import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

// 프로젝트가 어떤 모바일 플랫폼으로 빌드 가능한지 감지.
// Flutter/Capacitor = 양쪽 / Gradle = Android만 / Podfile·ios = iOS만 / 그 외 = 앱 아님

export interface BuildTarget {
  android: boolean
  ios: boolean
  kind: string // 'Flutter' | 'Capacitor' | 'Android(Gradle)' | 'iOS' | ''
}

export function detectBuildTarget(root: string): BuildTarget {
  const has = (f: string) => existsSync(join(root, f))

  let deps: Record<string, string> = {}
  if (has('package.json')) {
    try {
      const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8'))
      deps = { ...pkg.dependencies, ...pkg.devDependencies }
    } catch {}
  }

  if (has('pubspec.yaml')) {
    // Flutter — android/ ios/ 폴더 유무로 플랫폼 세분
    return { android: has('android'), ios: has('ios'), kind: 'Flutter' }
  }
  if (deps['@capacitor/core']) {
    return { android: has('android'), ios: has('ios'), kind: 'Capacitor' }
  }
  if (has('build.gradle') || has('build.gradle.kts') || has('gradlew') || has('settings.gradle')) {
    return { android: true, ios: false, kind: 'Android(Gradle)' }
  }
  if (has('Podfile') || has('ios') || existsSync(join(root, 'Runner.xcworkspace'))) {
    return { android: false, ios: true, kind: 'iOS' }
  }
  return { android: false, ios: false, kind: '' }
}
