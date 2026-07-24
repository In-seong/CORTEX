import { getDb } from '../../db'

export default defineEventHandler((event) => {
  const id = Number(getRouterParam(event, 'id'))
  const db = getDb()

  const result = db.prepare('DELETE FROM unified_todos WHERE id = ?').run(id)
  if (result.changes === 0) {
    throw createError({ statusCode: 404, message: 'todo not found' })
  }

  return { success: true }
})
