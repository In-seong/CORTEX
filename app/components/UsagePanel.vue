<script setup lang="ts">
const range = ref(30)
const { data: usage, refresh } = await useFetch('/api/usage', {
  query: computed(() => ({ days: range.value })),
})

const scanning = ref(false)
async function rescan() {
  scanning.value = true
  try {
    await $fetch('/api/usage/scan', { method: 'POST' })
    await refresh()
  } finally {
    scanning.value = false
  }
}

// 스캔 중이면 몇 초 후 자동 갱신
watch(() => (usage.value as any)?.scanning, (s) => {
  if (s) setTimeout(refresh, 5000)
})

const maxDailyCost = computed(() => {
  const d = (usage.value as any)?.daily || []
  return Math.max(0.01, ...d.map((x: any) => x.cost))
})

function fmtCost(c: number): string {
  if (c >= 100) return `$${Math.round(c)}`
  if (c >= 1) return `$${c.toFixed(1)}`
  return `$${c.toFixed(2)}`
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

const visibleDaily = computed(() => {
  const d = (usage.value as any)?.daily || []
  // 모바일 대응: 최근 14일만 바로 표시 (30일 범위여도)
  return range.value <= 7 ? d : d.slice(-14)
})
</script>

<template>
  <div class="glass-card overflow-hidden">
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-3 border-b border-brain-border">
      <div class="flex items-center gap-2">
        <span class="text-sm font-semibold">Claude 사용량</span>
        <span class="text-[10px] text-brain-muted">비용은 추정치</span>
        <span v-if="(usage as any)?.scanning" class="text-[10px] text-neon-indigo animate-pulse">스캔 중...</span>
      </div>
      <div class="flex items-center gap-2">
        <div class="flex rounded-md border border-brain-border overflow-hidden text-[11px]">
          <button
            @click="range = 7"
            class="px-2.5 py-1 transition-colors"
            :class="range === 7 ? 'bg-neon-indigo/15 text-neon-indigo' : 'text-brain-muted hover:text-brain-text'"
          >7일</button>
          <button
            @click="range = 30"
            class="px-2.5 py-1 border-l border-brain-border transition-colors"
            :class="range === 30 ? 'bg-neon-indigo/15 text-neon-indigo' : 'text-brain-muted hover:text-brain-text'"
          >30일</button>
        </div>
        <button
          @click="rescan"
          :disabled="scanning"
          class="w-6 h-6 rounded flex items-center justify-center text-xs text-brain-muted hover:text-brain-text hover:bg-white/[0.06] transition-colors disabled:opacity-50"
          :class="scanning ? 'animate-spin' : ''"
          title="다시 스캔"
        >⟳</button>
      </div>
    </div>

    <div v-if="usage" class="p-4 space-y-4">
      <!-- Totals -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <p class="text-[10px] text-brain-muted uppercase tracking-[0.08em] font-semibold mb-0.5">총 비용(추정)</p>
          <p class="text-xl font-semibold font-mono text-neon-indigo">{{ fmtCost((usage as any).totals.cost) }}</p>
        </div>
        <div>
          <p class="text-[10px] text-brain-muted uppercase tracking-[0.08em] font-semibold mb-0.5">출력 토큰</p>
          <p class="text-xl font-semibold font-mono">{{ fmtTokens((usage as any).totals.output) }}</p>
        </div>
        <div>
          <p class="text-[10px] text-brain-muted uppercase tracking-[0.08em] font-semibold mb-0.5">캐시 읽기</p>
          <p class="text-xl font-semibold font-mono">{{ fmtTokens((usage as any).totals.cacheRead) }}</p>
        </div>
        <div>
          <p class="text-[10px] text-brain-muted uppercase tracking-[0.08em] font-semibold mb-0.5">턴 수</p>
          <p class="text-xl font-semibold font-mono">{{ fmtTokens((usage as any).totals.turns) }}</p>
        </div>
      </div>

      <!-- Daily bars -->
      <div>
        <div class="flex items-end gap-1 h-20">
          <div
            v-for="d in visibleDaily"
            :key="d.day"
            class="flex-1 flex flex-col justify-end group relative"
            :title="`${d.day} · ${fmtCost(d.cost)} · ${fmtTokens(d.output)} 출력`"
          >
            <div
              class="w-full rounded-sm bg-neon-indigo/60 group-hover:bg-neon-indigo transition-colors min-h-[2px]"
              :style="{ height: `${Math.max(2, (d.cost / maxDailyCost) * 100)}%` }"
            />
          </div>
        </div>
        <div class="flex justify-between mt-1 text-[9px] text-brain-muted font-mono">
          <span>{{ visibleDaily[0]?.day.slice(5) }}</span>
          <span>{{ visibleDaily[visibleDaily.length - 1]?.day.slice(5) }}</span>
        </div>
      </div>

      <!-- Model + Project breakdown -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p class="text-[10px] text-brain-muted uppercase tracking-[0.08em] font-semibold mb-1.5">모델별</p>
          <div class="space-y-1">
            <div
              v-for="m in (usage as any).byModel.slice(0, 4)"
              :key="m.model"
              class="flex items-center justify-between text-xs"
            >
              <span class="font-mono text-brain-text-secondary truncate">{{ m.model }}</span>
              <span class="font-mono text-brain-muted shrink-0 ml-2">{{ fmtCost(m.cost) }} · {{ fmtTokens(m.output) }}</span>
            </div>
          </div>
        </div>
        <div>
          <p class="text-[10px] text-brain-muted uppercase tracking-[0.08em] font-semibold mb-1.5">프로젝트별 TOP</p>
          <div class="space-y-1">
            <div
              v-for="p in (usage as any).byProject.slice(0, 4)"
              :key="p.key"
              class="flex items-center justify-between text-xs"
            >
              <span class="truncate text-brain-text-secondary">{{ p.icon }} {{ p.name }}</span>
              <span class="font-mono text-brain-muted shrink-0 ml-2">{{ fmtCost(p.cost) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
