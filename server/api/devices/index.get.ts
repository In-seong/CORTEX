import { execFileSync } from 'child_process'
import { existsSync } from 'fs'

// 맥에 연결된 실기기 목록: Android(adb) + iOS(devicectl)
const ADB_CANDIDATES = [
  `${process.env.HOME}/Library/Android/sdk/platform-tools/adb`,
  '/opt/homebrew/bin/adb',
  '/usr/local/bin/adb',
]

export function findAdb(): string | null {
  for (const p of ADB_CANDIDATES) if (existsSync(p)) return p
  return null
}

interface Device {
  platform: 'android' | 'ios'
  id: string
  name: string
  state: string
}

export default defineEventHandler(() => {
  const devices: Device[] = []
  let adbAvailable = false

  // Android
  const adb = findAdb()
  if (adb) {
    adbAvailable = true
    try {
      const out = execFileSync(adb, ['devices', '-l'], { encoding: 'utf-8', timeout: 10000 })
      for (const line of out.split('\n').slice(1)) {
        const m = line.trim().match(/^(\S+)\s+(device|offline|unauthorized)\b(.*)$/)
        if (!m) continue
        const model = m[3].match(/model:(\S+)/)?.[1]?.replace(/_/g, ' ')
        devices.push({
          platform: 'android',
          id: m[1],
          name: model || m[1],
          state: m[2] === 'device' ? 'connected' : m[2],
        })
      }
    } catch {}
  }

  // iOS (Xcode 15+ devicectl)
  try {
    const out = execFileSync('xcrun', ['devicectl', 'list', 'devices'], {
      encoding: 'utf-8', timeout: 15000,
      env: { ...process.env, LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8' },
    })
    // 표 형식: Name  Hostname  Identifier  State  Model
    for (const line of out.split('\n')) {
      if (/^-{3,}/.test(line.trim()) || /^Name\s/.test(line)) continue // 헤더/구분선
      const m = line.match(/^(.+?)\s{2,}\S+\s{2,}([0-9A-F-]{25,})\s{2,}(\S[^ ]*(?: \(.*\))?)\s{2,}(.+)$/i)
      if (!m) continue
      if (/^-+$/.test(m[2])) continue
      devices.push({
        platform: 'ios',
        id: m[2],
        name: `${m[1].trim()} (${m[4].trim().replace(/\s*\(iPhone[\d,]+\)|\s*\(iPad[\d,]+\)/, '')})`,
        state: /available|connected|paired/i.test(m[3]) ? 'connected' : m[3].trim(),
      })
    }
  } catch {}

  return { devices, adbAvailable }
})
