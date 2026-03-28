<template>
  <div class="progress-view">
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
        <div class="progress-info">
          <div class="progress-status">
            <span class="status-icon">{{ isProcessing ? '⚡' : '✅' }}</span>
            <span class="status-text">{{ statusText }}</span>
          </div>
          <div class="progress-percent">{{ isProcessing ? progress?.percentage || 0 : 100 }}%</div>
        </div>

        <div class="progress-bar-wrap">
          <div class="progress-bar">
            <div
              class="progress-fill"
              :style="{ width: (isProcessing ? progress?.percentage || 0 : 100) + '%' }"
            ></div>
          </div>
          <div class="progress-meta-row">
            <span v-if="detailedProgress" class="progress-meta">
              {{
                t('{completed} / {total} 文件', {
                  completed: detailedProgress.processedFiles,
                  total: detailedProgress.totalFiles,
                })
              }}
            </span>
            <span v-if="detailedProgress?.filesPerMinute" class="progress-speed">
              {{ t('{value} 文件/分钟', { value: detailedProgress.filesPerMinute }) }}
            </span>
          </div>
        </div>

        <div v-if="detailedProgress && isProcessing" class="detailed-info">
          <div class="info-row">
            <span class="info-label">{{ t('已用时间:') }}</span>
            <span class="info-value">{{ formattedElapsedTime }}</span>
          </div>
          <div v-if="detailedProgress.estimatedTimeRemaining" class="info-row">
            <span class="info-label">{{ t('预计剩余:') }}</span>
            <span class="info-value">{{ formattedEstimatedTime }}</span>
          </div>
          <div v-if="detailedProgress.currentFile" class="current-file-info">
            <span class="info-label">{{ t('当前文件:') }}</span>
            <span class="info-value file-name">{{ detailedProgress.currentFile.fileName }}</span>
            <div v-if="detailedProgress.currentFile.progress > 0" class="file-progress">
              <div class="file-progress-bar">
                <div
                  class="file-progress-fill"
                  :style="{ width: detailedProgress.currentFile.progress + '%' }"
                ></div>
              </div>
              <span class="file-progress-text">{{
                translateRendererMessage(
                  detailedProgress.currentFile.currentOperation,
                  detailedProgress.currentFile.currentOperationKey,
                  detailedProgress.currentFile.currentOperationParams
                )
              }}</span>
            </div>
          </div>
        </div>

        <Transition name="slide">
          <div v-if="!isProcessing && hasProcessed" class="done-message">
            <span class="done-icon">📁</span>
            <span>{{ t('请在输出目录查看结果') }}</span>
          </div>
        </Transition>

        <button v-if="isProcessing" type="button" class="cancel-btn" @click="cancelTask">
          ⏹️ {{ t('取消任务') }}
        </button>
      </div>
    </Transition>

    <Transition name="slide">
      <div v-if="lastError" class="error-section">
        <div class="error-header">
          <span class="error-icon">⚠️</span>
          <span class="error-title">{{ lastError.userMessage }}</span>
        </div>
        <p class="error-message">{{ lastError.message }}</p>
        <p v-if="lastError.suggestion" class="error-suggestion">{{ lastError.suggestion }}</p>
        <div class="error-actions">
          <button v-if="lastError.retryable" class="retry-btn" @click="retryTask">
            🔄 {{ t('重试') }}
          </button>
          <button class="dismiss-btn" @click="dismissError">✕ {{ t('关闭') }}</button>
        </div>
      </div>
    </Transition>

    <Transition name="slide">
      <div v-if="validationWarnings.length > 0" class="warnings-section">
        <div class="warnings-header">
          <span class="warning-icon">⚠️</span>
          <span>{{ t('文件警告') }}</span>
        </div>
        <div class="warnings-list">
          <div v-for="(item, index) in validationWarnings" :key="index" class="warning-item">
            <span class="warning-file">{{ item.file }}</span>
            <span v-for="(w, i) in item.warnings" :key="i" class="warning-text">{{
              translateRendererMessage(w.message, w.messageKey, w.messageParams)
            }}</span>
          </div>
        </div>
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
import { useI18n } from '../i18n'
import { translateMessage } from '../utils/translate-message'
import type { ProcessResult } from '../../shared/types'

const store = useAppStore()
const { t } = useI18n()

const isProcessing = computed(() => store.isProcessing)
const progress = computed(() => store.progress)
const detailedProgress = computed(() => store.detailedProgress)
const results = computed(() => store.results)
const hasProcessed = computed(() => results.value.length > 0 || progress.value !== null)
const lastError = computed(() => store.lastError)
const validationWarnings = computed(() => store.validationWarnings)

const successCount = computed(() => results.value.filter((r) => r.status === 'success').length)
const errorCount = computed(() => results.value.filter((r) => r.status === 'error').length)

const statusText = computed(() => {
  if (!isProcessing.value) return t('处理完成')
  if (detailedProgress.value?.currentFile) {
    return (
      detailedProgress.value.currentFile.currentOperation ||
      detailedProgress.value.currentFile.fileName
    )
  }
  return progress.value?.currentFile || t('准备中...')
})

const formattedElapsedTime = computed(() => store.formattedElapsedTime)
const formattedEstimatedTime = computed(() => store.formattedEstimatedTime)

function cancelTask() {
  store.cancelProcessing()
}

function retryTask() {
  store.clearError()
}

function dismissError() {
  store.clearError()
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
.progress-view {
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
  padding: 20px;
  background: linear-gradient(135deg, #f0f4ff 0%, #e8ecff 100%);
  border: 1px solid #c7d2fe;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.progress-section-done {
  background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
  border-color: #6ee7b7;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.progress-status {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-icon {
  font-size: 18px;
}

.status-text {
  font-size: 14px;
  color: #374151;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 180px;
}

.progress-percent {
  font-size: 20px;
  font-weight: 700;
  color: #667eea;
  font-family: 'SF Mono', Monaco, monospace;
}

.progress-section-done .progress-percent {
  color: #10b981;
}

.progress-bar-wrap {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.progress-bar {
  height: 8px;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
  border-radius: 4px;
  transition: width 0.3s ease;
  position: relative;
}

.progress-fill::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.3) 50%,
    transparent 100%
  );
  animation: shimmer 2s infinite;
}

.progress-section-done .progress-fill {
  background: linear-gradient(90deg, #10b981 0%, #059669 100%);
}

.progress-section-done .progress-fill::after {
  animation: none;
}

@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

.progress-meta-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.progress-meta {
  font-size: 12px;
  color: #6b7280;
}

.progress-speed {
  font-size: 12px;
  color: #667eea;
  font-weight: 500;
}

.detailed-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 8px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
}

.info-label {
  color: #6b7280;
}

.info-value {
  color: #374151;
  font-weight: 500;
}

.info-value.file-name {
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 12px;
}

.current-file-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.file-progress {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.file-progress-bar {
  height: 4px;
  background: rgba(102, 126, 234, 0.2);
  border-radius: 2px;
  overflow: hidden;
}

.file-progress-fill {
  height: 100%;
  background: #667eea;
  border-radius: 2px;
  transition: width 0.2s ease;
}

.file-progress-text {
  font-size: 11px;
  color: #9ca3af;
}

.done-message {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: white;
  border: 1px solid #6ee7b7;
  border-radius: 8px;
  font-size: 14px;
  color: #059669;
}

.done-icon {
  font-size: 18px;
}

.cancel-btn {
  padding: 12px 20px;
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s ease;
}

.cancel-btn:hover {
  background: #f9fafb;
  border-color: #9ca3af;
}

.error-section {
  padding: 16px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.error-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.error-icon {
  font-size: 18px;
}

.error-title {
  font-size: 15px;
  font-weight: 600;
  color: #dc2626;
}

.error-message {
  margin: 0;
  font-size: 13px;
  color: #7f1d1d;
}

.error-suggestion {
  margin: 0;
  font-size: 13px;
  color: #6b7280;
  font-style: italic;
}

.error-actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

.retry-btn {
  padding: 8px 16px;
  background: #dc2626;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s ease;
}

.retry-btn:hover {
  background: #b91c1c;
}

.dismiss-btn {
  padding: 8px 16px;
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 13px;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s ease;
}

.dismiss-btn:hover {
  background: #f9fafb;
}

.warnings-section {
  padding: 16px;
  background: #fffbeb;
  border: 1px solid #fcd34d;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.warnings-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #92400e;
}

.warning-icon {
  font-size: 16px;
}

.warnings-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.warning-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 6px;
}

.warning-file {
  font-size: 13px;
  font-weight: 500;
  color: #78350f;
}

.warning-text {
  font-size: 12px;
  color: #92400e;
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
  background: #d1fae5;
  color: #059669;
}

.badge-error {
  background: #fee2e2;
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
  background: #fef2f2;
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
