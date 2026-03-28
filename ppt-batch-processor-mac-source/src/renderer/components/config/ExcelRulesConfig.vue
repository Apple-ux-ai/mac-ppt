<template>
  <div class="excel-rules-config">
    <FormField :label="t('config.excelRules.file')" required>
      <FilePicker
        v-model="excelRulesFile"
        type="excel"
        :placeholder="t('config.excelRules.filePlaceholder')"
        :button-text="t('common.selectFile')"
        icon="📊"
        :success-text="t('config.excelRules.fileSelected')"
      />
    </FormField>

    <FormField :label="t('config.textReplace.options')">
      <OptionsGrid :options="optionItems" v-model="selectedOptions" />
    </FormField>

    <button type="button" class="btn btn-secondary" @click="downloadTemplate">
      <span>⬇️</span>
      <span>{{ t('config.excelRules.downloadTemplate') }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { FormField, OptionsGrid, FilePicker } from '../common'
import { useI18n } from '../../i18n'

interface Props {
  modelValue: Record<string, any>
  taskType?: string
}

const props = defineProps<Props>()
const { t } = useI18n()
const emit = defineEmits<{
  (e: 'update:modelValue', value: Record<string, any>): void
}>()

const excelRulesFile = ref(props.modelValue.excelRulesPath || '')

const localOptions = ref({
  caseSensitive: props.modelValue.caseSensitive || false,
  replaceInNotes: props.modelValue.replaceInNotes ?? true,
  replaceInTables: props.modelValue.replaceInTables ?? true,
  skipHiddenSlides: props.modelValue.skipHiddenSlides || false,
})

const optionItems = computed(() => [
  { label: t('config.textReplace.caseSensitive'), value: 'caseSensitive' },
  { label: t('config.textReplace.replaceNotes'), value: 'replaceInNotes' },
  { label: t('config.textReplace.replaceTables'), value: 'replaceInTables' },
  { label: t('config.textReplace.skipHiddenSlides'), value: 'skipHiddenSlides' },
])

const selectedOptions = computed({
  get: () => {
    return Object.entries(localOptions.value)
      .filter(([_, value]) => value === true)
      .map(([key]) => key)
  },
  set: (values: string[]) => {
    optionItems.value.forEach((item) => {
      ;(localOptions.value as any)[item.value] = values.includes(item.value)
    })
  },
})

function downloadTemplate() {
  const templateContent = t(`类型,查找内容,替换内容
文本替换,旧文本,新文本
文本替换,Hello,你好
删除内容,要删除的内容,
文本替换,2024,2025`)

  const blob = new Blob(['\ufeff' + templateContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)

  link.setAttribute('href', url)
  link.setAttribute('download', t('config.excelRules.templateFilename'))
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

watch(
  [excelRulesFile, localOptions],
  ([file, options]) => {
    emit('update:modelValue', {
      ...props.modelValue,
      excelRulesPath: file,
      ...options,
    })
  },
  { deep: true }
)
</script>

<style scoped>
.excel-rules-config {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
