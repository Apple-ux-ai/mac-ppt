<template>
  <div class="feature-page">
    <div class="feature-header">
      <div class="feature-title-area">
        <span class="feature-icon">{{ icon }}</span>
        <div class="feature-title-text">
          <h2>{{ title }}</h2>
          <p>{{ description }}</p>
        </div>
      </div>
      <button type="button" class="back-btn" @click="$emit('back')">
        <span>←</span>
        <span>{{ t('common.backToList') }}</span>
      </button>
    </div>

    <div class="feature-content">
      <div class="feature-main">
        <div class="config-card">
          <h3 class="card-title">
            <span>{{ t('common.configOptions') }}</span>
            <button
              type="button"
              class="collapse-btn"
              @click="isConfigCollapsed = !isConfigCollapsed"
            >
              <el-icon><component :is="isConfigCollapsed ? ArrowDown : ArrowUp" /></el-icon>
              <span>{{ isConfigCollapsed ? t('common.expand') : t('common.collapse') }}</span>
            </button>
          </h3>
          <div v-show="!isConfigCollapsed">
            <slot name="config"></slot>
          </div>
        </div>

        <div class="files-card">
          <h3 class="card-title">{{ t('common.fileSelection') }}</h3>
          <slot name="files"></slot>
        </div>
      </div>

      <div class="feature-sidebar">
        <div class="output-card">
          <h3 class="card-title">{{ t('common.outputSettings') }}</h3>
          <slot name="output"></slot>
        </div>

        <div class="action-card">
          <button
            type="button"
            class="start-btn"
            :class="{ 'start-btn-disabled': !canStart }"
            :disabled="!canStart"
            @click="$emit('start')"
          >
            <span class="start-icon">▶</span>
            <span>{{ t('common.startProcessing') }}</span>
          </button>
          <p class="action-hint">{{ hint || t('common.clickButtonToStart') }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ArrowDown, ArrowUp } from '@element-plus/icons-vue'
import { useI18n } from '../../i18n'

interface Props {
  title: string
  description: string
  icon: string
  canStart: boolean
  hint?: string
}

defineProps<Props>()

defineEmits<{
  (e: 'back'): void
  (e: 'start'): void
}>()

const isConfigCollapsed = ref(false)
const { t } = useI18n()
</script>

<style scoped>
.feature-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.feature-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  color: white;
}

.feature-title-area {
  display: flex;
  gap: 16px;
}

.feature-icon {
  font-size: 48px;
  line-height: 1;
}

.feature-title-text h2 {
  margin: 0 0 8px;
  font-size: 24px;
  font-weight: 600;
}

.feature-title-text p {
  margin: 0;
  font-size: 14px;
  opacity: 0.9;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 20px;
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 8px;
  font-size: 14px;
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
}

.back-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

.feature-content {
  flex: 1;
  display: flex;
  gap: 24px;
  min-height: 0;
}

.feature-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 24px;
  overflow-y: auto;
  min-height: 0;
}

.feature-sidebar {
  width: 320px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.config-card,
.files-card,
.output-card,
.action-card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.card-title {
  margin: 0;
  padding: 16px 20px;
  font-size: 15px;
  font-weight: 600;
  color: #374151;
  background: #f9fafb;
  border-bottom: 1px solid #f3f4f6;
}

.action-card {
  padding: 20px;
}

.start-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 16px 32px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  color: white;
  cursor: pointer;
  transition: all 0.25s ease;
  box-shadow: 0 4px 14px rgba(102, 126, 234, 0.4);
}

.start-btn:hover:not(.start-btn-disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
}

.start-btn-disabled {
  background: #d1d5db;
  box-shadow: none;
  cursor: not-allowed;
}

.start-icon {
  font-size: 14px;
}

.action-hint {
  margin: 12px 0 0;
  font-size: 13px;
  color: #9ca3af;
  text-align: center;
}
</style>
