<template>
  <div class="progress-view-enhanced">
    <div class="view-header">
      <h3 class="view-title">{{ t('处理进度') }}</h3>
    </div>

    <div v-if="!isProcessing && !hasProcessed" class="empty-state">
      <div class="empty-icon">⏳</div>
      <p class="empty-text">{{ t('等待开始处理...') }}</p>
    </div>

    <Transition name="fade">
      <div
        v-if="isProcessing || hasProcessed"
        class="progress-section"
        :class="{ 'progress-section-done': !isProcessing && hasProcessed }"
      >
        <div class="progress-ring-container">
          <svg class="progress-ring" viewBox="0 0 120 120">
            <circle class="progress-ring-bg" cx="60" cy="60" r="52" fill="none" stroke-width="8" />
            <circle
              class="progress-ring-fill"
              cx="60"
              cy="60"
              r="52"
              fill="none"
              stroke-width="8"
              :stroke-dasharray="circumference"
              :stroke-dashoffset="offset"
              :class="{ 'animate-pulse': isProcessing }"
            />
          </svg>
          <div class="progress-ring-content">
            <span class="progress-percent">{{ displayPercentage }}%</span>
            <span class="progress-label">{{ isProcessing ? t('处理中') : t('已完成') }}</span>
          </div>
        </div>

        <div class="progress-details">
          <div class="detail-row">
            <span class="detail-label">{{ t('当前文件') }}</span>
            <span class="detail-value current-file">{{ currentFileName }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">{{ t('文件进度') }}</span>
            <span class="detail-value">
              <span class="highlight">{{ progress?.completedFiles || 0 }}</span>
              <span class="separator">/</span>
              <span>{{ progress?.totalFiles || 0 }}</span>
            </span>
          </div>
          <div class="detail-row">
            <span class="detail-label">{{ t('已用时间') }}</span>
            <span class="detail-value">{{ formattedElapsedTime }}</span>
          </div>
          <div v-if="isProcessing && estimatedTimeRemaining > 0" class="detail-row">
            <span class="detail-label">{{ t('预计剩余') }}</span>
            <span class="detail-value estimate">{{ formattedEstimatedTime }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">{{ t('处理速度') }}</span>
            <span class="detail-value">{{ processingSpeed }}</span>
          </div>
        </div>

        <Transition name="slide">
          <div v-if="!isProcessing && hasProcessed" class="done-message">
            <div class="done-icon-wrapper">
              <svg class="checkmark" viewBox="0 0 52 52">
                <circle class="checkmark-circle" cx="26" cy="26" r="24" fill="none" />
                <path class="checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
              </svg>
            </div>
            <div class="done-text">
              <span class="done-title">{{ t('处理完成！') }}</span>
              <span class="done-subtitle">{{
                t('共处理 {count} 个文件，用时 {time}', {
                  count: progress?.totalFiles || 0,
                  time: formattedElapsedTime,
                })
              }}</span>
            </div>
          </div>
        </Transition>

        <button v-if="isProcessing" type="button" class="cancel-btn" @click="cancelTask">
          <el-icon><VideoPause /></el-icon>
          {{ t('取消任务') }}
        </button>
      </div>
    </Transition>

    <Transition name="slide">
      <div v-if="results.length > 0" class="results-section">
        <div class="results-header">
          <h4>{{ t('处理结果') }}</h4>
          <div class="results-badges">
            <span class="badge badge-success">{{
              t('{count} 成功', { count: successCount })
            }}</span>
            <span v-if="errorCount > 0" class="badge badge-error">{{
              t('{count} 失败', { count: errorCount })
            }}</span>
          </div>
        </div>

        <div class="results-list">
          <TransitionGroup name="result-list">
            <div
              v-for="(result, index) in results"
              :key="index"
              class="result-item"
              :class="`result-${result.status}`"
            >
              <div class="result-icon">{{ result.status === 'success' ? '✅' : '❌' }}</div>
              <div class="result-content">
                <div class="result-file">{{ getResultInputLabel(result) }}</div>
                <div class="result-msg">
                  {{
                    result.status === 'success'
                      ? t('处理成功')
                      : translateRendererMessage(result.error, result.errorKey, result.errorParams)
                  }}
                </div>
              </div>
            </div>
          </TransitionGroup>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '../store/app'
import { VideoPause } from '@element-plus/icons-vue'
import { useI18n } from '../i18n'
import { translateMessage } from '../utils/translate-message'
import type { ProcessResult } from '../../shared/types'

const store = useAppStore()
const { t } = useI18n()

const isProcessing = computed(() => store.isProcessing)
const progress = computed(() => store.progress)
const results = computed(() => store.results)
const hasProcessed = computed(() => results.value.length > 0 || progress.value !== null)

const successCount = computed(() => results.value.filter((r) => r.status === 'success').length)
const errorCount = computed(() => results.value.filter((r) => r.status === 'error').length)

const circumference = 2 * Math.PI * 52
const displayPercentage = computed(() => {
  if (!isProcessing.value && hasProcessed.value) return 100
  return Math.round(progress.value?.percentage || 0)
})
const offset = computed(() => {
  const percent = displayPercentage.value / 100
  return circumference * (1 - percent)
})

const currentFileName = computed(() => {
  const name = progress.value?.currentFile
  if (!name) return isProcessing.value ? t('准备中...') : t('已完成')
  return name.split(/[\\/]/).pop() || name
})

const estimatedTimeRemaining = computed(() => store.detailedProgress?.estimatedTimeRemaining || 0)

const formattedElapsedTime = computed(() => store.formattedElapsedTime)
const formattedEstimatedTime = computed(() => store.formattedEstimatedTime)

const processingSpeed = computed(() => {
  if (!store.detailedProgress?.elapsedTime || !progress.value) return t('计算中...')
  const filesPerMs = progress.value.completedFiles / store.detailedProgress.elapsedTime
  const filesPerMinute = filesPerMs * 60000
  if (filesPerMinute >= 1) {
    return t('{value} 文件/分钟', { value: filesPerMinute.toFixed(1) })
  }
  const filesPerSecond = filesPerMs * 1000
  return t('{value} 文件/秒', { value: filesPerSecond.toFixed(2) })
})

function cancelTask() {
  store.cancelProcessing()
}

function getFileName(path: string | undefined): string {
  if (!path) return t('未知文件')
  return path.split(/[\\/]/).pop() || path
}

function getResultInputLabel(result: ProcessResult): string {
  if (result.inputFileKey) {
    return translateRendererMessage(result.inputFile, result.inputFileKey, result.inputFileParams)
  }
  return getFileName(result.inputFile)
}

function translateRendererMessage(
  message?: string,
  messageKey?: string,
  messageParams?: Record<string, string | number>
) {
  return translateMessage(message, messageKey, messageParams)
}
</script>

<style scoped>
.progress-view-enhanced {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.view-header {
  padding-bottom: 16px;
  border-bottom: 1px solid #f3f4f6;
}

.view-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
  opacity: 0.6;
}

.empty-text {
  margin: 0;
  font-size: 15px;
  color: #9ca3af;
}

.progress-section {
  padding: 24px;
  background: linear-gradient(135deg, #f0f4ff 0%, #e8ecff 100%);
  border: 1px solid #c7d2fe;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.progress-section-done {
  background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
  border-color: #6ee7b7;
}

.progress-ring-container {
  position: relative;
  width: 140px;
  height: 140px;
}

.progress-ring {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.progress-ring-bg {
  stroke: rgba(102, 126, 234, 0.15);
}

.progress-section-done .progress-ring-bg {
  stroke: rgba(16, 185, 129, 0.15);
}

.progress-ring-fill {
  stroke: #667eea;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.3s ease;
}

.progress-section-done .progress-ring-fill {
  stroke: #10b981;
}

.progress-ring-fill.animate-pulse {
  animation: ring-pulse 2s ease-in-out infinite;
}

@keyframes ring-pulse {
  0%,
  100% {
    filter: drop-shadow(0 0 4px rgba(102, 126, 234, 0.4));
  }
  50% {
    filter: drop-shadow(0 0 12px rgba(102, 126, 234, 0.8));
  }
}

.progress-ring-content {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
}

.progress-percent {
  display: block;
  font-size: 28px;
  font-weight: 700;
  color: #667eea;
  font-family: 'SF Mono', Monaco, monospace;
  line-height: 1;
}

.progress-section-done .progress-percent {
  color: #10b981;
}

.progress-label {
  display: block;
  font-size: 12px;
  color: #6b7280;
  margin-top: 4px;
}

.progress-details {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 8px;
}

.detail-label {
  font-size: 13px;
  color: #6b7280;
}

.detail-value {
  font-size: 14px;
  color: #374151;
  font-weight: 500;
}

.detail-value.current-file {
  max-width: 150px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.detail-value .highlight {
  color: #667eea;
  font-weight: 700;
}

.progress-section-done .detail-value .highlight {
  color: #10b981;
}

.detail-value .separator {
  color: #9ca3af;
  margin: 0 4px;
}

.detail-value.estimate {
  color: #f59e0b;
}

.done-message {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  background: white;
  border: 1px solid #6ee7b7;
  border-radius: 12px;
  width: 100%;
}

.done-icon-wrapper {
  width: 48px;
  height: 48px;
  flex-shrink: 0;
}

.checkmark {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  stroke-width: 2;
  stroke: #10b981;
  stroke-miterlimit: 10;
  animation:
    fill 0.4s ease-in-out 0.4s forwards,
    scale 0.3s ease-in-out 0.9s both;
}

.checkmark-circle {
  stroke-dasharray: 166;
  stroke-dashoffset: 166;
  stroke-width: 2;
  stroke-miterlimit: 10;
  stroke: #10b981;
  fill: none;
  animation: stroke 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards;
}

.checkmark-check {
  transform-origin: 50% 50%;
  stroke-dasharray: 48;
  stroke-dashoffset: 48;
  stroke: #10b981;
  stroke-width: 3;
  animation: stroke 0.3s cubic-bezier(0.65, 0, 0.45, 1) 0.8s forwards;
}

@keyframes stroke {
  100% {
    stroke-dashoffset: 0;
  }
}

@keyframes scale {
  0%,
  100% {
    transform: none;
  }
  50% {
    transform: scale3d(1.1, 1.1, 1);
  }
}

@keyframes fill {
  100% {
    box-shadow: inset 0px 0px 0px 30px rgba(16, 185, 129, 0.1);
  }
}

.done-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.done-title {
  font-size: 16px;
  font-weight: 600;
  color: #059669;
}

.done-subtitle {
  font-size: 13px;
  color: #6b7280;
}

.cancel-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 24px;
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  font-size: 14px;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s ease;
}

.cancel-btn:hover {
  background: #f9fafb;
  border-color: #9ca3af;
  color: #374151;
}

.results-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.results-header h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.results-badges {
  display: flex;
  gap: 8px;
}

.badge {
  font-size: 11px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 6px;
}

.badge-success {
  background: rgba(16, 185, 129, 0.1);
  color: #059669;
}

.badge-error {
  background: rgba(239, 68, 68, 0.1);
  color: #dc2626;
}

.results-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 300px;
  overflow-y: auto;
}

.result-item {
  display: flex;
  gap: 10px;
  padding: 10px 12px;
  background: #fafafa;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  border-left: 3px solid transparent;
}

.result-success {
  border-left-color: #10b981;
}

.result-error {
  border-left-color: #ef4444;
  background: rgba(239, 68, 68, 0.05);
}

.result-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.result-content {
  flex: 1;
  min-width: 0;
}

.result-file {
  font-size: 13px;
  font-weight: 500;
  color: #1f2937;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.result-msg {
  font-size: 12px;
  color: #6b7280;
  margin-top: 2px;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.result-list-enter-active,
.result-list-leave-active {
  transition: all 0.25s ease;
}

.result-list-enter-from {
  opacity: 0;
  transform: translateX(-10px);
}

.result-list-leave-to {
  opacity: 0;
  transform: translateX(10px);
}
</style>
