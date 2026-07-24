import { existsSync, readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

// 프로젝트가 어떤 모바일 플랫폼으로 빌드 가능한지 감지.
// 표준(Flutter/Capacitor/RN/루트 Gradle·iOS) + 비표준(android/·ios/ 폴더에 앱이 중첩된 구조)까지.

export interface BuildTarget {
  android: boolean
  ios: boolean
  kind: string
  androidDir: string | null // gradlew/build.gradle 이 있는 상대 경로 (빌드 실행 위치)
  iosNested: boolean         // ios가 여러 앱/중첩이라 자동 빌드가 어려운 경우
}

const IGNORE = new Set(['node_modules', '.git', 'build', '.gradle', 'Pods', 'DerivedData', '.dart_tool'])

// gradlew(우선) 또는 build.gradle+settings.gradle 이 있는 디렉토리를 depth까지 탐색.
// depth=2: 루트 또는 android/<앱이름>/ 까지만 (웹 프로젝트에 딸린 깊은 앱 폴더 오탐 방지)
function findGradleDir(root: string, depth = 2): string | null {
  const walk = (dir: string, rel: string, d: number): string | null => {
    let entries: string[]
    try { entries = readdirSync(dir) } catch { return null }
    const hasGradlew = entries.includes('gradlew')
    const hasBuild = entries.includes('build.gradle') || entries.includes('build.gradle.kts')
    const hasSettings = entries.includes('settings.gradle') || entries.includes('settings.gradle.kts')
    if (hasGradlew || (hasBuild && hasSettings)) return rel || '.'
    if (d <= 0) return null
    for (const e of entries) {
      if (IGNORE.has(e) || e.startsWith('.')) continue
      const full = join(dir, e)
      try { if (!statSync(full).isDirectory()) continue } catch { continue }
      const found = walk(full, rel ? `${rel}/${e}` : e, d - 1)
      if (found) return found
    }
    return null
  }
  return walk(root, '', depth)
}

// 발견 경로가 유효한 앱 위치인지: 루트('') 또는 android/ios 폴더 바로 아래
function validTop(rel: string): boolean {
  if (rel === '') return true
  return /^(android|ios)$/i.test(rel.split('/')[0])
}

// ios 프로젝트(.xcworkspace/.xcodeproj/Podfile) 존재 + 중첩 여부 (depth=2)
function detectIos(root: string, depth = 2): { found: boolean; nested: boolean } {
  let count = 0
  let atRoot = false
  const walk = (dir: string, rel: string, d: number) => {
    if (!validTop(rel)) return
    let entries: string[]
    try { entries = readdirSync(dir) } catch { return }
    for (const e of entries) {
      if (e.endsWith('.xcworkspace') || e.endsWith('.xcodeproj') || e === 'Podfile') {
        count++
        if (rel === '') atRoot = true
      }
    }
    if (d <= 0) return
    for (const e of entries) {
      if (IGNORE.has(e) || e.startsWith('.')) continue
      const full = join(dir, e)
      try { if (!statSync(full).isDirectory()) continue } catch { continue }
      walk(full, rel ? `${rel}/${e}` : e, d - 1)
    }
  }
  walk(root, '', depth)
  // 루트에 ios/ 폴더가 직접 있으면 프로젝트파일 못 찾아도 iOS 앱 신호
  const iosDirExists = existsSync(join(root, 'ios')) || existsSync(join(root, 'iOS'))
  return { found: count > 0 || iosDirExists, nested: count > 1 || (!atRoot && count > 0) }
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

  let gradleDir = findGradleDir(root)
  // 웹 프로젝트에 딸린 깊은 앱 폴더(예: SlowOK_App/android/...) 오탐 방지
  if (gradleDir && !validTop(gradleDir === '.' ? '' : gradleDir)) gradleDir = null
  const ios = detectIos(root)

  // 표준 프레임워크 (빌드 명령 명확)
  if (has('pubspec.yaml')) {
    return { android: has('android'), ios: has('ios'), kind: 'Flutter', androidDir: has('android') ? '.' : null, iosNested: false }
  }
  if (deps['@capacitor/core']) {
    return { android: has('android'), ios: has('ios'), kind: 'Capacitor', androidDir: has('android') ? '.' : null, iosNested: false }
  }
  if (deps['react-native']) {
    return { android: has('android'), ios: has('ios'), kind: 'React Native', androidDir: has('android') ? '.' : null, iosNested: ios.nested }
  }

  // 네이티브/비표준 — 하위 탐색 결과로 판정
  const android = !!gradleDir
  if (!android && !ios.found) {
    return { android: false, ios: false, kind: '', androidDir: null, iosNested: false }
  }
  let kind = 'iOS'
  if (android && ios.found) kind = '네이티브 (Android+iOS)'
  else if (android) kind = gradleDir === '.' ? 'Android(Gradle)' : '네이티브 Android'
  return { android, ios: ios.found, kind, androidDir: gradleDir, iosNested: ios.nested }
}
