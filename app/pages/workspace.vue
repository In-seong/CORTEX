<script setup lang="ts">
const { data: projects } = await useFetch('/api/projects')
const { openTabs, activeTabId, activeProject, openProject, closeTab, setTabMode } = useWorkspace()

const showProjectPicker = ref(false)
const searchQuery = ref('')

function pickProject(project: any) {
  openProject(project)
  showProjectPicker.value = false
  searchQuery.value = ''
}

const filteredProjects = computed(() => {
  if (!projects.value) return []
  let result = projects.value as any[]
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    )
  }
  return result.slice(0, 20)
})

function launchIde(type: string, path: string) {
  $fetch('/api/system/launch', {
    method: 'POST',
    body: { type, path },
  })
}

// ===== 화면 분할 (모든 열린 탭을 그리드로 동시 표시) =====
const splitMode = ref(false)
onMounted(() => {
  splitMode.value = localStorage.getItem('cortex-split') === '1'
})
function toggleSplit() {
  splitMode.value = !splitMode.value
  localStorage.setItem('cortex-split', splitMode.value ? '1' : '0')
}
</script>

<template>
  <div class="h-full flex flex-col overflow-hidden">
    <!-- Tab Bar -->
    <div v-if="openTabs.length" class="flex items-center border-b border-brain-border bg-brain-surface overflow-x-auto shrink-0">
      <button
        v-for="tab in openTabs"
        :key="tab.id"
        @click="activeTabId = tab.id"
        class="flex items-center gap-2 px-4 py-2 text-[13px] border-r border-brain-border whitespace-nowrap transition-colors shrink-0"
        :class="activeTabId === tab.id
          ? 'bg-brain-bg text-brain-text border-b-2 border-b-neon-indigo'
          : 'text-brain-muted hover:text-brain-text hover:bg-white/[0.03]'"
      >
        <span v-if="tab.has_claude_md" class="text-xs">🤖</span>
        <span>{{ tab.name }}</span>
        <span
          @click.stop="closeTab(tab.id)"
          class="ml-1 w-4 h-4 rounded flex items-center justify-center text-xs hover:bg-white/10 transition-colors cursor-pointer"
        >✕</span>
      </button>

      <button
        @click="showProjectPicker = true"
        class="px-3 py-2 text-brain-muted hover:text-brain-text transition-colors shrink-0"
        title="프로젝트 추가"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
      </button>

      <!-- 화면 분할 토글 -->
      <button
        v-if="openTabs.length > 1"
        @click="toggleSplit"
        class="hidden lg:flex ml-auto px-3 py-2 items-center gap-1.5 text-xs transition-colors shrink-0"
        :class="splitMode ? 'text-neon-indigo' : 'text-brain-muted hover:text-brain-text'"
        :title="splitMode ? '단일 화면으로' : '모든 탭 분할 표시'"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 4v16m6-16v16M4 8h16M4 16h16" /></svg>
        {{ splitMode ? '분할 중' : '분할' }}
      </button>
    </div>

    <!-- Tabs Content — 전부 렌더 유지(터미널 생존). 분할 모드면 그리드로 동시 표시 -->
    <div
      v-if="openTabs.length"
      class="flex-1 min-h-0"
      :class="splitMode && openTabs.length > 1
        ? 'grid grid-cols-1 lg:grid-cols-2 auto-rows-fr gap-2 p-2 overflow-y-auto'
        : 'flex flex-col overflow-hidden'"
    >
    <div
      v-for="tab in openTabs"
      :key="tab.id"
      v-show="splitMode || activeTabId === tab.id"
      class="overflow-y-auto min-h-0"
      :class="splitMode && openTabs.length > 1
        ? 'rounded-xl border p-3 ' + (activeTabId === tab.id ? 'border-neon-indigo/40' : 'border-brain-border')
        : 'flex-1 p-4 sm:p-6'"
      @click="splitMode && (activeTabId = tab.id)"
    >
      <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
        <div class="min-w-0">
          <h2 class="font-semibold truncate" :class="splitMode ? 'text-sm' : 'text-lg sm:text-xl'">{{ tab.name }}</h2>
          <p v-if="!splitMode" class="text-xs text-brain-muted font-mono mt-0.5 truncate">{{ tab.path }}</p>
        </div>
        <div v-if="!splitMode" class="flex items-center gap-2 overflow-x-auto shrink-0">
          <button
            @click="launchIde('vscode', tab.path)"
            class="px-2.5 py-1.5 rounded-md text-xs bg-brain-card border border-brain-border hover:border-brain-border-light transition-colors whitespace-nowrap"
          >💻 VS Code</button>
          <button
            @click="launchIde('android-studio', tab.path)"
            class="hidden sm:block px-2.5 py-1.5 rounded-md text-xs bg-brain-card border border-brain-border hover:border-brain-border-light transition-colors"
          >🤖 Studio</button>
          <button
            @click="launchIde('xcode', tab.path)"
            class="hidden sm:block px-2.5 py-1.5 rounded-md text-xs bg-brain-card border border-brain-border hover:border-brain-border-light transition-colors"
          >🍎 Xcode</button>
          <button
            @click="launchIde('finder', tab.path)"
            class="px-2.5 py-1.5 rounded-md text-xs bg-brain-card border border-brain-border hover:border-brain-border-light transition-colors"
          >📂 Finder</button>
        </div>
      </div>

      <!-- Mode Toggle (per tab) -->
      <div class="flex gap-1.5 mb-4 overflow-x-auto">
        <button
          @click="setTabMode(tab.id, 'chat')"
          class="px-3 py-1.5 rounded-md text-xs sm:text-[13px] border transition-colors whitespace-nowrap"
          :class="tab.mode === 'chat' ? 'bg-neon-indigo/15 text-neon-indigo border-neon-indigo/30' : 'border-brain-border text-brain-muted hover:text-brain-text'"
        >
          💬 채팅
        </button>
        <button
          @click="setTabMode(tab.id, 'claude')"
          class="px-3 py-1.5 rounded-md text-xs sm:text-[13px] border transition-colors whitespace-nowrap"
          :class="tab.mode === 'claude' ? 'bg-neon-indigo/15 text-neon-indigo border-neon-indigo/30' : 'border-brain-border text-brain-muted hover:text-brain-text'"
        >
          🤖 터미널(Claude)
        </button>
        <button
          @click="setTabMode(tab.id, 'shell')"
          class="px-3 py-1.5 rounded-md text-xs sm:text-[13px] border transition-colors whitespace-nowrap"
          :class="tab.mode === 'shell' ? 'bg-neon-cyan/15 text-neon-cyan border-neon-cyan/30' : 'border-brain-border text-brain-muted hover:text-brain-text'"
        >
          💻 터미널
        </button>
        <button
          @click="setTabMode(tab.id, 'quick')"
          class="px-3 py-1.5 rounded-md text-xs sm:text-[13px] border transition-colors whitespace-nowrap"
          :class="tab.mode === 'quick' ? 'bg-neon-emerald/15 text-neon-emerald border-neon-emerald/30' : 'border-brain-border text-brain-muted hover:text-brain-text'"
        >
          ⚡ 빠른질문
        </button>
        <button
          @click="setTabMode(tab.id, 'review')"
          class="px-3 py-1.5 rounded-md text-xs sm:text-[13px] border transition-colors whitespace-nowrap"
          :class="tab.mode === 'review' ? 'bg-neon-purple/15 text-neon-purple border-neon-purple/30' : 'border-brain-border text-brain-muted hover:text-brain-text'"
        >
          📝 리뷰
        </button>
      </div>

      <!-- Real Terminal (Claude or Shell) - stays alive -->
      <RealTerminal
        v-if="tab.mode === 'claude' || tab.mode === 'shell'"
        :key="`${tab.id}-${tab.mode}`"
        :project-path="tab.path"
        :project-name="tab.name"
        :start-claude="tab.mode === 'claude'"
        :initial-command="tab.command"
      />

      <!-- Native Chat -->
      <ChatView
        v-else-if="tab.mode === 'chat'"
        :key="`chat-${tab.id}`"
        :project-path="tab.path"
        :project-name="tab.name"
      />

      <!-- Source Control / Review -->
      <SourceControlPanel
        v-else-if="tab.mode === 'review'"
        :key="`review-${tab.id}`"
        :project-path="tab.path"
        :project-name="tab.name"
      />

      <!-- Quick Prompt -->
      <ClaudePrompt
        v-else
        :key="`quick-${tab.id}`"
        :project-path="tab.path"
        :project-name="tab.name"
      />
    </div>
    </div>

    <!-- Empty state -->
    <div v-if="!openTabs.length" class="flex-1 flex flex-col items-center justify-center">
      <div class="text-5xl mb-5 opacity-20">🧠</div>
      <h2 class="text-lg font-semibold mb-1">워크스페이스</h2>
      <p class="text-sm text-brain-muted mb-5">여러 프로젝트를 동시에 열고 작업하세요</p>
      <button
        @click="showProjectPicker = true"
        class="px-4 py-2 rounded-md text-sm font-medium bg-neon-indigo text-white hover:bg-neon-indigo-deep transition-colors"
      >
        프로젝트 추가하기
      </button>
    </div>

    <!-- Project Picker Modal -->
    <Teleport to="body">
      <div
        v-if="showProjectPicker"
        class="fixed inset-0 z-50 flex items-end sm:items-start justify-center sm:pt-[15vh]"
        @click.self="showProjectPicker = false"
      >
        <div class="absolute inset-0 bg-black/60" @click="showProjectPicker = false" />
        <div class="relative w-full sm:w-[560px] max-h-[80vh] sm:max-h-[60vh] bg-brain-card border border-brain-border-light rounded-t-xl sm:rounded-xl shadow-floating overflow-hidden animate-slide-up">
          <!-- Search -->
          <div class="p-3 border-b border-brain-border">
            <div class="relative">
              <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brain-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input
                v-model="searchQuery"
                type="text"
                placeholder="프로젝트 검색..."
                class="w-full bg-brain-bg border border-brain-border rounded-md pl-10 pr-4 py-2.5 text-sm placeholder:text-brain-muted/60 focus:outline-none focus:border-neon-indigo/50 transition-colors"
                autofocus
              />
            </div>
          </div>

          <!-- Project List -->
          <div class="overflow-y-auto max-h-[45vh]">
            <button
              v-for="project in filteredProjects"
              :key="project.id"
              @click="pickProject(project)"
              class="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.04] transition-colors border-b border-brain-border/50"
              :class="openTabs.some(t => t.id === project.id) ? 'opacity-50' : ''"
            >
              <span class="text-base shrink-0">{{ project.icon || '📁' }}</span>
              <div class="flex-1 text-left min-w-0">
                <p class="text-sm font-medium truncate">{{ project.name }}</p>
                <p class="text-xs text-brain-muted font-mono">{{ project.category }}</p>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <span v-if="project.git_dirty_count > 0" class="text-xs text-neon-amber font-mono">{{ project.git_dirty_count }} dirty</span>
                <span v-if="project.session_count > 0" class="text-xs text-brain-muted">💬{{ project.session_count }}</span>
                <span v-if="openTabs.some(t => t.id === project.id)" class="text-xs text-neon-indigo">열림</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
