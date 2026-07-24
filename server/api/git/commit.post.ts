import { execFileSync } from 'child_process'

function git(cwd: string, args: string[]): string {
  return execFileSync('git', ['-C', cwd, ...args], {
    encoding: 'utf-8', timeout: 120000, maxBuffer: 10 * 1024 * 1024,
  })
}

// { path, message, push? } — add -A → commit → (선택) push
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { path, message, push } = body
  if (!path?.startsWith('/Users/scoop') || !message?.trim()) {
    throw createError({ statusCode: 400, message: 'path and message required' })
  }

  const log: string[] = []
  try {
    git(path, ['add', '-A'])
    const out = git(path, ['commit', '-m', message.trim()])
    log.push(out.trim())

    if (push) {
      try {
        const pushOut = git(path, ['push'])
        log.push(pushOut.trim() || 'pushed')
      } catch (e: any) {
        // upstream 없으면 자동 설정 시도
        const branch = git(path, ['rev-parse', '--abbrev-ref', 'HEAD']).trim()
        try {
          log.push(git(path, ['push', '-u', 'origin', branch]).trim() || 'pushed (upstream 설정)')
        } catch (e2: any) {
          return { ok: true, committed: true, pushed: false, log, error: `push 실패: ${e2.message?.split('\n')[0]}` }
        }
      }
      return { ok: true, committed: true, pushed: true, log }
    }
    return { ok: true, committed: true, pushed: false, log }
  } catch (e: any) {
    throw createError({ statusCode: 400, message: e.message?.split('\n').slice(0, 2).join(' ') || 'commit 실패' })
  }
})
