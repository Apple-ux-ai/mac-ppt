<template>
  <FeaturePage
    :title="t('PPT合并')"
    :description="t('将多个PPT文件合并成一个文件')"
    icon="🔗"
    :can-start="canStart"
    :hint="t('请先添加至少2个PPT文件')"
    @back="$emit('back')"
    @start="startProcessing"
  >
    <template #config>
      <div class="config-section">
        <div class="info-box">
          <strong>{{ t('PPT合并') }}</strong>
          <p>{{ t('将多个PPT文件合并成一个文件，按照文件顺序依次合并所有幻灯片') }}</p>
        </div>

        <div class="form-group">
          <label class="form-label">{{ t('合并顺序') }}</label>
          <select v-model="options.mergeOrder" class="form-select">
            <option value="name">{{ t('按文件名排序') }}</option>
            <option value="date">{{ t('按修改日期排序') }}</option>
            <option value="size">{{ t('按文件大小排序') }}</option>
          </select>
        </div>

        <div class="form-group">
          <label class="checkbox-item">
            <input type="checkbox" v-model="options.mergeAddSeparator" />
            <span>{{ t('在文件之间添加分隔页') }}</span>
          </label>
        </div>

        <div v-if="options.mergeAddSeparator" class="form-group">
          <label class="form-label">{{ t('分隔页文字') }}</label>
          <input
            v-model="options.mergeSeparatorText"
            type="text"
            class="form-input"
            :placeholder="t('例如: --- 文件分隔 ---')"
          />
          <small class="form-hint">{{ t('在每个文件之间插入一页包含此文本的幻灯片') }}</small>
        </div>

        <div class="warning-box">
          <strong>{{ t('注意') }}</strong>
          <p>{{ t('PPT合并功能需要选择多个文件，请在下方添加至少2个PPT文件') }}</p>
        </div>
      </div>
    </template>

    <template #files>
      <FileSelector />
    </template>

    <template #output>
      <OutputSettings
        v-model="outputConfig"
        :show-overwrite="false"
        :show-file-name-pattern="false"
        :always-need-output-dir="true"
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
  mergeOrder: 'selected' | 'alphabetical' | 'date'
  mergeAddSeparator: boolean
  mergeSeparatorText: string
}>({
  mergeOrder: 'selected',
  mergeAddSeparator: false,
  mergeSeparatorText: t('--- 文件分隔 ---'),
})

const outputConfig = ref<OutputConfig>({
  directory: '',
  overwriteOriginal: false,
  fileNamePattern: '{name}_merged',
  createSubfolders: false,
})

const canStart = computed(() => {
  return store.fileList.length >= 2 && outputConfig.value.directory !== ''
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

.warning-box p {
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

.form-hint {
  font-size: 12px;
  color: #9ca3af;
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
