<script setup lang="ts">
const props = defineProps<{
  label: string
  value: string | number
  icon: string
  color: 'indigo' | 'cyan' | 'amber' | 'emerald' | 'rose'
}>()

const textColor: Record<string, string> = {
  indigo: 'text-neon-indigo',
  cyan: 'text-neon-cyan',
  amber: 'text-neon-amber',
  emerald: 'text-neon-emerald',
  rose: 'text-neon-rose',
}

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

watch(() => props.value, () => {
  if (numericValue.value === null) displayValue.value = props.value
})

onMounted(() => {
  if (numericValue.value !== null) {
    const end = numericValue.value
    const duration = 800
    const startTime = performance.now()
    function animate(now: number) {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = end * eased
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
  <div class="glass-card p-4 transition-colors">
    <div class="flex items-start justify-between">
      <div>
        <p class="text-[10px] text-brain-muted mb-1.5 uppercase tracking-[0.08em] font-semibold">{{ label }}</p>
        <p class="text-2xl sm:text-3xl font-semibold font-mono tracking-tight" :class="textColor[color]">
          {{ displayValue }}<span class="text-base opacity-60">{{ suffix }}</span>
        </p>
      </div>
      <span class="text-xl opacity-40">{{ icon }}</span>
    </div>
  </div>
</template>
