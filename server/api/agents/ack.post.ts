import { getDb } from '../../db'

// unread 해제: 프로젝트 단위 또는 세션 단위
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const db = getDb()

  if (body.session_id) {
    db.prepare('UPDATE agent_status SET unread = 0 WHERE session_id = ?').run(body.session_id)
  } else if (body.project_id) {
    db.prepare('UPDATE agent_status SET unread = 0 WHERE project_id = ?').run(body.project_id)
  } else {
    throw createError({ statusCode: 400, message: 'session_id or project_id required' })
  }

  return { ok: true }
})
