<template>
  <div class="watermark-config">
    <FormField :label="t('config.watermark.text')" required>
      <input
        v-model="watermarkContent"
        type="text"
        class="input"
        :placeholder="t('config.watermark.textPlaceholder')"
      />
    </FormField>

    <FormField :label="t('config.watermark.fontSize')">
      <RangeSlider v-model="fontSize" :min="12" :max="72" unit="pt" />
    </FormField>

    <FormField :label="t('config.watermark.fontColor')">
      <div class="color-input">
        <input v-model="color" type="color" />
        <span class="color-value">{{ color }}</span>
      </div>
    </FormField>

    <FormField :label="t('config.watermark.position')">
      <select v-model="position" class="select">
        <option value="center">{{ t('config.watermark.positionCenter') }}</option>
        <option value="top-left">{{ t('config.watermark.positionTopLeft') }}</option>
        <option value="top-right">{{ t('config.watermark.positionTopRight') }}</option>
        <option value="bottom-left">{{ t('config.watermark.positionBottomLeft') }}</option>
        <option value="bottom-right">{{ t('config.watermark.positionBottomRight') }}</option>
      </select>
    </FormField>

    <FormField :label="t('config.watermark.opacity')">
      <RangeSlider v-model="opacity" :min="0" :max="1" :step="0.1" />
    </FormField>

    <FormField>
      <label class="checkbox">
        <input type="checkbox" v-model="applyToAll" />
        <span class="checkbox-label">{{ t('config.watermark.applyAllPages') }}</span>
      </label>
    </FormField>
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

const watermarkContent = ref(props.modelValue.watermarkText || '')
const fontSize = ref(props.modelValue.watermarkFontSize || 36)
const color = ref(props.modelValue.watermarkColor || '#000000')
const position = ref(props.modelValue.watermarkPosition || 'center')
const opacity = ref(props.modelValue.watermarkOpacity || 0.5)
const applyToAll = ref(props.modelValue.applyWatermarkToAll ?? true)

watch(
  [watermarkContent, fontSize, color, position, opacity, applyToAll],
  ([content, size, c, pos, op, all]) => {
    emit('update:modelValue', {
      ...props.modelValue,
      watermarkType: 'text',
      watermarkText: content,
      watermarkFontSize: size,
      watermarkColor: c,
      watermarkPosition: pos,
      watermarkOpacity: op,
      applyWatermarkToImages: true,
      applyWatermarkToAll: all,
    })
  }
)
</script>

<style scoped>
.watermark-config {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.color-input {
  display: flex;
  align-items: center;
  gap: 8px;
}

.color-input input[type='color'] {
  width: 40px;
  height: 32px;
  padding: 2px;
  border: 1px solid var(--gray-300);
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.color-value {
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--gray-600);
}
</style>
