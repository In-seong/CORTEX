<script setup lang="ts">
import { marked } from 'marked'
import DOMPurify from 'dompurify'

// transcript(.jsonl) 폴링 → 채팅 렌더 (orca native-chat 뷰 축약판).
// 어시스턴트 답변은 orca처럼 마크다운 문서형으로 렌더. 전송은 ClaudeComposer가 bracketed paste.

marked.setOptions({ breaks: true, gfm: true })

function renderMarkdown(text: string): string {
  try {
    return DOMPurify.sanitize(marked.parse(text, { async: false }) as string)
  } catch {
    return text
  }
}

const props = defineProps<{
  projectPath: string
  projectName: string
  initialCommand?: string // 워크트리 fan-out 등: 세션 스폰 시 실행할 명령
}>()

// 터미널 뷰 토글 — 권한 응답·TUI 조작이 필요할 때만 펼침
const showTerminal = ref(false)

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

onMounted(async () => {
  poll()
  timer = setInterval(poll, 3000)

  // fan-out 등 시작 명령이 있으면 세션을 즉시 스폰 (첫 전송을 기다리지 않음)
  if (props.initialCommand) {
    const key = `cortex-term:${props.projectPath}:claude`
    const saved = localStorage.getItem(key)
    if (saved) {
      try {
        const ping = await $fetch(`/api/terminal/${saved}`, { method: 'POST', body: { type: 'ping' } }) as any
        if (ping.alive) return
      } catch {}
      localStorage.removeItem(key)
    }
    try {
      const { id } = await $fetch('/api/terminal/spawn', {
        method: 'POST',
        body: { cwd: props.projectPath, command: props.initialCommand },
      }) as any
      localStorage.setItem(key, id)
    } catch {}
  }
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
      <div class="flex items-center gap-2">
        <button
          v-if="!autoScroll && !showTerminal"
          @click="autoScroll = true; scrollToBottom()"
          class="text-[11px] text-neon-indigo hover:underline"
        >↓ 최신으로</button>
        <button
          @click="showTerminal = !showTerminal"
          class="px-2 py-1 rounded-md text-[11px] border transition-colors"
          :class="showTerminal ? 'bg-neon-cyan/15 text-neon-cyan border-neon-cyan/30' : 'border-brain-border text-brain-muted hover:text-brain-text'"
          title="권한 응답 등 TUI 직접 조작이 필요할 때"
        >🖥 터미널 {{ showTerminal ? '접기' : '보기' }}</button>
      </div>
    </div>

    <!-- Terminal view (같은 세션의 raw TUI) -->
    <div v-if="showTerminal" class="flex-1 overflow-y-auto scrollbar-sleek p-2">
      <RealTerminal
        :project-path="projectPath"
        :project-name="projectName"
        :start-claude="true"
        :initial-command="initialCommand"
      />
    </div>

    <!-- Messages -->
    <div v-show="!showTerminal" ref="scrollRef" class="flex-1 overflow-y-auto scrollbar-sleek p-4 space-y-3" @scroll="onScroll">
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

        <!-- Assistant — orca처럼 문서형 전체 폭 렌더 -->
        <div v-else class="w-full min-w-0">
          <!-- Tool chips -->
          <div v-if="msg.tools?.length" class="flex flex-wrap gap-1 mb-1.5">
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
          <div v-if="msg.text" class="chat-md text-sm leading-relaxed break-words" v-html="renderMarkdown(msg.text)" />
          <p class="text-[10px] text-brain-muted/60 mt-1 font-mono">🤖 {{ fmtTime(msg.ts) }}</p>
        </div>
      </div>
    </div>

    <!-- Composer -->
    <ClaudeComposer :project-path="projectPath" :initial-command="initialCommand" @sent="autoScroll = true" />
  </div>
</template>

<style>
/* 어시스턴트 마크다운 문서 스타일 (orca 문서형 렌더 대응) */
.chat-md > *:first-child { margin-top: 0; }
.chat-md > *:last-child { margin-bottom: 0; }
.chat-md p { margin: 0.5em 0; }
.chat-md h1, .chat-md h2, .chat-md h3, .chat-md h4 {
  font-weight: 600; margin: 1em 0 0.4em; line-height: 1.3;
}
.chat-md h1 { font-size: 1.15rem; }
.chat-md h2 { font-size: 1.05rem; }
.chat-md h3, .chat-md h4 { font-size: 0.95rem; }
.chat-md ul, .chat-md ol { margin: 0.4em 0; padding-left: 1.4em; }
.chat-md ul { list-style: disc; }
.chat-md ol { list-style: decimal; }
.chat-md li { margin: 0.15em 0; }
.chat-md li > ul, .chat-md li > ol { margin: 0.1em 0; }
.chat-md code {
  font-family: 'JetBrains Mono', monospace; font-size: 0.85em;
  background: rgba(255, 255, 255, 0.07); border-radius: 4px; padding: 0.1em 0.35em;
}
.chat-md pre {
  background: #0a0a0a; border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 8px; padding: 0.75em 1em; margin: 0.6em 0;
  overflow-x: auto; font-size: 0.8rem; line-height: 1.5;
}
.chat-md pre code { background: transparent; padding: 0; font-size: inherit; }
.chat-md blockquote {
  border-left: 3px solid rgba(129, 140, 248, 0.4); padding-left: 0.8em;
  margin: 0.5em 0; color: #a1a1a1;
}
.chat-md table {
  border-collapse: collapse; margin: 0.6em 0; font-size: 0.85em;
  display: block; overflow-x: auto; max-width: 100%;
}
.chat-md th, .chat-md td {
  border: 1px solid rgba(255, 255, 255, 0.1); padding: 0.35em 0.7em; text-align: left;
}
.chat-md th { background: rgba(255, 255, 255, 0.04); font-weight: 600; }
.chat-md a { color: #818cf8; text-decoration: underline; }
.chat-md hr { border: none; border-top: 1px solid rgba(255, 255, 255, 0.1); margin: 0.8em 0; }
.chat-md strong { font-weight: 600; }
</style>
