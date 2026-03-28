<template>
  <FeaturePage
    :title="t('删除页面')"
    :description="t('从PPT中删除指定页码的幻灯片')"
    icon="❌"
    :can-start="canStart"
    :hint="t('请先输入页码范围')"
    @back="$emit('back')"
    @start="startProcessing"
  >
    <template #config>
      <div class="config-section">
        <div class="form-group">
          <label class="form-label required">{{ t('删除方式') }}</label>
          <select v-model="options.deletePageMode" class="form-select">
            <option value="range">{{ t('按页码范围删除') }}</option>
            <option value="keep">{{ t('保留指定页面（删除其他）') }}</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label required">{{ t('页码范围') }}</label>
          <input
            v-model="options.pageRange"
            type="text"
            class="form-input"
            :placeholder="t('例如: 1-3,5,7-9')"
          />
        </div>

        <div class="info-box">
          <strong>{{ t('页码格式') }}</strong>
          <ul>
            <li>{{ t('单页：') }}<code>5</code> {{ t('表示删除第5页') }}</li>
            <li>{{ t('连续页：') }}<code>1-3</code> {{ t('表示删除第1到第3页') }}</li>
            <li>
              {{ t('组合：') }}<code>1-3,5,7-9</code> {{ t('表示删除第1-3页、第5页、第7-9页') }}
            </li>
          </ul>
          <p>{{ t('页码从1开始计数') }}</p>
        </div>

        <div class="warning-box">
          <strong>{{ t('注意') }}</strong>
          <p>{{ t('删除页面后无法恢复，建议先备份原文件或使用"不覆盖原文件"选项') }}</p>
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
  deletePageMode: 'range',
  pageRange: '',
})

const outputConfig = ref<OutputConfig>({
  directory: '',
  overwriteOriginal: false,
  fileNamePattern: '{name}_processed',
  createSubfolders: false,
})

const canStart = computed(() => {
  return (
    options.value.pageRange !== '' &&
    store.hasFiles &&
    (outputConfig.value.overwriteOriginal || !!outputConfig.value.directory)
  )
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

.info-box ul {
  margin: 8px 0;
  padding-left: 20px;
}

.info-box li {
  margin: 4px 0;
}

.info-box p {
  margin: 4px 0;
}

.info-box code {
  padding: 2px 6px;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 4px;
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 12px;
}

.warning-box {
  padding: 16px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  font-size: 13px;
  color: #991b1b;
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
</style>
