import { killByCwd } from './spawn.post'

// 워크스페이스 탭을 닫을 때 해당 프로젝트의 모든 PTY 정리 (좀비 방지)
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  if (!body?.cwd) throw createError({ statusCode: 400, message: 'cwd required' })
  return { ok: true, killed: killByCwd(body.cwd) }
})
