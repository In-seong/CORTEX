import { readdirSync, existsSync, readFileSync, statSync } from 'fs'
import { join, basename } from 'path'
import { execSync } from 'child_process'

const HOME = process.env.HOME || '/Users/scoop'
const IGNORE_DIRS = new Set([
  '.Trash', 'node_modules', '.git', '.nuxt', '.output', 'dist',
  'vendor', 'build', '.gradle', '.idea', 'Pods', '.cocoapods',
  'Library', 'Applications', 'Desktop', 'Documents', 'Downloads',
  'Movies', 'Music', 'Pictures', 'Public', '.cache', '.npm',
  '.nvm', '.oh-my-zsh', '.docker', '.gradle', '.m2', '.conda',
  '.anaconda', 'anaconda', '.local', '.config', '.ssh', '.gnupg',
  '.aws', '.vscode', '.vscode-shared', '.claude', '.claude.backup',
  'scoop-brain',
])

interface ScannedProject {
  slug: string
  name: string
  path: string
  category: string
  techStack: string[]
  description: string
  icon: string
  color: string
  hasClaudeMd: boolean
  hasClaudeDir: boolean
  agentsCount: number
  skillsCount: number
  sessionCount: number
  sessionSizeMb: number
  memoryCount: number
  gitBranch: string
  gitDirtyCount: number
}

const CATEGORY_MAP: Record<string, { category: string; icon: string; color: string }> = {
  mobiliteasy_coupang_web: { category: 'mobility', icon: '🚌', color: '#3b82f6' },
  mobiliteasy_web: { category: 'mobility', icon: '🚌', color: '#3b82f6' },
  Globalhana_web: { category: 'mobility', icon: '🏨', color: '#f97316' },
  mobil_web: { category: 'mobility', icon: '🚌', color: '#3b82f6' },
  mobil_eli_web: { category: 'mobility-lite', icon: '🚐', color: '#06b6d4' },
  mobil_jw_web: { category: 'mobility-lite', icon: '🚐', color: '#06b6d4' },
  mobil_amkor_web: { category: 'mobility-lite', icon: '🚐', color: '#06b6d4' },
  mobil_itcen_web: { category: 'mobility-lite', icon: '🚐', color: '#06b6d4' },
  mobil_pangyobiz_web: { category: 'mobility-lite', icon: '🚐', color: '#06b6d4' },
  mobil_gwangdong_web: { category: 'mobility-lite', icon: '🚐', color: '#06b6d4' },
  mobil_noluniverse_web: { category: 'mobility-lite', icon: '🚐', color: '#06b6d4' },
  mobil_openknowl_web: { category: 'mobility-lite', icon: '🚐', color: '#06b6d4' },
  mobil_manager: { category: 'mobility', icon: '📱', color: '#3b82f6' },
  mobiliteasy_admin: { category: 'mobility', icon: '⚙️', color: '#3b82f6' },
  webview_app_backend: { category: 'mobility-lite', icon: '🗄️', color: '#06b6d4' },
  MobilCustomer: { category: 'mobility', icon: '📱', color: '#3b82f6' },
  MobilDriver: { category: 'mobility', icon: '📱', color: '#3b82f6' },
  slowok: { category: 'education', icon: '📚', color: '#10b981' },
  MaeumOn: { category: 'insurance', icon: '💚', color: '#ec4899' },
  BusCall_WEB: { category: 'buscall', icon: '📞', color: '#14b8a6' },
  concede: { category: 'kiosk', icon: '⛳', color: '#22d3ee' },
  concede_code_backup_v2: { category: 'kiosk', icon: '⛳', color: '#22d3ee' },
  vchams: { category: 'church', icon: '⛪', color: '#eab308' },
  EasyChina: { category: 'travel', icon: '🇨🇳', color: '#ef4444' },
  bitgoeul_smart: { category: 'apartment', icon: '🏢', color: '#f59e0b' },
  'bitgoeul-smart': { category: 'apartment', icon: '🏢', color: '#f59e0b' },
  portfolio: { category: 'personal', icon: '🎨', color: '#8b5cf6' },
  autosimsa: { category: 'tool', icon: '🤖', color: '#a78bfa' },
  weatherask: { category: 'personal', icon: '🌤️', color: '#60a5fa' },
  revuplan: { category: 'marketing', icon: '📊', color: '#f472b6' },
  office_main: { category: 'office', icon: '🏢', color: '#94a3b8' },
  ERP_NEW: { category: 'erp', icon: '📋', color: '#ef4444' },
}

function detectTechStack(dirPath: string): string[] {
  const techs: string[] = []
  const has = (f: string) => existsSync(join(dirPath, f))

  if (has('package.json')) {
    try {
      const pkg = JSON.parse(readFileSync(join(dirPath, 'package.json'), 'utf-8'))
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies }
      if (allDeps.vue) techs.push('Vue')
      if (allDeps.react || allDeps['react-dom']) techs.push('React')
      if (allDeps.nuxt) techs.push('Nuxt')
      if (allDeps.next) techs.push('Next.js')
      if (allDeps.electron) techs.push('Electron')
      if (allDeps.typescript || has('tsconfig.json')) techs.push('TypeScript')
      if (allDeps.tailwindcss) techs.push('Tailwind')
      if (allDeps['@capacitor/core']) techs.push('Capacitor')
    } catch {}
  }
  if (has('composer.json')) techs.push('Laravel')
  if (has('pubspec.yaml')) techs.push('Flutter')
  if (has('build.gradle') || has('build.gradle.kts')) techs.push('Android')
  if (has('Podfile') || existsSync(join(dirPath, '*.xcworkspace'))) techs.push('iOS')
  if (has('Gemfile')) techs.push('Ruby')

  return techs
}

function getGitInfo(dirPath: string): { branch: string; dirtyCount: number } {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD 2>/dev/null', { cwd: dirPath }).toString().trim()
    const status = execSync('git status --porcelain 2>/dev/null', { cwd: dirPath }).toString().trim()
    const dirtyCount = status ? status.split('\n').length : 0
    return { branch, dirtyCount }
  } catch {
    return { branch: '', dirtyCount: 0 }
  }
}

function getClaudeSessionInfo(projectPath: string): { count: number; sizeMb: number } {
  const slug = projectPath.replace(/[^a-zA-Z0-9]/g, '-')
  const sessionDir = join(HOME, '.claude', 'projects', slug)
  if (!existsSync(sessionDir)) return { count: 0, sizeMb: 0 }

  try {
    const files = readdirSync(sessionDir).filter(f => f.endsWith('.jsonl'))
    let totalSize = 0
    for (const f of files) {
      try {
        totalSize += statSync(join(sessionDir, f)).size
      } catch {}
    }
    return { count: files.length, sizeMb: Math.round(totalSize / 1024 / 1024 * 10) / 10 }
  } catch {
    return { count: 0, sizeMb: 0 }
  }
}

function getMemoryCount(projectPath: string): number {
  const slug = projectPath.replace(/[^a-zA-Z0-9]/g, '-')
  const memDir = join(HOME, '.claude', 'projects', slug, 'memory')
  if (!existsSync(memDir)) return 0
  try {
    return readdirSync(memDir).filter(f => f.endsWith('.md')).length
  } catch {
    return 0
  }
}

function countAgents(dirPath: string): number {
  const agentsDir = join(dirPath, '.claude', 'agents')
  if (!existsSync(agentsDir)) return 0
  try {
    return readdirSync(agentsDir).filter(f => f.endsWith('.md')).length
  } catch {
    return 0
  }
}

function countSkills(dirPath: string): number {
  const skillsDir = join(dirPath, '.claude', 'skills')
  if (!existsSync(skillsDir)) return 0
  try {
    return readdirSync(skillsDir).filter(f => statSync(join(skillsDir, f)).isDirectory()).length
  } catch {
    return 0
  }
}

export function scanProjects(): ScannedProject[] {
  const projects: ScannedProject[] = []

  let dirs: string[]
  try {
    dirs = readdirSync(HOME)
  } catch {
    return []
  }

  for (const name of dirs) {
    if (name.startsWith('.') || IGNORE_DIRS.has(name)) continue
    const fullPath = join(HOME, name)

    try {
      if (!statSync(fullPath).isDirectory()) continue
    } catch {
      continue
    }

    const hasClaudeMd = existsSync(join(fullPath, 'CLAUDE.md'))
    const hasClaudeDir = existsSync(join(fullPath, '.claude'))
    const hasPackageJson = existsSync(join(fullPath, 'package.json'))
    const hasComposerJson = existsSync(join(fullPath, 'composer.json'))
    const hasPubspec = existsSync(join(fullPath, 'pubspec.yaml'))
    const hasGit = existsSync(join(fullPath, '.git'))

    if (!hasClaudeMd && !hasClaudeDir && !hasPackageJson && !hasComposerJson && !hasPubspec && !hasGit) {
      continue
    }

    const meta = CATEGORY_MAP[name] || { category: 'etc', icon: '📁', color: '#71717a' }
    const techStack = detectTechStack(fullPath)
    const gitInfo = getGitInfo(fullPath)
    const sessionInfo = getClaudeSessionInfo(fullPath)
    const memoryCount = getMemoryCount(fullPath)

    let description = ''
    if (hasClaudeMd) {
      try {
        const content = readFileSync(join(fullPath, 'CLAUDE.md'), 'utf-8')
        const overviewMatch = content.match(/## (?:Project )?Overview\n\n([^\n]+)/)
        if (overviewMatch) description = overviewMatch[1].slice(0, 200)
      } catch {}
    }

    projects.push({
      slug: name.toLowerCase().replace(/[^a-z0-9_-]/g, '_'),
      name,
      path: fullPath,
      category: meta.category,
      techStack,
      description,
      icon: meta.icon,
      color: meta.color,
      hasClaudeMd,
      hasClaudeDir,
      agentsCount: countAgents(fullPath),
      skillsCount: countSkills(fullPath),
      sessionCount: sessionInfo.count,
      sessionSizeMb: sessionInfo.sizeMb,
      memoryCount,
      gitBranch: gitInfo.branch,
      gitDirtyCount: gitInfo.dirtyCount,
    })
  }

  return projects.sort((a, b) => {
    if (a.sessionSizeMb !== b.sessionSizeMb) return b.sessionSizeMb - a.sessionSizeMb
    if (a.hasClaudeMd !== b.hasClaudeMd) return a.hasClaudeMd ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

export function detectRelations(projects: ScannedProject[]): Array<{
  sourcePath: string
  targetPath: string
  relationType: string
  label: string
}> {
  const relations: Array<{
    sourcePath: string
    targetPath: string
    relationType: string
    label: string
  }> = []
  const pathSet = new Set(projects.map(p => p.path))

  for (const project of projects) {
    const settingsPath = join(project.path, '.claude', 'settings.local.json')
    if (existsSync(settingsPath)) {
      try {
        const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'))
        const additionalDirs = settings?.permissions?.additionalDirectories || []
        for (const dir of additionalDirs) {
          if (pathSet.has(dir)) {
            relations.push({
              sourcePath: project.path,
              targetPath: dir,
              relationType: 'linked',
              label: 'additionalDirectory',
            })
          }
        }
      } catch {}
    }

    const claudeMdPath = join(project.path, 'CLAUDE.md')
    if (existsSync(claudeMdPath)) {
      try {
        const content = readFileSync(claudeMdPath, 'utf-8')
        const pathRefs = content.matchAll(/\/Users\/scoop\/([a-zA-Z0-9_-]+)/g)
        for (const match of pathRefs) {
          const refPath = join(HOME, match[1])
          if (pathSet.has(refPath) && refPath !== project.path) {
            relations.push({
              sourcePath: project.path,
              targetPath: refPath,
              relationType: 'reference',
              label: 'CLAUDE.md 참조',
            })
          }
        }
      } catch {}
    }

    const agentsDir = join(project.path, '.claude', 'agents')
    if (existsSync(agentsDir)) {
      try {
        for (const f of readdirSync(agentsDir)) {
          const content = readFileSync(join(agentsDir, f), 'utf-8')
          const pathRefs = content.matchAll(/\/Users\/scoop\/([a-zA-Z0-9_-]+)/g)
          for (const match of pathRefs) {
            const refPath = join(HOME, match[1])
            if (pathSet.has(refPath) && refPath !== project.path) {
              relations.push({
                sourcePath: project.path,
                targetPath: refPath,
                relationType: 'agent-ref',
                label: `에이전트(${basename(f, '.md')}) 참조`,
              })
            }
          }
        }
      } catch {}
    }
  }

  const unique = new Map<string, typeof relations[0]>()
  for (const r of relations) {
    const key = `${r.sourcePath}|${r.targetPath}|${r.relationType}`
    if (!unique.has(key)) unique.set(key, r)
  }

  return Array.from(unique.values())
}
