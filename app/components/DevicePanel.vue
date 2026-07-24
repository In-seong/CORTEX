<script setup lang="ts">
const props = defineProps<{
  project: any
}>()

const router = useRouter()
const { openProject } = useWorkspace()

const { data, refresh } = await useFetch('/api/devices')
const devices = computed(() => (data.value as any)?.devices || [])
const busy = ref('')
const msg = ref('')

// 30초마다 연결 상태 갱신
let timer: ReturnType<typeof setInterval> | null = null
onMounted(() => { timer = setInterval(refresh, 30000) })
onBeforeUnmount(() => { if (timer) clearInterval(timer) })

async function buildTo(device: any) {
  busy.value = device.id
  msg.value = ''
  try {
    const res = await $fetch('/api/devices/build-command', {
      method: 'POST',
      body: { project_id: props.project.id, platform: device.platform, device_id: device.id },
    }) as any

    if (!res.command) {
      msg.value = res.message || '빌드 명령 생성 실패'
      return
    }

    // 빌드는 전용 터미널 탭에서 실행 → 출력을 그대로 본다
    openProject({
      id: `build:${props.project.id}:${device.platform}`,
      name: `${props.project.name} ▶ ${device.name}`,
      path: props.project.path,
      category: 'build',
      has_claude_md: false,
      command: res.command,
    }, 'shell')
    router.push('/workspace')
  } catch (e: any) {
    msg.value = e.data?.message || '빌드 시작 실패'
  } finally {
    busy.value = ''
  }
}
</script>

<template>
  <div class="glass-card p-4">
    <div class="flex items-center justify-between mb-2.5">
      <h3 class="text-[10px] font-semibold text-brain-muted uppercase tracking-[0.08em]">연결된 디바이스</h3>
      <button
        @click="refresh()"
        class="w-6 h-6 rounded flex items-center justify-center text-xs text-brain-muted hover:text-brain-text hover:bg-white/[0.06] transition-colors"
        title="새로고침"
      >⟳</button>
    </div>

    <div v-if="devices.length" class="space-y-1.5">
      <div
        v-for="d in devices"
        :key="d.id"
        class="flex items-center gap-2.5 px-2.5 py-2 rounded-md border border-brain-border bg-brain-bg"
      >
        <span class="text-base shrink-0">{{ d.platform === 'android' ? '🤖' : '📱' }}</span>
        <div class="flex-1 min-w-0">
          <p class="text-xs font-medium truncate">{{ d.name }}</p>
          <p class="text-[10px] font-mono truncate" :class="d.state === 'connected' ? 'text-neon-emerald' : 'text-neon-amber'">
            <span class="inline-block w-1.5 h-1.5 rounded-full mr-1" :class="d.state === 'connected' ? 'bg-neon-emerald' : 'bg-neon-amber'" />
            {{ d.state === 'connected' ? '연결됨' : d.state }}
          </p>
        </div>
        <button
          @click="buildTo(d)"
          :disabled="busy === d.id || d.state !== 'connected'"
          class="px-2.5 py-1.5 rounded-md text-[11px] font-medium bg-neon-indigo text-white hover:bg-neon-indigo-deep transition-colors disabled:opacity-40 shrink-0"
        >
          {{ busy === d.id ? '...' : '▶ 이 폰에 빌드' }}
        </button>
      </div>
    </div>
    <p v-else class="text-xs text-brain-muted/60">
      연결된 폰 없음 — USB로 연결하면 여기 표시됩니다 (Android: USB 디버깅 허용 필요)
    </p>
    <p v-if="msg" class="text-[11px] text-neon-amber mt-2">{{ msg }}</p>
  </div>
</template>
