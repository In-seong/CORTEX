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
  <div class="h-full overflow-y-auto">
    <div class="max-w-5xl mx-auto p-4 sm:p-6 space-y-4">
      <!-- Title -->
      <div>
        <h2 class="text-lg font-semibold">프로젝트 설정</h2>
        <p class="text-xs text-brain-muted mt-0.5">
          {{ projects.length }} 프로젝트 · {{ hiddenCount }} 숨김
        </p>
      </div>

      <!-- Filters -->
      <div class="glass-card p-3">
        <div class="flex items-center gap-3 flex-wrap">
          <!-- Search -->
          <div class="relative flex-1 min-w-[200px]">
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brain-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="프로젝트 검색..."
              class="w-full pl-10 pr-4 py-2 rounded-md bg-brain-bg border border-brain-border text-sm placeholder:text-brain-muted/60 focus:outline-none focus:border-neon-indigo/50 transition-colors"
            />
          </div>

          <!-- Category Filter -->
          <div class="flex items-center gap-1.5 flex-wrap">
            <button
              @click="filterCategory = null"
              class="px-2.5 py-1.5 rounded-md text-xs transition-colors"
              :class="filterCategory === null ? 'bg-neon-indigo/15 text-neon-indigo border border-neon-indigo/30' : 'text-brain-muted hover:text-brain-text hover:bg-white/[0.04] border border-transparent'"
            >
              전체
            </button>
            <button
              v-for="cat in allCategories" :key="cat"
              @click="filterCategory = filterCategory === cat ? null : cat"
              class="px-2.5 py-1.5 rounded-md text-xs transition-colors"
              :class="filterCategory === cat ? 'bg-neon-indigo/15 text-neon-indigo border border-neon-indigo/30' : 'text-brain-muted hover:text-brain-text hover:bg-white/[0.04] border border-transparent'"
            >
              {{ categoryIcons[cat] || '📁' }} {{ cat }}
            </button>
          </div>

          <!-- Bulk Actions -->
          <div class="flex items-center gap-1.5 ml-auto">
            <button
              @click="bulkHide(true)"
              class="px-2.5 py-1.5 rounded-md text-xs text-brain-muted hover:text-neon-amber border border-brain-border hover:border-neon-amber/30 transition-colors"
            >
              필터 결과 모두 숨김
            </button>
            <button
              @click="bulkHide(false)"
              class="px-2.5 py-1.5 rounded-md text-xs text-brain-muted hover:text-neon-emerald border border-brain-border hover:border-neon-emerald/30 transition-colors"
            >
              필터 결과 모두 표시
            </button>
          </div>
        </div>
      </div>

      <!-- Project Table -->
      <div class="glass-card overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr class="border-b border-brain-border">
                <th class="text-left px-4 py-2.5 text-[10px] font-semibold text-brain-muted tracking-[0.08em] uppercase">상태</th>
                <th class="text-left px-4 py-2.5 text-[10px] font-semibold text-brain-muted tracking-[0.08em] uppercase">프로젝트</th>
                <th class="text-left px-4 py-2.5 text-[10px] font-semibold text-brain-muted tracking-[0.08em] uppercase">경로</th>
                <th class="text-left px-4 py-2.5 text-[10px] font-semibold text-brain-muted tracking-[0.08em] uppercase">카테고리</th>
                <th class="text-left px-4 py-2.5 text-[10px] font-semibold text-brain-muted tracking-[0.08em] uppercase">기술 스택</th>
                <th class="text-center px-4 py-2.5 text-[10px] font-semibold text-brain-muted tracking-[0.08em] uppercase">표시/숨김</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="project in filteredProjects" :key="project.id"
                class="border-b border-brain-border/50 transition-colors hover:bg-white/[0.02]"
                :class="{ 'opacity-40': project.is_hidden }"
              >
                <!-- Status Dot -->
                <td class="px-4 py-2.5">
                  <div class="flex items-center justify-center">
                    <div
                      class="w-2 h-2 rounded-full"
                      :class="project.is_hidden ? 'bg-brain-muted/40' : 'bg-neon-emerald'"
                    />
                  </div>
                </td>

                <!-- Name -->
                <td class="px-4 py-2.5">
                  <div class="flex items-center gap-2">
                    <span class="text-base">{{ project.icon || '📁' }}</span>
                    <div>
                      <span class="text-sm font-medium">{{ project.name }}</span>
                      <span v-if="project.git_dirty_count > 0" class="ml-2 text-[10px] text-neon-amber font-mono">
                        {{ project.git_dirty_count }} dirty
                      </span>
                    </div>
                  </div>
                </td>

                <!-- Path -->
                <td class="px-4 py-2.5">
                  <span class="text-xs text-brain-muted font-mono truncate max-w-[200px] block">
                    {{ project.path.replace('/Users/scoop/', '~/') }}
                  </span>
                </td>

                <!-- Category -->
                <td class="px-4 py-2.5">
                  <div v-if="editingCategory === project.id" class="flex items-center gap-1">
                    <input
                      v-model="categoryInput"
                      @keyup.enter="saveCategory(project)"
                      @keyup.escape="editingCategory = null"
                      @blur="saveCategory(project)"
                      class="w-28 px-2 py-1 rounded bg-brain-bg border border-neon-indigo/40 text-xs font-mono focus:outline-none"
                      autofocus
                    />
                  </div>
                  <button
                    v-else
                    @click="startEditCategory(project)"
                    class="flex items-center gap-1 px-2 py-1 rounded text-xs text-brain-text-secondary hover:text-brain-text hover:bg-white/[0.04] transition-colors group"
                  >
                    <span>{{ categoryIcons[project.category] || '📁' }}</span>
                    <span>{{ project.category }}</span>
                    <svg class="w-3 h-3 opacity-0 group-hover:opacity-100 text-brain-muted transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                </td>

                <!-- Tech Stack -->
                <td class="px-4 py-2.5">
                  <div class="flex items-center gap-1 flex-wrap max-w-[200px]">
                    <template v-if="project.tech_stack">
                      <span
                        v-for="tech in JSON.parse(project.tech_stack || '[]').slice(0, 3)"
                        :key="tech"
                        class="px-1.5 py-0.5 rounded text-[10px] font-mono bg-brain-bg text-brain-text-secondary border border-brain-border"
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
                <td class="px-4 py-2.5">
                  <div class="flex items-center justify-center">
                    <button
                      @click="toggleHidden(project)"
                      :disabled="saving === project.id"
                      class="relative w-10 h-[22px] rounded-full transition-colors duration-200 focus:outline-none"
                      :class="project.is_hidden ? 'bg-white/10' : 'bg-neon-indigo/60'"
                    >
                      <div
                        class="absolute top-0.5 w-[18px] h-[18px] rounded-full bg-white transition-all duration-200"
                        :class="project.is_hidden ? 'left-0.5 opacity-60' : 'left-[20px]'"
                      />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="filteredProjects.length === 0" class="py-12 text-center">
          <p class="text-brain-muted text-sm">검색 결과가 없습니다</p>
        </div>
      </div>
    </div>
  </div>
</template>
