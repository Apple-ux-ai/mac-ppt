<template>
  <div
    class="info-box"
    :class="[
      `info-box-${type}`,
      { 'info-box-expandable': expandable, 'info-box-expanded': isExpanded },
    ]"
    @click="handleClick"
  >
    <div class="info-box-icon">
      <span v-if="type === 'info'">ℹ️</span>
      <span v-else-if="type === 'success'">✓</span>
      <span v-else-if="type === 'warning'">⚠️</span>
      <span v-else-if="type === 'error'">✕</span>
    </div>
    <div class="info-box-content">
      <div class="info-box-title">{{ title }}</div>
      <div v-if="expandable" class="info-box-collapsible">
        <slot></slot>
      </div>
      <div v-else>
        <slot></slot>
      </div>
    </div>
    <button v-if="expandable" type="button" class="info-box-toggle" @click.stop="toggleExpand">
      {{ isExpanded ? `${t('common.collapse')} ▲` : `${t('common.expand')} ▼` }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from '../../i18n'

interface Props {
  type?: 'info' | 'success' | 'warning' | 'error'
  title: string
  expandable?: boolean
  defaultExpanded?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  type: 'info',
  expandable: false,
  defaultExpanded: false,
})

const { t } = useI18n()

const isExpanded = ref(props.defaultExpanded)

function toggleExpand() {
  isExpanded.value = !isExpanded.value
}

function handleClick() {
  if (props.expandable) {
    toggleExpand()
  }
}
</script>

<style scoped>
.info-box {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
  cursor: default;
  transition: all var(--transition-fast);
}

.info-box-expandable {
  cursor: pointer;
  max-height: 48px;
  overflow: hidden;
}

.info-box-expandable:hover {
  filter: brightness(0.98);
}

.info-box-expanded {
  max-height: 500px;
}

.info-box-icon {
  flex-shrink: 0;
  font-size: 16px;
  line-height: 1;
}

.info-box-content {
  flex: 1;
  min-width: 0;
}

.info-box-title {
  font-weight: 600;
  font-size: 13px;
  margin-bottom: var(--spacing-xs);
}

.info-box-expandable:not(.info-box-expanded) .info-box-title {
  margin-bottom: 0;
}

.info-box-collapsible {
  margin-top: var(--spacing-sm);
}

.info-box-toggle {
  flex-shrink: 0;
  padding: var(--spacing-xs) var(--spacing-sm);
  background: transparent;
  border: none;
  font-size: 12px;
  color: inherit;
  opacity: 0.7;
  cursor: pointer;
  transition: opacity var(--transition-fast);
}

.info-box-toggle:hover {
  opacity: 1;
}

.info-box-info {
  background: var(--primary-50);
  border: 1px solid var(--primary-200);
  color: var(--primary-800);
}

.info-box-info .info-box-title {
  color: var(--primary-700);
}

.info-box-success {
  background: var(--success-50);
  border: 1px solid var(--success-500);
  color: var(--success-700);
}

.info-box-success .info-box-title {
  color: var(--success-700);
}

.info-box-warning {
  background: var(--warning-50);
  border: 1px solid var(--warning-500);
  color: var(--warning-700);
}

.info-box-warning .info-box-title {
  color: var(--warning-700);
}

.info-box-error {
  background: var(--error-50);
  border: 1px solid var(--error-500);
  color: var(--error-700);
}

.info-box-error .info-box-title {
  color: var(--error-700);
}

.info-box :deep(ul) {
  margin: var(--spacing-sm) 0 0 0;
  padding-left: var(--spacing-lg);
}

.info-box :deep(li) {
  margin: var(--spacing-xs) 0;
  font-size: 13px;
}

.info-box :deep(p) {
  margin: var(--spacing-xs) 0;
  font-size: 13px;
}

.info-box :deep(code) {
  padding: 1px 4px;
  background: rgba(0, 0, 0, 0.05);
  border-radius: var(--radius-xs);
  font-family: var(--font-mono);
  font-size: 12px;
}
</style>
