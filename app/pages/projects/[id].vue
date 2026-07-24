<script setup lang="ts">
const route = useRoute()
const { data: detail, refresh } = await useFetch(`/api/projects/${route.params.id}`)
const { data: allProjects } = await useFetch('/api/projects')

const project = computed(() => detail.value?.project as any)

const techBadges = computed(() => {
  if (!project.value?.tech_stack) return []
  try {
    const parsed = JSON.parse(project.value.tech_stack)
    if (Array.isArray(parsed)) return parsed
  } catch {}
  return project.value.tech_stack.split(',').map((t: string) => t.trim()).filter(Boolean)
})

async function launchIde(type: string) {
  if (!project.value?.path) return
  await $fetch('/api/system/launch', {
    method: 'POST',
    body: { type, path: project.value.path },
  })
}

const ideButtons = [
  { type: 'vscode', label: 'VS Code', icon: '💻' },
  { type: 'android-studio', label: 'Android Studio', icon: '🤖' },
  { type: 'xcode', label: 'Xcode', icon: '🍎' },
  { type: 'finder', label: 'Finder', icon: '📂' },
  { type: 'iterm', label: 'iTerm', icon: '🖥️' },
]

const relatedProjects = computed(() => {
  if (!detail.value?.relations) return []
  return detail.value.relations as any[]
})

const memories = computed(() => detail.value?.memories as any[] || [])
const todos = computed(() => detail.value?.todos as any[] || [])

const showRelationPicker = ref(false)
const relationSearch = ref('')
const relationLabel = ref('')
const syncing = ref(false)

const relatedIds = computed(() => {
  const ids = new Set<number>()
  if (project.value) ids.add(project.value.id)
  for (const rel of relatedProjects.value) {
    ids.add(rel.source_id)
    ids.add(rel.target_id)
  }
  return ids
})

const availableProjects = computed(() => {
  if (!allProjects.value) return []
  let result = (allProjects.value as any[]).filter(p => !relatedIds.value.has(p.id))
  if (relationSearch.value) {
    const q = relationSearch.value.toLowerCase()
    result = result.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    )
  }
  return result.slice(0, 15)
})

async function syncRelations() {
  syncing.value = true
  try {
    await $fetch('/api/projects/relations-sync', {
      method: 'POST',
      body: { project_id: project.value.id },
    })
  } finally {
    syncing.value = false
  }
}

async function addRelation(targetId: number) {
  const label = relationLabel.value.trim()
  await $fetch('/api/projects/relations', {
    method: 'POST',
    body: {
      source_id: project.value.id,
      target_id: targetId,
      relation_type: 'related',
      label,
    },
  })
  showRelationPicker.value = false
  relationSearch.value = ''
  relationLabel.value = ''
  await refresh()
  await syncRelations()
}

async function removeRelation(relationId: number) {
  await $fetch('/api/projects/relations', {
    method: 'DELETE',
    body: { id: relationId },
  })
  await refresh()
  await syncRelations()
}
</script>

<template>
  <div class="h-full overflow-y-auto">
    <div v-if="project" class="max-w-5xl mx-auto p-4 sm:p-6 space-y-5">
      <!-- Header -->
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="flex items-center gap-2.5 mb-1 flex-wrap">
            <NuxtLink to="/" class="text-brain-muted hover:text-brain-text text-sm transition-colors shrink-0">←</NuxtLink>
            <span class="text-xl">{{ project.icon || '📁' }}</span>
            <h2 class="text-xl sm:text-2xl font-semibold truncate">{{ project.name }}</h2>
            <span
              v-if="project.has_claude_md"
              class="px-2 py-0.5 rounded-full text-xs bg-neon-indigo/15 text-neon-indigo border border-neon-indigo/30 shrink-0"
            >
              Claude 연동
            </span>
          </div>
          <p class="text-xs text-brain-muted font-mono truncate">{{ project.path }}</p>
        </div>
        <span class="text-xs font-mono text-brain-muted bg-brain-card border border-brain-border px-2.5 py-1 rounded-md uppercase shrink-0">
          {{ project.category }}
        </span>
      </div>

      <!-- Info Grid -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div class="glass-card p-4">
          <p class="text-[10px] text-brain-muted mb-1 uppercase tracking-[0.08em] font-semibold">세션</p>
          <p class="text-2xl font-semibold font-mono">{{ project.session_count }}</p>
          <p class="text-xs text-brain-muted mt-0.5 font-mono">{{ project.session_size_mb }}MB</p>
        </div>
        <div class="glass-card p-4">
          <p class="text-[10px] text-brain-muted mb-1 uppercase tracking-[0.08em] font-semibold">메모리</p>
          <p class="text-2xl font-semibold font-mono">{{ project.memory_count }}</p>
        </div>
        <div class="glass-card p-4">
          <p class="text-[10px] text-brain-muted mb-1 uppercase tracking-[0.08em] font-semibold">에이전트</p>
          <p class="text-2xl font-semibold font-mono">{{ project.agents_count }}</p>
        </div>
        <div class="glass-card p-4">
          <p class="text-[10px] text-brain-muted mb-1 uppercase tracking-[0.08em] font-semibold">스킬</p>
          <p class="text-2xl font-semibold font-mono">{{ project.skills_count }}</p>
        </div>
      </div>

      <!-- Claude Prompt -->
      <ClaudePrompt
        v-if="project.path"
        :project-path="project.path"
        :project-name="project.name"
      />

      <!-- Tech Stack -->
      <div v-if="techBadges.length" class="glass-card p-4">
        <h3 class="text-[10px] font-semibold text-brain-muted mb-2.5 uppercase tracking-[0.08em]">기술 스택</h3>
        <div class="flex flex-wrap gap-1.5">
          <span
            v-for="tech in techBadges"
            :key="tech"
            class="px-2.5 py-1 rounded-md text-xs border border-brain-border bg-brain-bg text-brain-text-secondary"
          >
            {{ tech }}
          </span>
        </div>
      </div>

      <!-- IDE Launchers + Relations (2-column) -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <!-- IDE Launchers -->
        <div class="glass-card p-4">
          <h3 class="text-[10px] font-semibold text-brain-muted mb-2.5 uppercase tracking-[0.08em]">실행</h3>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            <button
              v-for="ide in ideButtons"
              :key="ide.type"
              @click="launchIde(ide.type)"
              class="flex items-center gap-1.5 px-2.5 py-2 rounded-md text-xs bg-brain-bg border border-brain-border hover:border-brain-border-light transition-colors"
            >
              <span>{{ ide.icon }}</span>
              {{ ide.label }}
            </button>
          </div>
        </div>

        <!-- Related Projects -->
        <div class="glass-card p-4">
          <div class="flex items-center justify-between mb-2.5">
            <h3 class="text-[10px] font-semibold text-brain-muted uppercase tracking-[0.08em]">연관 프로젝트</h3>
            <div class="flex items-center gap-1">
              <button
                v-if="relatedProjects.length"
                @click="syncRelations"
                :disabled="syncing"
                class="w-6 h-6 rounded flex items-center justify-center text-sm text-brain-muted hover:text-brain-text hover:bg-white/[0.06] transition-colors"
                :class="syncing ? 'animate-spin' : ''"
                title="CLAUDE.md 동기화"
              >⟳</button>
              <button
                @click="showRelationPicker = true"
                class="w-6 h-6 rounded flex items-center justify-center text-sm text-brain-muted hover:text-brain-text hover:bg-white/[0.06] transition-colors"
                title="추가"
              >+</button>
            </div>
          </div>
          <div class="space-y-0.5">
            <div
              v-for="rel in relatedProjects"
              :key="rel.id"
              class="group flex flex-col px-2 py-1.5 rounded-md text-sm text-brain-text-secondary hover:bg-white/[0.04] transition-colors"
            >
              <div class="flex items-center gap-2">
                <NuxtLink
                  :to="`/projects/${rel.source_id === project?.id ? rel.target_id : rel.source_id}`"
                  class="flex items-center gap-2 flex-1 min-w-0 hover:text-brain-text"
                >
                  <span class="text-neon-indigo text-xs">🔗</span>
                  <span class="truncate text-[13px] font-medium">{{ rel.source_id === project?.id ? rel.target_name : rel.source_name }}</span>
                </NuxtLink>
                <span
                  @click="removeRelation(rel.id)"
                  class="w-4 h-4 rounded flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 text-brain-muted hover:text-neon-rose cursor-pointer"
                >✕</span>
              </div>
              <span v-if="rel.label" class="text-xs text-brain-muted ml-6 mt-0.5">{{ rel.label }}</span>
            </div>
          </div>
          <p v-if="!relatedProjects.length" class="text-xs text-brain-muted/60">연관 프로젝트 없음</p>
        </div>
      </div>

      <!-- Git Status -->
      <div v-if="project.git_branch" class="glass-card p-4">
        <h3 class="text-[10px] font-semibold text-brain-muted mb-2.5 uppercase tracking-[0.08em]">GIT</h3>
        <div class="flex items-center gap-4">
          <div class="flex items-center gap-2">
            <svg class="w-4 h-4 text-brain-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
            <span class="font-mono text-sm">{{ project.git_branch }}</span>
          </div>
          <span v-if="project.git_dirty_count > 0" class="px-2 py-0.5 rounded-full text-[11px] font-mono bg-neon-amber/10 text-neon-amber border border-neon-amber/30">
            {{ project.git_dirty_count }} 변경사항
          </span>
        </div>
      </div>

      <!-- Memories -->
      <div v-if="memories?.length" class="glass-card p-4">
        <h3 class="text-[10px] font-semibold text-brain-muted mb-2.5 uppercase tracking-[0.08em]">메모리 · {{ memories.length }}</h3>
        <div class="space-y-2">
          <div
            v-for="mem in memories"
            :key="mem.id"
            class="rounded-lg border border-brain-border bg-brain-bg p-3"
          >
            <div class="flex items-center gap-2 mb-1">
              <span class="text-[11px] font-mono text-neon-indigo">{{ mem.type }}</span>
              <span v-if="mem.pinned" class="text-[10px]">📌</span>
            </div>
            <p class="text-sm font-medium">{{ mem.title }}</p>
            <p v-if="mem.content" class="text-xs text-brain-muted mt-1 line-clamp-2">{{ mem.content }}</p>
          </div>
        </div>
      </div>

      <!-- Todos -->
      <div v-if="todos?.length" class="glass-card p-4">
        <h3 class="text-[10px] font-semibold text-brain-muted mb-2.5 uppercase tracking-[0.08em]">할 일 · {{ todos.length }}</h3>
        <div class="space-y-2">
          <div
            v-for="todo in todos"
            :key="todo.id"
            class="flex items-start gap-3 rounded-lg border border-brain-border bg-brain-bg p-3"
          >
            <div
              class="w-4 h-4 rounded-full border-2 shrink-0 mt-0.5"
              :class="todo.status === 'completed' ? 'bg-neon-emerald border-neon-emerald' : 'border-brain-muted'"
            />
            <div class="flex-1 min-w-0">
              <p class="text-sm" :class="todo.status === 'completed' ? 'line-through text-brain-muted' : ''">{{ todo.title }}</p>
              <p v-if="todo.description" class="text-xs text-brain-muted mt-0.5">{{ todo.description }}</p>
            </div>
            <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-brain-card text-brain-muted border border-brain-border">
              {{ todo.priority }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Relation Picker Modal -->
    <Teleport to="body">
      <div
        v-if="showRelationPicker"
        class="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4"
        @click.self="showRelationPicker = false"
      >
        <div class="absolute inset-0 bg-black/60" @click="showRelationPicker = false" />
        <div class="relative w-full sm:w-[520px] max-h-[65vh] bg-brain-card border border-brain-border-light rounded-xl shadow-floating overflow-hidden animate-slide-up">
          <!-- Header -->
          <div class="p-4 border-b border-brain-border">
            <h3 class="text-sm font-semibold mb-3">연관 프로젝트 추가</h3>

            <!-- Role Label -->
            <input
              v-model="relationLabel"
              type="text"
              placeholder="역할 설명 (예: 사용자 앱, 백엔드 API, 기사 앱...)"
              class="w-full bg-brain-bg border border-brain-border rounded-md px-3 py-2 text-sm placeholder:text-brain-muted/60 focus:outline-none focus:border-neon-indigo/50 transition-colors mb-2.5"
            />

            <!-- Search -->
            <div class="relative">
              <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brain-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input
                v-model="relationSearch"
                type="text"
                placeholder="프로젝트 검색..."
                class="w-full bg-brain-bg border border-brain-border rounded-md pl-10 pr-4 py-2 text-sm placeholder:text-brain-muted/60 focus:outline-none focus:border-neon-indigo/50 transition-colors"
              />
            </div>
          </div>

          <!-- Project List -->
          <div class="overflow-y-auto max-h-[40vh]">
            <button
              v-for="p in availableProjects"
              :key="p.id"
              @click="addRelation(p.id)"
              class="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.04] transition-colors border-b border-brain-border/50 text-left"
            >
              <span class="text-base shrink-0">{{ p.icon || '📁' }}</span>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium truncate">{{ p.name }}</p>
                <p class="text-xs text-brain-muted font-mono">{{ p.category }}</p>
              </div>
              <span class="text-xs text-neon-indigo shrink-0">+ 연결</span>
            </button>
            <p v-if="!availableProjects.length" class="px-4 py-6 text-center text-sm text-brain-muted">
              {{ relationSearch ? '검색 결과 없음' : '추가 가능한 프로젝트 없음' }}
            </p>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
