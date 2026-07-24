<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const { data: projects, refresh: refreshProjects } = await useFetch('/api/projects')
const { openProject, openTabs } = useWorkspace()

const showMobileNav = ref(false)
const scanning = ref(false)
const sidebarSearch = ref('')

const { isDark, toggle: toggleTheme, init: initTheme } = useTheme()
onMounted(initTheme)

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
  fetchNotifications()
  if (typeof Notification !== 'undefined') notifPermission.value = Notification.permission
  agentTimer = setInterval(() => {
    fetchAgents()
    fetchNotifications()
  }, 5000)
})
onBeforeUnmount(() => {
  if (agentTimer) clearInterval(agentTimer)
})

// ===== 알림 (seq 기반 catch-up + 브라우저 Notification) =====
const notifications = ref<any[]>([])
const unreadNotifs = ref(0)
let lastNotifSeq = 0
let notifsInitialized = false
const showNotifPanel = ref(false)
const notifPermission = ref<string>('default')

async function fetchNotifications() {
  try {
    const res = await $fetch('/api/notifications', {
      query: lastNotifSeq > 0 ? { since: lastNotifSeq } : {},
    }) as any

    if (!notifsInitialized) {
      notifications.value = res.items
      notifsInitialized = true
    } else if (res.items.length) {
      notifications.value = [...res.items, ...notifications.value].slice(0, 50)
      // 새 알림 → 브라우저 알림 (권한 있을 때)
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        for (const n of res.items.slice(0, 3)) {
          try {
            new Notification(n.title, { body: n.body || '', tag: `cortex-${n.id}`, icon: '/icon-192.png' })
          } catch {}
        }
      }
    }
    lastNotifSeq = Math.max(lastNotifSeq, res.maxSeq)
    unreadNotifs.value = res.unread
  } catch {}
}

async function requestNotifPermission() {
  if (typeof Notification === 'undefined') return
  const p = await Notification.requestPermission()
  notifPermission.value = p
}

async function markAllNotifsRead() {
  await $fetch('/api/notifications/read', { method: 'POST', body: { all: true } }).catch(() => {})
  unreadNotifs.value = 0
  notifications.value = notifications.value.map(n => ({ ...n, read: 1 }))
}

function openNotifPanel() {
  showNotifPanel.value = !showNotifPanel.value
  if (showNotifPanel.value && unreadNotifs.value > 0) markAllNotifsRead()
}

function clickNotification(n: any) {
  showNotifPanel.value = false
  const p = ((projects.value as any[]) || []).find(pr => pr.id === n.project_id)
  if (p) openInWorkspace(p)
}

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
  openProject(project, 'chat')
  showMobileNav.value = false
  router.push('/workspace')
}

async function scanProjects() {
  scanning.value = true
  try {
    await $fetch('/api/projects/scan', { method: 'POST' })
    await refreshCandidates()
  } finally {
    scanning.value = false
  }
}

// ===== 프로젝트 추가 (후보에서 골라 등록) =====
const showAddProject = ref(false)
const candidateSearch = ref('')
const candidates = ref<any[]>([])
const adding = ref<number | null>(null)

async function refreshCandidates() {
  try {
    candidates.value = await $fetch('/api/projects/candidates', {
      query: candidateSearch.value ? { q: candidateSearch.value } : {},
    }) as any[]
  } catch {}
}

function openAddProject() {
  showAddProject.value = true
  showMobileNav.value = false
  candidateSearch.value = ''
  refreshCandidates()
}

watch(candidateSearch, () => { if (showAddProject.value) refreshCandidates() })

async function addProject(c: any) {
  adding.value = c.id
  try {
    await $fetch('/api/projects/activate', { method: 'POST', body: { id: c.id } })
    await refreshProjects()
    candidates.value = candidates.value.filter(x => x.id !== c.id)
  } finally {
    adding.value = null
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
        <div class="ml-auto flex items-center gap-1">
          <button
            @click="toggleTheme"
            class="w-7 h-7 rounded-md flex items-center justify-center text-brain-muted hover:text-brain-text hover:bg-brain-border transition-colors"
            :title="isDark ? '라이트 모드' : '다크 모드'"
          >
            <svg v-if="isDark" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
          </button>
          <button
            @click="openNotifPanel"
            class="relative w-7 h-7 rounded-md flex items-center justify-center text-brain-muted hover:text-brain-text hover:bg-brain-border transition-colors"
            title="알림"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
            <span
              v-if="unreadNotifs > 0"
              class="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-0.5 rounded-full bg-neon-rose text-white text-[9px] font-semibold flex items-center justify-center"
            >{{ unreadNotifs > 9 ? '9+' : unreadNotifs }}</span>
          </button>
          <div class="w-1.5 h-1.5 rounded-full bg-neon-emerald" title="ONLINE" />
        </div>
      </div>


      <!-- Nav -->
      <nav class="px-2 py-2 space-y-0.5 shrink-0">
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-2 px-3 py-1.5 rounded-md text-[13px] transition-colors"
          :class="isActive(item.to)
            ? 'bg-brain-border text-brain-text font-medium'
            : 'text-brain-text-secondary hover:bg-brain-border hover:text-brain-text'"
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
            class="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left hover:bg-brain-border transition-colors"
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
            @click="openAddProject"
            class="w-6 h-6 rounded flex items-center justify-center text-sm text-brain-muted hover:text-brain-text hover:bg-brain-border transition-colors"
            title="프로젝트 추가"
          >+</button>
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
              ? 'bg-brain-border'
              : 'hover:bg-brain-border'"
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
          <div v-if="!sidebarProjects.length" class="px-2 py-4 text-center">
            <p class="text-xs text-brain-muted">{{ sidebarSearch ? '검색 결과 없음' : '등록된 프로젝트 없음' }}</p>
            <button v-if="!sidebarSearch" @click="openAddProject" class="mt-2 text-xs text-neon-indigo hover:underline">+ 프로젝트 추가</button>
          </div>
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
      <div class="ml-auto flex items-center gap-1">
        <button
          @click="toggleTheme"
          class="w-8 h-8 rounded-md flex items-center justify-center text-brain-text-secondary hover:text-brain-text"
          :title="isDark ? '라이트 모드' : '다크 모드'"
        >
          <svg v-if="isDark" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
          <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
        </button>
        <button
          @click="openNotifPanel"
          class="relative w-8 h-8 rounded-md flex items-center justify-center text-brain-text-secondary hover:text-brain-text"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
          <span
            v-if="unreadNotifs > 0"
            class="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-0.5 rounded-full bg-neon-rose text-white text-[9px] font-semibold flex items-center justify-center"
          >{{ unreadNotifs > 9 ? '9+' : unreadNotifs }}</span>
        </button>
        <div class="w-1.5 h-1.5 rounded-full bg-neon-emerald" />
      </div>
    </div>

    <!-- Notification Panel (공용) -->
    <Teleport to="body">
      <div v-if="showNotifPanel" class="fixed inset-0 z-[60]" @click.self="showNotifPanel = false">
        <div class="fixed left-2 right-2 top-14 md:left-3 md:right-auto md:top-16 md:w-80 bg-brain-card border border-brain-border-light rounded-lg shadow-floating overflow-hidden animate-fade-in">
          <div class="flex items-center justify-between px-3 py-2 border-b border-brain-border">
            <span class="text-xs font-semibold">알림</span>
            <div class="flex items-center gap-2">
              <button
                v-if="notifPermission !== 'granted'"
                @click="requestNotifPermission"
                class="text-[10px] text-neon-indigo hover:underline"
              >브라우저 알림 켜기</button>
              <button @click="showNotifPanel = false" class="text-xs text-brain-muted hover:text-brain-text">✕</button>
            </div>
          </div>
          <div class="max-h-72 overflow-y-auto scrollbar-sleek">
            <button
              v-for="n in notifications"
              :key="n.id"
              @click="clickNotification(n)"
              class="w-full text-left px-3 py-2 border-b border-brain-border/50 hover:bg-brain-border transition-colors"
            >
              <p class="text-xs" :class="n.read ? 'text-brain-text-secondary' : 'text-brain-text font-medium'">{{ n.title }}</p>
              <p v-if="n.body" class="text-[11px] text-brain-muted truncate mt-0.5">{{ n.body }}</p>
              <p class="text-[10px] text-brain-muted/60 font-mono mt-0.5">{{ n.created_at }}</p>
            </button>
            <p v-if="!notifications.length" class="px-3 py-6 text-center text-xs text-brain-muted">알림이 없습니다</p>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Add Project Modal -->
    <Teleport to="body">
      <div v-if="showAddProject" class="fixed inset-0 z-[70] flex items-end sm:items-start justify-center sm:pt-[12vh]" @click.self="showAddProject = false">
        <div class="absolute inset-0 bg-black/50" @click="showAddProject = false" />
        <div class="relative w-full sm:w-[560px] max-h-[80vh] sm:max-h-[64vh] bg-brain-card border border-brain-border-light rounded-t-xl sm:rounded-xl shadow-floating overflow-hidden animate-slide-up flex flex-col">
          <div class="p-3 border-b border-brain-border shrink-0">
            <div class="flex items-center justify-between mb-2.5">
              <h3 class="text-sm font-semibold">프로젝트 추가</h3>
              <button
                @click="scanProjects"
                :disabled="scanning"
                class="text-[11px] text-neon-indigo hover:underline disabled:opacity-50"
              >{{ scanning ? '스캔 중...' : '⟳ 새로 찾기(전체 스캔)' }}</button>
            </div>
            <div class="relative">
              <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brain-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input
                v-model="candidateSearch"
                type="text"
                placeholder="이름·경로·카테고리 검색..."
                class="w-full bg-brain-bg border border-brain-border rounded-md pl-10 pr-4 py-2 text-sm placeholder:text-brain-muted/60 focus:outline-none focus:border-neon-indigo/50 transition-colors"
                autofocus
              />
            </div>
          </div>
          <div class="overflow-y-auto scrollbar-sleek flex-1">
            <button
              v-for="c in candidates"
              :key="c.id"
              @click="addProject(c)"
              :disabled="adding === c.id"
              class="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-brain-border transition-colors border-b border-brain-border/50 text-left"
            >
              <span class="text-base shrink-0">{{ c.icon || '📁' }}</span>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium truncate">{{ c.name }}</p>
                <p class="text-[11px] text-brain-muted font-mono truncate">{{ c.path.replace('/Users/scoop/', '~/') }}</p>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <span v-if="c.has_claude_md" class="text-[10px] opacity-50">🤖</span>
                <span v-if="c.session_count > 0" class="text-[10px] text-brain-muted">💬{{ c.session_count }}</span>
                <span class="text-xs text-neon-indigo">{{ adding === c.id ? '...' : '+ 추가' }}</span>
              </div>
            </button>
            <p v-if="!candidates.length" class="px-4 py-8 text-center text-xs text-brain-muted">
              {{ candidateSearch ? '검색 결과 없음' : '추가할 후보가 없습니다 — "새로 찾기"로 스캔하세요' }}
            </p>
          </div>
        </div>
      </div>
    </Teleport>

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
              :class="isActive(item.to) ? 'bg-brain-border text-brain-text font-medium' : 'text-brain-text-secondary'"
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
