<template>
  <FeaturePage
    :title="t('优化压缩')"
    :description="t('优化压缩PPT文件，减小文件大小')"
    icon="📦"
    :can-start="canStart"
    :hint="t('请先选择文件')"
    @back="$emit('back')"
    @start="startProcessing"
  >
    <template #config>
      <div class="config-section">
        <div class="info-box">
          <strong>{{ t('优化压缩') }}</strong>
          <p>{{ t('优化压缩PPT文件，减小文件大小') }}</p>
        </div>

        <div class="form-group">
          <label class="form-label required">{{ t('压缩级别') }}</label>
          <select v-model="options.compressLevel" class="form-select">
            <option value="low">{{ t('低压缩（质量优先）') }}</option>
            <option value="medium">{{ t('中等压缩（平衡）') }}</option>
            <option value="high">{{ t('高压缩（大小优先）') }}</option>
          </select>
        </div>

        <div class="form-group">
          <label class="checkbox-item">
            <input type="checkbox" v-model="options.compressImages" />
            <span>{{ t('压缩图片') }}</span>
          </label>
        </div>

        <div class="form-group">
          <label class="checkbox-item">
            <input type="checkbox" v-model="options.removeEmbeddedFonts" />
            <span>{{ t('移除嵌入字体') }}</span>
          </label>
        </div>

        <div class="warning-box">
          <strong>{{ t('提示') }}</strong>
          <ul>
            <li>{{ t('压缩可能会略微降低图片质量') }}</li>
            <li>{{ t('移除嵌入字体可能影响在其他电脑上的显示效果') }}</li>
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
  compressLevel: 'low' | 'medium' | 'high'
  compressImages: boolean
  removeEmbeddedFonts: boolean
}>({
  compressLevel: 'medium',
  compressImages: true,
  removeEmbeddedFonts: false,
})

const outputConfig = ref<OutputConfig>({
  directory: '',
  overwriteOriginal: false,
  fileNamePattern: '{name}_compressed',
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

.warning-box {
  padding: 16px;
  background: #fffbeb;
  border: 1px solid #fcd34d;
  border-radius: 8px;
  font-size: 13px;
  color: #92400e;
}

.warning-box ul {
  margin: 8px 0 0;
  padding-left: 20px;
}

.warning-box li {
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
