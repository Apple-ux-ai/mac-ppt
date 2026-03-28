<template>
  <div class="base-tool-component">
    <div class="main-layout">
      <!-- 左侧：功能配置 -->
      <div class="left-panel">
        <div class="config-section">
          <div class="section-title">
            <el-icon><Setting /></el-icon>
            <span>{{ title }}</span>
          </div>

          <div class="config-form">
            <slot name="config"></slot>
          </div>
        </div>

        <div class="action-section">
          <el-button
            type="primary"
            size="large"
            @click="$emit('execute')"
            :loading="loading"
            :disabled="disabled"
            block
          >
            <el-icon><Tools /></el-icon>
            {{ executeText || t('开始处理') }}
          </el-button>
          <el-button size="large" @click="$emit('reset')" block>
            <el-icon><RefreshLeft /></el-icon>
            {{ t('重置设置') }}
          </el-button>
        </div>

        <div class="progress-section" v-if="showProgress">
          <el-progress :percentage="progress" :status="progressStatus" :stroke-width="20">
            <span class="progress-text">{{ progressText }}</span>
          </el-progress>
        </div>
      </div>

      <!-- 右侧：输入文件和处理结果 -->
      <div class="right-panel">
        <div class="section input-section">
          <div class="section-header">
            <h4>📁 {{ t('输入文件 ({count})', { count: files?.length || 0 }) }}</h4>
          </div>
          <div class="section-content">
            <div v-if="files && files.length > 0" class="file-list">
              <div v-for="(file, index) in files" :key="index" class="file-item">
                <el-icon class="file-icon"><Document /></el-icon>
                <div class="file-info">
                  <div class="file-name">{{ file.name }}</div>
                  <div class="file-size">{{ formatFileSize(file.size) }}</div>
                </div>
                <el-button
                  class="delete-btn"
                  type="danger"
                  :icon="Close"
                  circle
                  size="small"
                  @click.stop="handleDelete(index)"
                  :title="t('删除文件')"
                />
              </div>
            </div>
            <el-empty v-else :description="t('请先上传PPT文档')" :image-size="80" />
          </div>
        </div>

        <div class="section result-section">
          <div class="section-header">
            <h4>✅ {{ t('处理结果 ({count})', { count: results.length }) }}</h4>
            <div class="section-actions" v-if="results.length > 0">
              <el-button size="small" type="primary" @click="$emit('download-all')">
                <el-icon><Download /></el-icon>
                {{ t('下载全部') }}
              </el-button>
            </div>
          </div>
          <div class="section-content">
            <slot name="results" :results="results">
              <div v-if="results.length > 0" class="result-list">
                <div v-for="(result, index) in results" :key="index" class="result-item">
                  <el-icon :class="['result-icon', result.status]">
                    <CircleCheck v-if="result.status === 'success'" />
                    <CircleClose v-else />
                  </el-icon>
                  <div class="result-info">
                    <div class="result-name">{{ result.outputName || result.fileName }}</div>
                    <div class="result-meta">
                      <span class="result-size">{{ result.fileSize }}</span>
                      <span class="result-status">{{
                        result.status === 'success' ? t('处理成功') : t('处理失败')
                      }}</span>
                    </div>
                  </div>
                  <el-button
                    v-if="result.status === 'success'"
                    type="primary"
                    link
                    size="small"
                    @click="$emit('download', result)"
                  >
                    <el-icon><Download /></el-icon>
                    {{ t('下载') }}
                  </el-button>
                </div>
              </div>
              <el-empty v-else :description="t('处理结果将显示在这里')" :image-size="80" />
            </slot>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  Setting,
  Tools,
  RefreshLeft,
  Document,
  Download,
  CircleCheck,
  CircleClose,
  Close,
} from '@element-plus/icons-vue'
import { useI18n } from '../i18n'

interface FileInfo {
  name: string
  size?: number // 改为可选
  path?: string
}

interface ResultInfo {
  status: string
  outputName?: string
  fileName?: string
  fileSize?: string
}

const props = defineProps<{
  title?: string
  files?: FileInfo[]
  loading?: boolean
  disabled?: boolean
  executeText?: string
  showProgress?: boolean
  progress?: number
  progressStatus?: string
  progressText?: string
  results?: ResultInfo[]
  onRemoveFile?: (index: number) => void
}>()

const { t } = useI18n()

const emit = defineEmits([
  'execute',
  'reset',
  'download',
  'download-all',
  'removeFile',
  'remove-file',
])

const handleDelete = (index: number) => {
  if (props.onRemoveFile) {
    props.onRemoveFile(index)
  } else {
    emit('removeFile', index)
    emit('remove-file', index)
  }
}

const formatFileSize = (bytes: number) => {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}
</script>

<style scoped>
.base-tool-component {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f5f5f5;
}

.main-layout {
  flex: 1;
  display: flex;
  gap: 2px;
  background: #e8e8e8;
  overflow: hidden;
  min-height: 600px;
}

.left-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: white;
  min-width: 0;
}

.config-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.section-title {
  padding: 20px 24px 0;
  display: flex;
  align-items: center;
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.section-title .el-icon {
  margin-right: 8px;
}

.config-form {
  padding: 20px 24px;
}

.right-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: #e8e8e8;
  min-width: 0;
}

.section {
  flex: 1;
  background: white;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

.input-section {
  flex: 1;
}

.result-section {
  flex: 1;
}

.section-header {
  padding: 20px 24px;
  border-bottom: 2px solid #f0f0f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #fafafa;
}

.section-header h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.section-actions {
  display: flex;
  gap: 10px;
}

.section-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 20px;
  min-height: 0;
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.section-content::-webkit-scrollbar {
  display: none;
}

.config-section {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 24px;
  border-bottom: 1px solid #f0f0f0;
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.config-section::-webkit-scrollbar {
  display: none;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 600;
  color: #333;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 2px solid #f0f0f0;
}

.action-section {
  padding: 20px 24px;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: white;
}

.progress-section {
  padding: 16px 24px;
  background: white;
}

.progress-text {
  font-size: 13px;
  color: #666;
  margin-left: 10px;
}

.file-list,
.result-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
}

.file-item,
.result-item {
  display: flex;
  align-items: center;
  padding: 16px;
  background: #f9f9f9;
  border-radius: 10px;
  transition: all 0.3s;
  border: 1px solid #f0f0f0;
  position: relative;
  flex-shrink: 0;
}

.file-item:hover {
  background: #f0f5ff;
  border-color: #d0e0ff;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.1);
}

.file-item:hover .delete-btn {
  opacity: 1;
}

.result-item:hover {
  background: #f0f9f0;
  border-color: #d0f0d0;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(103, 194, 58, 0.1);
}

.delete-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  opacity: 0;
  transition: opacity 0.3s;
}

.file-icon {
  font-size: 32px;
  color: #667eea;
  margin-right: 16px;
  flex-shrink: 0;
}

.result-icon {
  font-size: 32px;
  margin-right: 16px;
  flex-shrink: 0;
}

.result-icon.success {
  color: #67c23a;
}

.result-icon.error {
  color: #f56c6c;
}

.file-info,
.result-info {
  flex: 1;
  min-width: 0;
}

.file-name,
.result-name {
  font-size: 16px;
  color: #333;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.5;
}

.file-size {
  font-size: 14px;
  color: #666;
  margin-top: 4px;
}

.result-meta {
  display: flex;
  gap: 16px;
  font-size: 14px;
  margin-top: 4px;
}

.result-size {
  color: #666;
}

.result-status {
  color: #67c23a;
  font-weight: 500;
}

@media (max-width: 900px) {
  .main-layout {
    flex-direction: column;
  }

  .left-panel,
  .right-panel {
    flex: none;
    width: 100%;
  }
}
</style>
