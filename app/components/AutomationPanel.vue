<script setup lang="ts">
const props = defineProps<{
  projectId: number
}>()

const { data: automations, refresh } = await useFetch('/api/automations', {
  query: { project_id: props.projectId },
})

const showAdd = ref(false)
const newPrompt = ref('')
const newSchedule = ref<'daily' | 'hourly'>('daily')
const newTime = ref('09:00')
const saving = ref(false)
const error = ref('')
const expandedRun = ref<number | null>(null)

async function addAutomation() {
  if (!newPrompt.value.trim() || saving.value) return
  saving.value = true
  error.value = ''
  try {
    await $fetch('/api/automations', {
      method: 'POST',
      body: {
        project_id: props.projectId,
        prompt: newPrompt.value.trim(),
        schedule: newSchedule.value,
        run_time: newTime.value,
      },
    })
    newPrompt.value = ''
    showAdd.value = false
    await refresh()
  } catch (e: any) {
    error.value = e.data?.message || '추가 실패'
  } finally {
    saving.value = false
  }
}

async function toggle(a: any) {
  await $fetch(`/api/automations/${a.id}`, { method: 'PUT', body: { enabled: !a.enabled } }).catch(() => {})
  await refresh()
}

async function remove(a: any) {
  await $fetch(`/api/automations/${a.id}`, { method: 'DELETE' }).catch(() => {})
  await refresh()
}

async function runNow(a: any) {
  error.value = ''
  try {
    await $fetch('/api/automations/run-now', { method: 'POST', body: { id: a.id } })
    error.value = '▶ 실행 시작됨 — 완료되면 알림이 옵니다'
    setTimeout(refresh, 3000)
  } catch (e: any) {
    error.value = e.data?.message || '실행 실패'
  }
}

const statusIcon: Record<string, string> = { done: '✅', failed: '⚠️', running: '🔄' }
</script>

<template>
  <div class="glass-card p-4">
    <div class="flex items-center justify-between mb-2.5">
      <h3 class="text-[10px] font-semibold text-brain-muted uppercase tracking-[0.08em]">자동화 (예약 프롬프트)</h3>
      <button
        @click="showAdd = !showAdd"
        class="w-6 h-6 rounded flex items-center justify-center text-sm text-brain-muted hover:text-brain-text hover:bg-white/[0.06] transition-colors"
      >{{ showAdd ? '✕' : '+' }}</button>
    </div>

    <!-- 추가 폼 -->
    <div v-if="showAdd" class="space-y-2 mb-3 p-3 rounded-md bg-brain-bg border border-brain-border">
      <textarea
        v-model="newPrompt"
        rows="2"
        placeholder="예: 어제 커밋들을 리뷰하고 claudedocs/DAILY_REVIEW.md에 요약 정리해줘"
        class="w-full bg-brain-card border border-brain-border rounded-md px-3 py-2 text-xs placeholder:text-brain-muted/60 focus:outline-none focus:border-neon-indigo/50 resize-none"
      />
      <div class="flex items-center gap-2 flex-wrap">
        <select v-model="newSchedule" class="bg-brain-card border border-brain-border rounded-md px-2 py-1.5 text-xs focus:outline-none">
          <option value="daily">매일</option>
          <option value="hourly">매시간</option>
        </select>
        <input
          v-if="newSchedule === 'daily'"
          v-model="newTime"
          type="time"
          class="bg-brain-card border border-brain-border rounded-md px-2 py-1 text-xs focus:outline-none"
        />
        <button
          @click="addAutomation"
          :disabled="!newPrompt.trim() || saving"
          class="ml-auto px-3 py-1.5 rounded-md text-xs font-medium bg-neon-indigo text-white hover:bg-neon-indigo-deep transition-colors disabled:opacity-40"
        >추가</button>
      </div>
    </div>

    <p v-if="error" class="text-[11px] text-brain-text-secondary mb-2">{{ error }}</p>

    <!-- 목록 -->
    <div v-if="(automations as any[])?.length" class="space-y-1.5">
      <div
        v-for="a in (automations as any[])"
        :key="a.id"
        class="rounded-md border border-brain-border bg-brain-bg overflow-hidden"
        :class="a.enabled ? '' : 'opacity-50'"
      >
        <div class="flex items-center gap-2 px-3 py-2">
          <button
            @click="toggle(a)"
            class="w-8 h-[18px] rounded-full relative shrink-0 transition-colors"
            :class="a.enabled ? 'bg-neon-indigo/60' : 'bg-white/10'"
            :title="a.enabled ? '끄기' : '켜기'"
          >
            <span class="absolute top-0.5 w-[14px] h-[14px] rounded-full bg-white transition-all" :class="a.enabled ? 'left-[17px]' : 'left-0.5 opacity-60'" />
          </button>
          <div class="flex-1 min-w-0">
            <p class="text-xs truncate">{{ a.prompt }}</p>
            <p class="text-[10px] text-brain-muted font-mono mt-0.5">
              {{ a.schedule === 'daily' ? `매일 ${a.run_time}` : '매시간' }}
              <span v-if="a.lastRun"> · 최근 {{ statusIcon[a.lastRun.status] }} {{ a.lastRun.started_at }}</span>
            </p>
          </div>
          <button
            v-if="a.lastRun?.output"
            @click="expandedRun = expandedRun === a.id ? null : a.id"
            class="text-[10px] text-brain-muted hover:text-brain-text shrink-0"
          >{{ expandedRun === a.id ? '접기' : '결과' }}</button>
          <button @click="runNow(a)" class="text-[11px] text-neon-indigo hover:underline shrink-0">▶ 지금</button>
          <button @click="remove(a)" class="w-5 h-5 rounded flex items-center justify-center text-[10px] text-brain-muted hover:text-neon-rose shrink-0">✕</button>
        </div>
        <pre
          v-if="expandedRun === a.id && a.lastRun?.output"
          class="px-3 py-2 border-t border-brain-border text-[10px] text-brain-text-secondary font-mono whitespace-pre-wrap max-h-40 overflow-y-auto scrollbar-sleek"
        >{{ a.lastRun.output }}</pre>
      </div>
    </div>
    <p v-else class="text-xs text-brain-muted/60">
      예약된 프롬프트 없음 — 매일 정해진 시간에 Claude가 자동으로 작업합니다
    </p>
  </div>
</template>
