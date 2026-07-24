<script setup lang="ts">
const props = defineProps<{
  projectPath: string
  projectName: string
}>()

const prompt = ref('')
const isRunning = ref(false)
const outputRef = ref<HTMLElement>()

type PromptMode = 'new' | 'continue' | 'resume'
const mode = ref<PromptMode>('continue')
const selectedSessionId = ref<string | null>(null)
const showSessionPicker = ref(false)

interface Session {
  id: string
  firstMessage: string
  lastMessage: string
  messageCount: number
  sizeMb: number
  updatedAt: string
}

const sessions = ref<Session[]>([])

async function loadSessions() {
  try {
    const data = await $fetch('/api/claude/sessions', {
      method: 'POST',
      body: { projectPath: props.projectPath },
    }) as { sessions: Session[] }
    sessions.value = data.sessions
  } catch {}
}

onMounted(loadSessions)

interface Message {
  id: number
  role: 'user' | 'assistant' | 'error'
  content: string
  timestamp: Date
}

const messages = ref<Message[]>([])
let msgId = 0

async function sendPrompt() {
  const text = prompt.value.trim()
  if (!text || isRunning.value) return

  messages.value.push({
    id: ++msgId,
    role: 'user',
    content: text,
    timestamp: new Date(),
  })
  prompt.value = ''
  isRunning.value = true
  scrollToBottom()

  const assistantMsg: Message = {
    id: ++msgId,
    role: 'assistant',
    content: '',
    timestamp: new Date(),
  }
  messages.value.push(assistantMsg)

  try {
    const bodyPayload: any = {
      prompt: text,
      cwd: props.projectPath,
      mode: mode.value,
    }
    if (mode.value === 'resume' && selectedSessionId.value) {
      bodyPayload.sessionId = selectedSessionId.value
    }

    const response = await fetch('/api/claude/prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload),
    })

    if (!response.ok) {
      assistantMsg.role = 'error'
      assistantMsg.content = `Error: ${response.statusText}`
      isRunning.value = false
      return
    }

    const reader = response.body?.getReader()
    const decoder = new TextDecoder()

    if (!reader) {
      assistantMsg.content = 'No response stream'
      isRunning.value = false
      return
    }

    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        try {
          const data = JSON.parse(line.slice(6))
          if (data.type === 'stdout') {
            assistantMsg.content += data.text
            scrollToBottom()
          } else if (data.type === 'stderr') {
            assistantMsg.content += data.text
            scrollToBottom()
          } else if (data.type === 'error') {
            assistantMsg.role = 'error'
            assistantMsg.content += `\n[Error] ${data.text}`
          }
        } catch {}
      }
    }
  } catch (err: any) {
    assistantMsg.role = 'error'
    assistantMsg.content = `Connection error: ${err.message}`
  }

  isRunning.value = false
  scrollToBottom()
  loadSessions()
}

function scrollToBottom() {
  nextTick(() => {
    if (outputRef.value) {
      outputRef.value.scrollTop = outputRef.value.scrollHeight
    }
  })
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendPrompt()
  }
}

function clearMessages() {
  messages.value = []
}

function selectSession(session: Session) {
  selectedSessionId.value = session.id
  mode.value = 'resume'
  showSessionPicker.value = false
}

function formatDate(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60000) return '방금 전'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}분 전`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}시간 전`
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

const modeLabel = computed(() => {
  if (mode.value === 'new') return '새 대화'
  if (mode.value === 'continue') return '이어서 하기'
  if (mode.value === 'resume' && selectedSessionId.value) {
    const s = sessions.value.find(s => s.id === selectedSessionId.value)
    return s ? `세션: ${s.firstMessage?.slice(0, 20) || s.id.slice(0, 8)}...` : '세션 선택됨'
  }
  return '모드 선택'
})
</script>

<template>
  <div class="flex flex-col rounded-2xl border border-brain-border bg-brain-card/30 overflow-hidden">
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-3 border-b border-brain-border bg-brain-surface/50">
      <div class="flex items-center gap-2">
        <div class="w-2 h-2 rounded-full" :class="isRunning ? 'bg-neon-amber animate-pulse' : 'bg-neon-emerald'" />
        <span class="text-sm font-medium">Claude Code</span>
        <span class="text-[11px] text-brain-muted font-mono">{{ projectName }}</span>
      </div>
      <div class="flex items-center gap-2">
        <button
          v-if="messages.length"
          @click="clearMessages"
          class="text-[11px] text-brain-muted hover:text-brain-text transition-colors"
        >
          지우기
        </button>
      </div>
    </div>

    <!-- Mode Selector -->
    <div class="flex items-center gap-2 px-4 py-2 border-b border-brain-border/50 bg-brain-bg/30">
      <div class="flex rounded-lg border border-brain-border overflow-hidden text-[11px]">
        <button
          @click="mode = 'new'"
          class="px-3 py-1.5 transition-colors"
          :class="mode === 'new' ? 'bg-neon-indigo/20 text-neon-indigo' : 'text-brain-muted hover:text-brain-text'"
        >
          새 대화
        </button>
        <button
          @click="mode = 'continue'"
          class="px-3 py-1.5 border-l border-brain-border transition-colors"
          :class="mode === 'continue' ? 'bg-neon-cyan/20 text-neon-cyan' : 'text-brain-muted hover:text-brain-text'"
        >
          이어서 하기
        </button>
        <button
          @click="showSessionPicker = !showSessionPicker"
          class="px-3 py-1.5 border-l border-brain-border transition-colors"
          :class="mode === 'resume' ? 'bg-neon-emerald/20 text-neon-emerald' : 'text-brain-muted hover:text-brain-text'"
        >
          세션 선택
        </button>
      </div>
      <span class="text-[10px] text-brain-muted font-mono">
        {{ mode === 'new' ? 'claude -p' : mode === 'continue' ? 'claude -c -p' : 'claude -r ' + (selectedSessionId?.slice(0, 8) || '...') + ' -p' }}
      </span>
    </div>

    <!-- Session Picker Dropdown -->
    <div v-if="showSessionPicker" class="border-b border-brain-border bg-brain-bg/50 max-h-48 overflow-y-auto">
      <div v-if="!sessions.length" class="px-4 py-3 text-[11px] text-brain-muted">
        세션이 없습니다
      </div>
      <button
        v-for="session in sessions"
        :key="session.id"
        @click="selectSession(session)"
        class="w-full flex items-start gap-3 px-4 py-2.5 text-left hover:bg-brain-surface/50 transition-colors border-b border-brain-border/30 last:border-0"
        :class="selectedSessionId === session.id ? 'bg-neon-emerald/5' : ''"
      >
        <div class="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" :class="selectedSessionId === session.id ? 'bg-neon-emerald' : 'bg-brain-muted/30'" />
        <div class="flex-1 min-w-0">
          <p class="text-[12px] text-brain-text truncate">{{ session.firstMessage || session.id.slice(0, 12) }}</p>
          <div class="flex items-center gap-2 mt-0.5">
            <span class="text-[10px] text-brain-muted font-mono">{{ session.messageCount }}msgs</span>
            <span class="text-[10px] text-brain-muted">{{ session.sizeMb }}MB</span>
            <span class="text-[10px] text-brain-muted">{{ formatDate(session.updatedAt) }}</span>
          </div>
        </div>
      </button>
    </div>

    <!-- Messages -->
    <div ref="outputRef" class="flex-1 overflow-y-auto p-4 space-y-4 min-h-[250px] max-h-[500px]">
      <div v-if="!messages.length" class="flex flex-col items-center justify-center h-full text-brain-muted py-10">
        <div class="text-4xl mb-3 opacity-30">🧠</div>
        <p class="text-sm">프롬프트를 입력하세요</p>
        <p class="text-[11px] mt-1 text-brain-muted/60">
          {{ mode === 'continue' ? '마지막 대화를 이어서 진행합니다' : mode === 'resume' ? '선택한 세션을 이어서 진행합니다' : '새로운 대화를 시작합니다' }}
        </p>
      </div>

      <div v-for="msg in messages" :key="msg.id">
        <div v-if="msg.role === 'user'" class="flex gap-3">
          <div class="w-6 h-6 rounded-lg bg-neon-indigo/20 border border-neon-indigo/30 flex items-center justify-center shrink-0 mt-0.5">
            <span class="text-[10px]">👤</span>
          </div>
          <div>
            <p class="text-[11px] text-brain-muted mb-1">You</p>
            <p class="text-sm bg-brain-surface/80 rounded-xl rounded-tl-none px-3 py-2 border border-brain-border inline-block">{{ msg.content }}</p>
          </div>
        </div>

        <div v-else-if="msg.role === 'assistant'" class="flex gap-3">
          <div class="w-6 h-6 rounded-lg bg-neon-cyan/20 border border-neon-cyan/30 flex items-center justify-center shrink-0 mt-0.5">
            <span class="text-[10px]">🤖</span>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-[11px] text-brain-muted mb-1">Claude</p>
            <div v-if="msg.content" class="text-sm bg-brain-bg/80 rounded-xl rounded-tl-none px-4 py-3 border border-brain-border font-mono text-[13px] leading-relaxed whitespace-pre-wrap break-words overflow-x-auto">{{ msg.content }}</div>
            <div v-else class="flex items-center gap-2 text-sm text-brain-muted">
              <div class="flex gap-1">
                <span class="w-1.5 h-1.5 rounded-full bg-neon-cyan animate-bounce [animation-delay:0ms]" />
                <span class="w-1.5 h-1.5 rounded-full bg-neon-cyan animate-bounce [animation-delay:150ms]" />
                <span class="w-1.5 h-1.5 rounded-full bg-neon-cyan animate-bounce [animation-delay:300ms]" />
              </div>
              생각 중...
            </div>
          </div>
        </div>

        <div v-else-if="msg.role === 'error'" class="flex gap-3">
          <div class="w-6 h-6 rounded-lg bg-neon-rose/20 border border-neon-rose/30 flex items-center justify-center shrink-0 mt-0.5">
            <span class="text-[10px]">⚠️</span>
          </div>
          <div>
            <p class="text-[11px] text-neon-rose mb-1">Error</p>
            <p class="text-sm text-neon-rose/80 font-mono">{{ msg.content }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Input -->
    <div class="border-t border-brain-border p-3 bg-brain-surface/30">
      <div class="flex gap-2">
        <div class="flex-1 relative">
          <textarea
            v-model="prompt"
            @keydown="handleKeydown"
            :disabled="isRunning"
            rows="1"
            :placeholder="mode === 'continue' ? '이어서 질문하세요... (Enter로 전송)' : mode === 'resume' ? '선택한 세션에서 이어서... (Enter로 전송)' : 'Claude에게 물어보세요... (Enter로 전송)'"
            class="w-full bg-brain-bg border border-brain-border rounded-xl px-4 py-2.5 text-sm placeholder:text-brain-muted/40 focus:outline-none focus:border-neon-indigo/50 focus:shadow-neon resize-none transition-all disabled:opacity-50"
          />
        </div>
        <button
          @click="sendPrompt"
          :disabled="!prompt.trim() || isRunning"
          class="px-4 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-neon-indigo to-neon-cyan text-white shadow-neon hover:shadow-neon-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
        >
          <svg v-if="isRunning" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
        </button>
      </div>
      <p class="text-[10px] text-brain-muted/40 mt-1.5 px-1">
        cwd: {{ projectPath }}
      </p>
    </div>
  </div>
</template>
