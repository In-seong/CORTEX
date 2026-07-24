<script setup lang="ts">
const { data: stats, refresh: refreshStats } = await useFetch('/api/system/stats')
const { data: projects, refresh: refreshProjects } = await useFetch('/api/projects')
const scanning = ref(false)
const searchQuery = ref('')
const selectedCategory = ref<string | null>(null)
const router = useRouter()
const { openProject } = useWorkspace()
const showSearch = ref(false)
const showMobileMenu = ref(false)

function openClaude(project: any) {
  openProject(project, 'claude')
  router.push('/workspace')
}

async function scanProjects() {
  scanning.value = true
  try {
    await $fetch('/api/projects/scan', { method: 'POST' })
    await refreshProjects()
    await refreshStats()
  } finally {
    scanning.value = false
  }
}

const categories = computed(() => {
  if (!projects.value) return []
  const cats = new Map<string, number>()
  for (const p of projects.value as any[]) {
    cats.set(p.category, (cats.get(p.category) || 0) + 1)
  }
  return Array.from(cats.entries()).map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
})

const filteredProjects = computed(() => {
  if (!projects.value) return []
  let result = projects.value as any[]
  if (selectedCategory.value) {
    result = result.filter(p => p.category === selectedCategory.value)
  }
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      (p.tech_stack && p.tech_stack.toLowerCase().includes(q))
    )
  }
  return result
})

const categoryIcons: Record<string, string> = {
  'mobility': '🚌', 'mobility-lite': '🚐', 'education': '📚', 'insurance': '💚',
  'buscall': '📞', 'kiosk': '⛳', 'church': '⛪', 'apartment': '🏢',
  'travel': '🇨🇳', 'personal': '🎨', 'tool': '🤖', 'marketing': '📊',
  'office': '🏢', 'erp': '📋', 'etc': '📁',
}

onMounted(() => {
  if (!projects.value || (projects.value as any[]).length === 0) {
    scanProjects()
  }
})
</script>

<template>
  <div class="h-screen overflow-hidden relative flex flex-col">
    <!-- Background Layers -->
    <div class="fixed inset-0 bg-grid-pattern opacity-30 pointer-events-none" />
    <div class="ambient-glow bg-neon-indigo" style="top: -300px; left: -200px;" />
    <div class="ambient-glow bg-neon-cyan" style="bottom: -300px; right: -200px; animation-delay: -7s;" />
    <div class="ambient-glow bg-neon-purple" style="top: 40%; left: 60%; animation-delay: -12s;" />
    <div class="particle-field">
      <div v-for="i in 15" :key="i" class="particle"
        :style="{
          left: `${(i * 7) % 100}%`,
          animationDuration: `${10 + (i % 5) * 3}s`,
          animationDelay: `${(i * 1.1) % 10}s`,
          width: `${1 + (i % 3)}px`,
          height: `${1 + (i % 3)}px`,
        }"
      />
    </div>

    <!-- ===== TOP NAV BAR ===== -->
    <header class="relative z-20 glass border-b border-neon-cyan/10 app-drag">
      <div class="flex items-center justify-between px-4 sm:px-6 py-3">
        <!-- Left: Logo + Nav -->
        <div class="flex items-center gap-4 sm:gap-8">
          <div class="flex items-center gap-2 sm:gap-3">
            <div class="relative">
              <div class="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-gradient-to-br from-neon-indigo to-neon-cyan flex items-center justify-center shadow-neon">
                <span class="text-base sm:text-lg">🧠</span>
              </div>
              <div class="absolute inset-0 rounded-lg bg-gradient-to-br from-neon-indigo to-neon-cyan animate-ping opacity-20" />
            </div>
            <div>
              <h1 class="text-sm sm:text-base font-bold tracking-tight glow-text leading-none">CORTEX</h1>
              <p class="text-[8px] sm:text-[9px] text-neon-cyan/40 font-mono tracking-[0.3em]">NERVE CENTER</p>
            </div>
          </div>

          <!-- Desktop Nav -->
          <nav class="hidden md:flex items-center gap-1">
            <NuxtLink to="/" class="px-4 py-1.5 rounded-lg text-sm font-medium text-neon-cyan bg-neon-cyan/10 border border-neon-cyan/20">
              대시보드
            </NuxtLink>
            <NuxtLink to="/workspace" class="px-4 py-1.5 rounded-lg text-sm text-brain-text-secondary hover:text-brain-text hover:bg-brain-card/50 transition-colors">
              워크스페이스
            </NuxtLink>
            <NuxtLink to="/graph" class="px-4 py-1.5 rounded-lg text-sm text-brain-text-secondary hover:text-brain-text hover:bg-brain-card/50 transition-colors">
              관계 그래프
            </NuxtLink>
            <NuxtLink to="/settings" class="px-4 py-1.5 rounded-lg text-sm text-brain-text-secondary hover:text-brain-text hover:bg-brain-card/50 transition-colors">
              설정
            </NuxtLink>
          </nav>
        </div>

        <!-- Right: Status + Search + Actions -->
        <div class="flex items-center gap-2 sm:gap-4">
          <div class="hidden sm:flex items-center gap-2">
            <div class="w-2 h-2 rounded-full bg-neon-emerald shadow-[0_0_8px_rgba(52,211,153,0.6)] animate-pulse" />
            <span class="text-[10px] text-neon-emerald/80 font-mono tracking-widest">ONLINE</span>
          </div>
          <div class="hidden sm:block w-[1px] h-5 bg-brain-border" />
          <span class="hidden sm:block text-xs text-brain-muted font-mono data-text">
            {{ new Date().toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }) }}
          </span>
          <div class="hidden sm:block w-[1px] h-5 bg-brain-border" />
          <button
            @click="showSearch = !showSearch"
            class="w-8 h-8 rounded-lg flex items-center justify-center text-brain-muted hover:text-neon-cyan hover:bg-brain-card/50 transition-all"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </button>
          <button
            @click="scanProjects"
            :disabled="scanning"
            class="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r from-neon-indigo to-neon-cyan text-white shadow-neon hover:shadow-neon-lg transition-all disabled:opacity-50"
          >
            <svg v-if="scanning" class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            <svg v-else class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            {{ scanning ? '스캔 중...' : '스캔' }}
          </button>
          <!-- Mobile menu button -->
          <button
            @click="showMobileMenu = !showMobileMenu"
            class="md:hidden w-8 h-8 rounded-lg flex items-center justify-center text-brain-muted hover:text-neon-cyan hover:bg-brain-card/50 transition-all"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
        </div>
      </div>

      <!-- Mobile Nav Menu -->
      <div v-if="showMobileMenu" class="md:hidden px-4 pb-3 space-y-1 animate-slide-up">
        <NuxtLink to="/" class="block px-4 py-2 rounded-lg text-sm font-medium text-neon-cyan bg-neon-cyan/10 border border-neon-cyan/20" @click="showMobileMenu = false">
          대시보드
        </NuxtLink>
        <NuxtLink to="/workspace" class="block px-4 py-2 rounded-lg text-sm text-brain-text-secondary hover:text-brain-text hover:bg-brain-card/50 transition-colors" @click="showMobileMenu = false">
          워크스페이스
        </NuxtLink>
        <NuxtLink to="/graph" class="block px-4 py-2 rounded-lg text-sm text-brain-text-secondary hover:text-brain-text hover:bg-brain-card/50 transition-colors" @click="showMobileMenu = false">
          관계 그래프
        </NuxtLink>
        <NuxtLink to="/settings" class="block px-4 py-2 rounded-lg text-sm text-brain-text-secondary hover:text-brain-text hover:bg-brain-card/50 transition-colors" @click="showMobileMenu = false">
          설정
        </NuxtLink>
        <button
          @click="scanProjects(); showMobileMenu = false"
          :disabled="scanning"
          class="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-gradient-to-r from-neon-indigo to-neon-cyan text-white shadow-neon transition-all disabled:opacity-50"
        >
          {{ scanning ? '스캔 중...' : '🔄 프로젝트 스캔' }}
        </button>
      </div>

      <!-- Search Bar (expandable) -->
      <div v-if="showSearch" class="px-4 sm:px-6 pb-3 animate-slide-up">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="프로젝트, 카테고리, 기술스택 검색..."
          class="w-full bg-brain-bg/60 border border-neon-cyan/20 rounded-xl px-4 py-2.5 text-sm placeholder:text-brain-muted/40 focus:outline-none focus:border-neon-cyan/50 transition-all backdrop-blur-sm font-mono"
          autofocus
        />
      </div>

      <!-- Top scan line -->
      <div class="absolute bottom-0 left-0 w-full h-[1px] overflow-hidden">
        <div class="absolute left-[-100%] w-full h-full bg-gradient-to-r from-transparent via-neon-cyan/50 to-transparent" style="animation: scan 5s ease-in-out infinite;" />
      </div>
    </header>

    <!-- ===== MAIN CONTENT ===== -->
    <main class="flex-1 overflow-y-auto relative z-10">
      <div class="max-w-[1600px] mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">

        <!-- ===== HERO: Stats + Center Visual ===== -->
        <!-- Mobile: compact stats row + hidden brain hub -->
        <div class="animate-slide-up">
          <!-- Mobile: Stats Grid -->
          <div class="grid grid-cols-2 gap-3 md:hidden">
            <DashboardStatCard label="전체 프로젝트" :value="stats?.totalProjects ?? 0" icon="📁" color="indigo" />
            <DashboardStatCard label="Claude 연동" :value="stats?.claudeProjects ?? 0" icon="🤖" color="cyan" />
            <DashboardStatCard label="미커밋" :value="stats?.dirtyProjects ?? 0" icon="⚠️" color="amber" />
            <DashboardStatCard label="세션 데이터" :value="`${stats?.totalSessionMb ?? 0}MB`" icon="💾" color="emerald" />
          </div>

          <!-- Desktop: Original 12-col layout -->
          <div class="hidden md:grid grid-cols-12 gap-4">
            <div class="col-span-3 space-y-4">
              <DashboardStatCard label="전체 프로젝트" :value="stats?.totalProjects ?? 0" icon="📁" color="indigo" />
              <DashboardStatCard label="Claude 연동" :value="stats?.claudeProjects ?? 0" icon="🤖" color="cyan" />
            </div>

            <div class="col-span-6 relative">
              <div class="relative rounded-2xl glass-card overflow-hidden h-full min-h-[240px] flex flex-col items-center justify-center">
                <div class="absolute inset-8 rounded-full border border-neon-cyan/10" style="animation: rotate-slow 20s linear infinite;" />
                <div class="absolute inset-16 rounded-full border border-neon-indigo/10 border-dashed" style="animation: rotate-slow 30s linear infinite reverse;" />
                <div class="relative z-10 text-center">
                  <div class="text-6xl mb-3 animate-float drop-shadow-[0_0_30px_rgba(34,211,238,0.3)]">🧠</div>
                  <h2 class="text-xl font-bold glow-text-cyan mb-1">CORTEX</h2>
                  <p class="text-[11px] text-brain-muted font-mono tracking-[0.2em]">DEVELOPMENT NERVE CENTER</p>
                  <div class="flex items-center justify-center gap-6 mt-4">
                    <div class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-neon-indigo/10 border border-neon-indigo/20">
                      <div class="w-1.5 h-1.5 rounded-full bg-neon-indigo shadow-[0_0_6px_rgba(99,102,241,0.6)]" />
                      <span class="text-xs font-mono text-neon-indigo">{{ categories.length }} 카테고리</span>
                    </div>
                    <div class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-neon-cyan/10 border border-neon-cyan/20">
                      <div class="w-1.5 h-1.5 rounded-full bg-neon-cyan shadow-[0_0_6px_rgba(34,211,238,0.6)]" />
                      <span class="text-xs font-mono text-neon-cyan">{{ filteredProjects.length }} 프로젝트</span>
                    </div>
                  </div>
                </div>
                <div class="absolute top-3 left-3 w-8 h-8 border-l-2 border-t-2 border-neon-cyan/30 rounded-tl-lg" />
                <div class="absolute top-3 right-3 w-8 h-8 border-r-2 border-t-2 border-neon-cyan/30 rounded-tr-lg" />
                <div class="absolute bottom-3 left-3 w-8 h-8 border-l-2 border-b-2 border-neon-cyan/30 rounded-bl-lg" />
                <div class="absolute bottom-3 right-3 w-8 h-8 border-r-2 border-b-2 border-neon-cyan/30 rounded-br-lg" />
                <div class="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                  <div class="absolute top-0 left-[-100%] w-full h-[1px] bg-gradient-to-r from-transparent via-neon-cyan/40 to-transparent" style="animation: scan 4s ease-in-out infinite;" />
                </div>
              </div>
            </div>

            <div class="col-span-3 space-y-4">
              <DashboardStatCard label="미커밋" :value="stats?.dirtyProjects ?? 0" icon="⚠️" color="amber" />
              <DashboardStatCard label="세션 데이터" :value="`${stats?.totalSessionMb ?? 0}MB`" icon="💾" color="emerald" />
            </div>
          </div>
        </div>

        <!-- ===== CATEGORY FILTER BAR ===== -->
        <div class="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button
            @click="selectedCategory = null"
            class="shrink-0 px-4 py-2 rounded-xl text-xs font-mono tracking-wider border transition-all"
            :class="!selectedCategory
              ? 'bg-neon-cyan/10 text-neon-cyan border-neon-cyan/25 shadow-[0_0_10px_rgba(34,211,238,0.1)]'
              : 'border-brain-border/50 text-brain-muted hover:text-brain-text hover:border-brain-border'"
          >
            ALL · {{ (projects as any[])?.length || 0 }}
          </button>
          <button
            v-for="cat in categories"
            :key="cat.name"
            @click="selectedCategory = selectedCategory === cat.name ? null : cat.name"
            class="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono border transition-all"
            :class="selectedCategory === cat.name
              ? 'bg-neon-indigo/10 text-neon-indigo border-neon-indigo/25 shadow-[0_0_10px_rgba(99,102,241,0.1)]'
              : 'border-brain-border/50 text-brain-muted hover:text-brain-text hover:border-brain-border'"
          >
            <span>{{ categoryIcons[cat.name] || '📁' }}</span>
            {{ cat.name }}
            <span class="text-[10px] opacity-60">{{ cat.count }}</span>
          </button>
        </div>

        <!-- ===== TODO PANEL ===== -->
        <TodoPanel />

        <!-- ===== PROJECT GRID ===== -->
        <div>
          <div class="flex items-center justify-between mb-3 sm:mb-4">
            <div class="flex items-center gap-2 sm:gap-3">
              <h3 class="text-base sm:text-lg font-semibold">프로젝트</h3>
              <span v-if="selectedCategory" class="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs bg-neon-indigo/10 text-neon-indigo border border-neon-indigo/20">
                {{ selectedCategory }}
                <button @click="selectedCategory = null" class="hover:text-white transition-colors">✕</button>
              </span>
            </div>
            <span class="text-xs text-brain-muted font-mono data-text tracking-wider">{{ filteredProjects.length }} PROJECTS</span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            <DashboardProjectCard
              v-for="project in filteredProjects"
              :key="project.id"
              :project="project"
              @open-claude="openClaude"
            />
          </div>

          <div v-if="filteredProjects.length === 0 && !scanning" class="text-center py-20">
            <div class="text-5xl mb-4 opacity-30">🔍</div>
            <p class="text-brain-muted font-mono text-sm">프로젝트가 없습니다</p>
            <button @click="scanProjects" class="mt-4 text-neon-cyan hover:underline text-sm font-mono">
              프로젝트 스캔하기
            </button>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
@keyframes rotate-slow {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.scrollbar-hide::-webkit-scrollbar { display: none; }
.scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
</style>
