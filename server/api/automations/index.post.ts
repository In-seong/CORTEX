import { getDb } from '../../db'

// { project_id, prompt, schedule: 'daily'|'hourly', run_time?: 'HH:MM' }
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { project_id, prompt, schedule, run_time } = body

  if (!project_id || !prompt?.trim()) {
    throw createError({ statusCode: 400, message: 'project_id and prompt required' })
  }
  if (schedule && !['daily', 'hourly'].includes(schedule)) {
    throw createError({ statusCode: 400, message: 'schedule must be daily or hourly' })
  }
  if (run_time && !/^\d{2}:\d{2}$/.test(run_time)) {
    throw createError({ statusCode: 400, message: 'run_time must be HH:MM' })
  }

  const db = getDb()
  const result = db.prepare(
    'INSERT INTO automations (project_id, prompt, schedule, run_time) VALUES (?, ?, ?, ?)'
  ).run(project_id, prompt.trim(), schedule || 'daily', run_time || '09:00')

  return db.prepare('SELECT * FROM automations WHERE id = ?').get(result.lastInsertRowid)
})
