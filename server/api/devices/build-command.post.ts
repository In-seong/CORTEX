import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { getDb } from '../../db'
import { findAdb } from './index.get'

// { project_id, platform: 'android'|'ios', device_id }
// → 프로젝트 타입(Flutter/Capacitor/네이티브)을 감지해 해당 폰에 빌드·실행하는 명령 생성.
// 실행 자체는 클라이언트가 터미널 탭으로 열어서 출력 확인 가능.
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
  const has = (f: string) => existsSync(join(root, f))
  let deps: Record<string, string> = {}
  if (has('package.json')) {
    try {
      const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8'))
      deps = { ...pkg.dependencies, ...pkg.devDependencies }
    } catch {}
  }

  const isFlutter = has('pubspec.yaml')
  const isCapacitor = !!deps['@capacitor/core']
  const isNativeAndroid = has('build.gradle') || has('build.gradle.kts') || has('gradlew')

  let command: string | null = null
  let kind = ''

  if (platform === 'android') {
    const adb = findAdb()
    if (isFlutter) {
      kind = 'Flutter'
      command = `flutter run -d ${device_id}`
    } else if (isCapacitor) {
      kind = 'Capacitor'
      command = `npx cap run android --target ${device_id}`
    } else if (isNativeAndroid) {
      kind = 'Android(Gradle)'
      command = `./gradlew installDebug && echo '✅ 설치 완료 — 폰에서 앱을 실행하세요'${adb ? ` && ${adb} -s ${device_id} shell am start -a android.intent.action.MAIN -c android.intent.category.LAUNCHER $(${adb} -s ${device_id} shell pm list packages -3 | head -1 | sed 's/package://') 2>/dev/null || true` : ''}`
    }
  } else if (platform === 'ios') {
    if (isFlutter) {
      kind = 'Flutter'
      command = `flutter run -d ${device_id}`
    } else if (isCapacitor) {
      kind = 'Capacitor'
      command = `npx cap run ios --target ${device_id}`
    } else if (has('Podfile') || has('ios')) {
      kind = 'iOS'
      command = null // 네이티브 iOS는 서명/스킴 때문에 Xcode에서 실행 권장
    }
  }

  if (!command) {
    return {
      command: null,
      kind,
      message: platform === 'ios'
        ? '네이티브 iOS 프로젝트는 서명 문제로 Xcode에서 실행하세요 (Xcode 버튼 사용)'
        : '빌드 명령을 결정할 수 없는 프로젝트 타입입니다',
    }
  }

  return { command, kind }
})
