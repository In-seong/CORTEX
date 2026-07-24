import { getDb } from '../../db'

export default defineEventHandler(() => {
  const db = getDb()

  const totalProjects = (db.prepare('SELECT COUNT(*) as cnt FROM projects').get() as any).cnt
  const claudeProjects = (db.prepare('SELECT COUNT(*) as cnt FROM projects WHERE has_claude_md = 1').get() as any).cnt
  const totalRelations = (db.prepare('SELECT COUNT(*) as cnt FROM project_relations').get() as any).cnt
  const totalMemory = (db.prepare('SELECT COUNT(*) as cnt FROM unified_memory').get() as any).cnt
  const pendingTodos = (db.prepare("SELECT COUNT(*) as cnt FROM unified_todos WHERE status = 'pending'").get() as any).cnt
  const dirtyProjects = (db.prepare('SELECT COUNT(*) as cnt FROM projects WHERE git_dirty_count > 0').get() as any).cnt
  const totalSessions = (db.prepare('SELECT SUM(session_count) as cnt FROM projects').get() as any).cnt || 0
  const totalSessionMb = (db.prepare('SELECT SUM(session_size_mb) as total FROM projects').get() as any).total || 0

  const topProjects = db.prepare(`
    SELECT name, icon, color, session_size_mb, git_dirty_count, category
    FROM projects ORDER BY session_size_mb DESC LIMIT 8
  `).all()

  const categories = db.prepare(`
    SELECT category, COUNT(*) as count, SUM(session_size_mb) as total_sessions
    FROM projects GROUP BY category ORDER BY total_sessions DESC
  `).all()

  return {
    totalProjects,
    claudeProjects,
    totalRelations,
    totalMemory,
    pendingTodos,
    dirtyProjects,
    totalSessions,
    totalSessionMb: Math.round(totalSessionMb),
    topProjects,
    categories,
  }
})
