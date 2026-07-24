import { getDb } from '../../db'

// 현재 에이전트 세션 목록 (12시간 내 활동만).
// stale: working 상태로 30분 이상 무소식 → hook 유실/크래시로 간주하고 클라이언트에서 흐리게 표시
export default defineEventHandler(() => {
  const db = getDb()

  db.prepare("DELETE FROM agent_status WHERE julianday('now') - julianday(updated_at) > 0.5").run()

  return db.prepare(`
    SELECT a.*,
      p.name as project_name, p.icon as project_icon,
      CAST((julianday('now') - julianday(a.updated_at)) * 86400 AS INTEGER) as age_sec,
      CASE WHEN a.state = 'working' AND (julianday('now') - julianday(a.updated_at)) * 86400 > 1800
        THEN 1 ELSE 0 END as stale
    FROM agent_status a
    LEFT JOIN projects p ON a.project_id = p.id
    ORDER BY a.updated_at DESC
  `).all()
})
