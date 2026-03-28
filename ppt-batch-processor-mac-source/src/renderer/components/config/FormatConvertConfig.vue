<template>
  <div class="format-convert-config">
    <FormField :label="t('config.formatConvert.targetFormat')" required>
      <select v-model="targetFormat" class="select">
        <option value="pdf">{{ t('config.formatConvert.pdf') }}</option>
        <option value="png">{{ t('config.formatConvert.png') }}</option>
      </select>
    </FormField>

    <template v-if="targetFormat === 'png'">
      <FormField :label="t('config.formatConvert.imageQuality')">
        <RangeSlider
          v-model="imageQuality"
          :min="1"
          :max="100"
          unit="%"
          :hint="t('config.formatConvert.imageQualityHint')"
        />
      </FormField>

      <FormField :label="t('config.formatConvert.compressionLevel')">
        <RangeSlider
          v-model="compressionLevel"
          :min="0"
          :max="9"
          :hint="t('config.formatConvert.compressionLevelHint')"
        />
      </FormField>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { FormField, RangeSlider } from '../common'
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

const targetFormat = ref<'pdf' | 'png'>(props.modelValue.targetFormat || 'pdf')
const imageQuality = ref(props.modelValue.imageQuality || 90)
const compressionLevel = ref(props.modelValue.compressionLevel || 6)

watch([targetFormat, imageQuality, compressionLevel], ([format, quality, compression]) => {
  emit('update:modelValue', {
    ...props.modelValue,
    targetFormat: format,
    imageQuality: quality,
    compressionLevel: compression,
  })
})
</script>

<style scoped>
.format-convert-config {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
