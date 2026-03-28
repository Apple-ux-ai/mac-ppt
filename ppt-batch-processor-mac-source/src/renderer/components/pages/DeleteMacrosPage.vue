<template>
  <FeaturePage
    :title="t('删除宏')"
    :description="t('移除PPT文件中的所有VBA宏代码')"
    icon="⚙️"
    :can-start="canStart"
    :hint="t('请先确认操作并选择文件')"
    @back="$emit('back')"
    @start="startProcessing"
  >
    <template #config>
      <div class="config-section">
        <div class="warning-box">
          <strong>{{ t('删除宏') }}</strong>
          <p>{{ t('此操作将删除PPT文件中的所有VBA宏代码，包括：') }}</p>
          <ul>
            <li>{{ t('vbaProject.bin 文件') }}</li>
            <li>{{ t('所有宏相关的引用和声明') }}</li>
          </ul>
          <p>
            <strong>{{ t('注意：') }}</strong
            >{{ t('删除后无法恢复，请确保已备份原文件') }}
          </p>
        </div>

        <div class="info-box">
          <strong>{{ t('为什么要删除宏？') }}</strong>
          <ul>
            <li>{{ t('提高文件安全性，防止恶意宏代码') }}</li>
            <li>{{ t('减小文件大小') }}</li>
            <li>{{ t('满足某些组织的安全策略要求') }}</li>
          </ul>
        </div>

        <div class="confirm-box">
          <label class="checkbox-item">
            <input type="checkbox" v-model="confirmed" />
            <span>{{ t('我确认要删除所有宏代码') }}</span>
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

const confirmed = ref(false)

const outputConfig = ref<OutputConfig>({
  directory: '',
  overwriteOriginal: false,
  fileNamePattern: '{name}_processed',
  createSubfolders: false,
})

const canStart = computed(() => {
  return (
    confirmed.value &&
    store.hasFiles &&
    (outputConfig.value.overwriteOriginal || !!outputConfig.value.directory)
  )
})

async function startProcessing() {
  if (!canStart.value) return

  const taskConfig = store.createTaskConfig(
    {
      confirmDeleteMacros: confirmed.value,
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

.warning-box {
  padding: 16px;
  background: #fef2f2;
  border: 2px solid #ef4444;
  border-radius: 8px;
  font-size: 13px;
  color: #991b1b;
}

.warning-box ul {
  margin: 8px 0;
  padding-left: 20px;
}

.warning-box li {
  margin: 4px 0;
}

.warning-box p {
  margin: 4px 0;
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

.confirm-box {
  padding: 16px;
  background: #fef2f2;
  border: 2px solid #ef4444;
  border-radius: 8px;
}

.checkbox-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #991b1b;
  cursor: pointer;
}

.checkbox-item input {
  width: 18px;
  height: 18px;
  accent-color: #ef4444;
}
</style>
