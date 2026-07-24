import { getDb } from '../../db'
import { scanUsage, isScanning } from '../../utils/usage-scanner'

// 수동 전체 스캔 (동기 — 첫 스캔은 수십 초 걸릴 수 있음)
export default defineEventHandler(() => {
  if (isScanning()) return { ok: false, message: 'already scanning' }
  const result = scanUsage(getDb())
  return { ok: true, ...result }
})
