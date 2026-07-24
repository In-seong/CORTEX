import { getDb } from '../../db'

// { all: true } 또는 { ids: number[] }
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const db = getDb()

  if (body?.all) {
    db.prepare('UPDATE notifications SET read = 1 WHERE read = 0').run()
  } else if (Array.isArray(body?.ids) && body.ids.length) {
    const stmt = db.prepare('UPDATE notifications SET read = 1 WHERE id = ?')
    for (const id of body.ids) stmt.run(Number(id))
  } else {
    throw createError({ statusCode: 400, message: 'all or ids required' })
  }

  return { ok: true }
})
