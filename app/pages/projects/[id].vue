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
const relationDirection = ref<'child' | 'parent' | 'related'>('child')
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
  // child = source가 모체. '상위로 연결'이면 방향을 뒤집는다.
  const isParent = relationDirection.value === 'parent'
  await $fetch('/api/projects/relations', {
    method: 'POST',
    body: {
      source_id: isParent ? targetId : project.value.id,
      target_id: isParent ? project.value.id : targetId,
      relation_type: relationDirection.value === 'related' ? 'related' : 'child',
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

// ===== 병렬 워크트리 =====
const router = useRouter()
const { openProject } = useWorkspace()
const { data: worktreeData, refresh: refreshWorktrees } = await useFetch(`/api/worktrees`, {
  query: { project_id: route.params.id },
})
const worktrees = computed(() => (worktreeData.value as any)?.worktrees || [])

const wtName = ref('')
const wtCount = ref(1)
const wtPrompt = ref('')
const wtCreating = ref(false)
const wtError = ref('')

function claudeCommandFor(prompt: string): string | undefined {
  const p = prompt.trim()
  if (!p) return undefined
  return `/Users/scoop/.local/bin/claude "${p.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

function openWorktreeTab(wt: { path: string; branch: string }, command?: string) {
  openProject({
    id: `wt:${wt.path}`,
    name: `${project.value.name} · ${wt.branch}`,
    path: wt.path,
    category: 'worktree',
    has_claude_md: project.value.has_claude_md,
    command,
  }, 'claude')
}

async function createWorktrees() {
  if (!wtName.value.trim() || wtCreating.value) return
  wtCreating.value = true
  wtError.value = ''
  try {
    const res = await $fetch('/api/worktrees', {
      method: 'POST',
      body: {
        project_id: project.value.id,
        name: wtName.value.trim(),
        count: wtCount.value,
      },
    }) as any

    const command = claudeCommandFor(wtPrompt.value)
    for (const wt of res.created) {
      openWorktreeTab(wt, command)
    }
    if (res.errors?.length) wtError.value = res.errors.join(' / ')

    wtName.value = ''
    wtPrompt.value = ''
    wtCount.value = 1
    await refreshWorktrees()
    if (res.created.length) router.push('/workspace')
  } catch (e: any) {
    wtError.value = e.data?.message || e.message || '생성 실패'
  } finally {
    wtCreating.value = false
  }
}

async function deleteWorktree(wt: any, force = false) {
  wtError.value = ''
  try {
    const res = await $fetch('/api/worktrees', {
      method: 'DELETE',
      body: { project_id: project.value.id, path: wt.path, force },
    }) as any
    if (res.preservedBranch) {
      wtError.value = `worktree 삭제됨 — 미머지 커밋이 있어 브랜치 '${res.preservedBranch}'는 보존됨`
    }
    await refreshWorktrees()
  } catch (e: any) {
    const msg = e.data?.message || e.message || '삭제 실패'
    if (!force && msg.includes('미커밋')) {
      if (confirm(`${msg}\n\n변경사항을 버리고 강제 삭제할까요?`)) {
        await deleteWorktree(wt, true)
        return
      }
    }
    wtError.value = msg
  }
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

      <!-- Worktrees (병렬 에이전트 작업공간) -->
      <div v-if="project.git_branch" class="glass-card p-4">
        <div class="flex items-center justify-between mb-2.5">
          <h3 class="text-[10px] font-semibold text-brain-muted uppercase tracking-[0.08em]">병렬 워크트리</h3>
          <span class="text-[10px] text-brain-muted font-mono">{{ worktrees.length }}</span>
        </div>

        <!-- 생성 폼 -->
        <div class="space-y-2 mb-3">
          <div class="flex gap-2 flex-wrap">
            <input
              v-model="wtName"
              type="text"
              placeholder="브랜치명 (예: try-fix)"
              class="flex-1 min-w-[140px] bg-brain-bg border border-brain-border rounded-md px-3 py-1.5 text-xs font-mono placeholder:text-brain-muted/60 focus:outline-none focus:border-neon-indigo/50"
              @keydown.enter="createWorktrees"
            />
            <select
              v-model.number="wtCount"
              class="bg-brain-bg border border-brain-border rounded-md px-2 py-1.5 text-xs focus:outline-none"
              title="병렬 개수 — 2개 이상이면 브랜치명-1, -2... 로 생성"
            >
              <option :value="1">×1</option>
              <option :value="2">×2</option>
              <option :value="3">×3</option>
              <option :value="4">×4</option>
            </select>
            <button
              @click="createWorktrees"
              :disabled="!wtName.trim() || wtCreating"
              class="px-3 py-1.5 rounded-md text-xs font-medium bg-neon-indigo text-white hover:bg-neon-indigo-deep transition-colors disabled:opacity-40"
            >
              {{ wtCreating ? '생성 중...' : '생성 + Claude 열기' }}
            </button>
          </div>
          <input
            v-model="wtPrompt"
            type="text"
            placeholder="시작 프롬프트 (선택 — 모든 워크트리의 Claude에 동일하게 전달됨)"
            class="w-full bg-brain-bg border border-brain-border rounded-md px-3 py-1.5 text-xs placeholder:text-brain-muted/60 focus:outline-none focus:border-neon-indigo/50"
          />
          <p v-if="wtError" class="text-[11px] text-neon-amber">{{ wtError }}</p>
        </div>

        <!-- 목록 -->
        <div v-if="worktrees.length" class="space-y-1">
          <div
            v-for="wt in worktrees"
            :key="wt.path"
            class="group flex items-center gap-2 px-2.5 py-2 rounded-md border border-brain-border bg-brain-bg"
          >
            <svg class="w-3.5 h-3.5 text-neon-purple shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
            <div class="flex-1 min-w-0">
              <p class="text-xs font-mono font-medium truncate">{{ wt.branch }}</p>
              <p class="text-[10px] text-brain-muted font-mono truncate">{{ wt.path.replace('/Users/scoop/', '~/') }}</p>
            </div>
            <span v-if="wt.dirty > 0" class="text-[10px] font-mono text-neon-amber shrink-0">{{ wt.dirty }} 변경</span>
            <button
              @click="openWorktreeTab(wt); router.push('/workspace')"
              class="px-2 py-1 rounded text-[11px] bg-neon-indigo/15 text-neon-indigo border border-neon-indigo/30 hover:bg-neon-indigo/25 transition-colors shrink-0"
            >🤖 열기</button>
            <button
              @click="deleteWorktree(wt)"
              class="w-6 h-6 rounded flex items-center justify-center text-xs text-brain-muted hover:text-neon-rose transition-colors shrink-0"
              title="worktree 삭제 (미머지 브랜치는 보존)"
            >✕</button>
          </div>
        </div>
        <p v-else class="text-xs text-brain-muted/60">
          워크트리 없음 — 브랜치명을 입력하고 생성하면 격리된 작업공간에서 Claude가 병렬로 작업합니다
        </p>
      </div>

      <!-- Devices -->
      <DevicePanel :project="project" />

      <!-- Automations -->
      <AutomationPanel :project-id="project.id" />

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

            <!-- 관계 방향 -->
            <div class="flex rounded-md border border-brain-border overflow-hidden text-[11px] mb-2.5">
              <button
                @click="relationDirection = 'child'"
                class="flex-1 px-2 py-1.5 transition-colors"
                :class="relationDirection === 'child' ? 'bg-neon-indigo/15 text-neon-indigo' : 'text-brain-muted hover:text-brain-text'"
              >⬇ 하위로 (내가 모체)</button>
              <button
                @click="relationDirection = 'parent'"
                class="flex-1 px-2 py-1.5 border-l border-brain-border transition-colors"
                :class="relationDirection === 'parent' ? 'bg-neon-indigo/15 text-neon-indigo' : 'text-brain-muted hover:text-brain-text'"
              >⬆ 상위로 (상대가 모체)</button>
              <button
                @click="relationDirection = 'related'"
                class="flex-1 px-2 py-1.5 border-l border-brain-border transition-colors"
                :class="relationDirection === 'related' ? 'bg-neon-indigo/15 text-neon-indigo' : 'text-brain-muted hover:text-brain-text'"
              >↔ 단순 연관</button>
            </div>

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
