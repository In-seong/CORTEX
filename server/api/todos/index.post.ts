import { getDb } from '../../db'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const db = getDb()

  const { title, description, priority, project_id, related_project_ids, due_date } = body

  if (!title?.trim()) {
    throw createError({ statusCode: 400, message: 'title is required' })
  }

  let resolvedProjectId = project_id || null
  if (!resolvedProjectId && body.project_path) {
    const proj = db.prepare('SELECT id FROM projects WHERE path = ?').get(body.project_path) as any
    if (proj) resolvedProjectId = proj.id
  }

  const result = db.prepare(`
    INSERT INTO unified_todos (title, description, priority, project_id, related_project_ids, due_date)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    title.trim(),
    description?.trim() || '',
    priority || 'normal',
    resolvedProjectId,
    JSON.stringify(related_project_ids || []),
    due_date || null,
  )

  const todo = db.prepare('SELECT * FROM unified_todos WHERE id = ?').get(result.lastInsertRowid)
  return todo
})
