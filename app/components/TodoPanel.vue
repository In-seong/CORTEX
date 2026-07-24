<script setup lang="ts">
interface Todo {
  id: number
  title: string
  description: string
  status: string
  priority: string
  project_id: number | null
  project_name: string | null
  project_icon: string | null
  due_date: string | null
  created_at: string
}

const { data: todos, refresh } = await useFetch<Todo[]>('/api/todos')

const showAddForm = ref(false)
const newTitle = ref('')
const newPriority = ref('normal')
const newDescription = ref('')
const newDueDate = ref('')

const { data: projects } = await useFetch('/api/projects')
const newProjectId = ref<number | null>(null)

const editingId = ref<number | null>(null)
const editTitle = ref('')
const editDescription = ref('')
const editPriority = ref('normal')
const editDueDate = ref('')
const editProjectId = ref<number | null>(null)

const filterStatus = ref<'all' | 'pending' | 'completed'>('pending')
const expanded = ref(false)

const pendingTodos = computed(() =>
  (todos.value || []).filter(t => t.status !== 'completed')
)
const completedTodos = computed(() =>
  (todos.value || []).filter(t => t.status === 'completed')
)
const displayTodos = computed(() => {
  if (filterStatus.value === 'completed') return completedTodos.value
  if (filterStatus.value === 'pending') return pendingTodos.value
  return todos.value || []
})

const alertTodos = computed(() =>
  pendingTodos.value.filter(t => {
    if (!t.due_date) return false
    return getDday(t.due_date) <= 3
  })
)

function getDday(dueDate: string): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const due = new Date(dueDate + 'T00:00:00')
  return Math.ceil((due.getTime() - now.getTime()) / 86400000)
}

function ddayLabel(dueDate: string): string {
  const d = getDday(dueDate)
  if (d < 0) return `D+${Math.abs(d)}`
  if (d === 0) return 'D-Day'
  return `D-${d}`
}

function ddayStyle(dueDate: string): string {
  const d = getDday(dueDate)
  if (d < 0) return 'bg-neon-rose/20 text-neon-rose border-neon-rose/40 animate-pulse'
  if (d === 0) return 'bg-neon-rose/20 text-neon-rose border-neon-rose/40 animate-pulse'
  if (d <= 3) return 'bg-neon-amber/15 text-neon-amber border-neon-amber/30'
  if (d <= 7) return 'bg-neon-cyan/10 text-neon-cyan border-neon-cyan/20'
  return 'bg-brain-surface text-brain-muted border-brain-border'
}

function dueDateDisplay(dueDate: string): string {
  const d = new Date(dueDate + 'T00:00:00')
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' })
}

function startEdit(todo: Todo) {
  if (editingId.value === todo.id) {
    editingId.value = null
    return
  }
  editingId.value = todo.id
  editTitle.value = todo.title
  editDescription.value = todo.description || ''
  editPriority.value = todo.priority
  editDueDate.value = todo.due_date || ''
  editProjectId.value = todo.project_id
}

async function saveEdit() {
  if (!editingId.value || !editTitle.value.trim()) return
  await $fetch(`/api/todos/${editingId.value}`, {
    method: 'PUT',
    body: {
      title: editTitle.value.trim(),
      description: editDescription.value.trim(),
      priority: editPriority.value,
      due_date: editDueDate.value || null,
      project_id: editProjectId.value,
    },
  })
  editingId.value = null
  await refresh()
}

async function addTodo() {
  const title = newTitle.value.trim()
  if (!title) return
  await $fetch('/api/todos', {
    method: 'POST',
    body: {
      title,
      description: newDescription.value.trim(),
      priority: newPriority.value,
      project_id: newProjectId.value,
      due_date: newDueDate.value || null,
    },
  })
  newTitle.value = ''
  newDescription.value = ''
  newPriority.value = 'normal'
  newProjectId.value = null
  newDueDate.value = ''
  showAddForm.value = false
  await refresh()
}

async function toggleTodo(todo: Todo) {
  const newStatus = todo.status === 'completed' ? 'pending' : 'completed'
  await $fetch(`/api/todos/${todo.id}`, {
    method: 'PUT',
    body: { status: newStatus },
  })
  await refresh()
}

async function deleteTodo(id: number) {
  if (editingId.value === id) editingId.value = null
  await $fetch(`/api/todos/${id}`, { method: 'DELETE' })
  await refresh()
}

function priorityStyle(p: string) {
  if (p === 'urgent') return 'bg-neon-rose/15 text-neon-rose border-neon-rose/30'
  if (p === 'high') return 'bg-neon-amber/15 text-neon-amber border-neon-amber/30'
  if (p === 'low') return 'bg-brain-surface text-brain-muted border-brain-border'
  return 'bg-neon-indigo/10 text-neon-indigo border-neon-indigo/20'
}

function priorityLabel(p: string) {
  if (p === 'urgent') return '🔴 긴급'
  if (p === 'high') return '🟡 높음'
  if (p === 'low') return '⚪ 낮음'
  return '🔵 보통'
}

function formatDate(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 3600000) return `${Math.floor(diff / 60000)}분 전`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}시간 전`
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}
</script>

<template>
  <div class="rounded-2xl glass-card hud-corners overflow-hidden">
    <!-- Alert Banner -->
    <div v-if="alertTodos.length" class="px-5 py-2.5 bg-neon-rose/5 border-b border-neon-rose/20">
      <div class="flex items-center gap-2 overflow-x-auto scrollbar-hide">
        <span class="text-sm shrink-0">🔔</span>
        <div v-for="todo in alertTodos" :key="'alert-' + todo.id" class="shrink-0 flex items-center gap-1.5">
          <span
            class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border"
            :class="ddayStyle(todo.due_date!)"
          >
            {{ ddayLabel(todo.due_date!) }}
          </span>
          <span class="text-[11px] text-brain-text max-w-[200px] truncate">{{ todo.title }}</span>
          <span class="text-[10px] text-brain-muted/40 mr-3">|</span>
        </div>
      </div>
    </div>

    <!-- Header -->
    <div class="flex items-center justify-between px-5 py-3 border-b border-brain-border/50">
      <div class="flex items-center gap-2">
        <span class="text-base">📋</span>
        <h3 class="text-sm font-semibold tracking-wide">숙제</h3>
        <span v-if="pendingTodos.length" class="px-2 py-0.5 rounded-full text-[10px] font-mono bg-neon-rose/15 text-neon-rose border border-neon-rose/20">
          {{ pendingTodos.length }}
        </span>
      </div>
      <div class="flex items-center gap-2">
        <!-- Filter Tabs -->
        <div class="flex rounded-lg border border-brain-border overflow-hidden text-[10px]">
          <button
            @click="filterStatus = 'pending'"
            class="px-2.5 py-1 transition-colors"
            :class="filterStatus === 'pending' ? 'bg-neon-indigo/20 text-neon-indigo' : 'text-brain-muted hover:text-brain-text'"
          >
            할 일 {{ pendingTodos.length }}
          </button>
          <button
            @click="filterStatus = 'completed'"
            class="px-2.5 py-1 border-l border-brain-border transition-colors"
            :class="filterStatus === 'completed' ? 'bg-neon-emerald/20 text-neon-emerald' : 'text-brain-muted hover:text-brain-text'"
          >
            완료 {{ completedTodos.length }}
          </button>
          <button
            @click="filterStatus = 'all'"
            class="px-2.5 py-1 border-l border-brain-border transition-colors"
            :class="filterStatus === 'all' ? 'bg-neon-cyan/20 text-neon-cyan' : 'text-brain-muted hover:text-brain-text'"
          >
            전체
          </button>
        </div>
        <button
          @click="expanded = !expanded"
          class="w-7 h-7 rounded-lg flex items-center justify-center text-xs text-brain-muted hover:text-neon-cyan hover:bg-brain-card transition-all"
          :title="expanded ? '축소' : '확장'"
        >
          {{ expanded ? '⌃' : '⌄' }}
        </button>
        <button
          @click="showAddForm = !showAddForm"
          class="w-7 h-7 rounded-lg flex items-center justify-center text-sm text-brain-muted hover:text-neon-cyan hover:bg-brain-card transition-all"
        >
          {{ showAddForm ? '✕' : '+' }}
        </button>
      </div>
    </div>

    <!-- Add Form -->
    <div v-if="showAddForm" class="p-4 border-b border-brain-border/50 bg-brain-bg/30 space-y-3 animate-slide-up">
      <input
        v-model="newTitle"
        type="text"
        placeholder="할 일을 입력하세요..."
        class="w-full bg-brain-bg border border-brain-border rounded-xl px-4 py-2.5 text-sm placeholder:text-brain-muted/40 focus:outline-none focus:border-neon-cyan/50 transition-all"
        @keydown.enter="addTodo"
        autofocus
      />
      <textarea
        v-model="newDescription"
        placeholder="상세 설명 (선택)"
        rows="2"
        class="w-full bg-brain-bg border border-brain-border rounded-xl px-4 py-2 text-sm placeholder:text-brain-muted/40 focus:outline-none focus:border-neon-cyan/50 transition-all resize-none"
      />
      <div class="flex items-center gap-3 flex-wrap">
        <select
          v-model="newPriority"
          class="bg-brain-bg border border-brain-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-neon-cyan/50"
        >
          <option value="urgent">🔴 긴급</option>
          <option value="high">🟡 높음</option>
          <option value="normal">🔵 보통</option>
          <option value="low">⚪ 낮음</option>
        </select>
        <input
          v-model="newDueDate"
          type="date"
          class="bg-brain-bg border border-brain-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-neon-cyan/50 text-brain-text"
        />
        <select
          v-model="newProjectId"
          class="flex-1 min-w-[140px] bg-brain-bg border border-brain-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-neon-cyan/50 truncate"
        >
          <option :value="null">프로젝트 없음 (공통)</option>
          <option v-for="p in (projects as any[])" :key="p.id" :value="p.id">
            {{ p.name }}
          </option>
        </select>
        <button
          @click="addTodo"
          :disabled="!newTitle.trim()"
          class="px-4 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r from-neon-indigo to-neon-cyan text-white shadow-neon hover:shadow-neon-lg transition-all disabled:opacity-30"
        >
          추가
        </button>
      </div>
    </div>

    <!-- Todo List -->
    <div :class="expanded ? 'max-h-[800px]' : 'max-h-[400px]'" class="overflow-y-auto transition-all duration-300">
      <div v-if="!displayTodos.length" class="py-8 text-center">
        <p class="text-sm text-brain-muted/50 font-mono">
          {{ filterStatus === 'completed' ? '완료된 숙제가 없습니다' : filterStatus === 'pending' ? '숙제가 없습니다 🎉' : '숙제가 없습니다' }}
        </p>
      </div>

      <div
        v-for="todo in displayTodos"
        :key="todo.id"
        class="border-b border-brain-border/30"
      >
        <!-- Normal View -->
        <div
          v-if="editingId !== todo.id"
          class="group flex items-start gap-3 px-5 py-3 hover:bg-brain-card/30 transition-colors"
        >
          <button
            @click="toggleTodo(todo)"
            class="mt-0.5 w-5 h-5 rounded-full border-2 shrink-0 transition-colors flex items-center justify-center"
            :class="todo.status === 'completed'
              ? 'border-neon-emerald bg-neon-emerald/20'
              : 'border-brain-muted/40 hover:border-neon-emerald'"
          >
            <svg v-if="todo.status === 'completed'" class="w-3 h-3 text-neon-emerald" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" /></svg>
          </button>

          <div
            class="flex-1 min-w-0 cursor-pointer"
            @click="startEdit(todo)"
          >
            <div class="flex items-center gap-2">
              <p class="text-sm" :class="todo.status === 'completed' ? 'line-through text-brain-muted' : ''">{{ todo.title }}</p>
              <span
                v-if="todo.due_date && todo.status !== 'completed'"
                class="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border shrink-0"
                :class="ddayStyle(todo.due_date)"
              >
                {{ ddayLabel(todo.due_date) }}
              </span>
            </div>
            <p v-if="todo.description" class="text-[11px] text-brain-muted mt-0.5 line-clamp-1">{{ todo.description }}</p>
            <div class="flex items-center gap-2 mt-1 flex-wrap">
              <span class="px-1.5 py-0.5 rounded text-[9px] font-mono border" :class="priorityStyle(todo.priority)">
                {{ todo.priority }}
              </span>
              <span v-if="todo.project_name" class="text-[10px] text-brain-muted font-mono">
                {{ todo.project_icon || '📁' }} {{ todo.project_name }}
              </span>
              <span v-else class="text-[10px] text-neon-cyan/50 font-mono">🌐 공통</span>
              <span v-if="todo.due_date" class="text-[10px] text-brain-muted/60 font-mono">
                📅 {{ dueDateDisplay(todo.due_date) }}
              </span>
              <span class="text-[10px] text-brain-muted/50">{{ formatDate(todo.created_at) }}</span>
            </div>
          </div>

          <div class="flex items-center gap-1 shrink-0">
            <button
              @click="startEdit(todo)"
              class="opacity-0 group-hover:opacity-100 w-6 h-6 rounded flex items-center justify-center text-[11px] text-brain-muted hover:text-neon-cyan transition-all"
              title="수정"
            >
              ✏️
            </button>
            <button
              @click="deleteTodo(todo.id)"
              class="opacity-0 group-hover:opacity-100 w-6 h-6 rounded flex items-center justify-center text-xs text-brain-muted hover:text-neon-rose transition-all"
              title="삭제"
            >
              ✕
            </button>
          </div>
        </div>

        <!-- Edit View -->
        <div
          v-else
          class="px-5 py-4 bg-neon-indigo/5 border-l-2 border-neon-indigo space-y-3 animate-slide-up"
        >
          <div class="flex items-center justify-between">
            <span class="text-[10px] text-neon-indigo font-mono tracking-widest">수정 중</span>
            <button @click="editingId = null" class="text-xs text-brain-muted hover:text-brain-text">✕ 취소</button>
          </div>
          <input
            v-model="editTitle"
            type="text"
            class="w-full bg-brain-bg border border-brain-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-neon-indigo/50 transition-all"
            @keydown.enter="saveEdit"
          />
          <textarea
            v-model="editDescription"
            placeholder="상세 설명"
            rows="2"
            class="w-full bg-brain-bg border border-brain-border rounded-xl px-4 py-2 text-sm placeholder:text-brain-muted/40 focus:outline-none focus:border-neon-indigo/50 transition-all resize-none"
          />
          <div class="flex items-center gap-3 flex-wrap">
            <select
              v-model="editPriority"
              class="bg-brain-bg border border-brain-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-neon-indigo/50"
            >
              <option value="urgent">🔴 긴급</option>
              <option value="high">🟡 높음</option>
              <option value="normal">🔵 보통</option>
              <option value="low">⚪ 낮음</option>
            </select>
            <input
              v-model="editDueDate"
              type="date"
              class="bg-brain-bg border border-brain-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-neon-indigo/50 text-brain-text"
            />
            <select
              v-model="editProjectId"
              class="flex-1 min-w-[140px] bg-brain-bg border border-brain-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-neon-indigo/50 truncate"
            >
              <option :value="null">프로젝트 없음 (공통)</option>
              <option v-for="p in (projects as any[])" :key="p.id" :value="p.id">
                {{ p.name }}
              </option>
            </select>
          </div>
          <div class="flex items-center justify-end gap-2">
            <button
              @click="deleteTodo(todo.id)"
              class="px-3 py-1.5 rounded-lg text-xs text-neon-rose hover:bg-neon-rose/10 transition-all"
            >
              삭제
            </button>
            <button
              @click="editingId = null"
              class="px-3 py-1.5 rounded-lg text-xs text-brain-muted hover:text-brain-text border border-brain-border transition-all"
            >
              취소
            </button>
            <button
              @click="saveEdit"
              :disabled="!editTitle.trim()"
              class="px-4 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r from-neon-indigo to-neon-cyan text-white shadow-neon hover:shadow-neon-lg transition-all disabled:opacity-30"
            >
              저장
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer Stats -->
    <div v-if="(todos?.length || 0) > 0" class="px-5 py-2 border-t border-brain-border/50 bg-brain-bg/20 flex items-center justify-between">
      <span class="text-[10px] text-brain-muted font-mono">
        전체 {{ todos?.length || 0 }} · 진행 {{ pendingTodos.length }} · 완료 {{ completedTodos.length }}
      </span>
      <span v-if="pendingTodos.some(t => t.due_date)" class="text-[10px] text-brain-muted font-mono">
        가장 빠른 마감:
        <span class="text-neon-amber">
          {{ pendingTodos.filter(t => t.due_date).sort((a, b) => a.due_date!.localeCompare(b.due_date!))[0]?.due_date
            ? dueDateDisplay(pendingTodos.filter(t => t.due_date).sort((a, b) => a.due_date!.localeCompare(b.due_date!))[0].due_date!)
            : '' }}
        </span>
      </span>
    </div>
  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar { display: none; }
.scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
</style>
