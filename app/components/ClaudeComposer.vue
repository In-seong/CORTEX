<script setup lang="ts">
// orca native-chat 컴포저 패턴:
// 일반 textarea로 작성(한글 IME 안전) → PTY에 bracketed paste 주입 → 지연 Enter.
// 전송 전 에이전트 readiness 확인 (권한 대기 중이면 경고).

const props = defineProps<{
  projectPath: string
}>()

const emit = defineEmits<{ sent: [] }>()

const text = ref('')
const sending = ref(false)
const hint = ref('')
const textareaRef = ref<HTMLTextAreaElement>()

const storageKey = computed(() => `cortex-term:${props.projectPath}:claude`)
const draftKey = computed(() => `cortex-draft:${props.projectPath}`)

onMounted(() => {
  text.value = localStorage.getItem(draftKey.value) || ''
})
watch(text, (v) => {
  localStorage.setItem(draftKey.value, v)
  autoGrow()
})

function autoGrow() {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 180) + 'px'
}

function showHint(msg: string, ms = 4000) {
  hint.value = msg
  setTimeout(() => { if (hint.value === msg) hint.value = '' }, ms)
}

// 세션 확보: 저장된 id가 살아있으면 재사용, 없으면 claude -c 스폰
async function ensureSession(): Promise<string | null> {
  const saved = localStorage.getItem(storageKey.value)
  if (saved) {
    try {
      const ping = await $fetch(`/api/terminal/${saved}`, { method: 'POST', body: { type: 'ping' } }) as any
      if (ping.alive) return saved
    } catch {}
    localStorage.removeItem(storageKey.value)
  }
  try {
    const { id } = await $fetch('/api/terminal/spawn', {
      method: 'POST',
      body: { cwd: props.projectPath, command: '/Users/scoop/.local/bin/claude -c' },
    }) as any
    localStorage.setItem(storageKey.value, id)
    showHint('새 Claude 세션을 시작했습니다 — 잠시 후 전송됩니다')
    await new Promise(r => setTimeout(r, 3500)) // TUI 부팅 대기
    return id
  } catch {
    showHint('⚠️ 세션 시작 실패')
    return null
  }
}

async function checkReadiness(): Promise<'sendable' | 'permission' | 'unknown'> {
  try {
    const agents = await $fetch('/api/agents') as any[]
    const a = agents.find(x => x.cwd === props.projectPath)
    if (!a) return 'unknown'
    if (a.state === 'permission') return 'permission'
    return 'sendable'
  } catch {
    return 'unknown'
  }
}

async function send() {
  const prompt = text.value.trim()
  if (!prompt || sending.value) return
  sending.value = true
  try {
    const readiness = await checkReadiness()
    if (readiness === 'permission') {
      if (!confirm('Claude가 권한 응답을 기다리는 중입니다. 그래도 전송할까요?\n(터미널 모드에서 먼저 권한에 답하는 걸 권장)')) {
        sending.value = false
        return
      }
    }

    const id = await ensureSession()
    if (!id) { sending.value = false; return }

    // bracketed paste — 멀티라인도 한 덩어리로 안전하게
    const paste = `\x1b[200~${prompt}\x1b[201~`
    await $fetch(`/api/terminal/${id}`, { method: 'POST', body: { type: 'input', data: paste } })
    await new Promise(r => setTimeout(r, 300))
    await $fetch(`/api/terminal/${id}`, { method: 'POST', body: { type: 'input', data: '\r' } })

    text.value = ''
    localStorage.removeItem(draftKey.value)
    await nextTick()
    autoGrow()
    emit('sent')
  } catch {
    showHint('⚠️ 전송 실패 — 터미널 상태를 확인하세요')
  } finally {
    sending.value = false
  }
}

// ESC = 진행 중인 턴 중단
async function interrupt() {
  const saved = localStorage.getItem(storageKey.value)
  if (!saved) return
  await $fetch(`/api/terminal/${saved}`, { method: 'POST', body: { type: 'input', data: '\x1b' } }).catch(() => {})
  showHint('⏹ 중단 신호(ESC)를 보냈습니다', 2500)
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault()
    send()
  }
}

// 이미지 붙여넣기/드롭 → 업로드 후 경로 삽입
async function uploadImageBlob(blob: Blob) {
  showHint('이미지 업로드 중...')
  const reader = new FileReader()
  reader.onload = async () => {
    const base64 = (reader.result as string).split(',')[1]
    try {
      const { path } = await $fetch('/api/terminal/upload-image', {
        method: 'POST',
        body: { base64, mimeType: blob.type, projectPath: props.projectPath },
      }) as any
      text.value = (text.value ? text.value + '\n' : '') + path
      showHint(`이미지 삽입됨: ${path.split('/').pop()}`)
    } catch {
      showHint('⚠️ 이미지 업로드 실패')
    }
  }
  reader.readAsDataURL(blob)
}

function handlePaste(e: ClipboardEvent) {
  const items = e.clipboardData?.items
  if (!items) return
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      e.preventDefault()
      const blob = item.getAsFile()
      if (blob) uploadImageBlob(blob)
      return
    }
  }
}

function handleDrop(e: DragEvent) {
  e.preventDefault()
  const files = e.dataTransfer?.files
  if (!files) return
  for (const f of files) {
    if (f.type.startsWith('image/')) { uploadImageBlob(f); return }
  }
}
</script>

<template>
  <div class="border-t border-brain-border bg-brain-surface/40 p-2.5" @dragover.prevent @drop="handleDrop">
    <div class="flex items-end gap-2">
      <textarea
        ref="textareaRef"
        v-model="text"
        rows="1"
        placeholder="Claude에게 지시... (Enter 전송 · Shift+Enter 줄바꿈 · 이미지 붙여넣기 가능)"
        class="flex-1 bg-brain-bg border border-brain-border rounded-lg px-3.5 py-2.5 text-sm leading-relaxed placeholder:text-brain-muted/50 focus:outline-none focus:border-neon-indigo/50 resize-none transition-colors"
        style="min-height: 42px; max-height: 180px"
        @keydown="handleKeydown"
        @paste="handlePaste"
      />
      <div class="flex flex-col gap-1.5 shrink-0">
        <button
          @click="send"
          :disabled="!text.trim() || sending"
          class="w-10 h-10 rounded-lg bg-neon-indigo text-white flex items-center justify-center hover:bg-neon-indigo-deep transition-colors disabled:opacity-30"
          title="전송 (Enter)"
        >
          <svg v-if="sending" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
        </button>
        <button
          @click="interrupt"
          class="w-10 h-7 rounded-lg border border-brain-border text-brain-muted hover:text-neon-rose hover:border-neon-rose/40 flex items-center justify-center transition-colors text-[10px]"
          title="진행 중인 작업 중단 (ESC)"
        >⏹</button>
      </div>
    </div>
    <p v-if="hint" class="text-[11px] text-brain-text-secondary mt-1.5 px-1">{{ hint }}</p>
  </div>
</template>
