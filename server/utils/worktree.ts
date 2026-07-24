import { execFileSync } from 'child_process'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'

// orca git/worktree.ts의 핵심 방어 로직 축약판:
// --no-track(behind 오표기 방지), base를 git config에 기록, 삭제 시 clean 검사 + 미머지 브랜치 보존(-d)

const HOME = process.env.HOME || '/Users/scoop'
const WORKTREE_ROOT = join(HOME, '.cortex-worktrees')

function git(repoPath: string, args: string[]): string {
  return execFileSync('git', ['-C', repoPath, ...args], {
    encoding: 'utf-8',
    timeout: 60000,
    maxBuffer: 10 * 1024 * 1024,
  })
}

export interface WorktreeInfo {
  path: string
  head: string
  branch: string
  isMain: boolean
  managed: boolean // CORTEX가 만든 worktree인지 (~/.cortex-worktrees 하위)
  dirty: number
}

export function listWorktrees(repoPath: string): WorktreeInfo[] {
  const out = git(repoPath, ['worktree', 'list', '--porcelain'])
  const result: WorktreeInfo[] = []
  let cur: Partial<WorktreeInfo> = {}

  for (const line of out.split('\n')) {
    if (line.startsWith('worktree ')) {
      cur = { path: line.slice(9) }
    } else if (line.startsWith('HEAD ')) {
      cur.head = line.slice(5, 13)
    } else if (line.startsWith('branch ')) {
      cur.branch = line.slice(7).replace('refs/heads/', '')
    } else if (line === '' && cur.path) {
      const isMain = cur.path === repoPath
      let dirty = 0
      try {
        const status = git(cur.path!, ['status', '--porcelain']).trim()
        dirty = status ? status.split('\n').length : 0
      } catch {}
      result.push({
        path: cur.path!,
        head: cur.head || '',
        branch: cur.branch || '(detached)',
        isMain,
        managed: cur.path!.startsWith(WORKTREE_ROOT),
        dirty,
      })
      cur = {}
    }
  }
  return result
}

export function currentBranch(repoPath: string): string {
  return git(repoPath, ['rev-parse', '--abbrev-ref', 'HEAD']).trim()
}

export function addWorktree(repoPath: string, branch: string, base?: string): { path: string; branch: string } {
  if (!/^[a-zA-Z0-9._\/-]+$/.test(branch)) {
    throw new Error(`잘못된 브랜치명: ${branch}`)
  }
  const baseBranch = base || currentBranch(repoPath)
  const repoName = repoPath.split('/').pop() || 'repo'
  const wtPath = join(WORKTREE_ROOT, repoName, branch.replace(/\//g, '-'))

  if (existsSync(wtPath)) {
    throw new Error(`이미 존재하는 worktree 경로: ${wtPath}`)
  }
  mkdirSync(join(WORKTREE_ROOT, repoName), { recursive: true })

  git(repoPath, ['worktree', 'add', '--no-track', '-b', branch, wtPath, baseBranch])
  try {
    git(repoPath, ['config', `branch.${branch}.base`, baseBranch])
  } catch {}

  return { path: wtPath, branch }
}

export function removeWorktree(repoPath: string, wtPath: string, force = false): { removed: boolean; preservedBranch: string | null } {
  const list = listWorktrees(repoPath)
  const wt = list.find(w => w.path === wtPath)
  if (!wt) throw new Error('worktree를 찾을 수 없습니다')
  if (wt.isMain) throw new Error('메인 worktree는 삭제할 수 없습니다')

  if (!force && wt.dirty > 0) {
    throw new Error(`미커밋 변경 ${wt.dirty}건 — 커밋하거나 force 삭제하세요`)
  }

  git(repoPath, ['worktree', 'remove', ...(force ? ['--force'] : []), wtPath])

  // 브랜치 정리: -d(안전 삭제)만 시도. 미머지 커밋이 있으면 브랜치는 보존한다.
  let preservedBranch: string | null = null
  if (wt.branch && wt.branch !== '(detached)') {
    try {
      git(repoPath, ['branch', '-d', wt.branch])
    } catch {
      preservedBranch = wt.branch
    }
  }

  return { removed: true, preservedBranch }
}
