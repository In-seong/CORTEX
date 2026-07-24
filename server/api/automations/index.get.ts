import { getDb } from '../../db'

// ?project_id=<id> (선택) — 자동화 목록 + 최근 실행
export default defineEventHandler((event) => {
  const db = getDb()
  const query = getQuery(event)
  const projectId = query.project_id ? Number(query.project_id) : null

  const automations = (projectId
    ? db.prepare(`
        SELECT a.*, p.name as project_name, p.icon as project_icon FROM automations a
        JOIN projects p ON a.project_id = p.id WHERE a.project_id = ? ORDER BY a.id DESC
      `).all(projectId)
    : db.prepare(`
        SELECT a.*, p.name as project_name, p.icon as project_icon FROM automations a
        JOIN projects p ON a.project_id = p.id ORDER BY a.id DESC
      `).all()) as any[]

  for (const a of automations) {
    a.lastRun = db.prepare(
      'SELECT id, status, started_at, finished_at, SUBSTR(output, 1, 500) as output FROM automation_runs WHERE automation_id = ? ORDER BY id DESC LIMIT 1'
    ).get(a.id) || null
  }

  return automations
})
