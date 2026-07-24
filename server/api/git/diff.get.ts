import { execFileSync } from 'child_process'
import { readFileSync, statSync } from 'fs'
import { join } from 'path'

function git(cwd: string, args: string[]): string {
  return execFileSync('git', ['-C', cwd, ...args], {
    encoding: 'utf-8', timeout: 30000, maxBuffer: 20 * 1024 * 1024,
  })
}

// ?path=<repo>&file=<상대경로> → unified diff. untracked 파일은 전체 추가로 합성.
export default defineEventHandler((event) => {
  const query = getQuery(event)
  const path = String(query.path || '')
  const file = String(query.file || '')
  if (!path || !path.startsWith('/Users/scoop') || !file || file.includes('..')) {
    throw createError({ statusCode: 400, message: 'valid path and file required' })
  }

  try {
    let diff = git(path, ['diff', 'HEAD', '--', file])
    if (!diff.trim()) {
      // 추적 중인 파일이 무변경이면 그대로 빈 diff 반환
      const tracked = git(path, ['ls-files', '--', file]).trim()
      if (tracked) return { diff: '', file }
      // untracked → 합성 diff (텍스트 파일만, 200KB 제한)
      const abs = join(path, file)
      const st = statSync(abs)
      if (st.size > 200 * 1024) return { diff: `(파일이 너무 큼: ${Math.round(st.size / 1024)}KB)`, file }
      const content = readFileSync(abs, 'utf-8')
      if (content.includes('\0')) return { diff: '(바이너리 파일)', file }
      const lines = content.split('\n')
      diff = [
        `diff --git a/${file} b/${file}`,
        'new file',
        `--- /dev/null`,
        `+++ b/${file}`,
        `@@ -0,0 +1,${lines.length} @@`,
        ...lines.map(l => '+' + l),
      ].join('\n')
    }
    // 안전 상한
    if (diff.length > 500 * 1024) diff = diff.slice(0, 500 * 1024) + '\n... (잘림)'
    return { diff, file }
  } catch (e: any) {
    throw createError({ statusCode: 400, message: e.message?.split('\n')[0] || 'git diff error' })
  }
})
