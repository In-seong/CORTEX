<script setup lang="ts">
const props = defineProps<{
  project: any
}>()

const router = useRouter()
const { openProject } = useWorkspace()

const apps = ref<any[]>([])
const devices = ref<any[]>([])
const searched = ref(false)
const searching = ref(false)
const busy = ref('')
const msg = ref('')

const relLabel: Record<string, string> = {
  self: '이 프로젝트', child: '하위', parent: '상위', related: '연관',
  reference: '참조', linked: '연결', 'agent-ref': '참조',
}

// "빌드 대상 찾기" — 자신 + 관계 프로젝트를 훑어 앱 + 연결된 폰 조회
async function findTargets() {
  searching.value = true
  msg.value = ''
  try {
    const [a, d] = await Promise.all([
      $fetch('/api/devices/buildable', { query: { project_id: props.project.id } }) as Promise<any>,
      $fetch('/api/devices') as Promise<any>,
    ])
    apps.value = a.apps || []
    devices.value = d.devices || []
    searched.value = true
  } catch (e: any) {
    msg.value = e.data?.message || '탐색 실패'
  } finally {
    searching.value = false
  }
}

// 특정 앱이 지원하는 플랫폼의 연결된 디바이스
function devicesFor(app: any) {
  return devices.value.filter((dv: any) =>
    (dv.platform === 'android' && app.android) ||
    (dv.platform === 'ios' && app.ios)
  )
}

async function buildTo(app: any, device: any) {
  busy.value = `${app.id}:${device.id}`
  msg.value = ''
  try {
    const res = await $fetch('/api/devices/build-command', {
      method: 'POST',
      body: { project_id: app.id, platform: device.platform, device_id: device.id },
    }) as any
    if (!res.command) {
      msg.value = res.message || '빌드 명령 생성 실패'
      return
    }
    openProject({
      id: `build:${app.id}:${device.platform}`,
      name: `${app.name} ▶ ${device.name}`,
      path: app.path, // 앱 프로젝트 루트에서 빌드 (build-command는 상대경로 cd 사용)
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
      <h3 class="text-[10px] font-semibold text-brain-muted uppercase tracking-[0.08em]">디바이스 빌드</h3>
      <button
        @click="findTargets"
        :disabled="searching"
        class="px-2.5 py-1 rounded-md text-[11px] font-medium border border-brain-border text-brain-text-secondary hover:text-brain-text hover:border-brain-border-light transition-colors disabled:opacity-50"
      >
        {{ searching ? '탐색 중...' : searched ? '⟳ 다시 찾기' : '🔍 빌드 대상 찾기' }}
      </button>
    </div>

    <p v-if="!searched" class="text-xs text-brain-muted/60">
      "빌드 대상 찾기"를 누르면 이 프로젝트와 하위(연관) 프로젝트에서 Android·iOS 앱을 찾아 연결된 폰에 빌드합니다.
    </p>

    <div v-else-if="!apps.length" class="text-xs text-brain-muted/60">
      빌드 가능한 앱 프로젝트가 없습니다 (자신·하위 모두 웹/백엔드).
    </div>

    <div v-else class="space-y-3">
      <div v-for="app in apps" :key="app.id" class="rounded-lg border border-brain-border bg-brain-bg overflow-hidden">
        <!-- 앱 헤더 -->
        <div class="flex items-center gap-2 px-3 py-2 border-b border-brain-border/50">
          <span class="text-sm shrink-0">{{ app.icon || '📱' }}</span>
          <span class="text-xs font-medium truncate">{{ app.name }}</span>
          <span class="text-[10px] px-1.5 py-0.5 rounded bg-brain-card text-brain-muted shrink-0">{{ relLabel[app.rel] || app.rel }}</span>
          <span class="ml-auto text-[10px] text-neon-indigo font-mono shrink-0">{{ app.kind }}</span>
        </div>

        <!-- 해당 앱의 디바이스 -->
        <div v-if="devicesFor(app).length" class="divide-y divide-brain-border/40">
          <div
            v-for="d in devicesFor(app)"
            :key="d.id"
            class="flex items-center gap-2.5 px-3 py-2"
          >
            <span class="text-base shrink-0">{{ d.platform === 'android' ? '🤖' : '📱' }}</span>
            <div class="flex-1 min-w-0">
              <p class="text-xs truncate">{{ d.name }}</p>
              <p class="text-[10px] font-mono" :class="d.state === 'connected' ? 'text-neon-emerald' : 'text-neon-amber'">
                {{ d.state === 'connected' ? '연결됨' : d.state }}
              </p>
            </div>
            <button
              @click="buildTo(app, d)"
              :disabled="busy === `${app.id}:${d.id}` || d.state !== 'connected'"
              class="px-2.5 py-1.5 rounded-md text-[11px] font-medium bg-neon-indigo text-white hover:bg-neon-indigo-deep transition-colors disabled:opacity-40 shrink-0"
            >
              {{ busy === `${app.id}:${d.id}` ? '...' : '▶ 빌드' }}
            </button>
          </div>
        </div>
        <p v-else class="px-3 py-2 text-[11px] text-brain-muted/60">
          연결된 {{ app.android && !app.ios ? 'Android' : !app.android && app.ios ? 'iOS' : '' }} 폰 없음
        </p>
      </div>
    </div>

    <p v-if="msg" class="text-[11px] text-neon-amber mt-2">{{ msg }}</p>
  </div>
</template>
