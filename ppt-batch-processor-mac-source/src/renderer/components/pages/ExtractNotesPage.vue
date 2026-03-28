<template>
  <FeaturePage
    :title="t('提取备注')"
    :description="t('从PPT文件中提取所有幻灯片的备注内容，保存为文本文件')"
    icon="📝"
    :can-start="canStart"
    :hint="t('请先选择PPT文件')"
    @back="$emit('back')"
    @start="startProcessing"
  >
    <template #config>
      <div class="config-section">
        <div class="info-box">
          <strong>{{ t('提取备注') }}</strong>
          <p>{{ t('从PPT文件中提取所有幻灯片的备注内容，保存为文本文件') }}</p>
          <p>{{ t('提取的备注将按幻灯片顺序保存，方便查看和编辑') }}</p>
        </div>

        <div class="form-group">
          <label class="form-label required">{{ t('选择PPT文件') }}</label>
          <div class="file-picker">
            <input
              :value="sourceFile"
              type="text"
              class="form-input"
              :placeholder="t('选择要提取备注的PPT文件')"
              readonly
            />
            <button type="button" class="pick-btn" @click="selectFile">
              📄 {{ t('选择文件') }}
            </button>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">{{ t('输出格式') }}</label>
          <select v-model="outputFormat" class="form-select">
            <option value="txt">{{ t('纯文本') }}</option>
            <option value="md">Markdown (.md)</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label required">{{ t('输出目录') }}</label>
          <div class="file-picker">
            <input
              :value="outputDirectory"
              type="text"
              class="form-input"
              :placeholder="t('选择输出目录')"
              readonly
            />
            <button type="button" class="pick-btn" @click="selectOutputDir">
              📁 {{ t('选择目录') }}
            </button>
          </div>
        </div>
      </div>
    </template>

    <template #files>
      <div class="files-placeholder">
        <p>{{ t('此功能需要在上方的配置区域选择单个文件') }}</p>
      </div>
    </template>

    <template #output>
      <div class="output-placeholder">
        <p>{{ t('输出设置已在上方配置') }}</p>
      </div>
    </template>
  </FeaturePage>
</template>

<script setup lang="ts">
import '../../types/electron.d.ts'
import { ref, computed } from 'vue'
import { useAppStore } from '../../store/app'
import FeaturePage from './FeaturePage.vue'
import { useI18n } from '../../i18n'

const emit = defineEmits<{
  (e: 'back'): void
}>()

const store = useAppStore()
const { t } = useI18n()

const sourceFile = ref('')
const outputFormat = ref<'txt' | 'md'>('txt')
const outputDirectory = ref('')

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

async function selectOutputDir() {
  try {
    const path = await window.electronAPI.selectFolder()
    if (path) {
      outputDirectory.value = path
    }
  } catch (error) {
    console.error('选择目录失败:', error)
  }
}

const canStart = computed(() => {
  return sourceFile.value !== '' && outputDirectory.value !== ''
})

async function startProcessing() {
  if (!canStart.value) return

  const taskConfig = store.createTaskConfig(
    {
      extractNotesSourceFile: sourceFile.value,
      extractNotesFormat: outputFormat.value,
    },
    {
      directory: outputDirectory.value,
      overwriteOriginal: false,
      fileNamePattern: '{name}_notes',
      createSubfolders: false,
    }
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

.form-input,
.form-select {
  padding: 10px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
  background: white;
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

.files-placeholder,
.output-placeholder {
  padding: 40px 20px;
  text-align: center;
  color: #9ca3af;
}

.files-placeholder p,
.output-placeholder p {
  margin: 0;
}
</style>
