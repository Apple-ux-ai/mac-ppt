<template>
  <div class="template-generate-config">
    <FormField :label="t('config.templateGenerate.dataSource')" required>
      <FilePicker
        v-model="dataSourceFile"
        type="excel"
        :placeholder="t('config.templateGenerate.dataSourcePlaceholder')"
        :button-text="t('config.templateGenerate.selectDataSource')"
        icon="📊"
        :success-text="t('config.templateGenerate.dataSourceSelected')"
      />
    </FormField>

    <FormField
      :label="t('config.templateGenerate.outputPattern')"
      :hint="t('config.templateGenerate.outputPatternHint')"
    >
      <input
        v-model="outputPattern"
        type="text"
        class="input"
        :placeholder="t('config.templateGenerate.outputPatternExample')"
      />
    </FormField>

    <button type="button" class="btn btn-secondary" @click="downloadExample">
      <span>⬇️</span>
      <span>{{ t('config.templateGenerate.downloadExamples') }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { FormField, FilePicker } from '../common'
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

const templateFile = ref(props.modelValue.templatePath || '')
const dataSourceFile = ref(props.modelValue.dataSourcePath || '')
const outputPattern = ref(props.modelValue.outputPattern || '')

function downloadExample() {
  const exampleText = t(`# PPT模板生成示例

## 模板文件
在PPT模板中使用 {{字段名}} 作为占位符，例如：
- {{姓名}}
- {{部门}}
- {{日期}}

## 数据源示例 (Excel/CSV)
第一行为列名，后续每行为一条数据：

姓名,部门,日期,金额
张三,销售部,2024-01-01,10000
李四,技术部,2024-01-02,15000
王五,市场部,2024-01-03,12000
`)

  const blob = new Blob(['\ufeff' + exampleText], { type: 'text/plain;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)

  link.setAttribute('href', url)
  link.setAttribute('download', t('config.templateGenerate.guideFilename'))
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  const csvContent = t(`姓名,部门,日期,金额
张三,销售部,2024-01-01,10000
李四,技术部,2024-01-02,15000
王五,市场部,2024-01-03,12000`)

  const csvBlob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const csvLink = document.createElement('a')
  const csvUrl = URL.createObjectURL(csvBlob)

  csvLink.setAttribute('href', csvUrl)
  csvLink.setAttribute('download', t('config.templateGenerate.exampleCsvFilename'))
  csvLink.style.visibility = 'hidden'
  document.body.appendChild(csvLink)
  csvLink.click()
  document.body.removeChild(csvLink)
}

watch([templateFile, dataSourceFile, outputPattern], ([template, dataSource, pattern]) => {
  emit('update:modelValue', {
    ...props.modelValue,
    templatePath: template,
    dataSourcePath: dataSource,
    outputPattern: pattern,
  })
})
</script>

<style scoped>
.template-generate-config {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
