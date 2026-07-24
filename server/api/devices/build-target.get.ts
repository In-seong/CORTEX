import { getDb } from '../../db'
import { detectBuildTarget } from '../../utils/build-target'

// ?project_id= → 이 프로젝트가 지원하는 빌드 플랫폼 { android, ios, kind }
export default defineEventHandler((event) => {
  const query = getQuery(event)
  const projectId = Number(query.project_id)
  if (!projectId) throw createError({ statusCode: 400, message: 'project_id required' })

  const db = getDb()
  const project = db.prepare('SELECT path FROM projects WHERE id = ?').get(projectId) as any
  if (!project) throw createError({ statusCode: 404, message: 'Project not found' })

  return detectBuildTarget(project.path)
})
