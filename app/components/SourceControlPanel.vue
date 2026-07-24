<script setup lang="ts">
const props = defineProps<{
  projectPath: string
  projectName: string
}>()

const status = ref<any>(null)
const statusError = ref('')
const selectedFile = ref<string | null>(null)
const diffText = ref('')
const diffLoading = ref(false)

// diff 라인 코멘트: { file, lineIdx, lineText, comment }
const notes = ref<{ file: string; lineIdx: number; lineText: string; comment: string }[]>([])
const commentingLine = ref<number | null>(null)
const commentDraft = ref('')

const commitMsg = ref('')
const generating = ref(false)
const committing = ref(false)
const commitResult = ref('')

async function loadStatus() {
  statusError.value = ''
  try {
    status.value = await $fetch('/api/git/status', { query: { path: props.projectPath } })
  } catch (e: any) {
    statusError.value = e.data?.message || 'git 상태 조회 실패'
    status.value = null
  }
}

onMounted(loadStatus)

async function openDiff(file: string) {
  selectedFile.value = file
  commentingLine.value = null
  diffLoading.value = true
  try {
    const res = await $fetch('/api/git/diff', { query: { path: props.projectPath, file } }) as any
    diffText.value = res.diff
  } catch (e: any) {
    diffText.value = `(diff 조회 실패: ${e.data?.message || e.message})`
  } finally {
    diffLoading.value = false
  }
}

const diffLines = computed(() => diffText.value.split('\n'))

function lineClass(line: string): string {
  if (line.startsWith('+') && !line.startsWith('+++')) return 'text-neon-emerald bg-neon-emerald/[0.06]'
  if (line.startsWith('-') && !line.startsWith('---')) return 'text-neon-rose bg-neon-rose/[0.06]'
  if (line.startsWith('@@')) return 'text-neon-cyan/80'
  if (line.startsWith('diff ') || line.startsWith('+++') || line.startsWith('---')) return 'text-brain-muted'
  return 'text-brain-text-secondary'
}

function startComment(idx: number) {
  commentingLine.value = commentingLine.value === idx ? null : idx
  commentDraft.value = ''
}

function saveComment(idx: number) {
  const text = commentDraft.value.trim()
  if (!text || !selectedFile.value) return
  notes.value.push({
    file: selectedFile.value,
    lineIdx: idx,
    lineText: diffLines.value[idx] || '',
    comment: text,
  })
  commentingLine.value = null
  commentDraft.value = ''
}

function noteForLine(idx: number) {
  return notes.value.filter(n => n.file === selectedFile.value && n.lineIdx === idx)
}

function removeNote(n: any) {
  notes.value = notes.value.filter(x => x !== n)
}

// 모아둔 코멘트를 이 프로젝트에서 실행 중인 Claude 터미널로 일괄 전송 (orca diff-comments 패턴)
const sendResult = ref('')
async function sendNotesToAgent() {
  if (!notes.value.length) return
  const termId = localStorage.getItem(`cortex-term:${props.projectPath}:claude`)
  if (!termId) {
    sendResult.value = '⚠️ 이 프로젝트의 Claude 탭이 열려 있어야 합니다 (🤖 Claude 모드로 먼저 실행)'
    return
  }
  const lines = ['다음 코드 리뷰 코멘트를 반영해줘:']
  for (const n of notes.value) {
    lines.push(`- ${n.file} 의 \`${n.lineText.trim().slice(0, 80)}\` 부분: ${n.comment}`)
  }
  try {
    await $fetch(`/api/terminal/${termId}`, {
      method: 'POST',
      body: { type: 'input', data: lines.join('\n') + '\n' },
    })
    sendResult.value = `✅ 코멘트 ${notes.value.length}개를 Claude에 전송했습니다`
    notes.value = []
  } catch {
    sendResult.value = '⚠️ 전송 실패 — Claude 터미널이 살아있는지 확인하세요'
  }
  setTimeout(() => { sendResult.value = '' }, 5000)
}

async function generateMessage() {
  generating.value = true
  commitResult.value = ''
  try {
    const res = await $fetch('/api/git/commit-message', {
      method: 'POST',
      body: { path: props.projectPath },
    }) as any
    if (res.empty) commitResult.value = '변경사항이 없습니다'
    else commitMsg.value = res.message
  } catch (e: any) {
    commitResult.value = e.data?.message || 'AI 메시지 생성 실패'
  } finally {
    generating.value = false
  }
}

async function commit(push: boolean) {
  if (!commitMsg.value.trim() || committing.value) return
  committing.value = true
  commitResult.value = ''
  try {
    const res = await $fetch('/api/git/commit', {
      method: 'POST',
      body: { path: props.projectPath, message: commitMsg.value, push },
    }) as any
    commitResult.value = res.error
      ? `✅ 커밋됨 / ${res.error}`
      : `✅ ${push ? '커밋 + 푸시' : '커밋'} 완료`
    commitMsg.value = ''
    selectedFile.value = null
    diffText.value = ''
    await loadStatus()
  } catch (e: any) {
    commitResult.value = `⚠️ ${e.data?.message || '커밋 실패'}`
  } finally {
    committing.value = false
  }
}

const statusColor: Record<string, string> = {
  'M': 'text-neon-amber', 'A': 'text-neon-emerald', 'D': 'text-neon-rose',
  'R': 'text-neon-cyan', '??': 'text-neon-emerald',
}
</script>

<template>
  <div class="flex flex-col rounded-xl border border-brain-border bg-brain-card overflow-hidden">
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-2.5 border-b border-brain-border bg-brain-surface/50">
      <div class="flex items-center gap-2 min-w-0">
        <span class="text-sm font-medium shrink-0">소스 컨트롤</span>
        <span v-if="status" class="text-[11px] text-brain-muted font-mono truncate">
          {{ status.branch }}
          <span v-if="status.ahead">↑{{ status.ahead }}</span>
          <span v-if="status.behind">↓{{ status.behind }}</span>
        </span>
      </div>
      <button
        @click="loadStatus"
        class="w-6 h-6 rounded flex items-center justify-center text-xs text-brain-muted hover:text-brain-text hover:bg-white/[0.06] transition-colors"
      >⟳</button>
    </div>

    <p v-if="statusError" class="px-4 py-3 text-xs text-neon-amber">{{ statusError }}</p>

    <div v-else-if="status" class="flex flex-col lg:flex-row min-h-0" style="max-height: 640px">
      <!-- 파일 목록 -->
      <div class="lg:w-64 shrink-0 border-b lg:border-b-0 lg:border-r border-brain-border overflow-y-auto scrollbar-sleek max-h-48 lg:max-h-none">
        <p v-if="!status.files.length" class="px-4 py-6 text-xs text-brain-muted text-center">변경사항 없음 ✨</p>
        <button
          v-for="f in status.files"
          :key="f.path"
          @click="openDiff(f.path)"
          class="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-white/[0.04] transition-colors"
          :class="selectedFile === f.path ? 'bg-white/[0.06]' : ''"
        >
          <span class="text-[10px] font-mono font-bold w-5 shrink-0" :class="statusColor[f.status[0]] || 'text-brain-muted'">
            {{ f.status }}
          </span>
          <span class="text-xs truncate font-mono">{{ f.path }}</span>
          <span v-if="notes.some(n => n.file === f.path)" class="ml-auto text-[9px] text-neon-indigo shrink-0">
            📝{{ notes.filter(n => n.file === f.path).length }}
          </span>
        </button>
      </div>

      <!-- Diff 뷰 + 라인 코멘트 -->
      <div class="flex-1 min-w-0 overflow-auto scrollbar-sleek bg-brain-bg/50">
        <p v-if="!selectedFile" class="px-4 py-8 text-xs text-brain-muted text-center">
          파일을 선택하면 diff가 표시됩니다.<br/>라인을 클릭해 "AI에게 메모"를 남기고 한 번에 전송하세요.
        </p>
        <p v-else-if="diffLoading" class="px-4 py-8 text-xs text-brain-muted text-center">불러오는 중...</p>
        <div v-else class="font-mono text-[11px] leading-relaxed py-2">
          <template v-for="(line, idx) in diffLines" :key="idx">
            <div
              class="group flex hover:bg-white/[0.04] cursor-pointer"
              :class="commentingLine === idx ? 'bg-neon-indigo/[0.08]' : ''"
              @click="startComment(idx)"
            >
              <span class="w-9 shrink-0 text-right pr-2 text-brain-muted/40 select-none">{{ idx + 1 }}</span>
              <span class="whitespace-pre-wrap break-all flex-1 px-1" :class="lineClass(line)">{{ line || ' ' }}</span>
              <span class="opacity-0 group-hover:opacity-100 text-neon-indigo px-2 select-none shrink-0">＋</span>
            </div>

            <!-- 저장된 코멘트 -->
            <div v-for="n in noteForLine(idx)" :key="n.comment + idx" class="flex items-start gap-2 ml-9 my-1 mr-2 px-3 py-2 rounded-md bg-neon-indigo/10 border border-neon-indigo/25">
              <span class="text-[10px] mt-0.5">📝</span>
              <p class="flex-1 text-xs text-brain-text font-sans">{{ n.comment }}</p>
              <button @click.stop="removeNote(n)" class="text-[10px] text-brain-muted hover:text-neon-rose">✕</button>
            </div>

            <!-- 코멘트 입력 -->
            <div v-if="commentingLine === idx" class="flex gap-2 ml-9 my-1 mr-2" @click.stop>
              <input
                v-model="commentDraft"
                type="text"
                placeholder="AI에게 메모... (Enter 저장, Esc 취소)"
                class="flex-1 bg-brain-bg border border-neon-indigo/40 rounded-md px-3 py-1.5 text-xs font-sans focus:outline-none"
                autofocus
                @keydown.enter="saveComment(idx)"
                @keydown.escape="commentingLine = null"
              />
              <button
                @click="saveComment(idx)"
                :disabled="!commentDraft.trim()"
                class="px-2.5 py-1 rounded-md text-xs bg-neon-indigo text-white disabled:opacity-40"
              >저장</button>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- 하단: 노트 전송 + 커밋 -->
    <div v-if="status" class="border-t border-brain-border p-3 space-y-2 bg-brain-surface/30">
      <div v-if="notes.length || sendResult" class="flex items-center gap-2">
        <button
          v-if="notes.length"
          @click="sendNotesToAgent"
          class="px-3 py-1.5 rounded-md text-xs font-medium bg-neon-indigo text-white hover:bg-neon-indigo-deep transition-colors"
        >
          📝 코멘트 {{ notes.length }}개 Claude로 보내기
        </button>
        <span v-if="sendResult" class="text-[11px] text-brain-text-secondary">{{ sendResult }}</span>
      </div>

      <div class="flex gap-2">
        <textarea
          v-model="commitMsg"
          rows="2"
          placeholder="커밋 메시지..."
          class="flex-1 bg-brain-bg border border-brain-border rounded-md px-3 py-2 text-xs font-mono placeholder:text-brain-muted/60 focus:outline-none focus:border-neon-indigo/50 resize-none"
        />
        <div class="flex flex-col gap-1.5 shrink-0">
          <button
            @click="generateMessage"
            :disabled="generating || !status.files.length"
            class="px-2.5 py-1 rounded-md text-[11px] border border-neon-indigo/40 text-neon-indigo hover:bg-neon-indigo/10 transition-colors disabled:opacity-40 whitespace-nowrap"
          >
            {{ generating ? '생성 중...' : '🤖 AI 메시지' }}
          </button>
          <button
            @click="commit(false)"
            :disabled="!commitMsg.trim() || committing"
            class="px-2.5 py-1 rounded-md text-[11px] bg-neon-indigo text-white hover:bg-neon-indigo-deep transition-colors disabled:opacity-40 whitespace-nowrap"
          >커밋</button>
          <button
            @click="commit(true)"
            :disabled="!commitMsg.trim() || committing"
            class="px-2.5 py-1 rounded-md text-[11px] border border-brain-border text-brain-text-secondary hover:text-brain-text transition-colors disabled:opacity-40 whitespace-nowrap"
          >커밋+푸시</button>
        </div>
      </div>
      <p v-if="commitResult" class="text-[11px] text-brain-text-secondary">{{ commitResult }}</p>
    </div>
  </div>
</template>
