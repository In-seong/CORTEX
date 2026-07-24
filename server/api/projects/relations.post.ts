import { getDb } from '../../db'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { source_id, target_id, relation_type = 'reference', label = '' } = body

  if (!source_id || !target_id) {
    throw createError({ statusCode: 400, message: 'source_id and target_id required' })
  }
  if (source_id === target_id) {
    throw createError({ statusCode: 400, message: 'cannot relate a project to itself' })
  }

  const db = getDb()

  const existing = db.prepare(
    'SELECT id FROM project_relations WHERE source_id = ? AND target_id = ? AND relation_type = ?'
  ).get(source_id, target_id, relation_type)

  if (existing) {
    throw createError({ statusCode: 409, message: 'relation already exists' })
  }

  const result = db.prepare(
    'INSERT INTO project_relations (source_id, target_id, relation_type, label, auto_detected, confirmed) VALUES (?, ?, ?, ?, 0, 1)'
  ).run(source_id, target_id, relation_type, label)

  return { id: result.lastInsertRowid }
})
