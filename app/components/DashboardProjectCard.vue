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

function launchIde(type: string) {
  $fetch('/api/system/launch', {
    method: 'POST',
    body: { type, path: props.project.path },
  })
}
</script>

<template>
  <div
    class="group relative glass-card p-4 cursor-pointer transition-colors"
    @click="router.push(`/projects/${project.id}`)"
  >
    <!-- Header -->
    <div class="flex items-start justify-between mb-2.5">
      <div class="flex items-center gap-2 flex-1 min-w-0">
        <span class="text-lg shrink-0">{{ project.icon || '📁' }}</span>
        <div class="min-w-0">
          <h4 class="text-sm font-semibold truncate">{{ project.name }}</h4>
          <p class="text-[10px] text-brain-muted font-mono uppercase tracking-wide">{{ project.category }}</p>
        </div>
      </div>
      <div class="flex items-center gap-1.5 ml-2 shrink-0">
        <span
          v-if="project.git_dirty_count > 0"
          class="px-1.5 py-0.5 rounded text-[10px] font-mono bg-neon-amber/10 text-neon-amber border border-neon-amber/25"
        >
          {{ project.git_dirty_count }}
        </span>
        <span v-if="project.has_claude_md" class="text-xs opacity-60" title="Claude 연동">🤖</span>
      </div>
    </div>

    <!-- Tech Stack -->
    <div v-if="techBadges.length" class="flex flex-wrap gap-1 mb-2.5">
      <span
        v-for="tech in techBadges"
        :key="tech"
        class="px-1.5 py-0.5 rounded text-[10px] font-mono border border-brain-border bg-brain-bg text-brain-text-secondary"
      >
        {{ tech }}
      </span>
    </div>

    <!-- Stats Row -->
    <div class="flex items-center gap-3 text-[11px] text-brain-muted font-mono">
      <span v-if="project.session_count > 0" title="세션">💬 {{ project.session_count }}</span>
      <span v-if="project.session_size_mb > 0" title="세션 크기">💾 {{ project.session_size_mb }}MB</span>
      <span v-if="project.memory_count > 0" title="메모리">🧠 {{ project.memory_count }}</span>
      <span v-if="project.relation_count > 0" title="연관 프로젝트">🔗 {{ project.relation_count }}</span>
    </div>

    <!-- Git Branch -->
    <div v-if="project.git_branch" class="mt-2 flex items-center gap-1.5 text-[11px] text-brain-muted">
      <svg class="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
      <span class="font-mono truncate">{{ project.git_branch }}</span>
    </div>

    <!-- Hover Quick Actions -->
    <div class="absolute bottom-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      <button
        @click.stop="emit('openClaude', project)"
        class="w-7 h-7 rounded-md bg-neon-indigo/20 border border-neon-indigo/40 flex items-center justify-center text-xs hover:bg-neon-indigo/35 transition-colors"
        title="Claude Code 열기"
      >
        🤖
      </button>
      <button
        @click.stop="launchIde('vscode')"
        class="w-7 h-7 rounded-md bg-brain-bg border border-brain-border flex items-center justify-center text-xs hover:border-brain-border-light transition-colors"
        title="VS Code"
      >
        💻
      </button>
      <button
        @click.stop="launchIde('finder')"
        class="w-7 h-7 rounded-md bg-brain-bg border border-brain-border flex items-center justify-center text-xs hover:border-brain-border-light transition-colors"
        title="Finder"
      >
        📂
      </button>
    </div>
  </div>
</template>
