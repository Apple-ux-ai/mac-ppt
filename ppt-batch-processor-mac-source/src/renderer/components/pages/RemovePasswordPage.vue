<template>
  <FeaturePage
    :title="t('删除密码')"
    :description="t('移除PPT文件的打开密码')"
    icon="🔓"
    :can-start="canStart"
    :hint="t('请先输入当前密码')"
    @back="$emit('back')"
    @start="startProcessing"
  >
    <template #config>
      <div class="config-section">
        <div class="info-box">
          <strong>{{ t('删除密码') }}</strong>
          <p>{{ t('移除PPT文件的打开密码') }}</p>
        </div>

        <div class="form-group">
          <label class="form-label required">{{ t('当前密码') }}</label>
          <input
            v-model="oldPassword"
            type="password"
            class="form-input"
            :placeholder="t('输入当前密码')"
          />
        </div>

        <div class="warning-box">
          <strong>{{ t('提示') }}</strong>
          <ul>
            <li>{{ t('需要输入正确的当前密码才能移除') }}</li>
            <li>{{ t('移除密码后文件可以直接打开') }}</li>
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

const oldPassword = ref('')

const outputConfig = ref<OutputConfig>({
  directory: '',
  overwriteOriginal: false,
  fileNamePattern: '{name}_unprotected',
  createSubfolders: false,
})

const canStart = computed(() => {
  return (
    oldPassword.value !== '' &&
    store.hasFiles &&
    (outputConfig.value.overwriteOriginal || !!outputConfig.value.directory)
  )
})

async function startProcessing() {
  if (!canStart.value) return

  const taskConfig = store.createTaskConfig(
    {
      oldPassword: oldPassword.value,
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

.form-input {
  padding: 10px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
  background: white;
}

.form-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}
</style>
