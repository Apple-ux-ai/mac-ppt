<template>
  <FeaturePage
    :title="t('替换图片')"
    :description="t('批量替换PPT中的图片，可选择替换所有页或指定页')"
    icon="🖼️"
    :can-start="canStart"
    :hint="t('请先选择目标图片')"
    @back="$emit('back')"
    @start="startProcessing"
  >
    <template #config>
      <div class="config-section">
        <div class="form-group">
          <label class="form-label required">{{ t('替换模式') }}</label>
          <select v-model="options.imageReplaceMode" class="form-select">
            <option value="all">{{ t('替换所有页的图片') }}</option>
            <option value="by-page">{{ t('替换指定页的图片') }}</option>
            <option value="all-same">{{ t('替换指定页所有相同图片') }}</option>
          </select>
        </div>

        <div
          v-if="options.imageReplaceMode === 'by-page' || options.imageReplaceMode === 'all-same'"
          class="form-group"
        >
          <label class="form-label required">{{ t('目标页码') }}</label>
          <input
            v-model.number="options.targetPageNumber"
            type="number"
            min="1"
            class="form-input"
            :placeholder="t('例如: 1 (第一页)')"
          />
          <small class="form-hint">{{ t('输入要替换图片的页码（从1开始）') }}</small>
        </div>

        <div v-if="options.imageReplaceMode === 'all-same'" class="info-box">
          <strong>{{ t('替换指定页所有相同图片') }}</strong>
          <p>{{ t('替换指定页面的图片，同时替换其他页面使用相同图片文件的地方。') }}</p>
          <p>
            {{ t('例如：第2页和第3页都使用 image1.png，选择第2页替换后，第3页也会显示新图片。') }}
          </p>
        </div>

        <div class="form-group">
          <label class="form-label required">{{ t('目标图片') }}</label>
          <div class="file-picker">
            <input
              :value="targetImage"
              type="text"
              class="form-input"
              :placeholder="t('选择要替换的新图片')"
              readonly
            />
            <button type="button" class="pick-btn" @click="selectImage">
              🖼️ {{ t('选择图片') }}
            </button>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">{{ t('选项') }}</label>
          <div class="checkbox-grid">
            <label class="checkbox-item">
              <input type="checkbox" v-model="options.keepImageSize" />
              <span>{{ t('保持原图尺寸') }}</span>
            </label>
            <label class="checkbox-item">
              <input type="checkbox" v-model="options.keepImagePosition" />
              <span>{{ t('保持原图位置') }}</span>
            </label>
          </div>
        </div>
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

const targetImage = ref('')
const options = ref<{
  imageReplaceMode: 'all' | 'by-page' | 'all-same'
  targetPageNumber: number
  keepImageSize: boolean
  keepImagePosition: boolean
}>({
  imageReplaceMode: 'all',
  targetPageNumber: 1,
  keepImageSize: true,
  keepImagePosition: true,
})

const outputConfig = ref<OutputConfig>({
  directory: '',
  overwriteOriginal: false,
  fileNamePattern: '{name}_processed',
  createSubfolders: false,
})

async function selectImage() {
  try {
    const path = await window.electronAPI.selectImageFile()
    if (path) {
      targetImage.value = path
    }
  } catch (error) {
    console.error('选择文件失败:', error)
  }
}

const canStart = computed(() => {
  return (
    targetImage.value !== '' &&
    store.hasFiles &&
    (outputConfig.value.overwriteOriginal || !!outputConfig.value.directory)
  )
})

async function startProcessing() {
  if (!canStart.value) return

  const taskConfig = store.createTaskConfig(
    {
      ...options.value,
      targetImage: targetImage.value,
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

.form-input:focus,
.form-select:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-input[readonly] {
  background: #f9fafb;
}

.form-hint {
  font-size: 12px;
  color: #9ca3af;
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

.info-box {
  padding: 16px;
  background: #fffbeb;
  border: 1px solid #fcd34d;
  border-radius: 8px;
  font-size: 13px;
  color: #92400e;
}

.info-box p {
  margin: 4px 0;
}
</style>
