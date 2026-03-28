<template>
  <FeaturePage
    :title="t('删除空白页')"
    :description="t('自动检测并删除不包含任何内容的幻灯片')"
    icon="🗑️"
    :can-start="canStart"
    :hint="t('请先选择文件')"
    @back="$emit('back')"
    @start="startProcessing"
  >
    <template #config>
      <div class="config-section">
        <div class="info-box">
          <strong>{{ t('删除空白页') }}</strong>
          <p>{{ t('自动检测并删除不包含任何内容的幻灯片') }}</p>
        </div>

        <div class="form-group">
          <label class="form-label">{{ t('保留页面，只要它包含以下任意一项：') }}</label>
          <div class="checkbox-grid">
            <label class="checkbox-item">
              <input type="checkbox" v-model="options.hasText" />
              <span>{{ t('文本内容') }}</span>
            </label>
            <label class="checkbox-item">
              <input type="checkbox" v-model="options.hasImages" />
              <span>{{ t('图片') }}</span>
            </label>
            <label class="checkbox-item">
              <input type="checkbox" v-model="options.hasShapes" />
              <span>{{ t('形状') }}</span>
            </label>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">{{ t('高级选项') }}</label>
          <div class="checkbox-grid">
            <label class="checkbox-item">
              <input type="checkbox" v-model="options.ignoreBackground" />
              <span>{{ t('忽略母版/背景中的元素') }}</span>
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

const options = ref({
  hasText: true,
  hasImages: true,
  hasShapes: true,
  ignoreBackground: true,
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
</style>
