import { getDb } from '../../db'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)
  const db = getDb()

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id)
  if (!project) {
    throw createError({ statusCode: 404, message: 'Project not found' })
  }

  const updates: string[] = []
  const values: any[] = []

  if (body.category !== undefined) {
    updates.push('category = ?')
    values.push(body.category)
  }
  if (body.is_hidden !== undefined) {
    updates.push('is_hidden = ?')
    values.push(body.is_hidden ? 1 : 0)
  }
  if (body.name !== undefined) {
    updates.push('name = ?')
    values.push(body.name)
  }
  if (body.icon !== undefined) {
    updates.push('icon = ?')
    values.push(body.icon)
  }

  if (updates.length === 0) {
    return { ok: true, message: 'Nothing to update' }
  }

  updates.push("updated_at = datetime('now')")
  values.push(id)

  db.prepare(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`).run(...values)

  return { ok: true }
})
