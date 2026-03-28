<template>
  <div class="output-settings">
    <h4 class="section-title">{{ t('common.outputSettings') }}</h4>

    <FormField v-if="showOverwrite" label="">
      <label class="checkbox">
        <input type="checkbox" v-model="overwriteOriginal" />
        <span class="checkbox-label">{{ t('common.overwriteOriginal') }}</span>
      </label>
    </FormField>

    <template v-if="needOutputDir">
      <FormField :label="t('common.outputDirectory')" required>
        <FilePicker
          v-model="outputDirectory"
          type="folder"
          :placeholder="t('common.selectOutputDirectory')"
          :button-text="t('common.select')"
          icon="📁"
        />
      </FormField>

      <FormField
        v-if="showFileNamePattern"
        :label="t('common.filenamePattern')"
        :hint="t('common.filenamePatternHint')"
      >
        <input v-model="fileNamePattern" type="text" class="input" placeholder="{name}_processed" />
      </FormField>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import FormField from './FormField.vue'
import FilePicker from './FilePicker.vue'
import { useI18n } from '../../i18n'

interface Props {
  modelValue: {
    directory: string
    overwriteOriginal: boolean
    fileNamePattern: string
  }
  showOverwrite?: boolean
  showFileNamePattern?: boolean
  alwaysNeedOutputDir?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showOverwrite: true,
  showFileNamePattern: true,
  alwaysNeedOutputDir: false,
})

const { t } = useI18n()

const emit = defineEmits<{
  (e: 'update:modelValue', value: Props['modelValue']): void
}>()

const overwriteOriginal = computed({
  get: () => props.modelValue.overwriteOriginal,
  set: (value) => {
    emit('update:modelValue', {
      ...props.modelValue,
      overwriteOriginal: value,
    })
  },
})

const outputDirectory = computed({
  get: () => props.modelValue.directory,
  set: (value) => {
    emit('update:modelValue', {
      ...props.modelValue,
      directory: value,
    })
  },
})

const fileNamePattern = computed({
  get: () => props.modelValue.fileNamePattern,
  set: (value) => {
    emit('update:modelValue', {
      ...props.modelValue,
      fileNamePattern: value,
    })
  },
})

const needOutputDir = computed(() => {
  return props.alwaysNeedOutputDir || !props.modelValue.overwriteOriginal
})
</script>

<style scoped>
.output-settings {
  padding: var(--spacing-lg);
  background: var(--gray-50);
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.section-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--gray-800);
}
</style>
