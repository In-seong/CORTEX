<script setup lang="ts">
const props = defineProps<{
  project: any
}>()

const emit = defineEmits<{
  openClaude: [project: any]
}>()

const router = useRouter()

const techBadges = computed(() => {
  if (!props.project.tech_stack) return []
  try {
    const parsed = JSON.parse(props.project.tech_stack)
    if (Array.isArray(parsed)) return parsed.slice(0, 4)
  } catch {}
  return props.project.tech_stack.split(',').map((t: string) => t.trim()).filter(Boolean).slice(0, 4)
})

const techColors: Record<string, string> = {
  'Vue': 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
  'React': 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10',
  'Flutter': 'text-blue-400 border-blue-500/30 bg-blue-500/10',
  'Laravel': 'text-red-400 border-red-500/30 bg-red-500/10',
  'Nuxt': 'text-green-400 border-green-500/30 bg-green-500/10',
  'Next.js': 'text-white border-white/30 bg-white/10',
  'TypeScript': 'text-blue-400 border-blue-500/30 bg-blue-500/10',
  'Tailwind': 'text-teal-400 border-teal-500/30 bg-teal-500/10',
  'Electron': 'text-sky-400 border-sky-500/30 bg-sky-500/10',
  'Capacitor': 'text-blue-300 border-blue-400/30 bg-blue-400/10',
  'Android': 'text-green-400 border-green-500/30 bg-green-500/10',
  'iOS': 'text-gray-300 border-gray-400/30 bg-gray-400/10',
}

function getTechColor(tech: string) {
  for (const [key, val] of Object.entries(techColors)) {
    if (tech.toLowerCase().includes(key.toLowerCase())) return val
  }
  return 'text-brain-text-secondary border-brain-border bg-brain-bg/50'
}

function launchIde(type: string) {
  $fetch('/api/system/launch', {
    method: 'POST',
    body: { type, path: props.project.path },
  })
}

const cardRef = ref<HTMLElement>()
const glowPos = reactive({ x: 50, y: 50 })

function handleMouseMove(e: MouseEvent) {
  if (!cardRef.value) return
  const rect = cardRef.value.getBoundingClientRect()
  glowPos.x = ((e.clientX - rect.left) / rect.width) * 100
  glowPos.y = ((e.clientY - rect.top) / rect.height) * 100
}
</script>

<template>
  <div
    ref="cardRef"
    class="group relative overflow-hidden rounded-2xl glass-card hud-corners holo-shimmer p-6 cursor-pointer transition-all duration-500 hover:shadow-[0_0_40px_rgba(34,211,238,0.15)]"
    @click="router.push(`/projects/${project.id}`)"
    @mousemove="handleMouseMove"
  >
    <!-- Cursor-following glow -->
    <div
      class="absolute w-56 h-56 rounded-full bg-neon-cyan/10 blur-[80px] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
      :style="{ left: `${glowPos.x}%`, top: `${glowPos.y}%`, transform: 'translate(-50%, -50%)' }"
    />

    <!-- Header -->
    <div class="relative flex items-start justify-between mb-3 z-[2]">
      <div class="flex-1 min-w-0">
        <h4 class="text-base font-semibold truncate group-hover:text-neon-cyan transition-colors duration-300">
          {{ project.name }}
        </h4>
        <p class="text-[10px] text-brain-muted mt-0.5 font-mono tracking-[0.15em] uppercase">{{ project.category }}</p>
      </div>
      <div class="flex items-center gap-1.5 ml-2 shrink-0">
        <div
          v-if="project.git_dirty_count > 0"
          class="px-2 py-0.5 rounded-full text-[10px] font-mono bg-neon-amber/15 text-neon-amber border border-neon-amber/30 shadow-[0_0_8px_rgba(251,191,36,0.2)]"
        >
          {{ project.git_dirty_count }} dirty
        </div>
        <div
          v-if="project.has_claude_md"
          class="w-7 h-7 rounded-lg bg-neon-indigo/20 border border-neon-indigo/30 flex items-center justify-center shadow-[0_0_8px_rgba(99,102,241,0.3)]"
          title="Claude 연동"
        >
          <span class="text-sm">🤖</span>
        </div>
      </div>
    </div>

    <!-- Tech Stack -->
    <div v-if="techBadges.length" class="relative flex flex-wrap gap-1.5 mb-3 z-[2]">
      <span
        v-for="tech in techBadges"
        :key="tech"
        class="px-2 py-0.5 rounded-md text-[11px] font-mono border backdrop-blur-sm"
        :class="getTechColor(tech)"
      >
        {{ tech }}
      </span>
    </div>

    <!-- Stats Row -->
    <div class="relative flex items-center gap-3 text-[11px] text-brain-muted font-mono z-[2]">
      <span v-if="project.session_count > 0" class="flex items-center gap-1" title="세션">
        💬 {{ project.session_count }}
      </span>
      <span v-if="project.session_size_mb > 0" class="flex items-center gap-1" title="세션 크기">
        💾 {{ project.session_size_mb }}MB
      </span>
      <span v-if="project.memory_count > 0" class="flex items-center gap-1" title="메모리">
        🧠 {{ project.memory_count }}
      </span>
      <span v-if="project.agents_count > 0" class="flex items-center gap-1" title="에이전트">
        🤖 {{ project.agents_count }}
      </span>
      <span v-if="project.relation_count > 0" class="flex items-center gap-1" title="연관 프로젝트">
        🔗 {{ project.relation_count }}
      </span>
    </div>

    <!-- Git Branch -->
    <div v-if="project.git_branch" class="relative mt-3 flex items-center gap-2 text-[11px] text-brain-muted z-[2]">
      <svg class="w-3 h-3 text-neon-cyan/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
      <span class="font-mono truncate data-text">{{ project.git_branch }}</span>
    </div>

    <!-- Quick IDE Buttons -->
    <div class="absolute bottom-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-2 group-hover:translate-y-0 z-[3]">
      <button
        @click.stop="emit('openClaude', project)"
        class="w-8 h-8 rounded-lg bg-neon-indigo/25 border border-neon-indigo/40 flex items-center justify-center text-sm hover:bg-neon-indigo/40 hover:shadow-[0_0_15px_rgba(99,102,241,0.4)] transition-all backdrop-blur-md"
        title="Claude Code 열기"
      >
        🤖
      </button>
      <button
        @click.stop="launchIde('vscode')"
        class="w-8 h-8 rounded-lg bg-brain-bg/80 border border-neon-cyan/20 flex items-center justify-center text-sm hover:border-neon-cyan/50 hover:shadow-[0_0_15px_rgba(34,211,238,0.3)] transition-all backdrop-blur-md"
        title="VS Code"
      >
        💻
      </button>
      <button
        @click.stop="launchIde('finder')"
        class="w-8 h-8 rounded-lg bg-brain-bg/80 border border-neon-cyan/20 flex items-center justify-center text-sm hover:border-neon-cyan/50 hover:shadow-[0_0_15px_rgba(34,211,238,0.3)] transition-all backdrop-blur-md"
        title="Finder"
      >
        📂
      </button>
    </div>

    <!-- Top accent line on hover -->
    <div class="absolute top-0 left-0 h-[2px] w-0 group-hover:w-full bg-gradient-to-r from-neon-indigo via-neon-cyan to-neon-indigo transition-all duration-700 shadow-[0_0_10px_rgba(34,211,238,0.5)]" />
  </div>
</template>
