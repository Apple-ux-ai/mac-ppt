<template>
  <FeaturePage
    :title="t('提取页面')"
    :description="t('从一个PPT文件中提取出指定的几页，生成一个新的PPT文件')"
    icon="📤"
    :can-start="canStart"
    :hint="t('请先选择文件并输入页码范围')"
    @back="$emit('back')"
    @start="startProcessing"
  >
    <template #config>
      <div class="config-section">
        <div class="info-box">
          <strong>{{ t('提取页面') }}</strong>
          <p>{{ t('从一个PPT文件中提取出指定的几页，生成一个新的PPT文件') }}</p>
          <p>{{ t('例如：从一个20页的PPT中，只提取第1、2、3、5页，生成一个只有这4页的新PPT') }}</p>
        </div>

        <div class="form-group">
          <label class="form-label required">{{ t('选择PPT文件') }}</label>
          <div class="file-picker">
            <input
              :value="sourceFile"
              type="text"
              class="form-input"
              :placeholder="t('选择要提取页面的PPT文件')"
              readonly
            />
            <button type="button" class="pick-btn" @click="selectFile">
              📄 {{ t('选择文件') }}
            </button>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label required">{{ t('要提取哪些页面？') }}</label>
          <input
            v-model="pageRange"
            type="text"
            class="form-input"
            :placeholder="t('例如: 1-3,5,7-9')"
          />
        </div>

        <div class="format-hint">
          <strong>{{ t('输入格式') }}</strong>
          <ul>
            <li>{{ t('单页：输入') }} <code>5</code> {{ t('表示提取第5页') }}</li>
            <li>{{ t('连续页：输入') }} <code>1-3</code> {{ t('表示提取第1、2、3页') }}</li>
            <li>
              {{ t('多个页：输入') }} <code>1-3,5,7-9</code>
              {{ t('表示提取第1、2、3、5、7、8、9页') }}
            </li>
          </ul>
        </div>
      </div>
    </template>

    <template #files>
      <div class="files-placeholder">
        <p>{{ t('此功能需要在上方的配置区域选择单个文件') }}</p>
      </div>
    </template>

    <template #output>
      <OutputSettings
        v-model="outputConfig"
        :show-overwrite="false"
        :show-file-name-pattern="true"
        :always-need-output-dir="true"
      />
    </template>
  </FeaturePage>
</template>

<script setup lang="ts">
import '../../types/electron.d.ts'
import { ref, computed } from 'vue'
import { useAppStore } from '../../store/app'
import FeaturePage from './FeaturePage.vue'
import { OutputSettings } from '../common'
import type { OutputConfig } from '../../../shared/types'
import { useI18n } from '../../i18n'

const emit = defineEmits<{
  (e: 'back'): void
}>()

const store = useAppStore()
const { t } = useI18n()

const sourceFile = ref('')
const pageRange = ref('')

const outputConfig = ref<OutputConfig>({
  directory: '',
  overwriteOriginal: false,
  fileNamePattern: '{name}_extracted',
  createSubfolders: false,
})

async function selectFile() {
  try {
    const result = await window.electronAPI.selectFiles()
    const files = result.files || []
    if (files && files.length > 0) {
      sourceFile.value = files[0]
    }
  } catch (error) {
    console.error('选择文件失败:', error)
  }
}

const canStart = computed(() => {
  return sourceFile.value !== '' && pageRange.value !== '' && outputConfig.value.directory !== ''
})

async function startProcessing() {
  if (!canStart.value) return

  const taskConfig = store.createTaskConfig(
    {
      extractSourceFile: sourceFile.value,
      extractPageRange: pageRange.value,
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

.format-hint {
  padding: 16px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 13px;
  color: #374151;
}

.format-hint ul {
  margin: 8px 0 0;
  padding-left: 20px;
}

.format-hint li {
  margin: 4px 0;
}

.format-hint code {
  padding: 2px 6px;
  background: #e5e7eb;
  border-radius: 4px;
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 12px;
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
  background: white;
}

.form-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-input[readonly] {
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

.files-placeholder {
  padding: 40px 20px;
  text-align: center;
  color: #9ca3af;
}

.files-placeholder p {
  margin: 0;
}
</style>
