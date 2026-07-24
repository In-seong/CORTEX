import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync, readdirSync } from 'fs'
import { join } from 'path'
import { getDb } from '../../db'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { project_id } = body

  if (!project_id) {
    throw createError({ statusCode: 400, message: 'project_id required' })
  }

  const db = getDb()
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(project_id) as any
  if (!project) throw createError({ statusCode: 404, message: 'Project not found' })

  const relations = db.prepare(`
    SELECT pr.*,
      ps.name as source_name, ps.path as source_path, ps.category as source_category, ps.tech_stack as source_tech,
      pt.name as target_name, pt.path as target_path, pt.category as target_category, pt.tech_stack as target_tech
    FROM project_relations pr
    JOIN projects ps ON pr.source_id = ps.id
    JOIN projects pt ON pr.target_id = pt.id
    WHERE pr.source_id = ? OR pr.target_id = ?
  `).all(project_id, project_id) as any[]

  if (!existsSync(project.path)) {
    throw createError({ statusCode: 400, message: 'Project path does not exist' })
  }

  // === 1. Update CLAUDE.md ===
  const claudeMdPath = join(project.path, 'CLAUDE.md')
  let claudeContent = ''
  if (existsSync(claudeMdPath)) {
    claudeContent = readFileSync(claudeMdPath, 'utf-8')
  }

  const sectionMarkerStart = '<!-- SCOOP-BRAIN:RELATIONS:START -->'
  const sectionMarkerEnd = '<!-- SCOOP-BRAIN:RELATIONS:END -->'

  let relationsSection = ''
  if (relations.length > 0) {
    const lines = ['', sectionMarkerStart, '## 연관 프로젝트', '']
    lines.push('이 프로젝트와 연관된 다른 프로젝트들입니다. 작업 시 참고하세요.', '')
    lines.push('| 프로젝트 | 역할 | 경로 |')
    lines.push('|---------|------|------|')

    for (const rel of relations) {
      const isSource = rel.source_id === project_id
      const name = isSource ? rel.target_name : rel.source_name
      const path = isSource ? rel.target_path : rel.source_path
      const label = rel.label || name
      lines.push(`| ${name} | ${label} | \`${path}\` |`)
    }

    // note(지침)가 있는 관계는 상세 설명으로 추가
    const withNotes = relations.filter(r => (r.note || '').trim())
    if (withNotes.length) {
      lines.push('', '### 연관 프로젝트 지침')
      for (const rel of withNotes) {
        const isSource = rel.source_id === project_id
        const name = isSource ? rel.target_name : rel.source_name
        lines.push('', `**${name}** (${rel.label || '연관'}): ${rel.note.trim()}`)
      }
    }

    lines.push('', sectionMarkerEnd, '')
    relationsSection = lines.join('\n')
  }

  if (claudeContent.includes(sectionMarkerStart)) {
    const regex = new RegExp(`${sectionMarkerStart}[\\s\\S]*?${sectionMarkerEnd}`, 'm')
    if (relations.length > 0) {
      claudeContent = claudeContent.replace(regex, relationsSection.trim())
    } else {
      claudeContent = claudeContent.replace(new RegExp(`\\n?${sectionMarkerStart}[\\s\\S]*?${sectionMarkerEnd}\\n?`, 'm'), '')
    }
  } else if (relations.length > 0) {
    claudeContent = claudeContent.trimEnd() + '\n' + relationsSection
  }

  writeFileSync(claudeMdPath, claudeContent, 'utf-8')

  // === 2. Create/Update sub-agent files ===
  const agentsDir = join(project.path, '.claude', 'agents')
  if (!existsSync(agentsDir)) {
    mkdirSync(agentsDir, { recursive: true })
  }

  const existingAgentFiles = existsSync(agentsDir)
    ? readdirSync(agentsDir).filter(f => f.startsWith('_rel-'))
    : []

  const newAgentFiles = new Set<string>()

  for (const rel of relations) {
    const isSource = rel.source_id === project_id
    const name = isSource ? rel.target_name : rel.source_name
    const path = isSource ? rel.target_path : rel.source_path
    const category = isSource ? rel.target_category : rel.source_category
    const techStack = isSource ? rel.target_tech : rel.source_tech
    const label = rel.label || name
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    const filename = `_rel-${slug}.md`
    newAgentFiles.add(filename)

    let techList = ''
    try {
      const parsed = JSON.parse(techStack || '[]')
      if (Array.isArray(parsed)) techList = parsed.join(', ')
    } catch {
      techList = techStack || ''
    }

    const note = (rel.note || '').trim()
    // note를 description에도 일부 반영해 에이전트 자동 선택 정확도를 높임
    const descNote = note ? ` ${note.split('\n')[0].slice(0, 120)}` : ''

    const agentContent = `---
name: ${slug}
description: ${label} — ${name} 프로젝트. ${category} 카테고리.${techList ? ` 기술스택: ${techList}.` : ''}${descNote} 연관 프로젝트의 코드를 읽고 분석할 때 사용합니다.
tools: Read, Grep, Glob, Bash, LSP
---

# ${label} (${name})

**경로**: \`${path}\`
**카테고리**: ${category}
${techList ? `**기술 스택**: ${techList}` : ''}

## 담당 범위

이 에이전트는 연관 프로젝트 \`${name}\`의 코드를 탐색하고 분석하는 데 사용됩니다.
현재 프로젝트(${project.name})에서의 역할: **${label}**
${note ? `\n## 이 프로젝트와의 관계 지침\n\n${note}\n` : ''}
### 주요 경로
- **프로젝트 루트**: \`${path}\`
`

    writeFileSync(join(agentsDir, filename), agentContent, 'utf-8')
  }

  for (const oldFile of existingAgentFiles) {
    if (!newAgentFiles.has(oldFile)) {
      unlinkSync(join(agentsDir, oldFile))
    }
  }

  return {
    ok: true,
    claudeMdUpdated: true,
    agentsCreated: newAgentFiles.size,
    agentsRemoved: existingAgentFiles.filter(f => !newAgentFiles.has(f)).length,
  }
})
