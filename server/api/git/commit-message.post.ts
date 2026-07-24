import { execFileSync, execFile } from 'child_process'

// { path } → claude -p 로 커밋 메시지 생성 (orca의 AI commit message)
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { path } = body
  if (!path?.startsWith('/Users/scoop')) {
    throw createError({ statusCode: 400, message: 'path required' })
  }

  let diff = ''
  try {
    execFileSync('git', ['-C', path, 'add', '-N', '.'], { timeout: 15000 }) // untracked도 diff에 포함
    diff = execFileSync('git', ['-C', path, 'diff', 'HEAD'], {
      encoding: 'utf-8', timeout: 30000, maxBuffer: 20 * 1024 * 1024,
    })
  } catch (e: any) {
    throw createError({ statusCode: 400, message: 'git diff 실패' })
  }

  if (!diff.trim()) return { message: '', empty: true }
  if (diff.length > 12000) diff = diff.slice(0, 12000) + '\n... (이하 생략)'

  const prompt = `다음 git diff를 보고 한국어 커밋 메시지를 작성해줘. 첫 줄은 50자 이내 요약, 필요하면 빈 줄 후 상세 불릿 2-4개. 커밋 메시지 텍스트만 출력하고 다른 말은 하지 마.\n\n${diff}`

  const message = await new Promise<string>((resolve, reject) => {
    execFile('/Users/scoop/.local/bin/claude', ['-p', '--output-format', 'text', prompt], {
      cwd: path,
      timeout: 90000,
      maxBuffer: 1024 * 1024,
      env: { ...process.env, FORCE_COLOR: '0' },
    }, (err, stdout) => {
      if (err) reject(err)
      else resolve(stdout.trim())
    })
  }).catch((e) => {
    throw createError({ statusCode: 500, message: `claude 실행 실패: ${e.message?.split('\n')[0]}` })
  })

  return { message }
})
