import Database from 'better-sqlite3'
import { join } from 'path'
import { SCHEMA } from './schema'

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!db) {
    const dbPath = join(process.cwd(), 'scoop-brain.db')
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    db.exec(SCHEMA)

    const cols = db.prepare("PRAGMA table_info(projects)").all() as any[]
    if (!cols.some((c: any) => c.name === 'is_hidden')) {
      db.exec("ALTER TABLE projects ADD COLUMN is_hidden INTEGER DEFAULT 0")
    }
    if (!cols.some((c: any) => c.name === 'is_active')) {
      db.exec("ALTER TABLE projects ADD COLUMN is_active INTEGER DEFAULT 0")
      // 기존 사용자: 관계를 설정한(=의도적으로 연결한 작업 관계망) 프로젝트만 자동 등록,
      // 나머지는 후보로 두어 사용자가 골라 추가하게 한다.
      db.exec(`UPDATE projects SET is_active = 1 WHERE id IN (
        SELECT source_id FROM project_relations UNION SELECT target_id FROM project_relations
      )`)
    }
  }
  return db
}
