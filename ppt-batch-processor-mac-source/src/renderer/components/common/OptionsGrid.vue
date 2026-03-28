<template>
  <div class="options-grid" :class="{ 'options-grid-compact': compact }">
    <label
      v-for="option in options"
      :key="option.value"
      class="checkbox option-item"
      :class="{ 'option-item-disabled': option.disabled }"
    >
      <input
        type="checkbox"
        :checked="modelValue?.includes(option.value)"
        :disabled="option.disabled"
        @change="handleChange(option.value, $event)"
      />
      <span class="checkbox-label">{{ option.label }}</span>
      <span v-if="option.hint" class="option-hint">{{ option.hint }}</span>
    </label>
  </div>
</template>

<script setup lang="ts">
interface Option {
  label: string
  value: string
  disabled?: boolean
  hint?: string
}

interface Props {
  options: Option[]
  modelValue?: string[]
  compact?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: () => [],
  compact: false
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string[]): void
  (e: 'change', value: string[]): void
}>()

function handleChange(value: string, event: Event) {
  const checked = (event.target as HTMLInputElement).checked
  const newValue = [...(props.modelValue || [])]

  if (checked && !newValue.includes(value)) {
    newValue.push(value)
  } else if (!checked) {
    const index = newValue.indexOf(value)
    if (index > -1) {
      newValue.splice(index, 1)
    }
  }

  emit('update:modelValue', newValue)
  emit('change', newValue)
}
</script>

<style scoped>
.options-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--spacing-sm) var(--spacing-lg);
  padding: var(--spacing-md);
  background: var(--gray-50);
  border-radius: var(--radius-md);
}

.options-grid-compact {
  grid-template-columns: repeat(3, 1fr);
  padding: var(--spacing-sm);
}

.option-item {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-sm);
  padding: var(--spacing-xs) 0;
  cursor: pointer;
}

.option-item-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.option-hint {
  font-size: 11px;
  color: var(--gray-500);
  margin-left: var(--spacing-xs);
}
</style>
