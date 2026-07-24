<script setup lang="ts">
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'

const props = defineProps<{
  projectPath: string
  projectName: string
  startClaude?: boolean
  initialCommand?: string // fan-out 등 커스텀 시작 명령 (startClaude 기본 명령보다 우선)
}>()

const terminalRef = ref<HTMLElement>()
const wrapperRef = ref<HTMLElement>()
const terminalId = ref<string | null>(null)
const isConnected = ref(false)
const isLoading = ref(true)
const imageToast = ref('')
const isDragging = ref(false)

const STORAGE_KEY = 'cortex-terminal-height'
const DEFAULT_HEIGHT = 500
const MIN_HEIGHT = 200
const MAX_HEIGHT = 1200
const terminalHeight = ref(DEFAULT_HEIGHT)
const isMobileView = ref(false)

let isResizing = false
let startY = 0
let startHeight = 0

function initHeight() {
  if (window.innerWidth < 640) {
    terminalHeight.value = Math.min(window.innerHeight - 180, 500)
    return
  }
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) {
    const h = parseInt(saved, 10)
    if (h >= MIN_HEIGHT && h <= MAX_HEIGHT) terminalHeight.value = h
  }
}

function onResizeStart(e: MouseEvent) {
  e.preventDefault()
  isResizing = true
  startY = e.clientY
  startHeight = terminalHeight.value
  document.addEventListener('mousemove', onResizeMove)
  document.addEventListener('mouseup', onResizeEnd)
  document.body.style.cursor = 'row-resize'
  document.body.style.userSelect = 'none'
}

function onResizeMove(e: MouseEvent) {
  if (!isResizing) return
  const delta = e.clientY - startY
  const next = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, startHeight + delta))
  terminalHeight.value = next
}

function onResizeEnd() {
  if (!isResizing) return
  isResizing = false
  document.removeEventListener('mousemove', onResizeMove)
  document.removeEventListener('mouseup', onResizeEnd)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  localStorage.setItem(STORAGE_KEY, String(terminalHeight.value))
  handleResize()
}

function onTouchResizeStart(e: TouchEvent) {
  isResizing = true
  startY = e.touches[0].clientY
  startHeight = terminalHeight.value
  document.addEventListener('touchmove', onTouchResizeMove, { passive: false })
  document.addEventListener('touchend', onTouchResizeEnd)
}

function onTouchResizeMove(e: TouchEvent) {
  if (!isResizing) return
  e.preventDefault()
  const delta = e.touches[0].clientY - startY
  terminalHeight.value = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, startHeight + delta))
}

function onTouchResizeEnd() {
  if (!isResizing) return
  isResizing = false
  document.removeEventListener('touchmove', onTouchResizeMove)
  document.removeEventListener('touchend', onTouchResizeEnd)
  localStorage.setItem(STORAGE_KEY, String(terminalHeight.value))
  handleResize()
}

let term: Terminal | null = null
let fitAddon: FitAddon | null = null
let reader: ReadableStreamDefaultReader | null = null

// 세션 생존성: 터미널 id를 localStorage에 저장해 페이지 이탈/새로고침 후 재부착
const storageKey = computed(() => `cortex-term:${props.projectPath}:${props.startClaude ? 'claude' : 'shell'}`)
let lastSeq = 0
let intentionalClose = false

async function uploadImage(base64: string, mimeType: string): Promise<string | null> {
  try {
    const { path } = await $fetch('/api/terminal/upload-image', {
      method: 'POST',
      body: { base64, mimeType, projectPath: props.projectPath },
    }) as { path: string }
    return path
  } catch {
    return null
  }
}

function sendToTerminal(text: string) {
  if (!terminalId.value) return
  $fetch(`/api/terminal/${terminalId.value}`, {
    method: 'POST',
    body: { type: 'input', data: text },
  })
}

function showToast(msg: string) {
  imageToast.value = msg
  setTimeout(() => { imageToast.value = '' }, 3000)
}

async function handleImageBlob(blob: Blob) {
  showToast('이미지 업로드 중...')
  const reader = new FileReader()
  reader.onload = async () => {
    const base64 = (reader.result as string).split(',')[1]
    const path = await uploadImage(base64, blob.type)
    if (path) {
      sendToTerminal(path)
      showToast(`이미지 삽입됨: ${path.split('/').pop()}`)
    } else {
      showToast('이미지 업로드 실패')
    }
  }
  reader.readAsDataURL(blob)
}

async function handlePaste(e: ClipboardEvent) {
  const items = e.clipboardData?.items
  if (!items) return

  for (const item of items) {
    if (item.type.startsWith('image/')) {
      e.preventDefault()
      const blob = item.getAsFile()
      if (blob) await handleImageBlob(blob)
      return
    }
  }
}

function handleDragOver(e: DragEvent) {
  e.preventDefault()
  isDragging.value = true
}

function handleDragLeave() {
  isDragging.value = false
}

async function handleDrop(e: DragEvent) {
  e.preventDefault()
  isDragging.value = false

  const files = e.dataTransfer?.files
  if (!files) return

  for (const file of files) {
    if (file.type.startsWith('image/')) {
      await handleImageBlob(file)
      return
    }
    // Non-image files: just insert the filename for reference
    showToast(`파일은 이미지만 지원됩니다`)
  }
}

async function initTerminal() {
  if (!terminalRef.value) return

  const isMobile = window.innerWidth < 640
  term = new Terminal({
    cursorBlink: true,
    cursorStyle: 'bar',
    fontSize: isMobile ? 10 : 13,
    fontFamily: 'JetBrains Mono, Menlo, Monaco, monospace',
    lineHeight: isMobile ? 1.2 : 1.4,
    theme: {
      background: '#0a0a0a',
      foreground: '#e4e4e7',
      cursor: '#818cf8',
      cursorAccent: '#0a0a0a',
      selectionBackground: '#818cf840',
      black: '#09090b',
      red: '#fb7185',
      green: '#34d399',
      yellow: '#fbbf24',
      blue: '#818cf8',
      magenta: '#a78bfa',
      cyan: '#22d3ee',
      white: '#e4e4e7',
      brightBlack: '#52525b',
      brightRed: '#fb7185',
      brightGreen: '#34d399',
      brightYellow: '#fbbf24',
      brightBlue: '#818cf8',
      brightMagenta: '#a78bfa',
      brightCyan: '#22d3ee',
      brightWhite: '#fafafa',
    },
    allowTransparency: true,
    scrollback: 5000,
  })

  fitAddon = new FitAddon()
  term.loadAddon(fitAddon)
  term.loadAddon(new WebLinksAddon())

  term.open(terminalRef.value)
  fitAddon.fit()

  term.onData((data: string) => {
    if (terminalId.value) {
      $fetch(`/api/terminal/${terminalId.value}`, {
        method: 'POST',
        body: { type: 'input', data },
      })
    }
  })

  // 1) 저장된 세션에 재부착 시도 → 실패 시 새로 스폰
  const savedId = localStorage.getItem(storageKey.value)
  if (savedId) {
    try {
      const ping = await $fetch(`/api/terminal/${savedId}`, {
        method: 'POST',
        body: { type: 'ping' },
      }) as { alive: boolean }
      if (ping.alive) {
        terminalId.value = savedId
        lastSeq = 0 // 전체 버퍼 replay로 스크롤백 복원
        isLoading.value = false
        streamLoop()
        return
      }
    } catch {}
    localStorage.removeItem(storageKey.value)
  }

  await spawnNew()
}

async function spawnNew() {
  const command = props.initialCommand || (props.startClaude ? '/Users/scoop/.local/bin/claude -c' : undefined)
  try {
    const { id } = await $fetch('/api/terminal/spawn', {
      method: 'POST',
      body: { cwd: props.projectPath, command },
    }) as { id: string; pid: number }

    terminalId.value = id
    lastSeq = 0
    localStorage.setItem(storageKey.value, id)
    isLoading.value = false
    streamLoop()
  } catch (err: any) {
    isLoading.value = false
    term?.write(`\r\n\x1b[31mError: ${err.message}\x1b[0m\r\n`)
  }
}

// SSE 수신 루프 — 끊기면 lastSeq부터 자동 재접속
async function streamLoop() {
  while (!intentionalClose && terminalId.value) {
    const id = terminalId.value
    try {
      const response = await fetch(`/api/terminal/${id}?since=${lastSeq}`)
      if (response.status === 404) {
        // 서버 재시작 등으로 세션 소멸 → 새 세션
        localStorage.removeItem(storageKey.value)
        if (!intentionalClose) {
          term?.write('\r\n\x1b[33m[세션이 종료되어 새로 시작합니다]\x1b[0m\r\n')
          await spawnNew()
        }
        return
      }

      reader = response.body?.getReader() || null
      const decoder = new TextDecoder()
      if (!reader) throw new Error('no stream')

      isConnected.value = true
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
            const msg = JSON.parse(line.slice(6))
            if ((msg.type === 'output' || msg.type === 'replay') && term) {
              if (msg.type === 'replay') term.clear()
              term.write(msg.data)
              lastSeq = msg.seq
            } else if (msg.type === 'hello') {
              lastSeq = msg.seq
            } else if (msg.type === 'exit') {
              isConnected.value = false
              localStorage.removeItem(storageKey.value)
              return
            }
          } catch {}
        }
      }
    } catch {}

    isConnected.value = false
    if (intentionalClose) return
    // 네트워크 단절 등 — 1.5초 후 재접속
    await new Promise(r => setTimeout(r, 1500))
  }
}

function handleResize() {
  if (fitAddon && term) {
    fitAddon.fit()
    if (terminalId.value) {
      $fetch(`/api/terminal/${terminalId.value}`, {
        method: 'POST',
        body: { type: 'resize', cols: term.cols, rows: term.rows },
      })
    }
  }
}

async function killTerminal() {
  intentionalClose = true
  localStorage.removeItem(storageKey.value)
  if (terminalId.value) {
    await $fetch(`/api/terminal/${terminalId.value}`, {
      method: 'POST',
      body: { type: 'kill' },
    }).catch(() => {})
  }
  isConnected.value = false
}

async function restartClaude() {
  await killTerminal()
  reader?.cancel().catch(() => {})
  term?.dispose()
  isLoading.value = true
  isConnected.value = false
  terminalId.value = null
  intentionalClose = false
  lastSeq = 0
  await nextTick()
  initTerminal()
}

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  isMobileView.value = window.innerWidth < 640
  initHeight()
  initTerminal()
  resizeObserver = new ResizeObserver(handleResize)
  if (terminalRef.value) {
    resizeObserver.observe(terminalRef.value)
  }
})

onBeforeUnmount(() => {
  // 세션은 죽이지 않는다 — 페이지 이탈/모드 전환 후 재부착 가능 (명시적 종료·탭 닫기에서만 kill)
  intentionalClose = true
  resizeObserver?.disconnect()
  reader?.cancel().catch(() => {})
  term?.dispose()
})
</script>

<template>
  <div
    ref="wrapperRef"
    class="relative flex flex-col rounded-xl sm:rounded-2xl border border-brain-border bg-brain-card/30 overflow-hidden max-w-full"
    :class="isDragging ? 'ring-2 ring-neon-cyan/50' : ''"
    @paste="handlePaste"
    @dragover="handleDragOver"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
  >
    <!-- Header -->
    <div class="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-2.5 border-b border-brain-border bg-brain-surface/50">
      <div class="flex items-center gap-1.5 sm:gap-2 min-w-0">
        <div class="w-2 h-2 rounded-full transition-colors shrink-0" :class="isConnected ? 'bg-neon-emerald' : isLoading ? 'bg-neon-amber animate-pulse' : 'bg-brain-muted'" />
        <span class="text-xs sm:text-sm font-medium shrink-0">{{ startClaude ? 'Claude' : 'Terminal' }}</span>
        <span class="text-[10px] sm:text-[11px] text-brain-muted font-mono truncate">{{ projectName }}</span>
      </div>
      <div class="flex items-center gap-1 sm:gap-2 shrink-0">
        <button
          v-if="startClaude"
          @click="restartClaude"
          class="text-[10px] sm:text-[11px] text-brain-muted hover:text-brain-text transition-colors px-1.5 sm:px-2 py-1 rounded hover:bg-brain-bg"
        >
          재시작
        </button>
        <button
          @click="killTerminal"
          class="text-[10px] sm:text-[11px] text-brain-muted hover:text-neon-rose transition-colors px-1.5 sm:px-2 py-1 rounded hover:bg-brain-bg"
        >
          종료
        </button>
      </div>
    </div>

    <!-- Terminal -->
    <div ref="terminalRef" class="terminal-container" :style="{ height: terminalHeight + 'px', padding: isMobileView ? '2px' : '8px' }" />

    <!-- Resize Handle -->
    <div
      @mousedown="onResizeStart"
      @touchstart.prevent="onTouchResizeStart"
      class="resize-handle group flex items-center justify-center h-3 sm:h-2 cursor-row-resize hover:bg-neon-cyan/10 active:bg-neon-cyan/10 transition-colors border-t border-brain-border/50"
    >
      <div class="w-12 sm:w-10 h-1 sm:h-0.5 rounded-full bg-brain-muted/30 group-hover:bg-neon-cyan/60 transition-colors" />
    </div>

    <!-- Image toast -->
    <Transition name="toast">
      <div
        v-if="imageToast"
        class="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl bg-neon-indigo/20 border border-neon-indigo/30 text-sm text-neon-indigo backdrop-blur-sm"
      >
        {{ imageToast }}
      </div>
    </Transition>

    <!-- Drag overlay -->
    <div
      v-if="isDragging"
      class="absolute inset-0 bg-neon-cyan/5 backdrop-blur-[1px] flex items-center justify-center z-10 pointer-events-none"
    >
      <div class="px-6 py-4 rounded-2xl bg-brain-surface/90 border border-neon-cyan/30 text-neon-cyan text-sm font-medium shadow-neon-cyan">
        🖼️ 이미지를 놓으세요
      </div>
    </div>
  </div>
</template>

<style>
@import 'xterm/css/xterm.css';

.terminal-container {
  overflow: hidden;
}

.terminal-container .xterm {
  padding: 4px;
  width: 100% !important;
}

.terminal-container .xterm-screen {
  width: 100% !important;
}

.terminal-container .xterm-viewport {
  overflow-y: auto !important;
  width: 100% !important;
}

.terminal-container .xterm-viewport::-webkit-scrollbar {
  width: 4px;
}
.terminal-container .xterm-viewport::-webkit-scrollbar-thumb {
  background: #252540;
  border-radius: 3px;
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 10px);
}
</style>
