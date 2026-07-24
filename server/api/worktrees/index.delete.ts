import { getDb } from '../../db'
import { removeWorktree } from '../../utils/worktree'
import { killByCwd } from '../terminal/spawn.post'

// { project_id, path, force? }
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { project_id, path, force } = body

  if (!project_id || !path) {
    throw createError({ statusCode: 400, message: 'project_id and path required' })
  }

  const db = getDb()
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(project_id) as any
  if (!project) throw createError({ statusCode: 404, message: 'Project not found' })

  killByCwd(path) // 해당 worktree에서 도는 터미널 먼저 정리

  try {
    return { ok: true, ...removeWorktree(project.path, path, !!force) }
  } catch (e: any) {
    throw createError({ statusCode: 400, message: e.message?.split('\n')[0] || 'worktree 삭제 실패' })
  }
})
