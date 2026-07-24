import { getDb } from '../../db'

// { enabled?: bool } — 토글 등
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const body = await readBody(event)
  const db = getDb()

  const existing = db.prepare('SELECT * FROM automations WHERE id = ?').get(id)
  if (!existing) throw createError({ statusCode: 404, message: 'not found' })

  if (body.enabled !== undefined) {
    db.prepare('UPDATE automations SET enabled = ? WHERE id = ?').run(body.enabled ? 1 : 0, id)
  }
  return db.prepare('SELECT * FROM automations WHERE id = ?').get(id)
})
