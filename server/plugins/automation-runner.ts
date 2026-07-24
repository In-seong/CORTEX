import { getDb } from '../db'
import { evaluateDueAutomations } from '../utils/automation-runner'

// 60초 tick으로 due 자동화 평가 (orca AutomationService 패턴)
export default defineNitroPlugin(() => {
  setInterval(() => {
    try {
      evaluateDueAutomations(getDb())
    } catch (e) {
      console.error('[automation-tick]', e)
    }
  }, 60 * 1000)
})
