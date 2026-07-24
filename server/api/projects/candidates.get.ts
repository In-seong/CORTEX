import { getDb } from '../../db'

// 아직 등록(활성화)하지 않은 프로젝트 후보 목록 (+ 검색)
export default defineEventHandler((event) => {
  const db = getDb()
  const query = getQuery(event)
  const q = String(query.q || '').toLowerCase()

  let sql = 'SELECT id, name, path, category, icon, tech_stack, has_claude_md, session_count, git_dirty_count FROM projects WHERE is_active = 0'
  const params: any[] = []
  if (q) {
    sql += ' AND (LOWER(name) LIKE ? OR LOWER(path) LIKE ? OR LOWER(category) LIKE ?)'
    const like = `%${q}%`
    params.push(like, like, like)
  }
  sql += ' ORDER BY session_size_mb DESC, name ASC LIMIT 100'

  return db.prepare(sql).all(...params)
})
