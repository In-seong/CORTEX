import { getDb } from '../../db'
import { scanProjects, detectRelations } from '../../utils/scanner'

export default defineEventHandler(async () => {
  const db = getDb()
  const scanned = scanProjects()
  const relations = detectRelations(scanned)

  const upsertProject = db.prepare(`
    INSERT INTO projects (slug, name, path, category, tech_stack, description, icon, color,
      has_claude_md, has_claude_dir, agents_count, skills_count,
      session_count, session_size_mb, memory_count,
      git_branch, git_dirty_count, updated_at)
    VALUES (@slug, @name, @path, @category, @techStack, @description, @icon, @color,
      @hasClaudeMd, @hasClaudeDir, @agentsCount, @skillsCount,
      @sessionCount, @sessionSizeMb, @memoryCount,
      @gitBranch, @gitDirtyCount, datetime('now'))
    ON CONFLICT(path) DO UPDATE SET
      tech_stack = @techStack,
      has_claude_md = @hasClaudeMd,
      has_claude_dir = @hasClaudeDir,
      agents_count = @agentsCount,
      skills_count = @skillsCount,
      session_count = @sessionCount,
      session_size_mb = @sessionSizeMb,
      memory_count = @memoryCount,
      git_branch = @gitBranch,
      git_dirty_count = @gitDirtyCount,
      updated_at = datetime('now')
  `)

  const insertRelation = db.prepare(`
    INSERT OR IGNORE INTO project_relations (source_id, target_id, relation_type, label, auto_detected)
    VALUES (?, ?, ?, ?, 1)
  `)

  const transaction = db.transaction(() => {
    for (const p of scanned) {
      upsertProject.run({
        slug: p.slug,
        name: p.name,
        path: p.path,
        category: p.category,
        techStack: JSON.stringify(p.techStack),
        description: p.description,
        icon: p.icon,
        color: p.color,
        hasClaudeMd: p.hasClaudeMd ? 1 : 0,
        hasClaudeDir: p.hasClaudeDir ? 1 : 0,
        agentsCount: p.agentsCount,
        skillsCount: p.skillsCount,
        sessionCount: p.sessionCount,
        sessionSizeMb: p.sessionSizeMb,
        memoryCount: p.memoryCount,
        gitBranch: p.gitBranch,
        gitDirtyCount: p.gitDirtyCount,
      })
    }

    for (const r of relations) {
      const source = db.prepare('SELECT id FROM projects WHERE path = ?').get(r.sourcePath) as any
      const target = db.prepare('SELECT id FROM projects WHERE path = ?').get(r.targetPath) as any
      if (source && target) {
        insertRelation.run(source.id, target.id, r.relationType, r.label)
      }
    }
  })

  transaction()

  const count = (db.prepare('SELECT COUNT(*) as cnt FROM projects').get() as any).cnt
  const relCount = (db.prepare('SELECT COUNT(*) as cnt FROM project_relations').get() as any).cnt

  return { scanned: scanned.length, stored: count, relations: relCount }
})
