import { getDb } from '../../db'

// { id, label?, note? } — 기존 관계의 역할/지침 메모 편집
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { id } = body
  if (!id) throw createError({ statusCode: 400, message: 'relation id required' })

  const db = getDb()
  const existing = db.prepare('SELECT * FROM project_relations WHERE id = ?').get(id) as any
  if (!existing) throw createError({ statusCode: 404, message: 'relation not found' })

  const label = body.label !== undefined ? body.label : existing.label
  const note = body.note !== undefined ? body.note : existing.note

  db.prepare('UPDATE project_relations SET label = ?, note = ? WHERE id = ?').run(label, note, id)
  return { ok: true }
})
