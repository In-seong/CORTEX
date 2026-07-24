import { getDb } from '../../db'
import { scanUsage, isScanning, turnCost } from '../../utils/usage-scanner'

// ?days=7|30|90 — 사용량 요약. 마지막 스캔 5분 경과 시 백그라운드 재스캔.
export default defineEventHandler((event) => {
  const db = getDb()
  const query = getQuery(event)
  const days = Math.min(365, Math.max(1, Number(query.days) || 30))

  const last = db.prepare("SELECT value FROM meta_kv WHERE key = 'last_usage_scan'").get() as any
  const staleSec = last
    ? (db.prepare("SELECT (julianday('now') - julianday(?)) * 86400 as s").get(last.value) as any).s
    : Infinity

  if (staleSec > 300 && !isScanning()) {
    // 첫 스캔은 수십 초 걸릴 수 있어 요청을 막지 않는다
    setImmediate(() => {
      try { scanUsage(db) } catch (e) { console.error('[usage-scan]', e) }
    })
  }

  const since = new Date(Date.now() - days * 86400000).toLocaleDateString('sv-SE')

  const rows = db.prepare(`
    SELECT model, day, project_id, cwd,
      SUM(input_tokens) as input_tokens, SUM(output_tokens) as output_tokens,
      SUM(cache_read_tokens) as cache_read_tokens, SUM(cache_write_tokens) as cache_write_tokens,
      COUNT(*) as turns
    FROM usage_turns WHERE day >= ?
    GROUP BY model, day, project_id
  `).all(since) as any[]

  const totals = { cost: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, turns: 0 }
  const dailyMap = new Map<string, { day: string; cost: number; output: number; turns: number }>()
  const modelMap = new Map<string, { model: string; cost: number; turns: number; output: number }>()
  const projectMap = new Map<string, { key: string; project_id: number | null; cost: number; turns: number }>()

  for (const r of rows) {
    const cost = turnCost(r)
    totals.cost += cost
    totals.input += r.input_tokens
    totals.output += r.output_tokens
    totals.cacheRead += r.cache_read_tokens
    totals.cacheWrite += r.cache_write_tokens
    totals.turns += r.turns

    const d = dailyMap.get(r.day) || { day: r.day, cost: 0, output: 0, turns: 0 }
    d.cost += cost; d.output += r.output_tokens; d.turns += r.turns
    dailyMap.set(r.day, d)

    const shortModel = r.model.replace(/^claude-/, '').replace(/-\d{8}$/, '')
    const m = modelMap.get(shortModel) || { model: shortModel, cost: 0, turns: 0, output: 0 }
    m.cost += cost; m.turns += r.turns; m.output += r.output_tokens
    modelMap.set(shortModel, m)

    const pkey = r.project_id ? `p${r.project_id}` : (r.cwd?.split('/').slice(0, 4).join('/') || 'unknown')
    const p = projectMap.get(pkey) || { key: pkey, project_id: r.project_id, cost: 0, turns: 0 }
    p.cost += cost; p.turns += r.turns
    projectMap.set(pkey, p)
  }

  // 프로젝트 이름 매핑
  const projects = new Map<number, any>(
    (db.prepare('SELECT id, name, icon FROM projects').all() as any[]).map(p => [p.id, p])
  )
  const byProject = Array.from(projectMap.values())
    .map(p => ({
      ...p,
      name: p.project_id ? projects.get(p.project_id)?.name || '(삭제됨)' : p.key.split('/').pop(),
      icon: p.project_id ? projects.get(p.project_id)?.icon || '📁' : '📁',
    }))
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 8)

  // 일자 빈칸 채우기 (최근 N일 연속)
  const daily: any[] = []
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(Date.now() - i * 86400000).toLocaleDateString('sv-SE')
    daily.push(dailyMap.get(day) || { day, cost: 0, output: 0, turns: 0 })
  }

  return {
    scanning: isScanning(),
    lastScan: last?.value || null,
    days,
    totals,
    daily,
    byModel: Array.from(modelMap.values()).sort((a, b) => b.cost - a.cost),
    byProject,
  }
})
