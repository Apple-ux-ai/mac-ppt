<template>
  <FeaturePage
    :title="t('添加密码')"
    :description="t('为PPT文件添加打开密码，保护文件安全')"
    icon="🔑"
    :can-start="canStart"
    :hint="t('请先输入密码并确认')"
    @back="$emit('back')"
    @start="startProcessing"
  >
    <template #config>
      <div class="config-section">
        <div class="info-box">
          <strong>{{ t('添加密码') }}</strong>
          <p>{{ t('为PPT文件添加打开密码，保护文件安全') }}</p>
        </div>

        <div class="form-group">
          <label class="form-label required">{{ t('设置密码') }}</label>
          <input
            v-model="password"
            type="password"
            class="form-input"
            :placeholder="t('输入密码')"
          />
        </div>

        <div class="form-group">
          <label class="form-label required">{{ t('确认密码') }}</label>
          <input
            v-model="passwordConfirm"
            type="password"
            class="form-input"
            :placeholder="t('再次输入密码')"
          />
        </div>

        <div v-if="password && passwordConfirm && password !== passwordConfirm" class="error-box">
          <p>{{ t('两次输入的密码不一致') }}</p>
        </div>

        <div class="warning-box">
          <strong>{{ t('提示') }}</strong>
          <ul>
            <li>{{ t('请牢记密码，忘记密码将无法打开文件') }}</li>
            <li>{{ t('建议使用包含字母、数字和符号的强密码') }}</li>
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

const password = ref('')
const passwordConfirm = ref('')

const outputConfig = ref<OutputConfig>({
  directory: '',
  overwriteOriginal: false,
  fileNamePattern: '{name}_protected',
  createSubfolders: false,
})

const canStart = computed(() => {
  return (
    password.value !== '' &&
    password.value === passwordConfirm.value &&
    store.hasFiles &&
    (outputConfig.value.overwriteOriginal || !!outputConfig.value.directory)
  )
})

async function startProcessing() {
  if (!canStart.value) return

  const taskConfig = store.createTaskConfig(
    {
      password: password.value,
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

.error-box {
  padding: 12px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  font-size: 13px;
  color: #dc2626;
}

.error-box p {
  margin: 0;
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
