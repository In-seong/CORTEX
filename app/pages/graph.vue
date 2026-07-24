<script setup lang="ts">
import { VueFlow, useVueFlow } from '@vue-flow/core'

const { data: projects } = await useFetch('/api/projects')
const { data: relations } = await useFetch('/api/projects/relations')

const { fitView } = useVueFlow()

const categoryColors: Record<string, string> = {
  'mobility': '#3b82f6',
  'mobility-lite': '#60a5fa',
  'education': '#10b981',
  'insurance': '#ec4899',
  'buscall': '#14b8a6',
  'kiosk': '#06b6d4',
  'church': '#f59e0b',
  'apartment': '#f97316',
  'travel': '#8b5cf6',
  'personal': '#818cf8',
  'tool': '#a78bfa',
  'marketing': '#22d3ee',
  'etc': '#64748b',
}

const nodes = computed(() => {
  if (!projects.value) return []
  const list = projects.value as any[]
  const cols = Math.ceil(Math.sqrt(list.length))
  return list.map((p: any, i: number) => ({
    id: String(p.id),
    position: {
      x: (i % cols) * 220 + Math.random() * 40,
      y: Math.floor(i / cols) * 140 + Math.random() * 30,
    },
    data: {
      label: p.name,
      category: p.category,
      color: categoryColors[p.category] || '#64748b',
      hasClaude: p.has_claude_md,
      dirtyCount: p.git_dirty_count,
      sessionSize: p.session_size_mb,
    },
    type: 'custom',
  }))
})

const edges = computed(() => {
  if (!relations.value) return []
  return (relations.value as any[]).map((r: any) => ({
    id: `e-${r.source_id}-${r.target_id}`,
    source: String(r.source_id),
    target: String(r.target_id),
    label: r.relation_type,
    animated: r.auto_detected === 1,
    style: { stroke: categoryColors[r.source_category] || '#818cf8', strokeWidth: 2 },
  }))
})

function onNodeClick(event: any) {
  const nodeId = event.node?.id
  if (nodeId) navigateTo(`/projects/${nodeId}`)
}

onMounted(() => {
  setTimeout(() => fitView({ padding: 0.3 }), 500)
})
</script>

<template>
  <div class="h-screen overflow-hidden relative flex flex-col">
    <!-- TOP NAV BAR -->
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
            <NuxtLink to="/" class="px-4 py-1.5 rounded-lg text-sm text-brain-text-secondary hover:text-brain-text hover:bg-brain-card/50 transition-colors">대시보드</NuxtLink>
            <NuxtLink to="/workspace" class="px-4 py-1.5 rounded-lg text-sm text-brain-text-secondary hover:text-brain-text hover:bg-brain-card/50 transition-colors">워크스페이스</NuxtLink>
            <NuxtLink to="/graph" class="px-4 py-1.5 rounded-lg text-sm font-medium text-neon-cyan bg-neon-cyan/10 border border-neon-cyan/20">관계 그래프</NuxtLink>
            <NuxtLink to="/settings" class="px-4 py-1.5 rounded-lg text-sm text-brain-text-secondary hover:text-brain-text hover:bg-brain-card/50 transition-colors">설정</NuxtLink>
          </nav>
        </div>
        <div class="flex items-center gap-2">
          <div class="w-2 h-2 rounded-full bg-neon-emerald shadow-[0_0_8px_rgba(52,211,153,0.6)] animate-pulse" />
          <span class="text-[10px] text-neon-emerald/80 font-mono tracking-widest">ONLINE</span>
        </div>
      </div>
    </header>

    <!-- GRAPH with legend overlay -->
    <main class="flex-1 relative">
      <div class="absolute inset-0 bg-brain-bg">
        <VueFlow
          :nodes="nodes"
          :edges="edges"
          :default-viewport="{ zoom: 0.8, x: 100, y: 100 }"
          :min-zoom="0.2"
          :max-zoom="3"
          fit-view-on-init
          @node-click="onNodeClick"
        >
          <template #node-custom="{ data }">
            <div
              class="px-4 py-2.5 rounded-xl border backdrop-blur-sm cursor-pointer transition-all hover:scale-105"
              :style="{
                borderColor: data.color + '40',
                backgroundColor: data.color + '15',
                boxShadow: `0 0 15px ${data.color}20`,
              }"
            >
              <div class="flex items-center gap-2">
                <div class="w-2 h-2 rounded-full" :style="{ backgroundColor: data.color }" />
                <span class="text-xs font-medium text-brain-text whitespace-nowrap">{{ data.label }}</span>
                <span v-if="data.hasClaude" class="text-[10px]">🤖</span>
              </div>
              <div v-if="data.dirtyCount > 0" class="text-[9px] text-neon-amber mt-1 font-mono">
                {{ data.dirtyCount }} dirty
              </div>
            </div>
          </template>
        </VueFlow>
      </div>

      <!-- Legend overlay - bottom left -->
      <div class="absolute bottom-4 left-4 z-10 glass rounded-xl p-3 border border-brain-border/50 max-h-[300px] overflow-y-auto">
        <p class="text-[10px] font-mono text-neon-cyan/60 tracking-[0.2em] uppercase mb-2">LEGEND</p>
        <div class="space-y-1">
          <div
            v-for="(color, name) in categoryColors"
            :key="name"
            class="flex items-center gap-2 text-[11px] text-brain-text-secondary"
          >
            <div class="w-2.5 h-2.5 rounded-full" :style="{ backgroundColor: color }" />
            {{ name }}
          </div>
        </div>
        <div class="mt-2 pt-2 border-t border-brain-border/50 text-[10px] text-brain-muted font-mono space-y-0.5">
          <p>클릭 → 프로젝트 상세</p>
          <p>드래그 → 이동 | 스크롤 → 줌</p>
        </div>
      </div>
    </main>
  </div>
</template>

<style>
@import '@vue-flow/core/dist/style.css';
@import '@vue-flow/core/dist/theme-default.css';
</style>
