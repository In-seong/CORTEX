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
  <div class="h-full relative">
    <div class="absolute inset-0">
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
            class="px-3.5 py-2 rounded-lg border cursor-pointer transition-transform hover:scale-105"
            :style="{
              borderColor: data.color + '50',
              backgroundColor: '#171717',
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

    <!-- Legend -->
    <div class="absolute bottom-4 left-4 z-10 bg-brain-card border border-brain-border rounded-lg p-3 max-h-[300px] overflow-y-auto scrollbar-sleek">
      <p class="text-[10px] font-semibold uppercase tracking-[0.08em] text-brain-muted mb-2">범례</p>
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
      <div class="mt-2 pt-2 border-t border-brain-border text-[10px] text-brain-muted space-y-0.5">
        <p>클릭 → 프로젝트 상세</p>
        <p>드래그 → 이동 | 스크롤 → 줌</p>
      </div>
    </div>
  </div>
</template>

<style>
@import '@vue-flow/core/dist/style.css';
@import '@vue-flow/core/dist/theme-default.css';
</style>
