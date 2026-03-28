<template>
  <div class="metadata-config">
    <template v-if="taskType === 'edit-metadata'">
      <FormField :label="t('config.metadata.title')">
        <input
          v-model="metadataTitle"
          type="text"
          class="input"
          :placeholder="t('config.metadata.titlePlaceholder')"
        />
      </FormField>

      <FormField :label="t('config.metadata.author')">
        <input
          v-model="metadataAuthor"
          type="text"
          class="input"
          :placeholder="t('config.metadata.authorPlaceholder')"
        />
      </FormField>

      <FormField :label="t('config.metadata.subject')">
        <input
          v-model="metadataSubject"
          type="text"
          class="input"
          :placeholder="t('config.metadata.subjectPlaceholder')"
        />
      </FormField>

      <FormField :label="t('config.metadata.keywords')" :hint="t('config.metadata.keywordsHint')">
        <input
          v-model="metadataKeywords"
          type="text"
          class="input"
          :placeholder="t('config.metadata.keywordsPlaceholder')"
        />
      </FormField>

      <FormField :label="t('config.metadata.comments')">
        <textarea
          v-model="metadataComments"
          class="input"
          rows="3"
          :placeholder="t('config.metadata.commentsPlaceholder')"
        ></textarea>
      </FormField>
      <p class="hint-text">{{ t('config.metadata.editHint') }}</p>
    </template>

    <template v-if="taskType === 'clear-metadata'">
      <div class="confirm-box">
        <label class="checkbox">
          <input type="checkbox" v-model="confirmClearMetadata" />
          <span class="checkbox-label">{{ t('config.metadata.confirmClear') }}</span>
        </label>
      </div>
    </template>

    <template v-if="taskType === 'add-password'">
      <FormField :label="t('config.metadata.password')" required>
        <input
          v-model="addPassword"
          type="password"
          class="input"
          :placeholder="t('config.metadata.passwordPlaceholder')"
        />
      </FormField>

      <FormField :label="t('config.metadata.confirmPassword')" required>
        <input
          v-model="addPasswordConfirm"
          type="password"
          class="input"
          :placeholder="t('config.metadata.confirmPasswordPlaceholder')"
        />
      </FormField>

      <div
        v-if="addPassword && addPasswordConfirm && addPassword !== addPasswordConfirm"
        class="error-message"
      >
        {{ t('config.metadata.passwordMismatch') }}
      </div>
    </template>

    <template v-if="taskType === 'remove-password'">
      <FormField :label="t('config.metadata.currentPassword')" required>
        <input
          v-model="removePassword"
          type="password"
          class="input"
          :placeholder="t('config.metadata.currentPasswordPlaceholder')"
        />
      </FormField>
    </template>

    <template v-if="taskType === 'optimize-compress'">
      <FormField :label="t('config.metadata.compressLevel')">
        <select v-model="compressLevel" class="select">
          <option value="low">{{ t('config.metadata.compressLow') }}</option>
          <option value="medium">{{ t('config.metadata.compressMedium') }}</option>
          <option value="high">{{ t('config.metadata.compressHigh') }}</option>
        </select>
      </FormField>

      <FormField>
        <label class="checkbox">
          <input type="checkbox" v-model="compressImages" />
          <span class="checkbox-label">{{ t('config.metadata.compressImages') }}</span>
        </label>
      </FormField>

      <FormField>
        <label class="checkbox">
          <input type="checkbox" v-model="removeEmbeddedFonts" />
          <span class="checkbox-label">{{ t('config.metadata.removeEmbeddedFonts') }}</span>
        </label>
      </FormField>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { FormField } from '../common'
import { useI18n } from '../../i18n'

type MetadataTaskType =
  | 'edit-metadata'
  | 'clear-metadata'
  | 'add-password'
  | 'remove-password'
  | 'optimize-compress'

interface Props {
  taskType: MetadataTaskType
  modelValue: Record<string, any>
}

const props = defineProps<Props>()
const { t } = useI18n()
const emit = defineEmits<{
  (e: 'update:modelValue', value: Record<string, any>): void
}>()

const editMetadataSourceFile = ref(props.modelValue.editMetadataSourceFile || '')
const metadataTitle = ref(props.modelValue.metadataTitle || '')
const metadataAuthor = ref(props.modelValue.metadataAuthor || '')
const metadataSubject = ref(props.modelValue.metadataSubject || '')
const metadataKeywords = ref(props.modelValue.metadataKeywords || '')
const metadataComments = ref(props.modelValue.metadataComments || '')

const confirmClearMetadata = ref(false)

const addPassword = ref(props.modelValue.password || '')
const addPasswordConfirm = ref('')
const removePassword = ref(props.modelValue.oldPassword || '')

const compressLevel = ref<'low' | 'medium' | 'high'>(props.modelValue.compressLevel || 'medium')
const compressImages = ref(props.modelValue.compressImages ?? true)
const removeEmbeddedFonts = ref(props.modelValue.removeEmbeddedFonts || false)

watch(
  [
    editMetadataSourceFile,
    metadataTitle,
    metadataAuthor,
    metadataSubject,
    metadataKeywords,
    metadataComments,
    confirmClearMetadata,
    addPassword,
    addPasswordConfirm,
    removePassword,
    compressLevel,
    compressImages,
    removeEmbeddedFonts,
  ],
  ([
    eFile,
    title,
    author,
    subject,
    keywords,
    comments,
    clearMeta,
    addPwd,
    addPwdConfirm,
    rmPwd,
    level,
    compress,
    rmFonts,
  ]) => {
    emit('update:modelValue', {
      ...props.modelValue,
      editMetadataSourceFile: eFile,
      metadataTitle: title,
      metadataAuthor: author,
      metadataSubject: subject,
      metadataKeywords: keywords,
      metadataComments: comments,
      confirmClearMetadata: clearMeta,
      password: addPwd,
      passwordConfirm: addPwdConfirm,
      oldPassword: rmPwd,
      compressLevel: level,
      compressImages: compress,
      removeEmbeddedFonts: rmFonts,
    })
  }
)
</script>

<style scoped>
.metadata-config {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.hint-text {
  font-size: 12px;
  color: #6b7280;
  margin: 0;
  padding: 8px 12px;
  background: #f3f4f6;
  border-radius: 6px;
}

textarea.input {
  resize: vertical;
  min-height: 80px;
}

.confirm-box {
  padding: var(--spacing-lg);
  background: var(--error-50);
  border: 2px solid var(--error-500);
  border-radius: var(--radius-md);
}

.error-message {
  color: var(--error-600);
  font-size: 12px;
}
</style>
