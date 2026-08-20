import { getTerminal } from './spawn.post'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)

  if (!id) throw createError({ statusCode: 400, message: 'id required' })

  const session = getTerminal(id)
  if (!session) throw createError({ statusCode: 404, message: 'Terminal not found' })

  if (body.type === 'ping') {
    return { ok: true, alive: !session.exited, seq: session.seq }
  }

  // 이미 종료된 세션에 write/resize/kill 하면 node-pty가 ioctl(EBADF)를 던진다 → 방어
  if (session.exited) return { ok: false, alive: false }

  try {
    if (body.type === 'input' && body.data) {
      session.pty.write(body.data)
    } else if (body.type === 'resize' && body.cols && body.rows) {
      session.pty.resize(body.cols, body.rows)
    } else if (body.type === 'kill') {
      session.pty.kill()
    }
  } catch {
    // 죽은 PTY 조작 등 — 조용히 무시 (요청 실패로 500 던지지 않음)
    return { ok: false, alive: false }
  }

  return { ok: true }
})
