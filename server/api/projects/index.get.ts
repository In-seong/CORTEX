import { getDb } from '../../db'

export default defineEventHandler((event) => {
  const db = getDb()
  const query = getQuery(event)
  const includeHidden = query.include_hidden === 'true'

  const hiddenFilter = includeHidden ? '' : 'WHERE p.is_hidden = 0'

  const projects = db.prepare(`
    SELECT p.*,
      (SELECT COUNT(*) FROM project_relations WHERE source_id = p.id OR target_id = p.id) as relation_count
    FROM projects p
    ${hiddenFilter}
    ORDER BY
      CASE WHEN p.git_dirty_count > 0 THEN 0 ELSE 1 END,
      p.session_size_mb DESC,
      p.name ASC
  `).all()
  return projects
})
