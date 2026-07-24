import { getDb } from '../../db'

// ?since=<id> : id 이후 알림만 (재접속 catch-up). 없으면 최근 30개.
export default defineEventHandler((event) => {
  const db = getDb()
  const query = getQuery(event)
  const since = Number(query.since) || 0

  // 7일 지난 알림 정리
  db.prepare("DELETE FROM notifications WHERE julianday('now') - julianday(created_at) > 7").run()

  const items = since > 0
    ? db.prepare(`
        SELECT n.*, p.name as project_name, p.icon as project_icon FROM notifications n
        LEFT JOIN projects p ON n.project_id = p.id
        WHERE n.id > ? ORDER BY n.id DESC LIMIT 100
      `).all(since)
    : db.prepare(`
        SELECT n.*, p.name as project_name, p.icon as project_icon FROM notifications n
        LEFT JOIN projects p ON n.project_id = p.id
        ORDER BY n.id DESC LIMIT 30
      `).all()

  const unread = (db.prepare('SELECT COUNT(*) as c FROM notifications WHERE read = 0').get() as any).c
  const maxSeq = (db.prepare('SELECT COALESCE(MAX(id), 0) as m FROM notifications').get() as any).m

  return { items, unread, maxSeq }
})
