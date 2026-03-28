<template>
  <FeaturePage
    :title="t('删除备注')"
    :description="t('清空所有幻灯片的备注内容')"
    icon="📋"
    :can-start="canStart"
    :hint="t('请先确认操作并选择文件')"
    @back="$emit('back')"
    @start="startProcessing"
  >
    <template #config>
      <div class="config-section">
        <div class="warning-box">
          <strong>{{ t('警告') }}</strong>
          <p>{{ t('此操作将删除所有幻灯片的备注内容，且无法恢复') }}</p>
        </div>

        <div class="confirm-box">
          <label class="checkbox-item">
            <input type="checkbox" v-model="confirmed" />
            <span>{{ t('我确认要删除所有备注') }}</span>
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
      confirmDeleteNotes: confirmed.value,
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

.warning-box p {
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
