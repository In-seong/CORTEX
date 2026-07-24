import { getDb } from '../../db'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const body = await readBody(event)
  const db = getDb()

  const existing = db.prepare('SELECT * FROM unified_todos WHERE id = ?').get(id) as any
  if (!existing) {
    throw createError({ statusCode: 404, message: 'todo not found' })
  }

  const title = body.title?.trim() || existing.title
  const description = body.description !== undefined ? body.description : existing.description
  const status = body.status || existing.status
  const priority = body.priority || existing.priority
  const project_id = body.project_id !== undefined ? body.project_id : existing.project_id
  const related_project_ids = body.related_project_ids !== undefined
    ? JSON.stringify(body.related_project_ids)
    : existing.related_project_ids
  const due_date = body.due_date !== undefined ? body.due_date : existing.due_date
  const completed_at = status === 'completed' && existing.status !== 'completed'
    ? new Date().toISOString()
    : existing.completed_at

  db.prepare(`
    UPDATE unified_todos
    SET title = ?, description = ?, status = ?, priority = ?, project_id = ?,
        related_project_ids = ?, due_date = ?, completed_at = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(title, description, status, priority, project_id, related_project_ids, due_date, completed_at, id)

  return db.prepare('SELECT * FROM unified_todos WHERE id = ?').get(id)
})
