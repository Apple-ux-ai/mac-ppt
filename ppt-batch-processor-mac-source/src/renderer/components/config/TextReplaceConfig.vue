<template>
  <div class="text-replace-config">
    <div class="quick-templates">
      <span class="templates-label">{{ t('config.textReplace.quickTemplates') }}</span>
      <div class="templates-list">
        <button
          v-for="template in quickTemplates"
          :key="template.name"
          type="button"
          class="btn btn-secondary btn-sm"
          @click="applyTemplate(template)"
        >
          {{ template.name }}
        </button>
      </div>
    </div>

    <FormField :label="t('config.textReplace.findText')" required>
      <input
        v-model="localOptions.searchText"
        type="text"
        class="input"
        :placeholder="t('config.textReplace.findTextPlaceholder')"
      />
    </FormField>

    <FormField
      :label="t('config.textReplace.replaceWith')"
      :hint="t('config.textReplace.replaceEmptyHint')"
    >
      <input
        v-model="localOptions.replaceText"
        type="text"
        class="input"
        :placeholder="t('config.textReplace.replacePlaceholder')"
      />
    </FormField>

    <FormField :label="t('config.textReplace.options')">
      <OptionsGrid :options="optionItems" v-model="selectedOptions" />
    </FormField>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { FormField, OptionsGrid } from '../common'
import { useI18n } from '../../i18n'

interface Props {
  modelValue: Record<string, any>
  taskType?: string
}

const props = defineProps<Props>()
const { t } = useI18n()
const emit = defineEmits<{
  (e: 'update:modelValue', value: Record<string, any>): void
}>()

const localOptions = ref({
  searchText: props.modelValue.searchText || '',
  replaceText: props.modelValue.replaceText || '',
  caseSensitive: props.modelValue.caseSensitive || false,
  wholeWord: props.modelValue.wholeWord || false,
  useRegex: props.modelValue.useRegex || false,
  replaceInNotes: props.modelValue.replaceInNotes ?? true,
  replaceInTables: props.modelValue.replaceInTables ?? true,
  skipHiddenSlides: props.modelValue.skipHiddenSlides || false,
})

const optionItems = computed(() => [
  { label: t('config.textReplace.caseSensitive'), value: 'caseSensitive' },
  { label: t('config.textReplace.matchWholeWord'), value: 'wholeWord' },
  { label: t('config.textReplace.useRegex'), value: 'useRegex' },
  { label: t('config.textReplace.replaceNotes'), value: 'replaceInNotes' },
  { label: t('config.textReplace.replaceTables'), value: 'replaceInTables' },
  { label: t('config.textReplace.skipHiddenSlides'), value: 'skipHiddenSlides' },
])

const selectedOptions = computed({
  get: () => {
    return Object.entries(localOptions.value)
      .filter(([_, value]) => value === true)
      .map(([key]) => key)
  },
  set: (values: string[]) => {
    optionItems.value.forEach((item) => {
      ;(localOptions.value as any)[item.value] = values.includes(item.value)
    })
  },
})

const quickTemplates = [
  { name: t('config.textReplace.templateRemoveSpaces'), searchText: ' ', replaceText: '' },
  {
    name: t('config.textReplace.templateRemoveLineBreaks'),
    searchText: '[\\r\\n]+',
    replaceText: '',
    useRegex: true,
  },
  {
    name: t('config.textReplace.templateNormalizeDate'),
    searchText: '(\\d{4})-(\\d{2})-(\\d{2})',
    replaceText: t('config.textReplace.templateNormalizeDateExample'),
    useRegex: true,
  },
  {
    name: t('config.textReplace.templateRemoveNumbers'),
    searchText: '\\d+',
    replaceText: '',
    useRegex: true,
  },
]

function applyTemplate(template: (typeof quickTemplates)[0]) {
  localOptions.value.searchText = template.searchText
  localOptions.value.replaceText = template.replaceText
  localOptions.value.useRegex = template.useRegex || false
  // 强制在下一次DOM更新循环中更新，以覆盖任何潜在的污染
  nextTick(() => {
    localOptions.value.replaceText = template.replaceText
  })
}

watch(
  localOptions,
  (value) => {
    emit('update:modelValue', { ...props.modelValue, ...value })
  },
  { deep: true }
)
</script>

<style scoped>
.text-replace-config {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.quick-templates {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.templates-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--gray-700);
}

.templates-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
</style>
