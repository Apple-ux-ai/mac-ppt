<template>
  <div class="split-merge-config">
    <template v-if="taskType === 'split-ppt'">
      <FormField :label="t('config.splitMerge.mode')">
        <select v-model="splitMode" class="select">
          <option value="pages">{{ t('config.splitMerge.byPages') }}</option>
          <option value="count">{{ t('config.splitMerge.byFileCount') }}</option>
        </select>
      </FormField>

      <FormField v-if="splitMode === 'pages'" :label="t('config.splitMerge.pagesPerFile')" required>
        <input
          v-model.number="splitPagesPerFile"
          type="number"
          min="1"
          class="input"
          :placeholder="t('config.splitMerge.pagesPerFileExample')"
        />
      </FormField>

      <FormField v-if="splitMode === 'count'" :label="t('config.splitMerge.fileCount')" required>
        <input
          v-model.number="splitFileCount"
          type="number"
          min="2"
          class="input"
          :placeholder="t('config.splitMerge.fileCountExample')"
        />
      </FormField>

      <FormField :label="t('config.splitMerge.namingRule')">
        <select v-model="splitNamingRule" class="select">
          <option value="number">{{ t('config.splitMerge.namingNumber') }}</option>
          <option value="range">{{ t('config.splitMerge.namingRange') }}</option>
          <option value="custom">{{ t('config.splitMerge.namingPrefix') }}</option>
        </select>
      </FormField>

      <FormField v-if="splitNamingRule === 'custom'" :label="t('config.splitMerge.namingPrefix')">
        <input
          v-model="splitCustomPrefix"
          type="text"
          class="input"
          :placeholder="t('config.splitMerge.prefixExample')"
        />
      </FormField>
    </template>

    <template v-if="taskType === 'merge-ppt'">
      <FormField :label="t('config.splitMerge.mergeOrder')">
        <select v-model="mergeOrder" class="select">
          <option value="name">{{ t('config.splitMerge.sortByName') }}</option>
          <option value="date">{{ t('config.splitMerge.sortByModified') }}</option>
          <option value="size">{{ t('config.splitMerge.sortBySize') }}</option>
        </select>
      </FormField>

      <FormField>
        <label class="checkbox">
          <input type="checkbox" v-model="mergeAddSeparator" />
          <span class="checkbox-label">{{ t('config.splitMerge.addSeparator') }}</span>
        </label>
      </FormField>

      <FormField v-if="mergeAddSeparator" :label="t('config.splitMerge.separatorText')">
        <input
          v-model="mergeSeparatorText"
          type="text"
          class="input"
          :placeholder="t('config.splitMerge.separatorTextExample')"
        />
      </FormField>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { FormField } from '../common'
import { useI18n } from '../../i18n'

interface Props {
  taskType: 'split-ppt' | 'merge-ppt'
  modelValue: Record<string, any>
}

const props = defineProps<Props>()
const { t } = useI18n()
const emit = defineEmits<{
  (e: 'update:modelValue', value: Record<string, any>): void
}>()

const splitMode = ref<'pages' | 'count'>(props.modelValue.splitMode || 'pages')
const splitPagesPerFile = ref(props.modelValue.splitPagesPerFile || 10)
const splitFileCount = ref(props.modelValue.splitFileCount || 2)
const splitNamingRule = ref<'number' | 'range' | 'custom'>(
  props.modelValue.splitNamingRule || 'number'
)
const splitCustomPrefix = ref(props.modelValue.splitCustomPrefix || '')

const mergeOrder = ref<'name' | 'date' | 'size'>(props.modelValue.mergeOrder || 'name')
const mergeAddSeparator = ref(props.modelValue.mergeAddSeparator || false)
const mergeSeparatorText = ref(
  props.modelValue.mergeSeparatorText || t('config.splitMerge.separatorDefault')
)

watch(
  [
    splitMode,
    splitPagesPerFile,
    splitFileCount,
    splitNamingRule,
    splitCustomPrefix,
    mergeOrder,
    mergeAddSeparator,
    mergeSeparatorText,
  ],
  ([sMode, sPages, sCount, sNaming, sPrefix, mOrder, mSeparator, mText]) => {
    emit('update:modelValue', {
      ...props.modelValue,
      splitMode: sMode,
      splitPagesPerFile: sPages,
      splitFileCount: sCount,
      splitNamingRule: sNaming,
      splitCustomPrefix: sPrefix,
      mergeOrder: mOrder,
      mergeAddSeparator: mSeparator,
      mergeSeparatorText: mText,
    })
  }
)
</script>

<style scoped>
.split-merge-config {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
