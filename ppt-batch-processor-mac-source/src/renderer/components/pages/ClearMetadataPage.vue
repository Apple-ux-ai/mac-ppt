<template>
  <FeaturePage
    :title="t('清空元数据')"
    :description="t('清空PPT文件的所有元数据信息，保护隐私')"
    icon="🔒"
    :can-start="canStart"
    :hint="t('请先选择文件')"
    @back="$emit('back')"
    @start="startProcessing"
  >
    <template #config>
      <div class="config-section">
        <div class="info-box">
          <strong>{{ t('清空元数据') }}</strong>
          <p>{{ t('清空PPT文件的所有元数据信息，保护隐私') }}</p>
        </div>

        <div class="warning-box">
          <strong>{{ t('提示') }}</strong>
          <ul>
            <li>{{ t('将清空标题、作者、主题、关键词等所有元数据') }}</li>
            <li>{{ t('保留创建和修改日期') }}</li>
            <li>{{ t('适用于需要分享文件但不想泄露个人信息的场景') }}</li>
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

const outputConfig = ref<OutputConfig>({
  directory: '',
  overwriteOriginal: false,
  fileNamePattern: '{name}_cleaned',
  createSubfolders: false,
})

const canStart = computed(() => {
  return store.hasFiles && (outputConfig.value.overwriteOriginal || !!outputConfig.value.directory)
})

async function startProcessing() {
  if (!canStart.value) return

  const taskConfig = store.createTaskConfig({}, outputConfig.value)
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
</style>
