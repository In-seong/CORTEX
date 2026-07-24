import { getDb } from '../../db'

export default defineEventHandler((event) => {
  const id = getRouterParam(event, 'id')
  const db = getDb()

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id)
  if (!project) throw createError({ statusCode: 404, message: 'Project not found' })

  const relations = db.prepare(`
    SELECT pr.*,
      ps.name as source_name, ps.icon as source_icon, ps.path as source_path,
      pt.name as target_name, pt.icon as target_icon, pt.path as target_path
    FROM project_relations pr
    JOIN projects ps ON pr.source_id = ps.id
    JOIN projects pt ON pr.target_id = pt.id
    WHERE pr.source_id = ? OR pr.target_id = ?
  `).all(id, id)

  const memories = db.prepare(`
    SELECT * FROM unified_memory
    WHERE project_id = ? OR is_global = 1
    ORDER BY pinned DESC, updated_at DESC
  `).all(id)

  const todos = db.prepare(`
    SELECT * FROM unified_todos
    WHERE project_id = ? OR json_extract(related_project_ids, '$') LIKE ?
    ORDER BY
      CASE status WHEN 'pending' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END,
      priority DESC, created_at DESC
  `).all(id, `%${id}%`)

  const ideConfigs = db.prepare('SELECT * FROM ide_configs WHERE project_id = ?').all(id)
  const quickActions = db.prepare('SELECT * FROM quick_actions WHERE project_id = ? ORDER BY sort_order').all(id)

  return { project, relations, memories, todos, ideConfigs, quickActions }
})
