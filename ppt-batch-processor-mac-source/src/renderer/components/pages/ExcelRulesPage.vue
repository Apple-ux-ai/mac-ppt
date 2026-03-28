<template>
  <FeaturePage
    :title="t('导入Excel规则修改')"
    :description="t('使用Excel表格定义批量修改规则，一次性执行多个替换操作')"
    icon="📊"
    :can-start="canStart"
    :hint="startHint"
    @back="$emit('back')"
    @start="startProcessing"
  >
    <template #config>
      <div class="config-section">
        <div class="info-box">
          <strong>{{ t('Excel文件格式') }}</strong>
          <p>{{ t('Excel文件需包含三列：类型、查找内容、替换内容') }}</p>
          <p>{{ t('支持的规则类型：文本替换、删除内容、图片替换') }}</p>
        </div>

        <div class="form-group">
          <label class="form-label required">{{ t('Excel规则文件') }}</label>
          <div class="file-picker">
            <input
              :value="excelFile"
              type="text"
              class="form-input"
              :placeholder="t('选择Excel规则文件')"
              readonly
            />
            <button type="button" class="pick-btn" @click="selectExcelFile">
              📁 {{ t('选择文件') }}
            </button>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">{{ t('选项') }}</label>
          <div class="checkbox-grid">
            <label class="checkbox-item">
              <input type="checkbox" v-model="options.caseSensitive" />
              <span>{{ t('区分大小写') }}</span>
            </label>
            <label class="checkbox-item">
              <input type="checkbox" v-model="options.replaceInNotes" />
              <span>{{ t('替换备注内容') }}</span>
            </label>
            <label class="checkbox-item">
              <input type="checkbox" v-model="options.replaceInTables" />
              <span>{{ t('替换表格内容') }}</span>
            </label>
            <label class="checkbox-item">
              <input type="checkbox" v-model="options.skipHiddenSlides" />
              <span>{{ t('跳过隐藏幻灯片') }}</span>
            </label>
          </div>
        </div>

        <button type="button" class="download-btn" @click="downloadTemplate">
          ⬇️ {{ t('下载Excel模板') }}
        </button>
      </div>
    </template>

    <template #files>
      <FileSelector />
    </template>

    <template #output>
      <OutputSettings
        v-model="outputConfig"
        :show-overwrite="true"
        :show-file-name-pattern="true"
      />
    </template>
  </FeaturePage>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAppStore } from '../../store/app'
import FeaturePage from './FeaturePage.vue'
import FileSelector from '../FileSelector.vue'
import { OutputSettings } from '../common'
import type { OutputConfig } from '../../../shared/types'
import { useI18n } from '../../i18n'

const emit = defineEmits<{
  (e: 'back'): void
}>()

const store = useAppStore()
const { t } = useI18n()

const excelFile = ref('')
const options = ref({
  caseSensitive: false,
  replaceInNotes: true,
  replaceInTables: true,
  skipHiddenSlides: false,
})

const outputConfig = ref<OutputConfig>({
  directory: '',
  overwriteOriginal: false,
  fileNamePattern: '{name}_processed',
  createSubfolders: false,
})

async function selectExcelFile() {
  try {
    const path = await window.electronAPI.selectExcelFile()
    if (path) {
      excelFile.value = path
    }
  } catch (error) {
    console.error('选择文件失败:', error)
  }
}

function downloadTemplate() {
  const templateContent = t(
    '类型,查找内容,替换内容\n文本替换,旧文本,新文本\n文本替换,Hello,你好\n删除内容,要删除的内容,\n文本替换,2024,2025'
  )

  const blob = new Blob(['\ufeff' + templateContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)

  link.setAttribute('href', url)
  link.setAttribute('download', t('Excel规则模板.csv'))
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

const canStart = computed(() => {
  return (
    excelFile.value !== '' &&
    store.hasFiles &&
    (outputConfig.value.overwriteOriginal || !!outputConfig.value.directory)
  )
})

const startHint = computed(() => {
  if (!store.hasFiles) return t('请先在下方选择PPT文件')
  if (excelFile.value === '') return t('请先选择Excel规则文件')
  if (!outputConfig.value.overwriteOriginal && !outputConfig.value.directory)
    return t('请先选择输出目录')
  return t('所有配置已就绪，可以开始处理')
})

async function startProcessing() {
  if (!canStart.value) return

  const taskConfig = store.createTaskConfig(
    {
      ...options.value,
      excelRulesPath: excelFile.value,
    },
    outputConfig.value
  )
  await store.startProcessing(taskConfig)
}
</script>

<style scoped>
.config-section {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.info-box {
  padding: 16px;
  background: #f0f4ff;
  border: 1px solid #c7d2fe;
  border-radius: 8px;
  font-size: 13px;
  color: #3730a3;
}

.info-box p {
  margin: 4px 0;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}

.form-label.required::after {
  content: ' *';
  color: #ef4444;
}

.form-input {
  padding: 10px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
  background: #f9fafb;
}

.file-picker {
  display: flex;
  gap: 10px;
}

.file-picker .form-input {
  flex: 1;
}

.pick-btn {
  padding: 10px 16px;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
  color: #374151;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.pick-btn:hover {
  background: #e5e7eb;
}

.checkbox-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.checkbox-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #374151;
  cursor: pointer;
}

.checkbox-item input {
  width: 16px;
  height: 16px;
  accent-color: #667eea;
}

.download-btn {
  padding: 12px 20px;
  background: linear-gradient(135deg, #f0f4ff 0%, #e8ecff 100%);
  border: 1px solid #c7d2fe;
  border-radius: 8px;
  font-size: 14px;
  color: #667eea;
  cursor: pointer;
  transition: all 0.2s ease;
}

.download-btn:hover {
  background: linear-gradient(135deg, #e0e7ff 0%, #d1d5ff 100%);
}
</style>
