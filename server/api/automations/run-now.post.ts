import { getDb } from '../../db'
import { runAutomation, isAutomationRunning } from '../../utils/automation-runner'

// { id } — 즉시 실행 (백그라운드, 완료 시 알림 생성)
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const id = Number(body?.id)
  if (!id) throw createError({ statusCode: 400, message: 'id required' })

  const db = getDb()
  const automation = db.prepare('SELECT * FROM automations WHERE id = ?').get(id)
  if (!automation) throw createError({ statusCode: 404, message: 'not found' })
  if (isAutomationRunning()) {
    throw createError({ statusCode: 409, message: '다른 자동화가 실행 중입니다' })
  }

  runAutomation(db, automation, 'manual').catch(e => console.error('[automation-manual]', e))
  return { ok: true, started: true }
})
