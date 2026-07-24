<script setup lang="ts">
import { VueFlow, useVueFlow, MarkerType } from '@vue-flow/core'

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

// 계층 레이아웃: relation_type='child'(모체→하위)로 트리를 만들고
// 모체가 위, 하위가 아래로 오도록 레벨 배치. 계층에 안 속한 노드는 아래 그리드.
const nodes = computed(() => {
  if (!projects.value) return []
  const list = projects.value as any[]
  const rels = (relations.value as any[]) || []

  const childEdges = rels.filter(r => r.relation_type === 'child')
  const hasParent = new Set(childEdges.map(r => String(r.target_id)))
  const hasChild = new Set(childEdges.map(r => String(r.source_id)))
  const inHierarchy = new Set([...hasParent, ...hasChild])

  // 레벨 계산 (BFS, 루트 = 자식은 있고 부모는 없는 노드)
  const level = new Map<string, number>()
  const childrenOf = new Map<string, string[]>()
  for (const r of childEdges) {
    const s = String(r.source_id)
    if (!childrenOf.has(s)) childrenOf.set(s, [])
    childrenOf.get(s)!.push(String(r.target_id))
  }
  const queue: string[] = []
  for (const id of hasChild) {
    if (!hasParent.has(id)) { level.set(id, 0); queue.push(id) }
  }
  while (queue.length) {
    const cur = queue.shift()!
    for (const c of childrenOf.get(cur) || []) {
      const nl = (level.get(cur) || 0) + 1
      if (!level.has(c) || level.get(c)! < nl) {
        level.set(c, nl)
        queue.push(c)
      }
    }
  }

  // 레벨별 x 배치
  const byLevel = new Map<number, string[]>()
  for (const [id, lv] of level) {
    if (!byLevel.has(lv)) byLevel.set(lv, [])
    byLevel.get(lv)!.push(id)
  }
  const pos = new Map<string, { x: number; y: number }>()
  for (const [lv, ids] of byLevel) {
    ids.forEach((id, i) => {
      pos.set(id, { x: i * 240 - (ids.length - 1) * 120, y: lv * 170 })
    })
  }

  // 계층 밖 노드는 아래 그리드
  const maxLevel = Math.max(0, ...byLevel.keys())
  const others = list.filter(p => !inHierarchy.has(String(p.id)))
  const cols = Math.ceil(Math.sqrt(others.length)) || 1
  others.forEach((p, i) => {
    pos.set(String(p.id), {
      x: (i % cols) * 220 - (cols * 110),
      y: (maxLevel + 2) * 170 + Math.floor(i / cols) * 130,
    })
  })

  return list.map((p: any) => ({
    id: String(p.id),
    position: pos.get(String(p.id)) || { x: 0, y: 0 },
    data: {
      label: p.name,
      category: p.category,
      color: categoryColors[p.category] || '#64748b',
      hasClaude: p.has_claude_md,
      dirtyCount: p.git_dirty_count,
      isRoot: level.get(String(p.id)) === 0,
    },
    type: 'custom',
  }))
})

const edges = computed(() => {
  if (!relations.value) return []
  return (relations.value as any[]).map((r: any) => {
    const isChild = r.relation_type === 'child'
    return {
      id: `e-${r.id}`,
      source: String(r.source_id),
      target: String(r.target_id),
      label: r.label || (isChild ? '하위' : r.relation_type),
      animated: r.auto_detected === 1,
      markerEnd: MarkerType.ArrowClosed,
      style: {
        stroke: isChild ? '#d97757' : (categoryColors[r.source_category] || '#6b6862'),
        strokeWidth: isChild ? 2.5 : 1.5,
        strokeDasharray: isChild ? undefined : '4 4',
      },
      labelStyle: { fill: '#b7b4aa', fontSize: 10 },
      labelBgStyle: { fill: '#30302e' },
    }
  })
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
              backgroundColor: '#30302e',
            }"
          >
            <div class="flex items-center gap-2">
              <span v-if="data.isRoot" class="text-[10px]" title="모체">👑</span>
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
