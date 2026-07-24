import { getDb } from '../../db'
import { findAdb } from './index.get'
import { detectBuildTarget } from '../../utils/build-target'

// { project_id, platform: 'android'|'ios', device_id }
// → 프로젝트 타입에 맞는 빌드·실행 명령 생성. 실행은 클라이언트가 터미널 탭으로.
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { project_id, platform, device_id } = body
  if (!project_id || !platform || !device_id) {
    throw createError({ statusCode: 400, message: 'project_id, platform, device_id required' })
  }

  const db = getDb()
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(project_id) as any
  if (!project) throw createError({ statusCode: 404, message: 'Project not found' })

  const root = project.path
  const target = detectBuildTarget(root)

  if (platform === 'android' && !target.android) {
    return { command: null, kind: target.kind, message: '이 프로젝트는 Android 빌드 대상이 아닙니다' }
  }
  if (platform === 'ios' && !target.ios) {
    return { command: null, kind: target.kind, message: '이 프로젝트는 iOS 빌드 대상이 아닙니다' }
  }

  let command: string | null = null
  const kind = target.kind

  if (platform === 'android') {
    const adb = findAdb()
    if (kind === 'Flutter') {
      command = `flutter run -d ${device_id}`
    } else if (kind === 'Capacitor') {
      command = `npx cap run android --target ${device_id}`
    } else if (kind === 'Android(Gradle)') {
      command = `./gradlew installDebug && echo '✅ 설치 완료 — 폰에서 앱을 실행하세요'${adb ? ` && ${adb} -s ${device_id} shell am start -a android.intent.action.MAIN -c android.intent.category.LAUNCHER $(${adb} -s ${device_id} shell pm list packages -3 | head -1 | sed 's/package://') 2>/dev/null || true` : ''}`
    }
  } else if (platform === 'ios') {
    if (kind === 'Flutter') {
      command = `flutter run -d ${device_id}`
    } else if (kind === 'Capacitor') {
      command = `npx cap run ios --target ${device_id}`
    } else if (kind === 'iOS') {
      // 네이티브 iOS는 서명/스킴 때문에 Xcode 실행 권장
      return { command: null, kind, message: '네이티브 iOS는 서명 문제로 Xcode에서 실행하세요 (Xcode 버튼 사용)' }
    }
  }

  if (!command) {
    return { command: null, kind, message: '빌드 명령을 결정할 수 없는 프로젝트 타입입니다' }
  }
  return { command, kind }
})
