<template>
  <FeaturePage
    :title="t('PPT拆分')"
    :description="t('将一个大的PPT文件按指定页数拆分成多个小文件')"
    icon="✂️"
    :can-start="canStart"
    :hint="t('请先配置拆分参数')"
    @back="$emit('back')"
    @start="startProcessing"
  >
    <template #config>
      <div class="config-section">
        <div class="info-box">
          <strong>{{ t('PPT拆分') }}</strong>
          <p>{{ t('将一个大的PPT文件按指定页数拆分成多个小文件，方便分发和管理') }}</p>
        </div>

        <div class="form-group">
          <label class="form-label required">{{ t('拆分方式') }}</label>
          <select v-model="options.splitMode" class="form-select">
            <option value="by-pages">{{ t('按页数拆分') }}</option>
            <option value="by-count">{{ t('按文件数量拆分') }}</option>
          </select>
        </div>

        <div v-if="options.splitMode === 'by-pages'" class="form-group">
          <label class="form-label required">{{ t('每个文件页数') }}</label>
          <input
            v-model.number="options.splitPagesPerFile"
            type="number"
            min="1"
            class="form-input"
            :placeholder="t('例如: 10')"
          />
          <small class="form-hint">{{ t('每个拆分后的文件包含的页数') }}</small>
        </div>

        <div v-if="options.splitMode === 'by-count'" class="form-group">
          <label class="form-label required">{{ t('拆分文件数量') }}</label>
          <input
            v-model.number="options.splitFileCount"
            type="number"
            min="2"
            class="form-input"
            :placeholder="t('例如: 5')"
          />
          <small class="form-hint">{{ t('将PPT平均拆分成指定数量的文件') }}</small>
        </div>

        <div class="form-group">
          <label class="form-label">{{ t('文件命名规则') }}</label>
          <select v-model="options.splitNamingRule" class="form-select">
            <option value="number">{{ t('数字编号（文件名_1, 文件名_2...）') }}</option>
            <option value="range">{{ t('页码范围（文件名_1-10, 文件名_11-20...）') }}</option>
            <option value="custom">{{ t('自定义前缀') }}</option>
          </select>
        </div>

        <div v-if="options.splitNamingRule === 'custom'" class="form-group">
          <label class="form-label">{{ t('自定义前缀') }}</label>
          <input
            v-model="options.splitCustomPrefix"
            type="text"
            class="form-input"
            :placeholder="t('例如: 部分')"
          />
          <small class="form-hint">{{ t('输出文件名格式：原文件名_前缀1.pptx') }}</small>
        </div>

        <div class="example-box">
          <strong>{{ t('示例') }}</strong>
          <p>{{ t('原文件：演示文稿.pptx（30页）') }}</p>
          <p>{{ t('按10页拆分：生成3个文件') }}</p>
          <p>{{ t('数字编号：演示文稿_1.pptx（1-10页）、演示文稿_2.pptx（11-20页）') }}</p>
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
  splitMode: 'by-pages' | 'by-count' | 'by-range'
  splitPagesPerFile: number
  splitFileCount: number
  splitNamingRule: 'numbered' | 'custom'
  splitCustomPrefix: string
}>({
  splitMode: 'by-pages',
  splitPagesPerFile: 10,
  splitFileCount: 2,
  splitNamingRule: 'numbered',
  splitCustomPrefix: '',
})

const outputConfig = ref<OutputConfig>({
  directory: '',
  overwriteOriginal: false,
  fileNamePattern: '{name}_processed',
  createSubfolders: false,
})

const canStart = computed(() => {
  return store.hasFiles && outputConfig.value.directory !== ''
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

.example-box {
  padding: 16px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 13px;
  color: #374151;
}

.example-box p {
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

.form-hint {
  font-size: 12px;
  color: #9ca3af;
}
</style>
