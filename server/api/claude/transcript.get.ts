import { readdirSync, statSync, openSync, readSync, fstatSync, closeSync } from 'fs'
import { join } from 'path'
import { claudeProjectDir } from '../../utils/claude-paths'

// orca native-chat 조립기의 축약판:
// 프로젝트의 최신 transcript(.jsonl) tail을 파싱해 채팅 버블 목록으로 반환.
// ?cwd=<프로젝트 경로> — claude -c 가 잇는 세션 = 최신 mtime 파일

interface ChatTool { name: string; input: string }
interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
  tools: ChatTool[]
  ts: string
}

const TAIL_BYTES = 768 * 1024

function toolPreview(input: any): string {
  if (!input || typeof input !== 'object') return ''
  for (const k of ['command', 'file_path', 'path', 'pattern', 'url', 'description', 'query', 'prompt']) {
    if (typeof input[k] === 'string' && input[k].trim()) return input[k].slice(0, 100)
  }
  return ''
}

function extractText(content: any): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .filter((c: any) => c.type === 'text' && typeof c.text === 'string')
      .map((c: any) => c.text)
      .join('\n')
  }
  return ''
}

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const cwd = String(query.cwd || '')
  if (!cwd || !cwd.startsWith('/Users/scoop')) {
    throw createError({ statusCode: 400, message: 'valid cwd required' })
  }

  const dir = claudeProjectDir(cwd)

  // claude -c 는 이어받아도 새 .jsonl을 만들 수 있어, 최신 파일만 읽으면 과거 대화가 사라진다.
  // → 최근 mtime 상위 파일들을 모아 timestamp 순으로 병합하고 uuid로 dedupe.
  let files: { path: string; mtime: number }[] = []
  try {
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.jsonl')) continue
      const st = statSync(join(dir, f))
      files.push({ path: join(dir, f), mtime: st.mtimeMs })
    }
  } catch {
    return { messages: [], sessionId: null }
  }
  if (!files.length) return { messages: [], sessionId: null }

  files.sort((a, b) => b.mtime - a.mtime)
  const newestMtime = files[0].mtime
  // 가장 최근 파일 기준 6시간 이내에 수정된 파일들(최대 5개)만 병합 = 현재 작업 맥락
  const recent = files.filter(f => newestMtime - f.mtime < 6 * 3600 * 1000).slice(0, 5)

  const rawLines: string[] = []
  for (const f of recent.reverse()) { // 오래된 것부터
    try {
      const fd = openSync(f.path, 'r')
      const size = fstatSync(fd).size
      const len = Math.min(size, TAIL_BYTES)
      const buf = Buffer.alloc(len)
      readSync(fd, buf, 0, len, size - len)
      closeSync(fd)
      const fl = buf.toString('utf-8').split('\n')
      if (fl.length && size > TAIL_BYTES) fl.shift() // 잘린 첫 줄 버림
      rawLines.push(...fl)
    } catch {}
  }

  const messages: ChatMessage[] = []
  let sessionId: string | null = null
  const seenUuid = new Set<string>()

  for (const line of rawLines) {
    // uuid dedupe (파일 간 fork/이어받기로 중복될 수 있음)
    if (line.includes('"uuid"')) {
      const m = line.match(/"uuid":"([^"]+)"/)
      if (m) {
        if (seenUuid.has(m[1])) continue
        seenUuid.add(m[1])
      }
    }
    if (!line.trim()) continue
    let j: any
    try {
      j = JSON.parse(line)
    } catch {
      continue
    }
    if (j.isSidechain) continue // 서브에이전트 대화 제외
    if (j.sessionId) sessionId = j.sessionId

    if (j.type === 'user' && j.message?.content !== undefined) {
      const content = j.message.content
      // tool_result만 담긴 user 엔트리는 스킵
      if (Array.isArray(content) && content.every((c: any) => c.type === 'tool_result')) continue
      let text = extractText(content).trim()
      if (!text) continue
      // 슬래시 명령 메타 XML은 명령어만 표시
      const cmdMatch = text.match(/<command-name>([^<]+)<\/command-name>/)
      if (cmdMatch) text = cmdMatch[1]
      if (text.startsWith('<local-command-stdout>')) continue
      if (text.startsWith('[Request interrupted')) continue
      if (text.startsWith('This session is being continued')) continue
      if (text.startsWith('Caveat:')) continue
      if (j.isMeta) continue
      messages.push({ role: 'user', text: text.slice(0, 4000), tools: [], ts: j.timestamp || '' })
    } else if (j.type === 'assistant' && j.message?.content) {
      const text = extractText(j.message.content).trim()
      const tools: ChatTool[] = Array.isArray(j.message.content)
        ? j.message.content
            .filter((c: any) => c.type === 'tool_use')
            .map((c: any) => ({ name: c.name || '', input: toolPreview(c.input) }))
        : []
      if (!text && !tools.length) continue

      // 같은 턴의 연속 assistant 엔트리는 이전 버블에 병합
      const prev = messages[messages.length - 1]
      if (prev && prev.role === 'assistant') {
        if (text) prev.text = (prev.text ? prev.text + '\n\n' : '') + text.slice(0, 6000)
        prev.tools.push(...tools)
        prev.ts = j.timestamp || prev.ts
      } else {
        messages.push({ role: 'assistant', text: text.slice(0, 6000), tools, ts: j.timestamp || '' })
      }
    }
  }

  // 최근 80개 버블만
  return { messages: messages.slice(-80), sessionId }
})
