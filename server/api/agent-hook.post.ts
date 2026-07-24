import { openSync, readSync, fstatSync, closeSync } from 'fs'
import { getDb } from '../db'

// Claude Code hook 페이로드를 상태 모델로 정규화해 agent_status에 upsert.
// 상태 모델(orca 방식): working | permission | waiting | done | idle
// 훅은 ~/.claude/cortex-hook.sh 가 127.0.0.1로만 POST (외부 노출 경로로는 호출되지 않는 전제)

function readLastAssistantText(path: string): string {
  try {
    const fd = openSync(path, 'r')
    const size = fstatSync(fd).size
    const len = Math.min(size, 256 * 1024)
    const buf = Buffer.alloc(len)
    readSync(fd, buf, 0, len, size - len)
    closeSync(fd)
    const lines = buf.toString('utf-8').split('\n').filter(Boolean)
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const j = JSON.parse(lines[i])
        if (j.type === 'assistant' && j.message?.content) {
          const c = j.message.content
          const text = Array.isArray(c)
            ? c.filter((x: any) => x.type === 'text').map((x: any) => x.text).join('\n')
            : typeof c === 'string' ? c : ''
          if (text.trim()) return text.trim().slice(0, 500)
        }
      } catch {}
    }
  } catch {}
  return ''
}

function toolInputPreview(toolName: string, input: any): string {
  if (!input || typeof input !== 'object') return ''
  // 툴별 대표 인자만 노출 (orca의 TOOL_INPUT_KEYS_BY_TOOL 축약판)
  const keys = ['command', 'file_path', 'path', 'pattern', 'url', 'description', 'prompt', 'query']
  for (const k of keys) {
    if (typeof input[k] === 'string' && input[k].trim()) return input[k].slice(0, 160)
  }
  try {
    return JSON.stringify(input).slice(0, 160)
  } catch {
    return ''
  }
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => null)
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, message: 'invalid payload' })
  }

  const sessionId = body.session_id
  const eventName = body.hook_event_name
  if (!sessionId || !eventName) {
    throw createError({ statusCode: 400, message: 'session_id and hook_event_name required' })
  }

  const db = getDb()
  const cwd = body.cwd || ''
  const transcriptPath = body.transcript_path || ''

  if (eventName === 'SessionEnd') {
    db.prepare('DELETE FROM agent_status WHERE session_id = ?').run(sessionId)
    return { ok: true }
  }

  // cwd → 프로젝트 귀속 (경로 완전일치 또는 하위 경로)
  let projectId: number | null = null
  if (cwd) {
    const proj = db.prepare(
      "SELECT id FROM projects WHERE ? = path OR ? LIKE path || '/%' ORDER BY LENGTH(path) DESC LIMIT 1"
    ).get(cwd, cwd) as any
    if (proj) projectId = proj.id
  }

  const fields: Record<string, any> = {
    state: null,
    tool_name: null,
    tool_input: null,
    last_prompt: null,
    last_message: null,
    unread: null,
  }

  switch (eventName) {
    case 'SessionStart':
      fields.state = 'idle'
      break
    case 'UserPromptSubmit':
      fields.state = 'working'
      fields.last_prompt = String(body.prompt || '').slice(0, 300)
      fields.unread = 0
      break
    case 'PreToolUse':
      fields.state = 'working'
      fields.tool_name = body.tool_name || ''
      fields.tool_input = toolInputPreview(body.tool_name, body.tool_input)
      break
    case 'Notification': {
      const msg = String(body.message || '')
      fields.state = /permission|권한/i.test(msg) ? 'permission' : 'waiting'
      fields.last_message = msg.slice(0, 300)
      break
    }
    case 'Stop':
      fields.state = 'done'
      fields.unread = 1
      fields.tool_name = ''
      fields.tool_input = ''
      if (transcriptPath) fields.last_message = readLastAssistantText(transcriptPath)
      break
    default:
      // 미지원 이벤트는 타임스탬프만 갱신
      break
  }

  const existing = db.prepare('SELECT id FROM agent_status WHERE session_id = ?').get(sessionId)

  if (!existing) {
    db.prepare(`
      INSERT INTO agent_status (session_id, cwd, project_id, state, last_event, tool_name, tool_input, last_prompt, last_message, transcript_path, unread)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sessionId, cwd, projectId,
      fields.state || 'idle', eventName,
      fields.tool_name || '', fields.tool_input || '',
      fields.last_prompt || '', fields.last_message || '',
      transcriptPath, fields.unread ?? 0,
    )
  } else {
    const sets: string[] = ["last_event = ?", "updated_at = datetime('now')"]
    const vals: any[] = [eventName]
    if (cwd) { sets.push('cwd = ?'); vals.push(cwd) }
    if (projectId !== null) { sets.push('project_id = ?'); vals.push(projectId) }
    if (transcriptPath) { sets.push('transcript_path = ?'); vals.push(transcriptPath) }
    for (const key of ['state', 'tool_name', 'tool_input', 'last_prompt', 'last_message', 'unread']) {
      if (fields[key] !== null && fields[key] !== undefined) {
        sets.push(`${key} = ?`)
        vals.push(fields[key])
      }
    }
    vals.push(sessionId)
    db.prepare(`UPDATE agent_status SET ${sets.join(', ')} WHERE session_id = ?`).run(...vals)
  }

  return { ok: true }
})
