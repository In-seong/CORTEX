import { getTerminal } from './spawn.post'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)

  if (!id) throw createError({ statusCode: 400, message: 'id required' })

  const session = getTerminal(id)
  if (!session) throw createError({ statusCode: 404, message: 'Terminal not found' })

  if (body.type === 'input' && body.data) {
    session.pty.write(body.data)
  } else if (body.type === 'resize' && body.cols && body.rows) {
    session.pty.resize(body.cols, body.rows)
  } else if (body.type === 'kill') {
    session.pty.kill()
  } else if (body.type === 'ping') {
    return { ok: true, alive: !session.exited, seq: session.seq }
  }

  return { ok: true }
})
