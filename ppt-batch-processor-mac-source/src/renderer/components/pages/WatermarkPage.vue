<template>
  <FeaturePage
    :title="t('添加水印')"
    :description="t('为PPT内的所有图片添加水印，保护图片版权')"
    icon="💧"
    :can-start="canStart"
    :hint="t('请先输入水印内容并选择文件')"
    @back="$emit('back')"
    @start="startProcessing"
  >
    <template #config>
      <div class="config-section">
        <div class="info-box">
          <strong>{{ t('添加水印') }}</strong>
          <p>{{ t('为PPT内的所有图片添加水印，保护图片版权') }}</p>
        </div>

        <div class="form-group">
          <label class="form-label required">{{ t('水印文本') }}</label>
          <input
            v-model="options.watermarkText"
            type="text"
            class="form-input"
            :placeholder="t('输入要添加到图片上的水印文字')"
          />
        </div>

        <div class="form-group">
          <label class="form-label">{{ t('字体大小') }}</label>
          <div class="slider-group">
            <input
              v-model.number="options.watermarkFontSize"
              type="range"
              min="12"
              max="72"
              class="slider"
            />
            <span class="slider-value">{{ options.watermarkFontSize }}pt</span>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">{{ t('字体颜色') }}</label>
          <div class="color-picker">
            <input v-model="options.watermarkColor" type="color" />
            <span class="color-value">{{ options.watermarkColor }}</span>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">{{ t('位置') }}</label>
          <select v-model="options.watermarkPosition" class="form-select">
            <option value="center">{{ t('居中') }}</option>
            <option value="top-left">{{ t('左上') }}</option>
            <option value="top-right">{{ t('右上') }}</option>
            <option value="bottom-left">{{ t('左下') }}</option>
            <option value="bottom-right">{{ t('右下') }}</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">{{ t('透明度') }}</label>
          <div class="slider-group">
            <input
              v-model.number="options.watermarkOpacity"
              type="range"
              min="0"
              max="1"
              step="0.1"
              class="slider"
            />
            <span class="slider-value">{{ Math.round(options.watermarkOpacity * 100) }}%</span>
          </div>
        </div>

        <div class="form-group">
          <label class="checkbox-item">
            <input type="checkbox" v-model="options.applyWatermarkToAll" />
            <span>{{ t('应用到所有页面') }}</span>
          </label>
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

const options = ref<{
  watermarkText: string
  watermarkFontSize: number
  watermarkColor: string
  watermarkPosition: 'top-left' | 'top-right' | 'center' | 'bottom-left' | 'bottom-right'
  watermarkOpacity: number
  applyWatermarkToAll: boolean
}>({
  watermarkText: '',
  watermarkFontSize: 36,
  watermarkColor: '#000000',
  watermarkPosition: 'center',
  watermarkOpacity: 0.5,
  applyWatermarkToAll: true,
})

const outputConfig = ref<OutputConfig>({
  directory: '',
  overwriteOriginal: false,
  fileNamePattern: '{name}_processed',
  createSubfolders: false,
})

const canStart = computed(() => {
  return (
    options.value.watermarkText !== '' &&
    store.hasFiles &&
    (outputConfig.value.overwriteOriginal || !!outputConfig.value.directory)
  )
})

async function startProcessing() {
  if (!canStart.value) return

  const taskConfig = store.createTaskConfig(
    {
      ...options.value,
      watermarkType: 'text',
      applyWatermarkToImages: true,
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

.slider-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.slider {
  flex: 1;
  height: 6px;
  background: #e5e7eb;
  border-radius: 3px;
  appearance: none;
  cursor: pointer;
}

.slider::-webkit-slider-thumb {
  appearance: none;
  width: 18px;
  height: 18px;
  background: #667eea;
  border-radius: 50%;
  cursor: pointer;
}

.slider-value {
  min-width: 50px;
  font-size: 14px;
  font-weight: 600;
  color: #667eea;
  text-align: right;
}

.color-picker {
  display: flex;
  align-items: center;
  gap: 12px;
}

.color-picker input[type='color'] {
  width: 50px;
  height: 36px;
  padding: 2px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  cursor: pointer;
}

.color-value {
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 13px;
  color: #6b7280;
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
</style>
