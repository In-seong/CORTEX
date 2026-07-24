import { getDb } from '../../db'

export default defineEventHandler((event) => {
  const db = getDb()
  const query = getQuery(event)
  const projectId = query.project_id ? Number(query.project_id) : null
  const status = (query.status as string) || null

  let sql = `
    SELECT t.*, p.name as project_name, p.icon as project_icon
    FROM unified_todos t
    LEFT JOIN projects p ON t.project_id = p.id
    WHERE 1=1
  `
  const params: any[] = []

  if (status) {
    sql += ` AND t.status = ?`
    params.push(status)
  }

  if (projectId) {
    sql += ` AND (t.project_id = ? OR t.related_project_ids LIKE ?)`
    params.push(projectId, `%${projectId}%`)
  }

  sql += ` ORDER BY
    CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 WHEN 'low' THEN 3 END,
    t.created_at DESC`

  const todos = db.prepare(sql).all(...params)
  return todos
})
