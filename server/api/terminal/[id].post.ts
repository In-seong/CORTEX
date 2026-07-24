import { getTerminal } from './spawn.post'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)

  if (!id) throw createError({ statusCode: 400, message: 'id required' })

  const term = getTerminal(id)
  if (!term) throw createError({ statusCode: 404, message: 'Terminal not found' })

  if (body.type === 'input' && body.data) {
    term.write(body.data)
  } else if (body.type === 'resize' && body.cols && body.rows) {
    term.resize(body.cols, body.rows)
  } else if (body.type === 'kill') {
    term.kill()
  }

  return { ok: true }
})
