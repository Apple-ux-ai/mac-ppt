<template>
  <div class="page-operation-config">
    <template v-if="taskType === 'delete-pages'">
      <FormField :label="t('config.pageOperation.deleteMode')">
        <select v-model="deletePageMode" class="select">
          <option value="range">{{ t('config.pageOperation.deleteByRange') }}</option>
          <option value="keep">{{ t('config.pageOperation.keepSpecifiedPages') }}</option>
        </select>
      </FormField>

      <FormField :label="t('config.pageOperation.pageRange')" required>
        <input
          v-model="pageRange"
          type="text"
          class="input"
          :placeholder="t('config.pageOperation.pageRangeExample')"
        />
      </FormField>
    </template>

    <template v-if="taskType === 'extract-pages'">
      <FormField :label="t('config.pageOperation.extractQuestion')" required>
        <input
          v-model="extractPageRange"
          type="text"
          class="input"
          :placeholder="t('config.pageOperation.pageRangeExample')"
        />
      </FormField>
      <p class="hint-text">{{ t('config.pageOperation.extractHint') }}</p>
    </template>

    <template v-if="taskType === 'replace-pages'">
      <FormField :label="t('config.pageOperation.sourceFile')" required>
        <FilePicker
          v-model="replaceSourceFile"
          type="file"
          :placeholder="t('config.pageOperation.sourceFilePlaceholder')"
          :button-text="t('common.selectFile')"
          icon="📄"
        />
      </FormField>

      <FormField :label="t('config.pageOperation.sourcePage')" required>
        <input
          v-model.number="replaceSourcePageNumber"
          type="number"
          min="1"
          class="input"
          :placeholder="t('config.pageOperation.sourcePageExample')"
        />
      </FormField>

      <FormField
        :label="t('config.pageOperation.targetPage')"
        required
        :hint="t('config.pageOperation.targetPageHint')"
      >
        <input
          v-model.number="replacePageNumber"
          type="number"
          min="1"
          class="input"
          :placeholder="t('config.pageOperation.targetPageExample')"
        />
      </FormField>
    </template>

    <template v-if="taskType === 'insert-pages'">
      <FormField :label="t('config.pageOperation.sourceFile')" required>
        <FilePicker
          v-model="insertSourceFile"
          type="file"
          :placeholder="t('config.pageOperation.sourceFilePlaceholder')"
          :button-text="t('common.selectFile')"
          icon="📄"
        />
      </FormField>

      <FormField :label="t('config.pageOperation.sourcePageRange')" required>
        <input
          v-model="insertSourcePageRange"
          type="text"
          class="input"
          :placeholder="t('config.pageOperation.pageRangeExample')"
        />
      </FormField>

      <FormField
        :label="t('config.pageOperation.insertPosition')"
        required
        :hint="t('config.pageOperation.insertPositionHint')"
      >
        <input
          v-model.number="insertPosition"
          type="number"
          min="1"
          class="input"
          :placeholder="t('config.pageOperation.targetPageExample')"
        />
      </FormField>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { FormField, FilePicker } from '../common'
import { useI18n } from '../../i18n'

interface Props {
  taskType: 'delete-pages' | 'extract-pages' | 'replace-pages' | 'insert-pages'
  modelValue: Record<string, any>
}

const props = defineProps<Props>()
const { t } = useI18n()
const emit = defineEmits<{
  (e: 'update:modelValue', value: Record<string, any>): void
}>()

const deletePageMode = ref<'range' | 'keep'>(props.modelValue.deletePageMode || 'range')
const pageRange = ref(props.modelValue.pageRange || '')

const extractSourceFile = ref(props.modelValue.extractSourceFile || '')
const extractPageRange = ref(props.modelValue.extractPageRange || '')

const replaceTargetFile = ref(props.modelValue.replaceTargetFile || '')
const replacePageNumber = ref(props.modelValue.replacePageNumber || 1)
const replaceSourceFile = ref(props.modelValue.replaceSourceFile || '')
const replaceSourcePageNumber = ref(props.modelValue.replaceSourcePageNumber || 1)

const insertSourceFile = ref(props.modelValue.insertSourceFile || '')
const insertSourcePageRange = ref(props.modelValue.insertSourcePageRange || '')
const insertTargetFile = ref(props.modelValue.insertTargetFile || '')
const insertPosition = ref(props.modelValue.insertPosition || 1)

watch(
  [
    deletePageMode,
    pageRange,
    extractSourceFile,
    extractPageRange,
    replaceTargetFile,
    replacePageNumber,
    replaceSourceFile,
    replaceSourcePageNumber,
    insertSourceFile,
    insertSourcePageRange,
    insertTargetFile,
    insertPosition,
  ],
  ([
    dMode,
    dRange,
    eFile,
    eRange,
    rTarget,
    rPage,
    rSource,
    rSourcePage,
    iSource,
    iRange,
    iTarget,
    iPos,
  ]) => {
    emit('update:modelValue', {
      ...props.modelValue,
      deletePageMode: dMode,
      pageRange: dRange,
      extractSourceFile: eFile,
      extractPageRange: eRange,
      replaceTargetFile: rTarget,
      replacePageNumber: rPage,
      replaceSourceFile: rSource,
      replaceSourcePageNumber: rSourcePage,
      insertSourceFile: iSource,
      insertSourcePageRange: iRange,
      insertTargetFile: iTarget,
      insertPosition: iPos,
    })
  }
)
</script>

<style scoped>
.page-operation-config {
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
</style>
