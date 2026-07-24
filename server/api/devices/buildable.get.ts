import { getDb } from '../../db'
import { detectBuildTarget } from '../../utils/build-target'

// ?project_id= → 자신 + 관계로 연결된(하위 등) 프로젝트 중 빌드 가능한 앱 목록.
// 모체(웹)에서도 하위 앱들을 찾아 폰에 빌드할 수 있게.
export default defineEventHandler((event) => {
  const query = getQuery(event)
  const projectId = Number(query.project_id)
  if (!projectId) throw createError({ statusCode: 400, message: 'project_id required' })

  const db = getDb()
  const self = db.prepare('SELECT id, name, icon, path FROM projects WHERE id = ?').get(projectId) as any
  if (!self) throw createError({ statusCode: 404, message: 'Project not found' })

  // 관계로 연결된 프로젝트 (양방향)
  const related = db.prepare(`
    SELECT p.id, p.name, p.icon, p.path,
      CASE WHEN pr.source_id = ? THEN pr.relation_type ELSE 'parent' END as rel,
      pr.label
    FROM project_relations pr
    JOIN projects p ON p.id = (CASE WHEN pr.source_id = ? THEN pr.target_id ELSE pr.source_id END)
    WHERE pr.source_id = ? OR pr.target_id = ?
  `).all(projectId, projectId, projectId, projectId) as any[]

  const seen = new Set<number>()
  const candidates = [{ ...self, rel: 'self', label: '' }, ...related].filter(p => {
    if (seen.has(p.id)) return false
    seen.add(p.id)
    return true
  })

  const apps: any[] = []
  for (const p of candidates) {
    const t = detectBuildTarget(p.path)
    if (!t.android && !t.ios) continue
    apps.push({
      id: p.id,
      name: p.name,
      icon: p.icon,
      path: p.path,
      label: p.label || '',
      rel: p.rel, // self | child | parent | related | reference | linked ...
      kind: t.kind,
      android: t.android,
      ios: t.ios,
      iosNested: t.iosNested,
    })
  }

  // self 먼저, 그다음 하위(child), 나머지
  const order: Record<string, number> = { self: 0, child: 1, related: 2, parent: 3 }
  apps.sort((a, b) => (order[a.rel] ?? 5) - (order[b.rel] ?? 5))

  return { apps }
})
