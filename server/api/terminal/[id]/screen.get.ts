import { getTerminal } from '../spawn.post'

// PTY 링버퍼의 최근 출력을 ANSI 제거한 plain 텍스트로 반환 + 입력 대기 프롬프트 감지.
// 채팅 뷰가 compact/resume/권한 같은 TUI 인터랙티브 프롬프트를 인지하는 용도.

function stripAnsi(s: string): string {
  return s
    // CSI, OSC, 기타 이스케이프 시퀀스 제거
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')
    .replace(/\x1b[@-Z\\-_]/g, '')
    .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '')
    .replace(/\x1b[=>]/g, '')
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '')
    .replace(/\r/g, '')
}

// 입력 대기(선택 프롬프트) 휴리스틱
const PROMPT_PATTERNS = [
  /Resume from summary/i,
  /Enter to confirm/i,
  /esc to (interrupt|cancel)/i,
  /Do you want to (proceed|continue)/i,
  /\(y\/n\)/i,
  /❯\s*\d\./,
  /^\s*\d\.\s+.+\n\s*\d\.\s+/m,
  /Don't ask me again/i,
  /계속하려면|선택하세요/,
]

export default defineEventHandler((event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'id required' })

  const session = getTerminal(id)
  if (!session) return { alive: false, text: '', needsInput: false }

  // 마지막 ~64KB 만 합쳐서 처리 (전체 링버퍼는 비쌈)
  let raw = ''
  for (let i = session.buffer.length - 1; i >= 0; i--) {
    raw = session.buffer[i].data + raw
    if (raw.length > 64 * 1024) break
  }

  const clean = stripAnsi(raw)
  // 의미 있는 마지막 라인들만
  const lines = clean.split('\n').map(l => l.replace(/\s+$/, ''))
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop()
  const tail = lines.slice(-25).join('\n').trim()

  const needsInput = PROMPT_PATTERNS.some(re => re.test(tail))

  return {
    alive: !session.exited,
    text: tail.slice(-3000),
    needsInput,
    seq: session.seq,
  }
})
