import { getDb } from '../../db'

// { ids: number[] } 또는 { id } — 프로젝트를 워크스페이스에 등록(활성화)
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const ids: number[] = Array.isArray(body?.ids) ? body.ids : body?.id ? [body.id] : []
  if (!ids.length) throw createError({ statusCode: 400, message: 'id or ids required' })

  const db = getDb()
  const active = Number(body?.active) === 0 ? 0 : 1 // 기본 활성화, active:0이면 해제
  const stmt = db.prepare('UPDATE projects SET is_active = ?, updated_at = datetime(\'now\') WHERE id = ?')
  const tx = db.transaction(() => { for (const id of ids) stmt.run(active, id) })
  tx()

  return { ok: true, count: ids.length, active }
})
