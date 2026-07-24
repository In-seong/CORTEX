export interface WorkspaceTab {
  id: number
  name: string
  path: string
  category: string
  has_claude_md: boolean
  mode: 'claude' | 'shell' | 'quick'
  [key: string]: any
}

const openTabs = ref<WorkspaceTab[]>([])
const activeTabId = ref<number | null>(null)

export function useWorkspace() {
  function openProject(project: any, mode: 'claude' | 'shell' | 'quick' = 'claude') {
    const existing = openTabs.value.find(t => t.id === project.id)
    if (existing) {
      activeTabId.value = existing.id
      existing.mode = mode
    } else {
      openTabs.value.push({ ...project, mode })
      activeTabId.value = project.id
    }
  }

  function closeTab(id: number) {
    const idx = openTabs.value.findIndex(t => t.id === id)
    if (idx === -1) return
    openTabs.value.splice(idx, 1)
    if (activeTabId.value === id) {
      activeTabId.value = openTabs.value.length ? openTabs.value[Math.max(0, idx - 1)].id : null
    }
  }

  function setTabMode(id: number, mode: 'claude' | 'shell' | 'quick') {
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
