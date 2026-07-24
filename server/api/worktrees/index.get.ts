import { getDb } from '../../db'
import { listWorktrees } from '../../utils/worktree'

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const projectId = Number(query.project_id)
  if (!projectId) throw createError({ statusCode: 400, message: 'project_id required' })

  const db = getDb()
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as any
  if (!project) throw createError({ statusCode: 404, message: 'Project not found' })

  try {
    return { worktrees: listWorktrees(project.path).filter(w => !w.isMain) }
  } catch (e: any) {
    // git repo가 아니거나 git 실패
    return { worktrees: [], error: e.message?.split('\n')[0] || 'git error' }
  }
})
