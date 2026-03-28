<template>
  <div class="file-picker">
    <div class="file-picker-input">
      <input
        :value="modelValue"
        type="text"
        :placeholder="resolvedPlaceholder"
        readonly
        class="input"
        :class="{ 'input-error': error }"
      />
      <button type="button" @click="handleSelect" class="btn btn-secondary file-picker-btn">
        <span class="file-picker-icon">{{ icon }}</span>
        <span>{{ resolvedButtonText }}</span>
      </button>
    </div>
    <div v-if="modelValue && showSuccess" class="file-picker-success">
      <span class="success-icon">✓</span>
      <span>{{ resolvedSuccessText }}</span>
    </div>
    <span v-if="hint" class="hint">{{ hint }}</span>
    <span v-if="error" class="error-message">{{ error }}</span>
  </div>
</template>

<script setup lang="ts">
import '../../types/electron.d.ts'
import { computed } from 'vue'
import { useI18n } from '../../i18n'
interface Props {
  modelValue: string
  type?: 'file' | 'folder' | 'excel' | 'image'
  placeholder?: string
  buttonText?: string
  icon?: string
  hint?: string
  error?: string
  showSuccess?: boolean
  successText?: string
  accept?: string
}

const { t } = useI18n()

const props = withDefaults(defineProps<Props>(), {
  type: 'file',
  placeholder: '',
  buttonText: '',
  icon: '📁',
  showSuccess: true,
  successText: '',
})

const resolvedPlaceholder = computed(() => props.placeholder || t('common.selectFileEllipsis'))
const resolvedButtonText = computed(() => props.buttonText || t('common.select'))
const resolvedSuccessText = computed(() => props.successText || t('common.fileSelected'))

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'select', path: string): void
}>()

async function handleSelect() {
  try {
    let path: string | undefined

    switch (props.type) {
      case 'folder':
        path = await window.electronAPI.selectFolder()
        break
      case 'excel':
        path = await window.electronAPI.selectExcelFile()
        break
      case 'image':
        path = await window.electronAPI.selectImageFile()
        break
      default:
        const result = await window.electronAPI.selectFiles()
        path = result.files?.[0]
    }

    if (path) {
      emit('update:modelValue', path)
      emit('select', path)
    }
  } catch (error) {
    console.error('选择文件失败:', error)
  }
}
</script>

<style scoped>
.file-picker {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.file-picker-input {
  display: flex;
  gap: var(--spacing-sm);
}

.file-picker-input .input {
  flex: 1;
  background: var(--gray-50);
}

.file-picker-btn {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.file-picker-icon {
  font-size: 14px;
}

.file-picker-success {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--success-50);
  border: 1px solid var(--success-500);
  border-radius: var(--radius-md);
  color: var(--success-700);
  font-size: 13px;
}

.success-icon {
  font-weight: bold;
  color: var(--success-500);
}
</style>
