import { getDb } from '../../db'

export default defineEventHandler(() => {
  const db = getDb()
  return db.prepare(`
    SELECT pr.*,
      ps.name as source_name, ps.icon as source_icon, ps.color as source_color, ps.path as source_path, ps.category as source_category,
      pt.name as target_name, pt.icon as target_icon, pt.color as target_color, pt.path as target_path, pt.category as target_category
    FROM project_relations pr
    JOIN projects ps ON pr.source_id = ps.id
    JOIN projects pt ON pr.target_id = pt.id
    ORDER BY pr.created_at DESC
  `).all()
})
