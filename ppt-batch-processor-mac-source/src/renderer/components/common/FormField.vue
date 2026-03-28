<template>
  <div class="form-field">
    <label v-if="label" class="label" :class="{ 'label-required': required }">
      {{ label }}
    </label>
    <slot></slot>
    <span v-if="hint" class="hint">{{ hint }}</span>
    <span v-if="error" class="error-message">{{ error }}</span>
  </div>
</template>

<script setup lang="ts">
interface Props {
  label?: string
  required?: boolean
  hint?: string
  error?: string
}

withDefaults(defineProps<Props>(), {
  required: false
})
</script>

<style scoped>
.form-field {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.label {
  font-size: 13px;
  font-weight: 500;
  color: var(--gray-700);
}

.label-required::after {
  content: ' *';
  color: var(--error-500);
}

.hint {
  font-size: 12px;
  color: var(--gray-500);
}

.error-message {
  font-size: 12px;
  color: var(--error-600);
}
</style>
