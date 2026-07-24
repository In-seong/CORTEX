<script setup lang="ts">
const { data: stats, refresh: refreshStats } = await useFetch('/api/system/stats')
const { data: projects, refresh: refreshProjects } = await useFetch('/api/projects')
const searchQuery = ref('')
const selectedCategory = ref<string | null>(null)
const router = useRouter()
const { openProject } = useWorkspace()

function openClaude(project: any) {
  openProject(project, 'chat')
  router.push('/workspace')
}

function goSettings() {
  router.push('/settings')
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

</script>

<template>
  <div class="h-full overflow-y-auto">
    <div class="max-w-[1400px] mx-auto p-4 sm:p-6 space-y-5">

      <!-- Page Header -->
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-lg font-semibold">대시보드</h2>
          <p class="text-xs text-brain-muted mt-0.5">
            {{ new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' }) }}
          </p>
        </div>
        <button
          @click="goSettings"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-brain-border text-brain-text-secondary hover:text-brain-text hover:border-brain-border-light transition-colors"
        >
          ⚙ 프로젝트 관리
        </button>
      </div>

      <!-- Stats -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <DashboardStatCard label="전체 프로젝트" :value="stats?.totalProjects ?? 0" icon="📁" color="indigo" />
        <DashboardStatCard label="Claude 연동" :value="stats?.claudeProjects ?? 0" icon="🤖" color="cyan" />
        <DashboardStatCard label="미커밋" :value="stats?.dirtyProjects ?? 0" icon="⚠️" color="amber" />
        <DashboardStatCard label="세션 데이터" :value="`${stats?.totalSessionMb ?? 0}MB`" icon="💾" color="emerald" />
      </div>

      <!-- Todo Panel -->
      <TodoPanel />

      <!-- Claude Usage -->
      <UsagePanel />

      <!-- Projects -->
      <div>
        <div class="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <div class="flex items-center gap-2">
            <h3 class="text-sm font-semibold">프로젝트</h3>
            <span class="text-xs text-brain-muted font-mono">{{ filteredProjects.length }}</span>
          </div>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="이름·카테고리·기술스택 검색..."
            class="w-full sm:w-64 bg-brain-card border border-brain-border rounded-md px-3 py-1.5 text-xs placeholder:text-brain-muted/60 focus:outline-none focus:border-neon-indigo/50 transition-colors"
          />
        </div>

        <!-- Category Filter -->
        <div class="flex items-center gap-1.5 overflow-x-auto pb-3 scrollbar-hide">
          <button
            @click="selectedCategory = null"
            class="shrink-0 px-2.5 py-1 rounded-md text-xs border transition-colors"
            :class="!selectedCategory
              ? 'bg-neon-indigo/15 text-neon-indigo border-neon-indigo/30'
              : 'border-brain-border text-brain-muted hover:text-brain-text hover:border-brain-border-light'"
          >
            전체 {{ (projects as any[])?.length || 0 }}
          </button>
          <button
            v-for="cat in categories"
            :key="cat.name"
            @click="selectedCategory = selectedCategory === cat.name ? null : cat.name"
            class="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-md text-xs border transition-colors"
            :class="selectedCategory === cat.name
              ? 'bg-neon-indigo/15 text-neon-indigo border-neon-indigo/30'
              : 'border-brain-border text-brain-muted hover:text-brain-text hover:border-brain-border-light'"
          >
            <span>{{ categoryIcons[cat.name] || '📁' }}</span>
            {{ cat.name }}
            <span class="opacity-60">{{ cat.count }}</span>
          </button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          <DashboardProjectCard
            v-for="project in filteredProjects"
            :key="project.id"
            :project="project"
            @open-claude="openClaude"
          />
        </div>

        <div v-if="filteredProjects.length === 0" class="text-center py-16">
          <p class="text-brain-muted text-sm mb-3">등록된 프로젝트가 없습니다</p>
          <button @click="goSettings" class="text-neon-indigo hover:underline text-sm">
            프로젝트 관리에서 추가하기
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
