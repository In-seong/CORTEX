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
