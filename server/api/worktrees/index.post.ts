import { getDb } from '../../db'
import { addWorktree } from '../../utils/worktree'

// { project_id, name, base?, count? } — count>1이면 name-1..N 로 병렬 생성 (fan-out)
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { project_id, name, base } = body
  const count = Math.min(4, Math.max(1, Number(body.count) || 1))

  if (!project_id || !name?.trim()) {
    throw createError({ statusCode: 400, message: 'project_id and name required' })
  }

  const db = getDb()
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(project_id) as any
  if (!project) throw createError({ statusCode: 404, message: 'Project not found' })

  const created: { path: string; branch: string }[] = []
  const errors: string[] = []

  for (let i = 1; i <= count; i++) {
    const branch = count === 1 ? name.trim() : `${name.trim()}-${i}`
    try {
      created.push(addWorktree(project.path, branch, base || undefined))
    } catch (e: any) {
      errors.push(`${branch}: ${e.message?.split('\n')[0]}`)
    }
  }

  if (!created.length) {
    throw createError({ statusCode: 500, message: errors.join(' / ') || 'worktree 생성 실패' })
  }

  return { created, errors }
})
