<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const { data: projects, refresh: refreshProjects } = await useFetch('/api/projects')
const { openProject, openTabs } = useWorkspace()

const showMobileNav = ref(false)
const scanning = ref(false)
const sidebarSearch = ref('')

const navItems = [
  { to: '/', label: '대시보드' },
  { to: '/workspace', label: '워크스페이스' },
  { to: '/graph', label: '관계 그래프' },
  { to: '/settings', label: '설정' },
]

// ===== 에이전트 상태 (Claude Code hook 기반, 5초 폴링) =====
const agents = ref<any[]>([])
let agentTimer: ReturnType<typeof setInterval> | null = null

async function fetchAgents() {
  try {
    agents.value = await $fetch('/api/agents') as any[]
  } catch {}
}

onMounted(() => {
  fetchAgents()
  agentTimer = setInterval(fetchAgents, 5000)
})
onBeforeUnmount(() => {
  if (agentTimer) clearInterval(agentTimer)
})

const STATE_RANK: Record<string, number> = { permission: 5, waiting: 4, working: 3, done: 2, idle: 1 }
const STATE_LABEL: Record<string, string> = {
  working: '작업 중', permission: '권한 대기', waiting: '응답 대기', done: '완료', idle: '대기',
}

// 프로젝트별 대표 상태 (permission > waiting > working > done)
const agentByProject = computed(() => {
  const m = new Map<number, any>()
  for (const a of agents.value) {
    if (!a.project_id) continue
    const cur = m.get(a.project_id)
    if (!cur || (STATE_RANK[a.state] || 0) > (STATE_RANK[cur.state] || 0)) m.set(a.project_id, a)
  }
  return m
})

// 사이드바 "에이전트" 섹션: idle 제외, 최근 2시간
const activeAgents = computed(() =>
  agents.value.filter(a => (a.state !== 'idle' || a.unread) && a.age_sec < 7200)
)

function agentDotClass(a: any): string {
  if (a.stale) return 'bg-brain-muted/50'
  if (a.state === 'permission' || a.state === 'waiting') return 'bg-neon-amber animate-pulse'
  if (a.state === 'working') return 'bg-neon-indigo animate-pulse'
  if (a.state === 'done' && a.unread) return 'bg-neon-emerald'
  return 'bg-brain-muted/50'
}

function agentDisplayName(a: any): string {
  return a.project_name || a.cwd?.split('/').pop() || a.session_id.slice(0, 8)
}

function openAgent(a: any) {
  if (a.unread) {
    $fetch('/api/agents/ack', { method: 'POST', body: { session_id: a.session_id } })
      .then(fetchAgents).catch(() => {})
  }
  const p = ((projects.value as any[]) || []).find(pr => pr.id === a.project_id)
  if (p) openInWorkspace(p)
}

function isActive(to: string) {
  if (to === '/') return route.path === '/'
  return route.path.startsWith(to)
}

const sidebarProjects = computed(() => {
  let list = (projects.value as any[]) || []
  if (sidebarSearch.value) {
    const q = sidebarSearch.value.toLowerCase()
    list = list.filter(p => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))
  }
  return list
})

function openInWorkspace(project: any) {
  openProject(project, 'claude')
  showMobileNav.value = false
  router.push('/workspace')
}

async function scanProjects() {
  scanning.value = true
  try {
    await $fetch('/api/projects/scan', { method: 'POST' })
    await refreshProjects()
  } finally {
    scanning.value = false
  }
}

watch(() => route.path, () => { showMobileNav.value = false })
</script>

<template>
  <div class="h-screen flex overflow-hidden">
    <!-- ===== Desktop Sidebar ===== -->
    <aside class="hidden md:flex w-64 shrink-0 flex-col bg-brain-surface border-r border-brain-border">
      <!-- Logo -->
      <div class="flex items-center gap-2.5 px-4 h-14 shrink-0 border-b border-brain-border">
        <div class="w-7 h-7 rounded-lg bg-neon-indigo/15 border border-neon-indigo/30 flex items-center justify-center">
          <span class="text-sm">🧠</span>
        </div>
        <div class="min-w-0">
          <h1 class="text-sm font-semibold leading-none">CORTEX</h1>
          <p class="text-[10px] text-brain-muted font-mono mt-0.5">dev nerve center</p>
        </div>
        <div class="ml-auto w-1.5 h-1.5 rounded-full bg-neon-emerald" title="ONLINE" />
      </div>

      <!-- Nav -->
      <nav class="px-2 py-2 space-y-0.5 shrink-0">
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-2 px-3 py-1.5 rounded-md text-[13px] transition-colors"
          :class="isActive(item.to)
            ? 'bg-white/[0.06] text-brain-text font-medium'
            : 'text-brain-text-secondary hover:bg-white/[0.04] hover:text-brain-text'"
        >
          {{ item.label }}
          <span
            v-if="item.to === '/workspace' && openTabs.length"
            class="ml-auto text-[10px] font-mono text-neon-indigo"
          >{{ openTabs.length }}</span>
        </NuxtLink>
      </nav>

      <!-- Agents (실행 중인 Claude 세션) -->
      <div v-if="activeAgents.length" class="border-t border-brain-border px-2 py-2 shrink-0">
        <span class="px-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-brain-muted">에이전트</span>
        <div class="mt-1 space-y-0.5 max-h-40 overflow-y-auto scrollbar-sleek">
          <button
            v-for="a in activeAgents"
            :key="a.session_id"
            @click="openAgent(a)"
            class="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left hover:bg-white/[0.04] transition-colors"
          >
            <span class="w-1.5 h-1.5 rounded-full shrink-0" :class="agentDotClass(a)" />
            <span class="text-[13px] truncate" :class="a.unread ? 'text-brain-text font-medium' : 'text-brain-text-secondary'">
              {{ agentDisplayName(a) }}
            </span>
            <span class="ml-auto text-[10px] font-mono shrink-0"
              :class="a.state === 'permission' || a.state === 'waiting' ? 'text-neon-amber' : a.state === 'done' && a.unread ? 'text-neon-emerald' : 'text-brain-muted'">
              {{ a.stale ? '응답없음' : STATE_LABEL[a.state] || a.state }}
            </span>
          </button>
        </div>
      </div>

      <!-- Projects -->
      <div class="flex-1 min-h-0 flex flex-col border-t border-brain-border">
        <div class="flex items-center justify-between px-4 pt-3 pb-1.5 shrink-0">
          <span class="text-[11px] font-semibold uppercase tracking-[0.08em] text-brain-muted">프로젝트</span>
          <button
            @click="scanProjects"
            :disabled="scanning"
            class="w-6 h-6 rounded flex items-center justify-center text-xs text-brain-muted hover:text-brain-text hover:bg-white/[0.06] transition-colors disabled:opacity-50"
            :class="scanning ? 'animate-spin' : ''"
            title="프로젝트 스캔"
          >⟳</button>
        </div>
        <div class="px-3 pb-2 shrink-0">
          <input
            v-model="sidebarSearch"
            type="text"
            placeholder="검색..."
            class="w-full bg-brain-bg border border-brain-border rounded-md px-2.5 py-1.5 text-xs placeholder:text-brain-muted/60 focus:outline-none focus:border-neon-indigo/50 transition-colors"
          />
        </div>
        <div class="flex-1 overflow-y-auto px-2 pb-2 scrollbar-sleek">
          <button
            v-for="p in sidebarProjects"
            :key="p.id"
            @click="openInWorkspace(p)"
            class="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors group"
            :class="openTabs.some(t => t.id === p.id)
              ? 'bg-white/[0.06]'
              : 'hover:bg-white/[0.04]'"
          >
            <span class="text-sm shrink-0">{{ p.icon || '📁' }}</span>
            <span class="text-[13px] truncate flex-1" :class="openTabs.some(t => t.id === p.id) ? 'text-brain-text' : 'text-brain-text-secondary group-hover:text-brain-text'">
              {{ p.name }}
            </span>
            <span
              v-if="agentByProject.get(p.id)"
              class="w-1.5 h-1.5 rounded-full shrink-0"
              :class="agentDotClass(agentByProject.get(p.id))"
              :title="STATE_LABEL[agentByProject.get(p.id).state]"
            />
            <span v-if="p.git_dirty_count > 0" class="flex items-center gap-1 shrink-0" :title="`${p.git_dirty_count}개 미커밋`">
              <span class="text-[10px] font-mono text-neon-amber">{{ p.git_dirty_count }}</span>
            </span>
            <span v-else-if="p.has_claude_md && !agentByProject.get(p.id)" class="text-[10px] opacity-40 shrink-0">🤖</span>
          </button>
          <p v-if="!sidebarProjects.length" class="px-2 py-4 text-xs text-brain-muted text-center">
            {{ sidebarSearch ? '검색 결과 없음' : '프로젝트 없음' }}
          </p>
        </div>
      </div>
    </aside>

    <!-- ===== Mobile Top Bar ===== -->
    <div class="md:hidden fixed top-0 inset-x-0 z-40 flex items-center gap-3 h-12 px-4 bg-brain-surface/95 backdrop-blur-md border-b border-brain-border">
      <button
        @click="showMobileNav = !showMobileNav"
        class="w-8 h-8 -ml-1 rounded-md flex items-center justify-center text-brain-text-secondary hover:text-brain-text"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
      </button>
      <div class="flex items-center gap-2">
        <span class="text-sm">🧠</span>
        <span class="text-sm font-semibold">CORTEX</span>
      </div>
      <div class="ml-auto w-1.5 h-1.5 rounded-full bg-neon-emerald" />
    </div>

    <!-- Mobile Drawer -->
    <Teleport to="body">
      <div v-if="showMobileNav" class="md:hidden fixed inset-0 z-50">
        <div class="absolute inset-0 bg-black/60" @click="showMobileNav = false" />
        <aside class="absolute left-0 top-0 bottom-0 w-72 bg-brain-surface border-r border-brain-border flex flex-col animate-drawer-in">
          <div class="flex items-center gap-2.5 px-4 h-12 shrink-0 border-b border-brain-border">
            <span class="text-sm">🧠</span>
            <span class="text-sm font-semibold">CORTEX</span>
            <button @click="showMobileNav = false" class="ml-auto w-7 h-7 rounded-md flex items-center justify-center text-brain-muted">✕</button>
          </div>
          <nav class="px-2 py-2 space-y-0.5 shrink-0">
            <NuxtLink
              v-for="item in navItems"
              :key="item.to"
              :to="item.to"
              class="flex items-center px-3 py-2 rounded-md text-sm transition-colors"
              :class="isActive(item.to) ? 'bg-white/[0.06] text-brain-text font-medium' : 'text-brain-text-secondary'"
            >
              {{ item.label }}
            </NuxtLink>
          </nav>
          <div v-if="activeAgents.length" class="border-t border-brain-border px-2 py-2 shrink-0">
            <span class="px-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-brain-muted">에이전트</span>
            <div class="mt-1 space-y-0.5 max-h-36 overflow-y-auto scrollbar-sleek">
              <button
                v-for="a in activeAgents"
                :key="a.session_id"
                @click="openAgent(a)"
                class="w-full flex items-center gap-2 px-2 py-2 rounded-md text-left"
              >
                <span class="w-1.5 h-1.5 rounded-full shrink-0" :class="agentDotClass(a)" />
                <span class="text-sm truncate" :class="a.unread ? 'text-brain-text font-medium' : 'text-brain-text-secondary'">
                  {{ agentDisplayName(a) }}
                </span>
                <span class="ml-auto text-[10px] font-mono shrink-0"
                  :class="a.state === 'permission' || a.state === 'waiting' ? 'text-neon-amber' : a.state === 'done' && a.unread ? 'text-neon-emerald' : 'text-brain-muted'">
                  {{ a.stale ? '응답없음' : STATE_LABEL[a.state] || a.state }}
                </span>
              </button>
            </div>
          </div>
          <div class="flex-1 min-h-0 flex flex-col border-t border-brain-border">
            <span class="px-4 pt-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-brain-muted shrink-0">프로젝트</span>
            <div class="flex-1 overflow-y-auto px-2 pb-2 scrollbar-sleek">
              <button
                v-for="p in sidebarProjects"
                :key="p.id"
                @click="openInWorkspace(p)"
                class="w-full flex items-center gap-2 px-2 py-2 rounded-md text-left"
              >
                <span class="text-sm shrink-0">{{ p.icon || '📁' }}</span>
                <span class="text-sm truncate flex-1 text-brain-text-secondary">{{ p.name }}</span>
                <span v-if="p.git_dirty_count > 0" class="w-1.5 h-1.5 rounded-full bg-neon-amber shrink-0" />
              </button>
            </div>
          </div>
        </aside>
      </div>
    </Teleport>

    <!-- ===== Main ===== -->
    <main class="flex-1 min-w-0 flex flex-col overflow-hidden pt-12 md:pt-0">
      <slot />
    </main>
  </div>
</template>

<style scoped>
@keyframes drawer-in {
  from { transform: translateX(-100%); }
  to { transform: translateX(0); }
}
.animate-drawer-in {
  animation: drawer-in 0.2s ease-out;
}
</style>
