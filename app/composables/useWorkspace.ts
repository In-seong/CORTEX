export interface WorkspaceTab {
  id: number | string // worktree 탭은 'wt:<path>' 형태의 string id
  name: string
  path: string
  category: string
  has_claude_md: boolean
  mode: 'claude' | 'shell' | 'quick' | 'review' | 'chat'
  command?: string // 터미널 시작 시 실행할 커스텀 명령 (fan-out 프롬프트)
  [key: string]: any
}

const openTabs = ref<WorkspaceTab[]>([])
const activeTabId = ref<number | string | null>(null)

export function useWorkspace() {
  function openProject(project: any, mode: 'claude' | 'shell' | 'quick' | 'review' | 'chat' = 'chat') {
    const existing = openTabs.value.find(t => t.id === project.id)
    if (existing) {
      activeTabId.value = existing.id
      existing.mode = mode
    } else {
      openTabs.value.push({ ...project, mode })
      activeTabId.value = project.id
    }
  }

  function closeTab(id: number | string) {
    const idx = openTabs.value.findIndex(t => t.id === id)
    if (idx === -1) return
    const tab = openTabs.value[idx]
    openTabs.value.splice(idx, 1)
    if (activeTabId.value === id) {
      activeTabId.value = openTabs.value.length ? openTabs.value[Math.max(0, idx - 1)].id : null
    }
    // 탭 닫기 = 세션 종료 (좀비 PTY 방지). 페이지 이탈과 달리 명시적 정리.
    if (tab?.path) {
      $fetch('/api/terminal/kill-by-cwd', { method: 'POST', body: { cwd: tab.path } }).catch(() => {})
      localStorage.removeItem(`cortex-term:${tab.path}:claude`)
      localStorage.removeItem(`cortex-term:${tab.path}:shell`)
    }
  }

  function setTabMode(id: number | string, mode: 'claude' | 'shell' | 'quick' | 'review' | 'chat') {
    const tab = openTabs.value.find(t => t.id === id)
    if (tab) tab.mode = mode
  }

  const activeProject = computed(() => openTabs.value.find(t => t.id === activeTabId.value))

  return {
    openTabs,
    activeTabId,
    activeProject,
    openProject,
    closeTab,
    setTabMode,
  }
}
