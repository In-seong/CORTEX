import { getDb } from '../../db'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { id } = body

  if (!id) {
    throw createError({ statusCode: 400, message: 'relation id required' })
  }

  const db = getDb()
  db.prepare('DELETE FROM project_relations WHERE id = ?').run(id)

  return { ok: true }
})
