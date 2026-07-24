<script setup lang="ts">
// transcript(.jsonl) 폴링 → 채팅 버블 렌더 (orca native-chat 뷰 축약판).
// 전송은 ClaudeComposer가 같은 PTY 세션으로 bracketed paste.

const props = defineProps<{
  projectPath: string
  projectName: string
}>()

const messages = ref<any[]>([])
const scrollRef = ref<HTMLElement>()
const autoScroll = ref(true)
let timer: ReturnType<typeof setInterval> | null = null
let lastJson = ''

async function poll() {
  try {
    const res = await $fetch('/api/claude/transcript', {
      query: { cwd: props.projectPath },
    }) as any
    const j = JSON.stringify(res.messages)
    if (j !== lastJson) {
      lastJson = j
      messages.value = res.messages
      if (autoScroll.value) scrollToBottom()
    }
  } catch {}
}

function scrollToBottom() {
  nextTick(() => {
    if (scrollRef.value) scrollRef.value.scrollTop = scrollRef.value.scrollHeight
  })
}

function onScroll() {
  const el = scrollRef.value
  if (!el) return
  // 바닥 근처면 자동 스크롤 유지, 위로 올리면 해제
  autoScroll.value = el.scrollHeight - el.scrollTop - el.clientHeight < 80
}

onMounted(() => {
  poll()
  timer = setInterval(poll, 3000)
})
onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})

function fmtTime(ts: string): string {
  if (!ts) return ''
  try {
    return new Date(ts).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

const toolIcons: Record<string, string> = {
  Bash: '💻', Read: '📄', Edit: '✏️', Write: '📝', Grep: '🔍', Glob: '🔍',
  WebFetch: '🌐', WebSearch: '🌐', Task: '🤖', Agent: '🤖', TodoWrite: '📋',
}
</script>

<template>
  <div class="flex flex-col rounded-xl border border-brain-border bg-brain-card overflow-hidden" style="height: calc(100vh - 240px); min-height: 400px">
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-2.5 border-b border-brain-border bg-brain-surface/50 shrink-0">
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium">💬 채팅</span>
        <span class="text-[11px] text-brain-muted font-mono truncate">{{ projectName }}</span>
      </div>
      <button
        v-if="!autoScroll"
        @click="autoScroll = true; scrollToBottom()"
        class="text-[11px] text-neon-indigo hover:underline"
      >↓ 최신으로</button>
    </div>

    <!-- Messages -->
    <div ref="scrollRef" class="flex-1 overflow-y-auto scrollbar-sleek p-4 space-y-3" @scroll="onScroll">
      <div v-if="!messages.length" class="flex flex-col items-center justify-center h-full text-brain-muted">
        <div class="text-3xl mb-2 opacity-30">💬</div>
        <p class="text-sm">아래에 입력하면 Claude Code 세션과 대화합니다</p>
        <p class="text-[11px] mt-1 text-brain-muted/60">기존 대화는 자동으로 이어집니다 (claude -c)</p>
      </div>

      <div v-for="(msg, i) in messages" :key="i" class="flex" :class="msg.role === 'user' ? 'justify-end' : 'justify-start'">
        <!-- User bubble -->
        <div v-if="msg.role === 'user'" class="max-w-[85%] sm:max-w-[70%]">
          <div class="bg-neon-indigo/15 border border-neon-indigo/25 rounded-xl rounded-br-sm px-3.5 py-2.5">
            <p class="text-sm whitespace-pre-wrap break-words">{{ msg.text }}</p>
          </div>
          <p class="text-[10px] text-brain-muted/60 text-right mt-0.5 font-mono">{{ fmtTime(msg.ts) }}</p>
        </div>

        <!-- Assistant bubble -->
        <div v-else class="max-w-[92%] sm:max-w-[80%] min-w-0">
          <div class="bg-brain-bg border border-brain-border rounded-xl rounded-bl-sm px-3.5 py-2.5 space-y-2">
            <!-- Tool chips -->
            <div v-if="msg.tools?.length" class="flex flex-wrap gap-1">
              <span
                v-for="(t, ti) in msg.tools.slice(0, 8)"
                :key="ti"
                class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-brain-card border border-brain-border text-brain-muted max-w-full"
                :title="t.input"
              >
                {{ toolIcons[t.name] || '🔧' }} {{ t.name }}
                <span v-if="t.input" class="truncate max-w-[180px] opacity-60">{{ t.input }}</span>
              </span>
              <span v-if="msg.tools.length > 8" class="text-[10px] text-brain-muted">+{{ msg.tools.length - 8 }}</span>
            </div>
            <p v-if="msg.text" class="text-sm whitespace-pre-wrap break-words leading-relaxed">{{ msg.text }}</p>
          </div>
          <p class="text-[10px] text-brain-muted/60 mt-0.5 font-mono">🤖 {{ fmtTime(msg.ts) }}</p>
        </div>
      </div>
    </div>

    <!-- Composer -->
    <ClaudeComposer :project-path="projectPath" @sent="autoScroll = true" />
  </div>
</template>
