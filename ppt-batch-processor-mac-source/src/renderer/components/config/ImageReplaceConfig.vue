<template>
  <div class="image-replace-config">
    <FormField :label="t('config.imageReplace.mode')">
      <select v-model="replaceMode" class="select">
        <option value="all">{{ t('config.imageReplace.modeAllPages') }}</option>
        <option value="by-page">{{ t('config.imageReplace.modeSpecifiedPage') }}</option>
        <option value="all-same">{{ t('config.imageReplace.modeSameImage') }}</option>
      </select>
    </FormField>

    <FormField
      v-if="replaceMode === 'by-page' || replaceMode === 'all-same'"
      :label="t('config.imageReplace.pageNumber')"
      required
      :hint="t('config.imageReplace.pageNumberPlaceholder')"
    >
      <input
        v-model.number="targetPageNumber"
        type="number"
        min="1"
        class="input"
        :placeholder="t('config.imageReplace.pageNumberExample')"
      />
    </FormField>

    <FormField :label="t('config.imageReplace.targetImage')" required>
      <FilePicker
        v-model="targetImagePath"
        type="image"
        :placeholder="t('config.imageReplace.targetImagePlaceholder')"
        :button-text="t('config.imageReplace.selectImage')"
        icon="🖼️"
        :success-text="t('config.imageReplace.imageSelected')"
      />
    </FormField>

    <FormField :label="t('config.textReplace.options')">
      <OptionsGrid :options="optionItems" v-model="selectedOptions" />
    </FormField>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { FormField, OptionsGrid, FilePicker } from '../common'
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

const replaceMode = ref<'all' | 'by-page' | 'all-same'>(props.modelValue.imageReplaceMode || 'all')
const targetPageNumber = ref(props.modelValue.targetPageNumber || 1)
const targetImagePath = ref(props.modelValue.targetImage || '')

const localOptions = ref({
  keepImageSize: props.modelValue.keepImageSize ?? true,
  keepImagePosition: props.modelValue.keepImagePosition ?? true,
})

const optionItems = computed(() => [
  { label: t('config.imageReplace.keepSize'), value: 'keepImageSize' },
  { label: t('config.imageReplace.keepPosition'), value: 'keepImagePosition' },
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

watch(
  [replaceMode, targetPageNumber, targetImagePath, localOptions],
  ([mode, page, image, options]) => {
    emit('update:modelValue', {
      ...props.modelValue,
      imageReplaceMode: mode,
      targetPageNumber: page,
      targetImage: image,
      ...options,
    })
  },
  { deep: true }
)
</script>

<style scoped>
.image-replace-config {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
