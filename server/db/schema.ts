export const SCHEMA = `
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  path TEXT UNIQUE NOT NULL,
  category TEXT DEFAULT 'etc',
  tech_stack TEXT DEFAULT '[]',
  description TEXT DEFAULT '',
  icon TEXT DEFAULT '📁',
  color TEXT DEFAULT '#6366f1',
  has_claude_md INTEGER DEFAULT 0,
  has_claude_dir INTEGER DEFAULT 0,
  agents_count INTEGER DEFAULT 0,
  skills_count INTEGER DEFAULT 0,
  session_count INTEGER DEFAULT 0,
  session_size_mb REAL DEFAULT 0,
  memory_count INTEGER DEFAULT 0,
  git_branch TEXT DEFAULT '',
  git_dirty_count INTEGER DEFAULT 0,
  is_hidden INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 0,
  last_active_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS project_relations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL,
  target_id INTEGER NOT NULL,
  relation_type TEXT NOT NULL DEFAULT 'reference',
  label TEXT DEFAULT '',
  auto_detected INTEGER DEFAULT 0,
  confirmed INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (source_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (target_id) REFERENCES projects(id) ON DELETE CASCADE,
  UNIQUE(source_id, target_id, relation_type)
);

CREATE TABLE IF NOT EXISTS unified_memory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'note',
  tags TEXT DEFAULT '[]',
  project_id INTEGER,
  is_global INTEGER DEFAULT 0,
  pinned INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS unified_todos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT DEFAULT 'pending',
  priority TEXT DEFAULT 'normal',
  project_id INTEGER,
  related_project_ids TEXT DEFAULT '[]',
  due_date TEXT,
  completed_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  session_file TEXT,
  summary TEXT DEFAULT '',
  size_mb REAL DEFAULT 0,
  started_at TEXT DEFAULT (datetime('now')),
  ended_at TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ide_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  ide_type TEXT NOT NULL,
  label TEXT NOT NULL,
  path TEXT NOT NULL,
  icon TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS agent_status (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT UNIQUE NOT NULL,
  cwd TEXT NOT NULL,
  project_id INTEGER,
  state TEXT NOT NULL DEFAULT 'idle',
  last_event TEXT DEFAULT '',
  tool_name TEXT DEFAULT '',
  tool_input TEXT DEFAULT '',
  last_prompt TEXT DEFAULT '',
  last_message TEXT DEFAULT '',
  transcript_path TEXT DEFAULT '',
  unread INTEGER DEFAULT 0,
  started_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS automations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  prompt TEXT NOT NULL,
  schedule TEXT NOT NULL DEFAULT 'daily',
  run_time TEXT DEFAULT '09:00',
  enabled INTEGER DEFAULT 1,
  last_run_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS automation_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  automation_id INTEGER NOT NULL,
  status TEXT DEFAULT 'running',
  output TEXT DEFAULT '',
  started_at TEXT DEFAULT (datetime('now')),
  finished_at TEXT,
  FOREIGN KEY (automation_id) REFERENCES automations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT DEFAULT '',
  project_id INTEGER,
  session_id TEXT,
  read INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS usage_turns (
  dedupe_key TEXT PRIMARY KEY,
  session_id TEXT,
  day TEXT,
  ts TEXT,
  model TEXT,
  project_id INTEGER,
  cwd TEXT,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  cache_read_tokens INTEGER DEFAULT 0,
  cache_write_tokens INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_usage_turns_day ON usage_turns(day);
CREATE INDEX IF NOT EXISTS idx_usage_turns_project ON usage_turns(project_id);

CREATE TABLE IF NOT EXISTS scanned_files (
  path TEXT PRIMARY KEY,
  mtime_ms INTEGER,
  size INTEGER,
  scanned_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS meta_kv (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS quick_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  label TEXT NOT NULL,
  command TEXT NOT NULL,
  icon TEXT DEFAULT '▶',
  sort_order INTEGER DEFAULT 0,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
`;
