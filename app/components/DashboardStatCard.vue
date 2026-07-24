<script setup lang="ts">
const props = defineProps<{
  label: string
  value: string | number
  icon: string
  color: 'indigo' | 'cyan' | 'amber' | 'emerald' | 'rose'
}>()

const colorStyles: Record<string, { glow: string; gradient: string; text: string; glowClass: string }> = {
  indigo: {
    glow: 'hover:shadow-[0_0_40px_rgba(99,102,241,0.35)]',
    gradient: 'from-neon-indigo/15 to-transparent',
    text: 'text-neon-indigo',
    glowClass: 'glow-text',
  },
  cyan: {
    glow: 'hover:shadow-[0_0_40px_rgba(34,211,238,0.35)]',
    gradient: 'from-neon-cyan/15 to-transparent',
    text: 'text-neon-cyan',
    glowClass: 'glow-text-cyan',
  },
  amber: {
    glow: 'hover:shadow-[0_0_40px_rgba(251,191,36,0.35)]',
    gradient: 'from-neon-amber/15 to-transparent',
    text: 'text-neon-amber',
    glowClass: 'glow-text',
  },
  emerald: {
    glow: 'hover:shadow-[0_0_40px_rgba(52,211,153,0.35)]',
    gradient: 'from-neon-emerald/15 to-transparent',
    text: 'text-neon-emerald',
    glowClass: 'glow-text-emerald',
  },
  rose: {
    glow: 'hover:shadow-[0_0_40px_rgba(251,113,133,0.35)]',
    gradient: 'from-neon-rose/15 to-transparent',
    text: 'text-neon-rose',
    glowClass: 'glow-text',
  },
}

const s = computed(() => colorStyles[props.color])

const displayValue = ref<string | number>(0)
const numericValue = computed(() => {
  if (typeof props.value === 'number') return props.value
  const n = parseFloat(String(props.value))
  return isNaN(n) ? null : n
})

const suffix = computed(() => {
  if (typeof props.value === 'string') {
    const match = props.value.match(/[A-Za-z%]+$/)
    return match ? match[0] : ''
  }
  return ''
})

onMounted(() => {
  if (numericValue.value !== null) {
    let start = 0
    const end = numericValue.value
    const duration = 1200
    const startTime = performance.now()
    function animate(now: number) {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = start + (end - start) * eased
      displayValue.value = end % 1 === 0 ? Math.round(current) : Math.round(current * 10) / 10
      if (progress < 1) requestAnimationFrame(animate)
    }
    requestAnimationFrame(animate)
  } else {
    displayValue.value = props.value
  }
})
</script>

<template>
  <div
    class="group relative rounded-2xl glass-card hud-corners holo-shimmer scan-line p-5 transition-all duration-500 hover:scale-[1.03]"
    :class="[s.glow]"
  >
    <!-- Gradient overlay -->
    <div class="absolute inset-0 bg-gradient-to-br opacity-60 rounded-2xl" :class="s.gradient" />

    <!-- Glow orb -->
    <div
      class="absolute -top-12 -right-12 w-40 h-40 rounded-full blur-3xl opacity-20 group-hover:opacity-50 transition-opacity duration-700"
      :class="{ 'bg-neon-indigo': color === 'indigo', 'bg-neon-cyan': color === 'cyan', 'bg-neon-amber': color === 'amber', 'bg-neon-emerald': color === 'emerald', 'bg-neon-rose': color === 'rose' }"
    />

    <div class="relative flex items-start justify-between z-[2]">
      <div>
        <p class="text-[10px] text-brain-muted mb-2 uppercase tracking-[0.2em] font-mono">{{ label }}</p>
        <p class="text-5xl font-bold font-mono tracking-tight" :class="[s.text, s.glowClass]">
          {{ displayValue }}<span class="text-2xl opacity-60">{{ suffix }}</span>
        </p>
      </div>
      <span class="text-4xl opacity-30 group-hover:opacity-80 group-hover:scale-125 transition-all duration-500 drop-shadow-[0_0_10px_rgba(34,211,238,0.3)]">{{ icon }}</span>
    </div>

    <!-- Bottom accent line -->
    <div
      class="absolute bottom-0 left-0 h-[2px] w-0 group-hover:w-full transition-all duration-700 z-[2]"
      :class="{ 'bg-neon-indigo shadow-[0_0_10px_rgba(99,102,241,0.5)]': color === 'indigo', 'bg-neon-cyan shadow-[0_0_10px_rgba(34,211,238,0.5)]': color === 'cyan', 'bg-neon-amber shadow-[0_0_10px_rgba(251,191,36,0.5)]': color === 'amber', 'bg-neon-emerald shadow-[0_0_10px_rgba(52,211,153,0.5)]': color === 'emerald', 'bg-neon-rose shadow-[0_0_10px_rgba(251,113,133,0.5)]': color === 'rose' }"
    />
  </div>
</template>
