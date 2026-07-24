import { homedir } from 'os'
import { join } from 'path'

// Claude Code는 프로젝트 경로를 슬러그로 만들 때 영숫자가 아닌 모든 문자를 '-'로 바꾼다.
// 예: /Users/scoop/BusCall_App → -Users-scoop-BusCall-App (슬래시와 언더스코어 모두 '-')
export function claudeProjectSlug(cwd: string): string {
  return cwd.replace(/[^a-zA-Z0-9]/g, '-')
}

export function claudeProjectDir(cwd: string): string {
  return join(homedir(), '.claude', 'projects', claudeProjectSlug(cwd))
}
