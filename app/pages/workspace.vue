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
</script>

<template>
  <div class="h-screen overflow-hidden relative flex flex-col">
    <!-- Ambient Glow Orbs -->
    <div class="ambient-glow bg-neon-indigo" style="top: -200px; left: -100px;" />
    <div class="ambient-glow bg-neon-cyan" style="bottom: -200px; right: -100px; animation-delay: -5s;" />

    <!-- Top Nav Bar -->
    <header class="relative z-20 glass border-b border-neon-cyan/10 app-drag">
      <div class="flex items-center justify-between px-4 sm:px-6 py-3">
        <div class="flex items-center gap-4 sm:gap-8">
          <NuxtLink to="/" class="flex items-center gap-2 sm:gap-3">
            <div class="relative">
              <div class="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-gradient-to-br from-neon-indigo to-neon-cyan flex items-center justify-center shadow-neon">
                <span class="text-base sm:text-lg">🧠</span>
              </div>
            </div>
            <div>
              <h1 class="text-sm sm:text-base font-bold tracking-tight glow-text leading-none">CORTEX</h1>
              <p class="text-[8px] sm:text-[9px] text-neon-cyan/40 font-mono tracking-[0.3em]">NERVE CENTER</p>
            </div>
          </NuxtLink>

          <nav class="hidden md:flex items-center gap-1">
            <NuxtLink to="/" class="px-4 py-1.5 rounded-lg text-sm text-brain-text-secondary hover:text-brain-text hover:bg-brain-card/50 transition-colors">대시보드</NuxtLink>
            <NuxtLink to="/workspace" class="px-4 py-1.5 rounded-lg text-sm font-medium text-neon-cyan bg-neon-cyan/10 border border-neon-cyan/20">워크스페이스</NuxtLink>
            <NuxtLink to="/graph" class="px-4 py-1.5 rounded-lg text-sm text-brain-text-secondary hover:text-brain-text hover:bg-brain-card/50 transition-colors">관계 그래프</NuxtLink>
            <NuxtLink to="/settings" class="px-4 py-1.5 rounded-lg text-sm text-brain-text-secondary hover:text-brain-text hover:bg-brain-card/50 transition-colors">설정</NuxtLink>
          </nav>
        </div>

        <div class="flex items-center gap-2 sm:gap-4">
          <div class="hidden sm:flex items-center gap-2">
            <div class="w-2 h-2 rounded-full bg-neon-emerald shadow-[0_0_8px_rgba(52,211,153,0.6)] animate-pulse" />
            <span class="text-[10px] text-neon-emerald/80 font-mono tracking-widest">ONLINE</span>
          </div>
          <button @click="showProjectPicker = true" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r from-neon-indigo to-neon-cyan text-white shadow-neon hover:shadow-neon-lg transition-all">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
            <span class="hidden sm:inline">프로젝트 추가</span>
          </button>
        </div>
      </div>
    </header>

    <!-- Main Area -->
    <main class="flex-1 flex flex-col overflow-hidden relative">
      <div class="fixed inset-0 bg-grid-pattern bg-[size:40px_40px] opacity-20 pointer-events-none" />

      <!-- Tab Bar -->
      <div v-if="openTabs.length" class="relative z-10 flex items-center border-b border-brain-border/50 glass overflow-x-auto">
        <button
          v-for="tab in openTabs"
          :key="tab.id"
          @click="activeTabId = tab.id"
          class="flex items-center gap-2 px-4 py-2.5 text-[15px] border-r border-brain-border/50 whitespace-nowrap transition-all shrink-0"
          :class="activeTabId === tab.id
            ? 'bg-brain-card/50 text-brain-text border-b-2 border-b-neon-indigo'
            : 'text-brain-muted hover:text-brain-text hover:bg-brain-card/20'"
        >
          <div
            v-if="tab.has_claude_md"
            class="w-5 h-5 rounded bg-neon-indigo/20 flex items-center justify-center"
          >
            <span class="text-xs">🤖</span>
          </div>
          <span>{{ tab.name }}</span>
          <span class="text-xs text-brain-muted font-mono ml-1">{{ tab.category }}</span>
          <span
            @click.stop="closeTab(tab.id)"
            class="ml-1 w-4 h-4 rounded flex items-center justify-center text-xs hover:bg-brain-border/60 transition-all cursor-pointer"
          >✕</span>
        </button>

        <!-- Quick add from tab bar -->
        <button
          @click="showProjectPicker = true"
          class="px-3 py-2.5 text-brain-muted hover:text-brain-text transition-colors shrink-0"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
        </button>
      </div>

      <!-- ALL Tabs Content - rendered simultaneously, v-show for switching -->
      <div
        v-for="tab in openTabs"
        :key="tab.id"
        v-show="activeTabId === tab.id"
        class="relative z-10 flex-1 overflow-y-auto p-4 sm:p-6"
      >
        <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
          <div class="min-w-0">
            <h2 class="text-lg sm:text-2xl font-bold truncate">{{ tab.name }}</h2>
            <p class="text-xs sm:text-sm text-brain-muted font-mono mt-0.5 truncate">{{ tab.path }}</p>
          </div>
          <div class="flex items-center gap-2 overflow-x-auto shrink-0">
            <button
              @click="launchIde('vscode', tab.path)"
              class="px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm bg-brain-bg border border-brain-border hover:border-neon-indigo/30 transition-all whitespace-nowrap"
            >💻 VS Code</button>
            <button
              @click="launchIde('android-studio', tab.path)"
              class="hidden sm:block px-3 py-1.5 rounded-lg text-sm bg-brain-bg border border-brain-border hover:border-neon-indigo/30 transition-all"
            >🤖 Studio</button>
            <button
              @click="launchIde('xcode', tab.path)"
              class="hidden sm:block px-3 py-1.5 rounded-lg text-sm bg-brain-bg border border-brain-border hover:border-neon-indigo/30 transition-all"
            >🍎 Xcode</button>
            <button
              @click="launchIde('finder', tab.path)"
              class="px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm bg-brain-bg border border-brain-border hover:border-neon-indigo/30 transition-all"
            >📂 Finder</button>
          </div>
        </div>

        <!-- Mode Toggle (per tab) -->
        <div class="flex gap-2 mb-4 overflow-x-auto">
          <button
            @click="setTabMode(tab.id, 'claude')"
            class="px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-[15px] border transition-all whitespace-nowrap"
            :class="tab.mode === 'claude' ? 'bg-neon-indigo/15 text-neon-indigo border-neon-indigo/30' : 'border-brain-border text-brain-muted hover:text-brain-text'"
          >
            🤖 Claude
          </button>
          <button
            @click="setTabMode(tab.id, 'shell')"
            class="px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-[15px] border transition-all whitespace-nowrap"
            :class="tab.mode === 'shell' ? 'bg-neon-cyan/15 text-neon-cyan border-neon-cyan/30' : 'border-brain-border text-brain-muted hover:text-brain-text'"
          >
            💻 터미널
          </button>
          <button
            @click="setTabMode(tab.id, 'quick')"
            class="px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-[15px] border transition-all whitespace-nowrap"
            :class="tab.mode === 'quick' ? 'bg-neon-emerald/15 text-neon-emerald border-neon-emerald/30' : 'border-brain-border text-brain-muted hover:text-brain-text'"
          >
            ⚡ 빠른질문
          </button>
        </div>

        <!-- Real Terminal (Claude or Shell) - stays alive -->
        <RealTerminal
          v-if="tab.mode === 'claude' || tab.mode === 'shell'"
          :key="`${tab.id}-${tab.mode}`"
          :project-path="tab.path"
          :project-name="tab.name"
          :start-claude="tab.mode === 'claude'"
        />

        <!-- Quick Prompt -->
        <ClaudePrompt
          v-else
          :key="`quick-${tab.id}`"
          :project-path="tab.path"
          :project-name="tab.name"
        />
      </div>

      <!-- Empty state -->
      <div v-if="!openTabs.length" class="relative z-10 flex-1 flex flex-col items-center justify-center">
        <div class="text-7xl mb-6 opacity-15 animate-float">🧠</div>
        <h2 class="text-2xl font-bold mb-2 glow-text">워크스페이스</h2>
        <p class="text-base text-brain-muted mb-6 font-mono tracking-wide">여러 프로젝트를 동시에 열고 작업하세요</p>
        <button
          @click="showProjectPicker = true"
          class="px-6 py-3 rounded-xl text-[15px] font-medium bg-gradient-to-r from-neon-indigo to-neon-cyan text-white shadow-neon hover:shadow-neon-lg transition-all"
        >
          프로젝트 추가하기
        </button>
      </div>
    </main>

    <!-- Project Picker Modal -->
    <Teleport to="body">
      <div
        v-if="showProjectPicker"
        class="fixed inset-0 z-50 flex items-end sm:items-start justify-center sm:pt-[15vh]"
        @click.self="showProjectPicker = false"
      >
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="showProjectPicker = false" />
        <div class="relative w-full sm:w-[560px] max-h-[80vh] sm:max-h-[60vh] glass border border-brain-border/50 rounded-t-2xl sm:rounded-2xl shadow-2xl shadow-neon overflow-hidden animate-slide-up hud-corners">
          <!-- Search -->
          <div class="p-4 border-b border-brain-border">
            <div class="relative">
              <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brain-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input
                v-model="searchQuery"
                type="text"
                placeholder="프로젝트 검색..."
                class="w-full bg-brain-bg border border-brain-border rounded-xl pl-10 pr-4 py-3 text-[15px] placeholder:text-brain-muted/50 focus:outline-none focus:border-neon-indigo/50 focus:shadow-neon transition-all"
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
              class="w-full flex items-center gap-3 px-4 py-3 hover:bg-brain-card/50 transition-colors border-b border-brain-border/30"
              :class="openTabs.some(t => t.id === project.id) ? 'opacity-50' : ''"
            >
              <div class="w-9 h-9 rounded-lg bg-brain-bg border border-brain-border flex items-center justify-center">
                <span v-if="project.has_claude_md" class="text-sm">🤖</span>
                <span v-else class="text-sm">📁</span>
              </div>
              <div class="flex-1 text-left min-w-0">
                <p class="text-[15px] font-medium truncate">{{ project.name }}</p>
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
