import { execFile } from 'child_process'
import type Database from 'better-sqlite3'

// orca automations의 축약판: 예약된 프롬프트를 프로젝트 디렉토리에서 claude -p로 실행.
// due 판정: hourly = 마지막 실행 후 60분 경과 / daily = 오늘 run_time 지났고 오늘 아직 안 돌았음

let running = false

export function isAutomationRunning() {
  return running
}

export async function runAutomation(db: Database.Database, automation: any, trigger: 'scheduled' | 'manual'): Promise<number> {
  const runId = db.prepare(
    "INSERT INTO automation_runs (automation_id, status) VALUES (?, 'running')"
  ).run(automation.id).lastInsertRowid as number

  db.prepare("UPDATE automations SET last_run_at = datetime('now') WHERE id = ?").run(automation.id)

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(automation.project_id) as any
  if (!project) {
    db.prepare("UPDATE automation_runs SET status = 'failed', output = '프로젝트 없음', finished_at = datetime('now') WHERE id = ?").run(runId)
    return runId
  }

  running = true
  try {
    const output = await new Promise<string>((resolve, reject) => {
      execFile('/Users/scoop/.local/bin/claude', ['-p', '--output-format', 'text', automation.prompt], {
        cwd: project.path,
        timeout: 20 * 60 * 1000, // 20분 상한
        maxBuffer: 2 * 1024 * 1024,
        env: { ...process.env, FORCE_COLOR: '0' },
      }, (err, stdout, stderr) => {
        if (err) reject(new Error(`${err.message?.split('\n')[0]}\n${(stderr || '').slice(0, 500)}`))
        else resolve(stdout)
      })
    })

    db.prepare("UPDATE automation_runs SET status = 'done', output = ?, finished_at = datetime('now') WHERE id = ?")
      .run(output.slice(0, 100 * 1024), runId)
    db.prepare('INSERT INTO notifications (type, title, body, project_id) VALUES (?, ?, ?, ?)')
      .run('done', `🤖 [자동화] ${project.name} 실행 완료`, output.trim().slice(0, 200), project.id)
  } catch (e: any) {
    db.prepare("UPDATE automation_runs SET status = 'failed', output = ?, finished_at = datetime('now') WHERE id = ?")
      .run(String(e.message || e).slice(0, 10000), runId)
    db.prepare('INSERT INTO notifications (type, title, body, project_id) VALUES (?, ?, ?, ?)')
      .run('waiting', `⚠️ [자동화] ${project.name} 실행 실패`, String(e.message || '').slice(0, 200), project.id)
  } finally {
    running = false
  }
  return runId
}

export function evaluateDueAutomations(db: Database.Database) {
  if (running) return // 한 번에 하나만 (claude 세션 부하 방지)

  const now = new Date()
  const hhmm = now.toTimeString().slice(0, 5)
  const today = now.toLocaleDateString('sv-SE')

  const candidates = db.prepare('SELECT * FROM automations WHERE enabled = 1').all() as any[]

  for (const a of candidates) {
    let due = false
    if (a.schedule === 'hourly') {
      due = !a.last_run_at ||
        (db.prepare("SELECT (julianday('now') - julianday(?)) * 1440 as m").get(a.last_run_at) as any).m >= 60
    } else {
      // daily: run_time 지났고, 오늘 아직 안 돌았음 (last_run_at은 UTC 저장 → localtime 변환 비교)
      const ranToday = a.last_run_at
        ? (db.prepare("SELECT date(?, 'localtime') = date('now', 'localtime') as t").get(a.last_run_at) as any).t === 1
        : false
      due = hhmm >= (a.run_time || '09:00') && !ranToday
    }
    if (due) {
      runAutomation(db, a, 'scheduled').catch(e => console.error('[automation]', e))
      return // 이번 tick엔 하나만 시작
    }
  }
}
