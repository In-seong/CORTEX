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
  <div class="h-screen overflow-hidden relative flex flex-col">
    <!-- Ambient Glow Orbs -->
    <div class="ambient-glow bg-neon-indigo" style="top: -200px; left: -100px;" />
    <div class="ambient-glow bg-neon-cyan" style="bottom: -200px; right: -100px; animation-delay: -5s;" />

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
            <NuxtLink to="/settings" class="px-4 py-1.5 rounded-lg text-sm text-brain-text-secondary hover:text-brain-text hover:bg-brain-card/50 transition-colors">
              설정
            </NuxtLink>
          </nav>
        </div>

        <div class="flex items-center gap-4">
          <div class="flex items-center gap-2">
            <div class="w-2 h-2 rounded-full bg-neon-emerald shadow-[0_0_8px_rgba(52,211,153,0.6)] animate-pulse" />
            <span class="text-[10px] text-neon-emerald/80 font-mono tracking-widest">ONLINE</span>
          </div>
          <div class="w-[1px] h-5 bg-brain-border" />
          <NuxtLink to="/" class="px-3 py-1.5 rounded-lg text-xs text-brain-muted hover:text-brain-text hover:bg-brain-card/50 transition-colors font-mono">
            ← 대시보드
          </NuxtLink>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="flex-1 overflow-y-auto relative">
      <div class="fixed inset-0 bg-grid-pattern bg-[size:40px_40px] opacity-20 pointer-events-none" />

      <div v-if="project" class="relative z-10 p-6 space-y-6">
        <!-- Header -->
        <div class="flex items-start justify-between animate-slide-up">
          <div>
            <div class="flex items-center gap-3 mb-2">
              <h2 class="text-4xl font-bold glow-text">{{ project.name }}</h2>
              <span
                v-if="project.has_claude_md"
                class="px-2.5 py-1 rounded-full text-sm font-medium bg-neon-indigo/10 text-neon-indigo border border-neon-indigo/20 glow-border"
              >
                Claude 연동
              </span>
            </div>
            <p class="text-brain-muted">
              <span class="font-mono text-sm data-text tracking-wide">{{ project.path }}</span>
            </p>
          </div>
          <span class="text-sm font-mono text-brain-muted glass-card px-3 py-1.5 rounded-lg data-text tracking-wider uppercase">
            {{ project.category }}
          </span>
        </div>

        <!-- Info Grid -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="rounded-xl glass-card hud-corners p-4">
            <p class="text-xs text-brain-muted mb-1 uppercase tracking-widest font-mono">세션</p>
            <p class="text-3xl font-bold font-mono text-neon-indigo glow-text">{{ project.session_count }}</p>
            <p class="text-xs text-brain-muted mt-1 data-text">{{ project.session_size_mb }}MB</p>
          </div>
          <div class="rounded-xl glass-card hud-corners p-4">
            <p class="text-xs text-brain-muted mb-1 uppercase tracking-widest font-mono">메모리</p>
            <p class="text-3xl font-bold font-mono text-neon-cyan glow-text-cyan">{{ project.memory_count }}</p>
          </div>
          <div class="rounded-xl glass-card hud-corners p-4">
            <p class="text-xs text-brain-muted mb-1 uppercase tracking-widest font-mono">에이전트</p>
            <p class="text-3xl font-bold font-mono text-neon-emerald">{{ project.agents_count }}</p>
          </div>
          <div class="rounded-xl glass-card hud-corners p-4">
            <p class="text-xs text-brain-muted mb-1 uppercase tracking-widest font-mono">스킬</p>
            <p class="text-3xl font-bold font-mono text-neon-purple">{{ project.skills_count }}</p>
          </div>
        </div>

        <!-- Claude Prompt -->
        <ClaudePrompt
          v-if="project.path"
          :project-path="project.path"
          :project-name="project.name"
        />

        <!-- Tech Stack -->
        <div v-if="techBadges.length" class="rounded-2xl glass-card p-5">
          <h3 class="text-xs font-semibold text-brain-muted mb-3 uppercase tracking-widest font-mono">TECH STACK</h3>
          <div class="flex flex-wrap gap-2">
            <span
              v-for="tech in techBadges"
              :key="tech"
              class="px-3 py-1.5 rounded-lg text-sm border border-brain-border bg-brain-bg/50 text-brain-text"
            >
              {{ tech }}
            </span>
          </div>
        </div>

        <!-- IDE Launchers + Relations (2-column) -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <!-- IDE Launchers -->
          <div class="rounded-2xl glass-card p-5">
            <h3 class="text-xs font-semibold text-brain-muted mb-3 uppercase tracking-widest font-mono">LAUNCH</h3>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                v-for="ide in ideButtons"
                :key="ide.type"
                @click="launchIde(ide.type)"
                class="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm bg-brain-bg/50 border border-brain-border/50 hover:border-neon-cyan/30 hover:bg-brain-surface hover:shadow-[0_0_10px_rgba(34,211,238,0.1)] transition-all"
              >
                <span>{{ ide.icon }}</span>
                {{ ide.label }}
              </button>
            </div>
          </div>

          <!-- Related Projects -->
          <div class="rounded-2xl glass-card p-5">
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-xs font-semibold text-brain-muted uppercase tracking-widest font-mono">연관 프로젝트</h3>
              <div class="flex items-center gap-1">
                <button
                  v-if="relatedProjects.length"
                  @click="syncRelations"
                  :disabled="syncing"
                  class="w-6 h-6 rounded flex items-center justify-center text-sm text-brain-muted hover:text-neon-cyan hover:bg-brain-card transition-all"
                  :class="syncing ? 'animate-spin' : ''"
                  title="동기화"
                >⟳</button>
                <button
                  @click="showRelationPicker = true"
                  class="w-6 h-6 rounded flex items-center justify-center text-sm text-brain-muted hover:text-neon-indigo hover:bg-brain-card transition-all"
                  title="추가"
                >+</button>
              </div>
            </div>
            <div class="space-y-1">
              <div
                v-for="rel in relatedProjects"
                :key="rel.id"
                class="group flex flex-col px-3 py-2 rounded-lg text-sm text-brain-text-secondary hover:bg-brain-card/50 transition-colors"
              >
                <div class="flex items-center gap-2">
                  <NuxtLink
                    :to="`/projects/${rel.source_id === project?.id ? rel.target_id : rel.source_id}`"
                    class="flex items-center gap-2 flex-1 min-w-0 hover:text-brain-text"
                  >
                    <span class="text-neon-indigo text-sm">🔗</span>
                    <span class="truncate font-medium">{{ rel.source_id === project?.id ? rel.target_name : rel.source_name }}</span>
                  </NuxtLink>
                  <span
                    @click="removeRelation(rel.id)"
                    class="w-4 h-4 rounded flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 text-brain-muted hover:text-neon-rose cursor-pointer"
                  >✕</span>
                </div>
                <span v-if="rel.label" class="text-xs text-brain-muted ml-6 mt-0.5">{{ rel.label }}</span>
              </div>
            </div>
            <p v-if="!relatedProjects.length" class="text-xs text-brain-muted/50">연관 프로젝트 없음</p>
          </div>
        </div>

        <!-- Git Status -->
        <div v-if="project.git_branch" class="rounded-2xl glass-card p-5">
          <h3 class="text-xs font-semibold text-brain-muted mb-3 uppercase tracking-widest font-mono">GIT STATUS</h3>
          <div class="flex items-center gap-4">
            <div class="flex items-center gap-2">
              <svg class="w-4 h-4 text-neon-indigo" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
              <span class="font-mono text-sm">{{ project.git_branch }}</span>
            </div>
            <div v-if="project.git_dirty_count > 0" class="flex items-center gap-2">
              <span class="px-2.5 py-1 rounded-full text-[11px] font-mono bg-neon-amber/10 text-neon-amber border border-neon-amber/20">
                {{ project.git_dirty_count }} 변경사항
              </span>
            </div>
          </div>
        </div>

        <!-- Memories -->
        <div v-if="memories?.length" class="rounded-2xl glass-card p-5">
          <h3 class="text-xs font-semibold text-brain-muted mb-3 uppercase tracking-widest font-mono">MEMORY · {{ memories.length }}</h3>
          <div class="space-y-2">
            <div
              v-for="mem in memories"
              :key="mem.id"
              class="rounded-xl border border-brain-border bg-brain-bg/50 p-3"
            >
              <div class="flex items-center gap-2 mb-1">
                <span class="text-[11px] font-mono text-neon-indigo">{{ mem.type }}</span>
                <span v-if="mem.pinned" class="text-[10px]">📌</span>
              </div>
              <p class="text-sm font-medium">{{ mem.title }}</p>
              <p v-if="mem.content" class="text-[12px] text-brain-muted mt-1 line-clamp-2">{{ mem.content }}</p>
            </div>
          </div>
        </div>

        <!-- Todos -->
        <div v-if="todos?.length" class="rounded-2xl glass-card p-5">
          <h3 class="text-xs font-semibold text-brain-muted mb-3 uppercase tracking-widest font-mono">TASKS · {{ todos.length }}</h3>
          <div class="space-y-2">
            <div
              v-for="todo in todos"
              :key="todo.id"
              class="flex items-start gap-3 rounded-xl border border-brain-border bg-brain-bg/50 p-3"
            >
              <div
                class="w-5 h-5 rounded-full border-2 shrink-0 mt-0.5"
                :class="todo.status === 'completed' ? 'bg-neon-emerald border-neon-emerald' : 'border-brain-muted'"
              />
              <div class="flex-1 min-w-0">
                <p class="text-sm" :class="todo.status === 'completed' ? 'line-through text-brain-muted' : ''">{{ todo.title }}</p>
                <p v-if="todo.description" class="text-[12px] text-brain-muted mt-0.5">{{ todo.description }}</p>
              </div>
              <span
                class="text-[10px] font-mono px-2 py-0.5 rounded-full"
                :class="{
                  'bg-neon-rose/10 text-neon-rose': todo.priority === 'high',
                  'bg-neon-amber/10 text-neon-amber': todo.priority === 'medium',
                  'bg-brain-surface text-brain-muted': todo.priority === 'low',
                }"
              >
                {{ todo.priority }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- Relation Picker Modal -->
    <Teleport to="body">
      <div
        v-if="showRelationPicker"
        class="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]"
        @click.self="showRelationPicker = false"
      >
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="showRelationPicker = false" />
        <div class="relative w-[520px] max-h-[65vh] glass border border-brain-border/50 rounded-2xl shadow-2xl shadow-neon overflow-hidden animate-slide-up hud-corners">
          <!-- Header -->
          <div class="p-4 border-b border-brain-border">
            <h3 class="text-base font-semibold mb-3">연관 프로젝트 추가</h3>

            <!-- Role Label -->
            <input
              v-model="relationLabel"
              type="text"
              placeholder="역할 설명 (예: 사용자 앱, 백엔드 API, 기사 앱...)"
              class="w-full bg-brain-bg border border-brain-border rounded-xl px-4 py-2.5 text-[15px] placeholder:text-brain-muted/50 focus:outline-none focus:border-neon-indigo/50 transition-all mb-3"
            />

            <!-- Search -->
            <div class="relative">
              <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brain-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input
                v-model="relationSearch"
                type="text"
                placeholder="프로젝트 검색..."
                class="w-full bg-brain-bg border border-brain-border rounded-xl pl-10 pr-4 py-2.5 text-[15px] placeholder:text-brain-muted/50 focus:outline-none focus:border-neon-indigo/50 focus:shadow-neon transition-all"
              />
            </div>
          </div>

          <!-- Project List -->
          <div class="overflow-y-auto max-h-[40vh]">
            <button
              v-for="p in availableProjects"
              :key="p.id"
              @click="addRelation(p.id)"
              class="w-full flex items-center gap-3 px-4 py-3 hover:bg-brain-card/50 transition-colors border-b border-brain-border/30 text-left"
            >
              <div class="w-7 h-7 rounded-lg bg-brain-bg border border-brain-border flex items-center justify-center">
                <span v-if="p.has_claude_md" class="text-xs">🤖</span>
                <span v-else class="text-xs">📁</span>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-[15px] font-medium truncate">{{ p.name }}</p>
                <p class="text-xs text-brain-muted font-mono">{{ p.category }}</p>
              </div>
              <span class="text-xs text-neon-indigo shrink-0">+ 연결</span>
            </button>
            <p v-if="!availableProjects.length" class="px-4 py-6 text-center text-[15px] text-brain-muted">
              {{ relationSearch ? '검색 결과 없음' : '추가 가능한 프로젝트 없음' }}
            </p>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
