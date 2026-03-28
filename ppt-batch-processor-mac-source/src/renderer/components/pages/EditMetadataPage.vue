<template>
  <FeaturePage
    :title="t('编辑元数据')"
    :description="t('编辑PPT文件的元数据信息，包括标题、作者、主题、关键词等')"
    icon="✏️"
    :can-start="canStart"
    :hint="t('请先选择文件并配置输出目录')"
    @back="$emit('back')"
    @start="startProcessing"
  >
    <template #config>
      <div class="config-section">
        <div class="info-box">
          <strong>{{ t('编辑元数据') }}</strong>
          <p>{{ t('编辑PPT文件的元数据信息，包括标题、作者、主题、关键词等') }}</p>
        </div>

        <div class="form-group">
          <label class="form-label required">{{ t('选择PPT文件') }}</label>
          <div class="file-picker">
            <input
              :value="sourceFile"
              type="text"
              class="form-input"
              :placeholder="t('选择要编辑元数据的PPT文件')"
              readonly
            />
            <button type="button" class="pick-btn" @click="selectFile">
              📄 {{ t('选择文件') }}
            </button>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">{{ t('标题') }}</label>
          <input
            v-model="metadata.title"
            type="text"
            class="form-input"
            :placeholder="t('输入文档标题')"
          />
        </div>

        <div class="form-group">
          <label class="form-label">{{ t('作者') }}</label>
          <input
            v-model="metadata.author"
            type="text"
            class="form-input"
            :placeholder="t('输入作者名称')"
          />
        </div>

        <div class="form-group">
          <label class="form-label">{{ t('主题') }}</label>
          <input
            v-model="metadata.subject"
            type="text"
            class="form-input"
            :placeholder="t('输入文档主题')"
          />
        </div>

        <div class="form-group">
          <label class="form-label">{{ t('关键词') }}</label>
          <input
            v-model="metadata.keywords"
            type="text"
            class="form-input"
            :placeholder="t('输入关键词，用逗号分隔')"
          />
        </div>

        <div class="form-group">
          <label class="form-label">{{ t('备注') }}</label>
          <textarea
            v-model="metadata.comments"
            class="form-textarea"
            rows="3"
            :placeholder="t('输入备注信息')"
          ></textarea>
        </div>

        <div class="hint-box">
          <p>{{ t('留空的字段将不会被修改') }}</p>
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
const metadata = ref({
  title: '',
  author: '',
  subject: '',
  keywords: '',
  comments: '',
})

const outputConfig = ref<OutputConfig>({
  directory: '',
  overwriteOriginal: false,
  fileNamePattern: '{name}_edited',
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
  return sourceFile.value !== '' && outputConfig.value.directory !== ''
})

async function startProcessing() {
  if (!canStart.value) return

  const taskConfig = store.createTaskConfig(
    {
      editMetadataSourceFile: sourceFile.value,
      metadataTitle: metadata.value.title,
      metadataAuthor: metadata.value.author,
      metadataSubject: metadata.value.subject,
      metadataKeywords: metadata.value.keywords,
      metadataComments: metadata.value.comments,
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

.hint-box {
  padding: 12px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 13px;
  color: #6b7280;
}

.hint-box p {
  margin: 0;
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
.form-textarea {
  padding: 10px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
  background: white;
}

.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-input[readonly] {
  background: #f9fafb;
}

.form-textarea {
  resize: vertical;
  min-height: 80px;
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
