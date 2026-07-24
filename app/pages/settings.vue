<script setup lang="ts">
const projects = ref<any[]>([])

async function refresh() {
  projects.value = await $fetch('/api/projects', { query: { include_hidden: 'true' } }) as any[]
}

await refresh()

const saving = ref<number | null>(null)
const editingCategory = ref<number | null>(null)
const categoryInput = ref('')

const categoryIcons: Record<string, string> = {
  'mobility': '🚌', 'mobility-lite': '🚐', 'education': '📚', 'insurance': '💚',
  'buscall': '📞', 'kiosk': '⛳', 'church': '⛪', 'apartment': '🏢',
  'travel': '🇨🇳', 'personal': '🎨', 'tool': '🤖', 'marketing': '📊',
  'office': '🏢', 'erp': '📋', 'etc': '📁',
}

const allCategories = computed(() => {
  if (!projects.value) return []
  const cats = new Set<string>()
  for (const p of projects.value as any[]) {
    cats.add(p.category)
  }
  return Array.from(cats).sort()
})

const filterCategory = ref<string | null>(null)
const searchQuery = ref('')

const filteredProjects = computed(() => {
  if (!projects.value) return []
  let result = [...projects.value]
  if (filterCategory.value) {
    result = result.filter(p => p.category === filterCategory.value)
  }
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.path.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    )
  }
  result.sort((a, b) => a.is_hidden - b.is_hidden || a.name.localeCompare(b.name))
  return result
})

const hiddenCount = computed(() => {
  if (!projects.value) return 0
  return projects.value.filter(p => p.is_hidden).length
})

async function toggleHidden(project: any) {
  saving.value = project.id
  try {
    await $fetch(`/api/projects/${project.id}`, {
      method: 'PUT',
      body: { is_hidden: !project.is_hidden }
    })
    await refresh()
  } finally {
    saving.value = null
  }
}

function startEditCategory(project: any) {
  editingCategory.value = project.id
  categoryInput.value = project.category
}

async function saveCategory(project: any) {
  if (categoryInput.value === project.category) {
    editingCategory.value = null
    return
  }
  saving.value = project.id
  try {
    await $fetch(`/api/projects/${project.id}`, {
      method: 'PUT',
      body: { category: categoryInput.value.trim() || 'etc' }
    })
    await refresh()
  } finally {
    saving.value = null
    editingCategory.value = null
  }
}

async function bulkHide(hidden: boolean) {
  const targets = filteredProjects.value.filter(p => p.is_hidden !== hidden)
  for (const p of targets) {
    await $fetch(`/api/projects/${p.id}`, {
      method: 'PUT',
      body: { is_hidden: hidden }
    })
  }
  await refresh()
}
</script>

<template>
  <div class="h-screen overflow-hidden relative flex flex-col">
    <!-- Background -->
    <div class="fixed inset-0 bg-grid-pattern opacity-30 pointer-events-none" />
    <div class="ambient-glow bg-neon-indigo" style="top: -300px; left: -200px;" />
    <div class="ambient-glow bg-neon-cyan" style="bottom: -300px; right: -200px; animation-delay: -7s;" />
    <div class="particle-field">
      <div v-for="i in 8" :key="i" class="particle"
        :style="{
          left: `${(i * 13) % 100}%`,
          animationDuration: `${12 + (i % 4) * 4}s`,
          animationDelay: `${(i * 1.5) % 8}s`,
          width: `${1 + (i % 2)}px`,
          height: `${1 + (i % 2)}px`,
        }"
      />
    </div>

    <!-- ===== TOP NAV BAR ===== -->
    <header class="relative z-20 glass border-b border-neon-cyan/10 app-drag">
      <div class="flex items-center justify-between px-6 py-3">
        <div class="flex items-center gap-8">
          <NuxtLink to="/" class="flex items-center gap-3">
            <div class="relative">
              <div class="w-9 h-9 rounded-lg bg-gradient-to-br from-neon-indigo to-neon-cyan flex items-center justify-center shadow-neon">
                <span class="text-lg">🧠</span>
              </div>
            </div>
            <div>
              <h1 class="text-base font-bold tracking-tight glow-text leading-none">CORTEX</h1>
              <p class="text-[9px] text-neon-cyan/40 font-mono tracking-[0.3em]">NERVE CENTER</p>
            </div>
          </NuxtLink>

          <nav class="flex items-center gap-1">
            <NuxtLink to="/" class="px-4 py-1.5 rounded-lg text-sm text-brain-text-secondary hover:text-brain-text hover:bg-brain-card/50 transition-colors">
              대시보드
            </NuxtLink>
            <NuxtLink to="/workspace" class="px-4 py-1.5 rounded-lg text-sm text-brain-text-secondary hover:text-brain-text hover:bg-brain-card/50 transition-colors">
              워크스페이스
            </NuxtLink>
            <NuxtLink to="/graph" class="px-4 py-1.5 rounded-lg text-sm text-brain-text-secondary hover:text-brain-text hover:bg-brain-card/50 transition-colors">
              관계 그래프
            </NuxtLink>
            <NuxtLink to="/settings" class="px-4 py-1.5 rounded-lg text-sm font-medium text-neon-cyan bg-neon-cyan/10 border border-neon-cyan/20">
              설정
            </NuxtLink>
          </nav>
        </div>

        <div class="flex items-center gap-4">
          <div class="flex items-center gap-2">
            <div class="w-2 h-2 rounded-full bg-neon-emerald shadow-[0_0_8px_rgba(52,211,153,0.6)] animate-pulse" />
            <span class="text-[10px] text-neon-emerald/80 font-mono tracking-widest">ONLINE</span>
          </div>
        </div>
      </div>
    </header>

    <!-- ===== MAIN CONTENT ===== -->
    <main class="flex-1 overflow-auto relative z-10 p-6">
      <div class="max-w-6xl mx-auto space-y-6">
        <!-- Title -->
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-xl font-bold glow-text tracking-wide">PROJECT SETTINGS</h2>
            <p class="text-xs text-brain-muted font-mono mt-1">
              {{ projects.length }} 프로젝트 · {{ hiddenCount }} 숨김
            </p>
          </div>
        </div>

        <!-- Filters -->
        <div class="glass-card p-4">
          <div class="flex items-center gap-4 flex-wrap">
            <!-- Search -->
            <div class="relative flex-1 min-w-[200px]">
              <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brain-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                v-model="searchQuery"
                type="text"
                placeholder="프로젝트 검색..."
                class="w-full pl-10 pr-4 py-2 rounded-lg bg-brain-bg/80 border border-brain-border text-sm text-brain-text placeholder-brain-muted focus:outline-none focus:border-neon-cyan/50 font-mono transition-colors"
              />
            </div>

            <!-- Category Filter -->
            <div class="flex items-center gap-2 flex-wrap">
              <button
                @click="filterCategory = null"
                class="px-3 py-1.5 rounded-lg text-xs font-mono transition-all"
                :class="filterCategory === null ? 'bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30' : 'text-brain-muted hover:text-brain-text hover:bg-brain-card/50'"
              >
                ALL
              </button>
              <button
                v-for="cat in allCategories" :key="cat"
                @click="filterCategory = filterCategory === cat ? null : cat"
                class="px-3 py-1.5 rounded-lg text-xs font-mono transition-all"
                :class="filterCategory === cat ? 'bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30' : 'text-brain-muted hover:text-brain-text hover:bg-brain-card/50'"
              >
                {{ categoryIcons[cat] || '📁' }} {{ cat }}
              </button>
            </div>

            <!-- Bulk Actions -->
            <div class="flex items-center gap-2 ml-auto">
              <button
                @click="bulkHide(true)"
                class="px-3 py-1.5 rounded-lg text-xs text-brain-muted hover:text-neon-amber border border-brain-border hover:border-neon-amber/30 transition-all font-mono"
              >
                필터 결과 모두 숨김
              </button>
              <button
                @click="bulkHide(false)"
                class="px-3 py-1.5 rounded-lg text-xs text-brain-muted hover:text-neon-emerald border border-brain-border hover:border-neon-emerald/30 transition-all font-mono"
              >
                필터 결과 모두 표시
              </button>
            </div>
          </div>
        </div>

        <!-- Project Table -->
        <div class="glass-card overflow-hidden">
          <table class="w-full">
            <thead>
              <tr class="border-b border-brain-border">
                <th class="text-left px-4 py-3 text-[10px] font-mono text-neon-cyan/60 tracking-[0.2em] uppercase">상태</th>
                <th class="text-left px-4 py-3 text-[10px] font-mono text-neon-cyan/60 tracking-[0.2em] uppercase">프로젝트</th>
                <th class="text-left px-4 py-3 text-[10px] font-mono text-neon-cyan/60 tracking-[0.2em] uppercase">경로</th>
                <th class="text-left px-4 py-3 text-[10px] font-mono text-neon-cyan/60 tracking-[0.2em] uppercase">카테고리</th>
                <th class="text-left px-4 py-3 text-[10px] font-mono text-neon-cyan/60 tracking-[0.2em] uppercase">기술 스택</th>
                <th class="text-center px-4 py-3 text-[10px] font-mono text-neon-cyan/60 tracking-[0.2em] uppercase">표시/숨김</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="project in filteredProjects" :key="project.id"
                class="border-b border-brain-border/50 transition-colors hover:bg-brain-card/30"
                :class="{ 'opacity-40': project.is_hidden }"
              >
                <!-- Status Dot -->
                <td class="px-4 py-3">
                  <div class="flex items-center justify-center">
                    <div
                      class="w-2 h-2 rounded-full"
                      :class="project.is_hidden ? 'bg-brain-muted/40' : 'bg-neon-emerald shadow-[0_0_6px_rgba(52,211,153,0.5)]'"
                    />
                  </div>
                </td>

                <!-- Name -->
                <td class="px-4 py-3">
                  <div class="flex items-center gap-2">
                    <span class="text-lg">{{ project.icon || '📁' }}</span>
                    <div>
                      <span class="text-sm font-medium text-brain-text">{{ project.name }}</span>
                      <span v-if="project.git_dirty_count > 0" class="ml-2 text-[10px] text-neon-amber font-mono">
                        {{ project.git_dirty_count }} dirty
                      </span>
                    </div>
                  </div>
                </td>

                <!-- Path -->
                <td class="px-4 py-3">
                  <span class="text-xs text-brain-muted font-mono truncate max-w-[200px] block">
                    {{ project.path.replace('/Users/scoop/', '~/') }}
                  </span>
                </td>

                <!-- Category -->
                <td class="px-4 py-3">
                  <div v-if="editingCategory === project.id" class="flex items-center gap-1">
                    <input
                      v-model="categoryInput"
                      @keyup.enter="saveCategory(project)"
                      @keyup.escape="editingCategory = null"
                      @blur="saveCategory(project)"
                      ref="categoryInputEl"
                      class="w-28 px-2 py-1 rounded bg-brain-bg border border-neon-cyan/40 text-xs font-mono text-brain-text focus:outline-none"
                      autofocus
                    />
                  </div>
                  <button
                    v-else
                    @click="startEditCategory(project)"
                    class="flex items-center gap-1 px-2 py-1 rounded text-xs font-mono text-brain-text-secondary hover:text-neon-cyan hover:bg-brain-card/50 transition-all group"
                  >
                    <span>{{ categoryIcons[project.category] || '📁' }}</span>
                    <span>{{ project.category }}</span>
                    <svg class="w-3 h-3 opacity-0 group-hover:opacity-100 text-neon-cyan/50 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                </td>

                <!-- Tech Stack -->
                <td class="px-4 py-3">
                  <div class="flex items-center gap-1 flex-wrap max-w-[200px]">
                    <template v-if="project.tech_stack">
                      <span
                        v-for="tech in JSON.parse(project.tech_stack || '[]').slice(0, 3)"
                        :key="tech"
                        class="px-1.5 py-0.5 rounded text-[10px] font-mono bg-brain-card/80 text-brain-text-secondary border border-brain-border/50"
                      >
                        {{ tech }}
                      </span>
                      <span v-if="JSON.parse(project.tech_stack || '[]').length > 3" class="text-[10px] text-brain-muted">
                        +{{ JSON.parse(project.tech_stack || '[]').length - 3 }}
                      </span>
                    </template>
                    <span v-else class="text-[10px] text-brain-muted">—</span>
                  </div>
                </td>

                <!-- Toggle -->
                <td class="px-4 py-3">
                  <div class="flex items-center justify-center">
                    <button
                      @click="toggleHidden(project)"
                      :disabled="saving === project.id"
                      class="relative w-11 h-6 rounded-full transition-all duration-300 focus:outline-none"
                      :class="project.is_hidden ? 'bg-brain-border' : 'bg-neon-cyan/30 shadow-[0_0_10px_rgba(34,211,238,0.2)]'"
                    >
                      <div
                        class="absolute top-0.5 w-5 h-5 rounded-full transition-all duration-300 shadow-md"
                        :class="project.is_hidden
                          ? 'left-0.5 bg-brain-muted'
                          : 'left-[22px] bg-neon-cyan shadow-[0_0_8px_rgba(34,211,238,0.5)]'"
                      />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          <div v-if="filteredProjects.length === 0" class="py-12 text-center">
            <p class="text-brain-muted font-mono text-sm">검색 결과가 없습니다</p>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
