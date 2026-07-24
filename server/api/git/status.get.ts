import { execFileSync } from 'child_process'

function git(cwd: string, args: string[]): string {
  return execFileSync('git', ['-C', cwd, ...args], {
    encoding: 'utf-8', timeout: 30000, maxBuffer: 10 * 1024 * 1024,
  })
}

// ?path=<repo or worktree path> → 브랜치 + 변경 파일 목록
export default defineEventHandler((event) => {
  const query = getQuery(event)
  const path = String(query.path || '')
  if (!path || !path.startsWith('/Users/scoop')) {
    throw createError({ statusCode: 400, message: 'valid path required' })
  }

  try {
    const branch = git(path, ['rev-parse', '--abbrev-ref', 'HEAD']).trim()
    const porcelain = git(path, ['status', '--porcelain']).trimEnd()

    const files = porcelain
      ? porcelain.split('\n').map(line => ({
          status: line.slice(0, 2).trim() || '??',
          path: line.slice(3).replace(/^"|"$/g, ''),
          untracked: line.startsWith('??'),
        }))
      : []

    let ahead = 0, behind = 0
    try {
      const ab = git(path, ['rev-list', '--left-right', '--count', '@{upstream}...HEAD']).trim().split('\t')
      behind = Number(ab[0]) || 0
      ahead = Number(ab[1]) || 0
    } catch {} // upstream 없음

    return { branch, files, ahead, behind }
  } catch (e: any) {
    throw createError({ statusCode: 400, message: e.message?.split('\n')[0] || 'git error' })
  }
})
