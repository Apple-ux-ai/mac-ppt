<template>
  <FeaturePage
    :title="t('按规则修改内容')"
    :description="t('批量查找和替换PPT中的文本内容，支持正则表达式')"
    icon="📝"
    :can-start="canStart"
    :hint="t('请先输入查找内容并选择文件')"
    @back="$emit('back')"
    @start="startProcessing"
  >
    <template #config>
      <div class="config-section">
        <div class="quick-templates">
          <span class="templates-label">{{ t('快捷模板') }}</span>
          <div class="templates-list">
            <button
              v-for="template in quickTemplates"
              :key="template.name"
              type="button"
              class="template-btn"
              @click="applyTemplate(template)"
            >
              {{ template.name }}
            </button>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label required">{{ t('查找文本') }}</label>
          <input
            v-model="options.searchText"
            type="text"
            class="form-input"
            :placeholder="t('输入要查找的文本')"
          />
        </div>

        <div class="form-group">
          <label class="form-label">{{ t('替换为') }}</label>
          <input
            v-model="options.replaceText"
            type="text"
            class="form-input"
            :placeholder="t('留空表示删除')"
          />
        </div>

        <div class="form-group">
          <label class="form-label">{{ t('选项') }}</label>
          <div class="checkbox-grid">
            <label class="checkbox-item">
              <input type="checkbox" v-model="options.caseSensitive" />
              <span>{{ t('区分大小写') }}</span>
            </label>
            <label class="checkbox-item">
              <input type="checkbox" v-model="options.wholeWord" />
              <span>{{ t('全词匹配') }}</span>
            </label>
            <label class="checkbox-item">
              <input type="checkbox" v-model="options.useRegex" />
              <span>{{ t('使用正则表达式') }}</span>
            </label>
            <label class="checkbox-item">
              <input type="checkbox" v-model="options.replaceInNotes" />
              <span>{{ t('替换备注内容') }}</span>
            </label>
            <label class="checkbox-item">
              <input type="checkbox" v-model="options.replaceInTables" />
              <span>{{ t('替换表格内容') }}</span>
            </label>
            <label class="checkbox-item">
              <input type="checkbox" v-model="options.skipHiddenSlides" />
              <span>{{ t('跳过隐藏幻灯片') }}</span>
            </label>
          </div>
        </div>

        <div v-if="options.useRegex" class="info-box">
          <strong>{{ t('正则表达式示例：') }}</strong>
          <ul>
            <li><code>\d+</code> - {{ t('匹配数字') }}</li>
            <li><code>[A-Z]+</code> - {{ t('匹配大写字母') }}</li>
            <li><code>\b\w+@\w+\.\w+\b</code> - {{ t('匹配邮箱') }}</li>
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
import { ref, computed, watch } from 'vue'
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
  searchText: '',
  replaceText: '',
  caseSensitive: false,
  wholeWord: false,
  useRegex: false,
  replaceInNotes: true,
  replaceInTables: true,
  skipHiddenSlides: false,
})

const outputConfig = ref<OutputConfig>({
  directory: '',
  overwriteOriginal: false,
  fileNamePattern: '{name}_processed',
  createSubfolders: false,
})

const quickTemplates = [
  { name: t('删除空格'), searchText: ' ', replaceText: '' },
  { name: t('删除换行'), searchText: '\\n', replaceText: '', useRegex: true },
  {
    name: t('统一日期'),
    searchText: '(\\d{4})-(\\d{2})-(\\d{2})',
    replaceText: t('$1年$2月$3日'),
    useRegex: true,
  },
  { name: t('删除数字'), searchText: '\\d+', replaceText: '', useRegex: true },
]

function applyTemplate(template: (typeof quickTemplates)[0]) {
  options.value.searchText = template.searchText
  options.value.replaceText = template.replaceText
  options.value.useRegex = template.useRegex || false
}

const canStart = computed(() => {
  return (
    options.value.searchText !== '' &&
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

.quick-templates {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.templates-label {
  font-size: 13px;
  font-weight: 500;
  color: #6b7280;
}

.templates-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.template-btn {
  padding: 6px 12px;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-size: 13px;
  color: #374151;
  cursor: pointer;
  transition: all 0.2s ease;
}

.template-btn:hover {
  background: #e5e7eb;
  border-color: #d1d5db;
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

.form-input {
  padding: 10px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
  transition: all 0.2s ease;
}

.form-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
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

.info-box code {
  padding: 2px 6px;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 4px;
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 12px;
}
</style>
