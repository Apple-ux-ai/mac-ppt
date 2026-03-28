<template>
  <div class="range-slider">
    <div class="range-slider-header">
      <span class="range-slider-label">{{ label }}</span>
      <span class="range-slider-value">{{ displayValue }}</span>
    </div>
    <input
      type="range"
      :min="min"
      :max="max"
      :step="step"
      :value="modelValue"
      :disabled="disabled"
      @input="handleInput"
      class="range-input"
    />
    <div v-if="showMarks" class="range-marks">
      <span v-for="mark in marks" :key="mark" class="range-mark">{{ mark }}</span>
    </div>
    <span v-if="hint" class="hint">{{ hint }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  modelValue: number
  label?: string
  min?: number
  max?: number
  step?: number
  unit?: string
  disabled?: boolean
  showMarks?: boolean
  marks?: number[]
  hint?: string
}

const props = withDefaults(defineProps<Props>(), {
  min: 0,
  max: 100,
  step: 1,
  unit: '',
  showMarks: false,
  marks: () => []
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: number): void
  (e: 'change', value: number): void
}>()

const displayValue = computed(() => {
  return `${props.modelValue}${props.unit}`
})

function handleInput(event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  emit('update:modelValue', value)
  emit('change', value)
}
</script>

<style scoped>
.range-slider {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.range-slider-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.range-slider-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--gray-700);
}

.range-slider-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--primary-600);
  min-width: 50px;
  text-align: right;
}

.range-input {
  width: 100%;
  height: 6px;
  background: var(--gray-200);
  border-radius: 3px;
  outline: none;
  appearance: none;
  cursor: pointer;
}

.range-input::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  background: var(--primary-600);
  border-radius: 50%;
  cursor: pointer;
  transition: transform var(--transition-fast);
}

.range-input::-webkit-slider-thumb:hover {
  transform: scale(1.1);
}

.range-input::-webkit-slider-thumb:active {
  transform: scale(1.2);
}

.range-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.range-input:disabled::-webkit-slider-thumb {
  cursor: not-allowed;
}

.range-marks {
  display: flex;
  justify-content: space-between;
  padding: 0 var(--spacing-xs);
}

.range-mark {
  font-size: 11px;
  color: var(--gray-500);
}
</style>
