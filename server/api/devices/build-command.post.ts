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
    } else if (kind === 'React Native') {
      command = `npx react-native run-android --deviceId ${device_id}`
    } else if (target.androidDir) {
      // 네이티브 Android — gradlew 위치에서 설치 후, APK의 실제 패키지/액티비티로 실행
      const cd = target.androidDir === '.' ? '' : `cd "${target.androidDir}" && `
      const home = process.env.HOME || '/Users/scoop'
      const sdk = `${home}/Library/Android/sdk/build-tools`
      let launch = ''
      if (adb) {
        // 방금 빌드한 debug APK를 찾아 aapt로 패키지/런처액티비티 추출 → am start (정확한 앱 실행)
        launch = ` && APK=$(find . -path '*/outputs/apk/debug/*.apk' 2>/dev/null | head -1)` +
          ` && AAPT=$(ls "${sdk}"/*/aapt2 2>/dev/null | sort -V | tail -1); [ -z "$AAPT" ] && AAPT=$(ls "${sdk}"/*/aapt 2>/dev/null | sort -V | tail -1);` +
          ` PKG=$("$AAPT" dump badging "$APK" 2>/dev/null | sed -n "s/.*package: name='\\([^']*\\)'.*/\\1/p");` +
          ` ACT=$("$AAPT" dump badging "$APK" 2>/dev/null | sed -n "s/launchable-activity: name='\\([^']*\\)'.*/\\1/p");` +
          ` if [ -n "$PKG" ] && [ -n "$ACT" ]; then echo "▶ 실행: $PKG"; ${adb} -s ${device_id} shell am start -n "$PKG/$ACT"; else echo "⚠️ 패키지 자동감지 실패 — 폰에서 직접 실행하세요"; fi`
      }
      command = `${cd}./gradlew installDebug && echo '✅ 설치 완료'${launch}`
    }
  } else if (platform === 'ios') {
    if (kind === 'Flutter') {
      command = `flutter run -d ${device_id}`
    } else if (kind === 'Capacitor') {
      command = `npx cap run ios --target ${device_id}`
    } else if (kind === 'React Native' && !target.iosNested) {
      command = `npx react-native run-ios --udid ${device_id}`
    } else {
      // 네이티브/중첩 iOS는 서명·스킴 때문에 Xcode 실행 권장
      return { command: null, kind, message: 'iOS 앱은 서명·스킴 설정 때문에 Xcode에서 실행하세요 (상단 🍎 Xcode 버튼)' }
    }
  }

  if (!command) {
    return {
      command: null,
      kind,
      message: kind
        ? '이 구조는 자동 빌드 명령을 만들 수 없습니다 — 셸/Studio에서 직접 실행하세요'
        : '빌드 가능한 앱 프로젝트가 아닙니다',
    }
  }
  return { command, kind }
})
