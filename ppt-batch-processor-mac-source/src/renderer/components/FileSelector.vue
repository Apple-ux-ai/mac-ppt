<template>
  <div class="file-selector">
    <div class="selector-header">
      <h3 class="selector-title">{{ t('common.fileSelection') }}</h3>
      <div v-if="hasFiles" class="selector-stats">
        <span class="stat-item">
          <span class="stat-value">{{ fileList.length }}</span>
          <span class="stat-label">{{ t('fileSelector.fileCountUnit') }}</span>
        </span>
        <span class="stat-divider">|</span>
        <span class="stat-item">
          <span class="stat-value">{{ formatSize(totalSize) }}</span>
          <span class="stat-label">{{ t('fileSelector.totalLabel') }}</span>
        </span>
        <button type="button" class="clear-btn" @click="clearFiles">{{ t('common.clear') }}</button>
      </div>
    </div>

    <div
      class="drop-zone"
      :class="{ 'drop-zone-active': isDragging, 'drop-zone-has-files': hasFiles }"
      @click="selectFilesWithElectron"
      @dragover.prevent="handleDragOver"
      @dragleave="handleDragLeave"
      @drop.prevent="handleDrop"
    >
      <div class="drop-zone-content">
        <div class="drop-icon">
          <el-icon :size="40"><component :is="isDragging ? 'Download' : 'Folder'" /></el-icon>
        </div>
        <p class="drop-text">
          {{ isDragging ? t('fileSelector.dropHere') : t('fileSelector.clickOrDragPpt') }}
        </p>
        <small class="drop-hint">{{ t('fileSelector.supportedFormats') }}</small>
      </div>
    </div>

    <Transition name="slide-fade">
      <div v-if="hasFiles" class="file-list">
        <TransitionGroup name="file-list" tag="div" class="files-container">
          <div v-for="file in fileList" :key="file.path" class="file-item">
            <div class="file-icon">
              <el-icon :size="24"><Document /></el-icon>
            </div>
            <div class="file-info">
              <span class="file-name" :title="file.name">{{ file.name }}</span>
              <div class="file-meta">
                <span class="file-size">{{ formatSize(file.size) }}</span>
                <span class="file-format" :class="`format-${file.format}`">{{
                  file.format.toUpperCase()
                }}</span>
              </div>
            </div>
            <button
              type="button"
              class="remove-btn"
              :title="t('fileSelector.removeFile')"
              @click="removeFile(file.path)"
            >
              ×
            </button>
          </div>
        </TransitionGroup>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAppStore } from '../store/app'
import { Folder, Download, Document } from '@element-plus/icons-vue'
import type { FileInfo } from '../../shared/types'
import { useI18n } from '../i18n'

const store = useAppStore()
const { t } = useI18n()

const isDragging = ref(false)

const fileList = computed(() => store.fileList)
const hasFiles = computed(() => store.hasFiles)
const totalSize = computed(() => {
  return fileList.value.reduce((sum, file) => sum + file.size, 0)
})

function handleDragOver(e: DragEvent) {
  isDragging.value = true
}

function handleDragLeave(e: DragEvent) {
  isDragging.value = false
}

async function handleDrop(e: DragEvent) {
  isDragging.value = false

  const files = e.dataTransfer?.files
  if (!files || files.length === 0) return

  const validFiles: FileInfo[] = []

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase()

    if (ext === '.pptx' || ext === '.ppt') {
      validFiles.push({
        name: file.name,
        path: (file as any).path || file.name,
        size: file.size,
        format: ext === '.pptx' ? 'pptx' : 'ppt',
      })
    }
  }

  if (validFiles.length > 0) {
    store.addFiles(validFiles)
  }
}

async function selectFilesWithElectron() {
  try {
    const result = await window.electronAPI.selectFiles()

    const filePaths = result.files || []
    if (filePaths.length === 0) return

    if (result.validationResults) {
      const warnings: Array<{ file: string; warnings: any[] }> = []
      for (const [path, validation] of Object.entries(result.validationResults)) {
        if ((validation as any).warnings && (validation as any).warnings.length > 0) {
          warnings.push({
            file: path.split(/[/\\]/).pop() || path,
            warnings: (validation as any).warnings,
          })
        }
      }
      if (warnings.length > 0) {
        store.setValidationWarnings(warnings)
      }
    }

    const validFiles: FileInfo[] = []

    for (const filePath of filePaths) {
      try {
        const fileName = filePath.split(/[/\\]/).pop() || filePath
        const ext = fileName.substring(fileName.lastIndexOf('.')).toLowerCase()

        const stats = await window.electronAPI.getFileStats(filePath)

        if (!stats) continue

        validFiles.push({
          name: fileName,
          path: filePath,
          size: stats.size,
          format: ext === '.pptx' ? 'pptx' : 'ppt',
        })
      } catch (error) {
        console.error(`处理文件失败: ${filePath}`, error)
      }
    }

    if (validFiles.length > 0) {
      store.addFiles(validFiles)
    }
  } catch (error) {
    console.error('选择文件失败:', error)
    alert(t('fileSelector.selectFailed', { error: String(error) }))
  }
}

function clearFiles() {
  store.clearFiles()
}

function removeFile(path: string) {
  store.removeFile(path)
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}
</script>

<style scoped>
.file-selector {
  background: white;
  border-radius: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.selector-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #f3f4f6;
}

.selector-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
}

.selector-stats {
  display: flex;
  align-items: center;
  gap: 12px;
}

.stat-item {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.stat-value {
  font-size: 16px;
  font-weight: 600;
  color: #667eea;
}

.stat-label {
  font-size: 13px;
  color: #6b7280;
}

.stat-divider {
  color: #e5e7eb;
}

.clear-btn {
  padding: 6px 12px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  font-size: 13px;
  color: #ef4444;
  cursor: pointer;
  transition: all 0.2s ease;
}

.clear-btn:hover {
  background: #fee2e2;
  border-color: #fca5a5;
}

.drop-zone {
  margin: 16px 20px;
  border: 2px dashed #d1d5db;
  border-radius: 12px;
  padding: 24px 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.25s ease;
  background: linear-gradient(135deg, #fafbfc 0%, #f5f7fa 100%);
  flex-shrink: 0;
}

.drop-zone:hover {
  border-color: #a5b4fc;
  background: linear-gradient(135deg, #f0f4ff 0%, #e8ecff 100%);
}

.drop-zone-active {
  border-color: #667eea;
  background: linear-gradient(135deg, #e0e7ff 0%, #d1d5ff 100%);
  transform: scale(1.01);
}

.drop-zone-has-files {
  padding: 16px;
}

.drop-zone-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.drop-icon {
  font-size: 32px;
  line-height: 1;
  transition: transform 0.25s ease;
}

.drop-zone:hover .drop-icon {
  transform: scale(1.1);
}

.drop-text {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}

.drop-hint {
  color: #9ca3af;
  font-size: 12px;
}

.file-list {
  padding: 0 20px 16px;
  display: flex;
  flex-direction: column;
}

.files-container {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: linear-gradient(135deg, #fafbfc 0%, #f5f7fa 100%);
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  transition: all 0.2s ease;
}

.file-item:hover {
  border-color: #c7d2fe;
  background: linear-gradient(135deg, #f0f4ff 0%, #e8ecff 100%);
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.1);
}

.file-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.file-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.file-name {
  font-size: 14px;
  font-weight: 500;
  color: #1f2937;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.file-size {
  font-size: 12px;
  color: #6b7280;
}

.file-format {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  text-transform: uppercase;
}

.format-pptx {
  background: #dbeafe;
  color: #2563eb;
}

.format-ppt {
  background: #fef3c7;
  color: #d97706;
}

.remove-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 6px;
  font-size: 18px;
  color: #9ca3af;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.remove-btn:hover {
  background: #fee2e2;
  color: #ef4444;
}

.slide-fade-enter-active {
  transition: all 0.3s ease;
}

.slide-fade-leave-active {
  transition: all 0.2s ease;
}

.slide-fade-enter-from,
.slide-fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.file-list-enter-active,
.file-list-leave-active {
  transition: all 0.25s ease;
}

.file-list-enter-from {
  opacity: 0;
  transform: translateX(-20px);
}

.file-list-leave-to {
  opacity: 0;
  transform: translateX(20px);
}
</style>
