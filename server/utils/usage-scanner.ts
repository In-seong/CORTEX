import { readdirSync, readFileSync, statSync, existsSync } from 'fs'
import { join } from 'path'
import type Database from 'better-sqlite3'

// orca claude-usage 스캐너의 축약 이식판:
// ~/.claude/projects/**/*.jsonl 의 assistant 턴을 dedupe(messageId:requestId)하며 usage_turns에 적재.
// 파일별 mtime+size 캐시(scanned_files)로 증분 스캔.

const HOME = process.env.HOME || '/Users/scoop'
const PROJECTS_DIR = join(HOME, '.claude', 'projects')

// $/1M tokens: [input, output, cacheRead, cacheWrite]
// fable은 공식 단가 미공개 → opus 단가로 추정 (UI에 '추정치' 표기)
const MODEL_PRICING: Record<string, [number, number, number, number]> = {
  opus: [15, 75, 1.5, 18.75],
  fable: [15, 75, 1.5, 18.75],
  sonnet: [3, 15, 0.3, 3.75],
  haiku: [1, 5, 0.1, 1.25],
}

export function pricingFor(model: string): [number, number, number, number] | null {
  const m = model.toLowerCase()
  for (const key of Object.keys(MODEL_PRICING)) {
    if (m.includes(key)) return MODEL_PRICING[key]
  }
  return null
}

export function turnCost(row: { model: string; input_tokens: number; output_tokens: number; cache_read_tokens: number; cache_write_tokens: number }): number {
  const p = pricingFor(row.model || '')
  if (!p) return 0
  return (
    row.input_tokens * p[0] +
    row.output_tokens * p[1] +
    row.cache_read_tokens * p[2] +
    row.cache_write_tokens * p[3]
  ) / 1_000_000
}

function localDay(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('sv-SE') // YYYY-MM-DD (로컬 타임존)
  } catch {
    return iso.slice(0, 10)
  }
}

let scanning = false

export function isScanning() {
  return scanning
}

export function scanUsage(db: Database.Database): { files: number; skipped: number; turns: number } {
  if (scanning) return { files: 0, skipped: 0, turns: 0 }
  scanning = true
  try {
    return doScan(db)
  } finally {
    scanning = false
    db.prepare("INSERT INTO meta_kv (key, value) VALUES ('last_usage_scan', datetime('now')) ON CONFLICT(key) DO UPDATE SET value = datetime('now')").run()
  }
}

function doScan(db: Database.Database): { files: number; skipped: number; turns: number } {
  if (!existsSync(PROJECTS_DIR)) return { files: 0, skipped: 0, turns: 0 }

  const getScanned = db.prepare('SELECT mtime_ms, size FROM scanned_files WHERE path = ?')
  const upsertScanned = db.prepare(`
    INSERT INTO scanned_files (path, mtime_ms, size, scanned_at) VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(path) DO UPDATE SET mtime_ms = excluded.mtime_ms, size = excluded.size, scanned_at = datetime('now')
  `)
  const insertTurn = db.prepare(`
    INSERT OR IGNORE INTO usage_turns
      (dedupe_key, session_id, day, ts, model, project_id, cwd, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const findProject = db.prepare("SELECT id FROM projects WHERE ? = path OR ? LIKE path || '/%' ORDER BY LENGTH(path) DESC LIMIT 1")
  const projectCache = new Map<string, number | null>()

  function resolveProject(cwd: string): number | null {
    if (!cwd) return null
    if (projectCache.has(cwd)) return projectCache.get(cwd)!
    const p = findProject.get(cwd, cwd) as any
    const id = p ? p.id : null
    projectCache.set(cwd, id)
    return id
  }

  let files = 0, skipped = 0, turns = 0

  let dirs: string[] = []
  try {
    dirs = readdirSync(PROJECTS_DIR)
  } catch {
    return { files, skipped, turns }
  }

  for (const dir of dirs) {
    const dirPath = join(PROJECTS_DIR, dir)
    let entries: string[] = []
    try {
      if (!statSync(dirPath).isDirectory()) continue
      entries = readdirSync(dirPath).filter(f => f.endsWith('.jsonl'))
    } catch {
      continue
    }

    for (const f of entries) {
      const filePath = join(dirPath, f)
      let st
      try {
        st = statSync(filePath)
      } catch {
        continue
      }

      const prev = getScanned.get(filePath) as any
      if (prev && prev.mtime_ms === Math.floor(st.mtimeMs) && prev.size === st.size) {
        skipped++
        continue
      }

      let content: string
      try {
        content = readFileSync(filePath, 'utf-8')
      } catch {
        continue
      }

      const tx = db.transaction(() => {
        for (const line of content.split('\n')) {
          // 빠른 프리필터 (JSON.parse 비용 절약)
          if (!line || !line.includes('"type":"assistant"') || !line.includes('"usage"')) continue
          try {
            const j = JSON.parse(line)
            if (j.type !== 'assistant') continue
            const usage = j.message?.usage
            const model = j.message?.model
            if (!usage || !model || model.includes('synthetic')) continue

            const dedupeKey = `${j.message.id || j.uuid || ''}:${j.requestId || ''}`
            if (dedupeKey === ':') continue

            const r = insertTurn.run(
              dedupeKey,
              j.sessionId || '',
              localDay(j.timestamp || ''),
              j.timestamp || '',
              model,
              resolveProject(j.cwd || ''),
              j.cwd || '',
              usage.input_tokens || 0,
              usage.output_tokens || 0,
              usage.cache_read_input_tokens || 0,
              usage.cache_creation_input_tokens || 0,
            )
            if (r.changes > 0) turns++
          } catch {}
        }
        upsertScanned.run(filePath, Math.floor(st.mtimeMs), st.size)
      })
      tx()
      files++
    }
  }

  return { files, skipped, turns }
}
