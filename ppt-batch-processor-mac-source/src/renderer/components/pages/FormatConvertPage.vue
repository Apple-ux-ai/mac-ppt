<template>
  <FeaturePage
    :title="t('格式转换')"
    :description="t('将PPT文件转换为PDF、图片等其他格式')"
    icon="🔄"
    :can-start="canStart"
    :hint="t('请先选择文件')"
    @back="$emit('back')"
    @start="startProcessing"
  >
    <template #config>
      <div class="config-section">
        <div class="form-group">
          <label class="form-label required">{{ t('目标格式') }}</label>
          <select v-model="options.targetFormat" class="form-select">
            <option value="pdf">{{ t('PDF文档') }}</option>
            <option value="png">{{ t('PNG图片（每页一张）') }}</option>
          </select>
        </div>

        <template v-if="options.targetFormat === 'png'">
          <div class="form-group">
            <label class="form-label">{{ t('图片质量') }}</label>
            <div class="slider-group">
              <input
                v-model.number="options.imageQuality"
                type="range"
                min="1"
                max="100"
                class="slider"
              />
              <span class="slider-value">{{ options.imageQuality }}%</span>
            </div>
            <small class="form-hint">{{ t('质量越高，文件越大') }}</small>
          </div>

          <div class="form-group">
            <label class="form-label">{{ t('压缩级别') }}</label>
            <div class="slider-group">
              <input
                v-model.number="options.compressionLevel"
                type="range"
                min="0"
                max="9"
                class="slider"
              />
              <span class="slider-value">{{ options.compressionLevel }}</span>
            </div>
            <small class="form-hint">{{ t('0=无压缩（最快），9=最大压缩（最慢）') }}</small>
          </div>
        </template>

        <div v-if="options.targetFormat === 'pdf'" class="info-box">
          <strong>{{ t('PDF格式特点') }}</strong>
          <ul>
            <li>{{ t('适合打印和分享') }}</li>
            <li>{{ t('保持原始布局和格式') }}</li>
            <li>{{ t('文件大小适中') }}</li>
          </ul>
        </div>

        <div v-if="options.targetFormat === 'png'" class="info-box">
          <strong>{{ t('PNG格式特点') }}</strong>
          <ul>
            <li>{{ t('无损压缩，图片质量最佳') }}</li>
            <li>{{ t('支持透明背景') }}</li>
            <li>{{ t('每页幻灯片生成一张PNG图片') }}</li>
          </ul>
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
  targetFormat: 'pdf' | 'png' | 'jpg' | 'html' | 'ppt' | 'pptx'
  imageQuality: number
  compressionLevel: number
}>({
  targetFormat: 'pdf',
  imageQuality: 90,
  compressionLevel: 6,
})

const outputConfig = ref<OutputConfig>({
  directory: '',
  overwriteOriginal: false,
  fileNamePattern: '{name}_processed',
  createSubfolders: false,
})

const canStart = computed(() => {
  return store.hasFiles && (outputConfig.value.overwriteOriginal || !!outputConfig.value.directory)
})

async function startProcessing() {
  if (!canStart.value) return

  const taskConfig = store.createTaskConfig(options.value, outputConfig.value)
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

.form-select {
  padding: 10px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
  background: white;
}

.form-select:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-hint {
  font-size: 12px;
  color: #9ca3af;
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

.info-box {
  padding: 16px;
  background: #f0f4ff;
  border: 1px solid #c7d2fe;
  border-radius: 8px;
  font-size: 13px;
  color: #3730a3;
}

.info-box ul {
  margin: 8px 0 0;
  padding-left: 20px;
}

.info-box li {
  margin: 4px 0;
}
</style>
