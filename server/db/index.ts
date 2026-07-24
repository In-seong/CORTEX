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
  }
  return db
}
