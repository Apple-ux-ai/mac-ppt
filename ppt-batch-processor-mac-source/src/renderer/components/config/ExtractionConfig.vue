<template>
  <div class="extraction-config">
    <template v-if="taskType === 'extract-images'">
      <p class="hint-text">{{ t('config.extraction.extractImagesHint') }}</p>
    </template>

    <template v-if="taskType === 'extract-notes'">
      <FormField :label="t('config.extraction.outputFormat')">
        <select v-model="extractNotesFormat" class="select">
          <option value="txt">{{ t('config.extraction.outputText') }}</option>
          <option value="md">{{ t('config.extraction.outputMarkdown') }}</option>
        </select>
      </FormField>
      <p class="hint-text">{{ t('config.extraction.extractNotesHint') }}</p>
    </template>

    <template v-if="taskType === 'delete-blank-pages'">
      <FormField :label="t('config.extraction.keepPageIfContains')">
        <OptionsGrid :options="blankPageOptions" v-model="selectedBlankOptions" />
      </FormField>
      <FormField :label="t('config.extraction.advancedOptions')">
        <OptionsGrid :options="advancedBlankOptions" v-model="selectedAdvancedBlankOptions" />
      </FormField>
    </template>

    <template v-if="taskType === 'delete-notes'">
      <div class="confirm-box">
        <label class="checkbox">
          <input type="checkbox" v-model="confirmDeleteNotes" />
          <span class="checkbox-label">{{ t('config.extraction.confirmDeleteNotes') }}</span>
        </label>
      </div>
    </template>

    <template v-if="taskType === 'delete-background'">
      <FormField :label="t('config.extraction.deleteOptions')">
        <OptionsGrid :options="backgroundOptions" v-model="selectedBackgroundOptions" />
      </FormField>
    </template>

    <template v-if="taskType === 'delete-macros'">
      <div class="confirm-box">
        <label class="checkbox">
          <input type="checkbox" v-model="confirmDeleteMacros" />
          <span class="checkbox-label">{{ t('config.extraction.confirmDeleteMacros') }}</span>
        </label>
      </div>
    </template>

    <template v-if="taskType === 'delete-header-footer'">
      <FormField :label="t('config.extraction.deleteOptions')">
        <OptionsGrid :options="headerFooterOptions" v-model="selectedHeaderFooterOptions" />
      </FormField>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { FormField, OptionsGrid } from '../common'
import { useI18n } from '../../i18n'

type ExtractionTaskType =
  | 'extract-images'
  | 'extract-notes'
  | 'delete-blank-pages'
  | 'delete-notes'
  | 'delete-background'
  | 'delete-macros'
  | 'delete-header-footer'

interface Props {
  taskType: ExtractionTaskType
  modelValue: Record<string, any>
}

const props = defineProps<Props>()
const { t } = useI18n()
const emit = defineEmits<{
  (e: 'update:modelValue', value: Record<string, any>): void
}>()

const extractImagesSourceFile = ref(props.modelValue.extractImagesSourceFile || '')
const extractNotesSourceFile = ref(props.modelValue.extractNotesSourceFile || '')
const extractNotesFormat = ref<'txt' | 'md'>(props.modelValue.extractNotesFormat || 'txt')

const blankPageOptions = computed(() => [
  { label: t('config.extraction.textContent'), value: 'hasText' },
  { label: t('config.extraction.image'), value: 'hasImages' },
  { label: t('config.extraction.shape'), value: 'hasShapes' },
])
const selectedBlankOptions = ref<string[]>(['hasText', 'hasImages', 'hasShapes'])

const advancedBlankOptions = computed(() => [
  { label: t('config.extraction.ignoreMaster'), value: 'ignoreBackground' },
])
const selectedAdvancedBlankOptions = ref<string[]>(['ignoreBackground'])

const confirmDeleteNotes = ref(false)
const confirmDeleteMacros = ref(false)

const backgroundOptions = computed(() => [
  { label: t('config.extraction.deleteBackgroundImage'), value: 'removeImages' },
  { label: t('config.extraction.deleteBackgroundColor'), value: 'removeColors' },
  { label: t('config.extraction.applyToMaster'), value: 'applyToMaster' },
])
const selectedBackgroundOptions = ref<string[]>(['removeImages'])

const headerFooterOptions = computed(() => [
  { label: t('config.extraction.deleteHeader'), value: 'removeHeader' },
  { label: t('config.extraction.deleteFooter'), value: 'removeFooter' },
  { label: t('config.extraction.deletePageNumber'), value: 'removeSlideNumber' },
  { label: t('config.extraction.deleteDateTime'), value: 'removeDateTime' },
])
const selectedHeaderFooterOptions = ref<string[]>([
  'removeHeader',
  'removeFooter',
  'removeSlideNumber',
  'removeDateTime',
])

watch(
  [
    extractImagesSourceFile,
    extractNotesSourceFile,
    extractNotesFormat,
    selectedBlankOptions,
    selectedAdvancedBlankOptions,
    confirmDeleteNotes,
    confirmDeleteMacros,
    selectedBackgroundOptions,
    selectedHeaderFooterOptions,
  ],
  ([
    imgFile,
    notesFile,
    notesFormat,
    blankOpts,
    advancedOpts,
    delNotes,
    delMacros,
    bgOpts,
    hfOpts,
  ]) => {
    const blankOptions: Record<string, boolean> = {}
    const allBlankOptions = [...blankPageOptions.value, ...advancedBlankOptions.value]
    allBlankOptions.forEach((opt) => {
      blankOptions[opt.value] = [...blankOpts, ...advancedOpts].includes(opt.value)
    })

    const bgOptions: Record<string, boolean> = {}
    backgroundOptions.value.forEach((opt) => {
      bgOptions[opt.value] = bgOpts.includes(opt.value)
    })

    const hfOptions: Record<string, boolean> = {}
    headerFooterOptions.value.forEach((opt) => {
      hfOptions[opt.value] = hfOpts.includes(opt.value)
    })

    emit('update:modelValue', {
      ...props.modelValue,
      extractImagesSourceFile: imgFile,
      extractNotesSourceFile: notesFile,
      extractNotesFormat: notesFormat,
      ...blankOptions,
      confirmDeleteNotes: delNotes,
      confirmDeleteMacros: delMacros,
      ...bgOptions,
      ...hfOptions,
    })
  },
  { deep: true }
)
</script>

<style scoped>
.extraction-config {
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

.confirm-box {
  padding: var(--spacing-lg);
  background: var(--error-50);
  border: 2px solid var(--error-500);
  border-radius: var(--radius-md);
}

.confirm-box .checkbox-label {
  font-weight: 600;
  color: var(--error-700);
}
</style>
