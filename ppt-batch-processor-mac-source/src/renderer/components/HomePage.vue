<template>
  <div class="home-page">
    <!-- 顶部 Hero 区域 -->
    <div class="hero-section">
      <div class="hero-content">
        <div class="title-row">
          <div class="logo-container">
            <img src="/icon.svg" alt="Logo" class="app-logo" />
          </div>
          <h1 class="app-title">{{ t('home.heroTitle') }}</h1>
        </div>
        <p class="app-subtitle">{{ t('home.heroSubtitle') }}</p>
        <div class="hero-stats">
          <div class="stat-item">
            <span class="stat-number">8+</span>
            <span class="stat-label">{{ t('home.heroFeatureCore') }}</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-item">
            <span class="stat-number">50+</span>
            <span class="stat-label">{{ t('home.heroFeatureOptions') }}</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-item">
            <span class="stat-number">100%</span>
            <span class="stat-label">{{ t('home.heroFeatureLocal') }}</span>
          </div>
        </div>
      </div>
      <div class="hero-decoration">
        <div class="decoration-circle c1"></div>
        <div class="decoration-circle c2"></div>
        <div class="decoration-circle c3"></div>
      </div>
    </div>

    <!-- 功能卡片区域 -->
    <div class="features-section">
      <div class="features-grid">
        <div
          v-for="feature in features"
          :key="feature.id"
          class="feature-card"
          :class="[`card-${feature.color}`]"
          @click="navigateToFeature(feature)"
        >
          <div class="card-icon">
            <el-icon :size="32">
              <component :is="feature.icon" />
            </el-icon>
          </div>
          <div class="card-content">
            <h3 class="card-title">{{ feature.name }}</h3>
            <p class="card-desc">{{ feature.description }}</p>
          </div>
          <div class="card-arrow">
            <el-icon><ArrowRight /></el-icon>
          </div>
          <div class="card-glow"></div>
        </div>
      </div>
    </div>

    <!-- 底部操作区域 -->
    <div class="actions-section">
      <div class="action-buttons">
        <button class="action-btn feedback-btn" @click="openFeedback">
          <el-icon><ChatDotRound /></el-icon>
          <span>{{ t('home.feedback') }}</span>
        </button>
        <button class="action-btn custom-btn" @click="openCustom">
          <el-icon><Brush /></el-icon>
          <span>{{ t('home.customization') }}</span>
        </button>
      </div>
      <p class="version-info">{{ t('home.version', { version }) }}</p>
    </div>

    <!-- 软件定制对话框 -->
    <el-dialog
      v-model="showCustom"
      :title="t('home.customization')"
      width="500px"
      :close-on-click-modal="false"
      class="custom-dialog"
    >
      <div class="dialog-content">
        <div class="custom-icon">
          <el-icon :size="48" color="#3b82f6"><BrushFilled /></el-icon>
        </div>
        <p class="custom-text">{{ t('home.customizationIntro') }}</p>
        <div class="custom-features">
          <div class="custom-feature-item">
            <el-icon color="#10b981"><Check /></el-icon>
            <span>{{ t('home.customization.privateDeployment') }}</span>
          </div>
          <div class="custom-feature-item">
            <el-icon color="#10b981"><Check /></el-icon>
            <span>{{ t('home.customization.customDev') }}</span>
          </div>
          <div class="custom-feature-item">
            <el-icon color="#10b981"><Check /></el-icon>
            <span>{{ t('home.customization.apiIntegration') }}</span>
          </div>
          <div class="custom-feature-item">
            <el-icon color="#10b981"><Check /></el-icon>
            <span>{{ t('home.customization.techSupport') }}</span>
          </div>
        </div>
        <el-input
          v-model="customContent"
          type="textarea"
          :rows="4"
          :placeholder="t('home.customization.placeholder')"
          class="custom-input"
        />
      </div>
      <template #footer>
        <el-button @click="showCustom = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" @click="submitCustom" :disabled="!customContent.trim()">
          {{ t('home.customization.submit') }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAppStore } from '../store/app'
import type { TaskCategory, TaskType } from '../../shared/types'
import {
  Document,
  Refresh,
  Notebook,
  Stamp,
  Link,
  Files,
  Download,
  Setting,
  ArrowRight,
  ChatDotRound,
  Brush,
  BrushFilled,
  Check,
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useI18n } from '../i18n'

const store = useAppStore()
const { t } = useI18n()
const version = ref('1.0.0')

const showFeedback = ref(false)
const showCustom = ref(false)
const customContent = ref('')

const FEEDBACK_API_URL = 'https://api-web.kunqiongai.com/soft_desktop/get_feedback_url'
const CUSTOM_API_URL = 'https://api-web.kunqiongai.com/soft_desktop/get_custom_url'
const SOFTWARE_NUMBER = '10036'

interface Feature {
  id: TaskCategory
  name: string
  description: string
  icon: any
  color: 'blue' | 'green' | 'orange' | 'purple' | 'red' | 'cyan' | 'indigo' | 'pink'
}

const features = computed<Feature[]>(() => [
  {
    id: 'content',
    name: t('category.content'),
    description: t('homeCard.content.description'),
    icon: Document,
    color: 'blue',
  },
  {
    id: 'conversion',
    name: t('category.conversion'),
    description: t('homeCard.conversion.description'),
    icon: Refresh,
    color: 'green',
  },
  {
    id: 'header-footer',
    name: t('category.headerFooter'),
    description: t('homeCard.headerFooter.description'),
    icon: Notebook,
    color: 'orange',
  },
  {
    id: 'watermark',
    name: t('category.watermark'),
    description: t('homeCard.watermark.description'),
    icon: Stamp,
    color: 'purple',
  },
  {
    id: 'merge-split',
    name: t('category.mergeSplit'),
    description: t('homeCard.mergeSplit.description'),
    icon: Link,
    color: 'red',
  },
  {
    id: 'page',
    name: t('category.page'),
    description: t('homeCard.page.description'),
    icon: Files,
    color: 'cyan',
  },
  {
    id: 'extraction',
    name: t('category.extraction'),
    description: t('homeCard.extraction.description'),
    icon: Download,
    color: 'indigo',
  },
  {
    id: 'properties',
    name: t('category.properties'),
    description: t('homeCard.properties.description'),
    icon: Setting,
    color: 'pink',
  },
])

function navigateToFeature(feature: Feature) {
  store.setTaskCategory(feature.id)
  store.showHomePage = false
}

async function openFeedback() {
  try {
    console.log('开始调用反馈API:', FEEDBACK_API_URL)
    const response = await fetch(FEEDBACK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        soft_number: SOFTWARE_NUMBER,
      }),
    })

    console.log('API响应状态:', response.status, response.statusText)

    if (!response.ok) {
      throw new Error(`HTTP错误: ${response.status}`)
    }

    const data = await response.json()
    console.log('API响应数据:', data)

    if (data.code === 1 && data.data?.url) {
      console.log('打开反馈页面:', data.data.url)
      const openResult = await window.electronAPI.invoke('open-external', data.data.url)
      if (!openResult?.success) {
        throw new Error(openResult?.error || '打开反馈页面失败')
      }
    } else {
      console.error('API返回错误:', data)
      ElMessage.error(t('home.customization.feedbackLinkFailed'))
    }
  } catch (error: any) {
    console.error('反馈API调用失败:', error)
    console.error('错误详情:', error.message)
    ElMessage.error(
      t('home.customization.feedbackLinkFailedWithMessage', {
        message: error.message || t('home.customization.networkError'),
      })
    )
  }
}

async function openCustom() {
  try {
    console.log('开始调用定制API:', CUSTOM_API_URL)
    const response = await fetch(CUSTOM_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        soft_number: SOFTWARE_NUMBER,
      }),
    })

    console.log('API响应状态:', response.status, response.statusText)

    if (!response.ok) {
      throw new Error(`HTTP错误: ${response.status}`)
    }

    const data = await response.json()
    console.log('API响应数据:', data)

    if (data.code === 1 && data.data?.url) {
      console.log('打开定制页面:', data.data.url)
      const openResult = await window.electronAPI.invoke('open-external', data.data.url)
      if (!openResult?.success) {
        throw new Error(openResult?.error || '打开定制页面失败')
      }
    } else {
      console.error('API返回错误:', data)
      ElMessage.error(t('home.customization.customLinkFailed'))
    }
  } catch (error: any) {
    console.error('定制API调用失败:', error)
    console.error('错误详情:', error.message)
    ElMessage.error(
      t('home.customization.customLinkFailedWithMessage', {
        message: error.message || t('home.customization.networkError'),
      })
    )
  }
}

function submitCustom() {
  ElMessage.success(t('home.customization.submitted'))
  customContent.value = ''
  showCustom.value = false
}
</script>

<style scoped>
.home-page {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 50%, #e2e8f0 100%);
  overflow: hidden;
}

/* Hero Section */
.hero-section {
  position: relative;
  padding: 20px 40px 16px;
  text-align: center;
  overflow: hidden;
  flex-shrink: 0;
}

.hero-content {
  position: relative;
  z-index: 2;
}

.title-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-bottom: 8px;
}

.logo-container {
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.app-logo {
  width: 36px;
  height: 36px;
  object-fit: contain;
  filter: drop-shadow(0 2px 8px rgba(59, 130, 246, 0.25));
}

.app-title {
  font-size: 24px;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 6px 0;
  background: linear-gradient(135deg, #1e293b 0%, #475569 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.app-subtitle {
  font-size: 13px;
  color: #64748b;
  margin: 0 0 12px 0;
}

.hero-stats {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.stat-number {
  font-size: 22px;
  font-weight: 700;
  color: #3b82f6;
}

.stat-label {
  font-size: 13px;
  color: #94a3b8;
}

.stat-divider {
  width: 1px;
  height: 24px;
  background: #cbd5e1;
}

/* Decoration */
.hero-decoration {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  overflow: hidden;
}

.decoration-circle {
  position: absolute;
  border-radius: 50%;
  opacity: 0.4;
}

.c1 {
  width: 300px;
  height: 300px;
  background: linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%);
  top: -100px;
  right: -80px;
  filter: blur(60px);
}

.c2 {
  width: 200px;
  height: 200px;
  background: linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%);
  bottom: -60px;
  left: -40px;
  filter: blur(40px);
}

.c3 {
  width: 150px;
  height: 150px;
  background: linear-gradient(135deg, #10b981 0%, #34d399 100%);
  top: 50%;
  left: 60%;
  filter: blur(50px);
  opacity: 0.3;
}

/* Features Section */
.features-section {
  flex: 1;
  padding: 16px 40px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 0;
}

.section-header {
  text-align: center;
  margin-bottom: 16px;
  flex-shrink: 0;
}

.section-title {
  font-size: 20px;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 8px 0;
}

.section-desc {
  font-size: 14px;
  color: #64748b;
  margin: 0;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-template-rows: repeat(2, 1fr);
  gap: 16px;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

.feature-card {
  position: relative;
  background: white;
  border-radius: 12px;
  padding: 16px 12px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid #e2e8f0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  min-height: 0;
}

.feature-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.08);
}

.card-glow {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  opacity: 0;
  transition: opacity 0.3s;
}

.feature-card:hover .card-glow {
  opacity: 1;
}

.card-blue .card-icon {
  color: #3b82f6;
  background: #eff6ff;
}
.card-blue .card-glow {
  background: linear-gradient(90deg, #3b82f6, #60a5fa);
}
.card-blue:hover {
  border-color: #3b82f6;
}

.card-green .card-icon {
  color: #10b981;
  background: #ecfdf5;
}
.card-green .card-glow {
  background: linear-gradient(90deg, #10b981, #34d399);
}
.card-green:hover {
  border-color: #10b981;
}

.card-orange .card-icon {
  color: #f59e0b;
  background: #fffbeb;
}
.card-orange .card-glow {
  background: linear-gradient(90deg, #f59e0b, #fbbf24);
}
.card-orange:hover {
  border-color: #f59e0b;
}

.card-purple .card-icon {
  color: #8b5cf6;
  background: #f5f3ff;
}
.card-purple .card-glow {
  background: linear-gradient(90deg, #8b5cf6, #a78bfa);
}
.card-purple:hover {
  border-color: #8b5cf6;
}

.card-red .card-icon {
  color: #ef4444;
  background: #fef2f2;
}
.card-red .card-glow {
  background: linear-gradient(90deg, #ef4444, #f87171);
}
.card-red:hover {
  border-color: #ef4444;
}

.card-cyan .card-icon {
  color: #06b6d4;
  background: #ecfeff;
}
.card-cyan .card-glow {
  background: linear-gradient(90deg, #06b6d4, #22d3ee);
}
.card-cyan:hover {
  border-color: #06b6d4;
}

.card-indigo .card-icon {
  color: #6366f1;
  background: #eef2ff;
}
.card-indigo .card-glow {
  background: linear-gradient(90deg, #6366f1, #818cf8);
}
.card-indigo:hover {
  border-color: #6366f1;
}

.card-pink .card-icon {
  color: #ec4899;
  background: #fdf2f8;
}
.card-pink .card-glow {
  background: linear-gradient(90deg, #ec4899, #f472b6);
}
.card-pink:hover {
  border-color: #ec4899;
}

.card-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 10px;
  transition: all 0.3s;
}

.feature-card:hover .card-icon {
  transform: scale(1.1);
}

.card-content {
  flex: 1;
}

.card-title {
  font-size: 15px;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 6px 0;
}

.card-desc {
  font-size: 12px;
  color: #64748b;
  line-height: 1.4;
  margin: 0;
}

.card-arrow {
  margin-top: 10px;
  color: #cbd5e1;
  transition: all 0.3s;
}

.feature-card:hover .card-arrow {
  color: #3b82f6;
  transform: translateX(4px);
}

/* Actions Section */
.actions-section {
  padding: 12px 40px 16px;
  text-align: center;
  border-top: 1px solid #e2e8f0;
  background: white;
  flex-shrink: 0;
}

.action-buttons {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-bottom: 12px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.feedback-btn {
  background: #fef3c7;
  color: #d97706;
}

.feedback-btn:hover {
  background: #fde68a;
  transform: translateY(-2px);
}

.custom-btn {
  background: #dbeafe;
  color: #2563eb;
}

.custom-btn:hover {
  background: #bfdbfe;
  transform: translateY(-2px);
}

.version-info {
  font-size: 11px;
  color: #94a3b8;
  margin: 0;
}

/* Dialog Styles */
.dialog-content {
  text-align: center;
  padding: 8px;
}

.feedback-icon,
.custom-icon {
  margin-bottom: 16px;
}

.feedback-text,
.custom-text {
  font-size: 15px;
  color: #475569;
  margin: 0 0 20px 0;
}

.feedback-channels,
.custom-features {
  text-align: left;
  background: #f8fafc;
  border-radius: 12px;
  padding: 16px 20px;
  margin-bottom: 20px;
}

.channel-item,
.custom-feature-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  font-size: 14px;
  color: #475569;
}

.custom-feature-item {
  color: #334155;
  font-weight: 500;
}

.feedback-input,
.custom-input {
  margin-top: 8px;
}

:deep(.feedback-dialog .el-dialog__header),
:deep(.custom-dialog .el-dialog__header) {
  text-align: center;
  padding-bottom: 0;
}

:deep(.feedback-dialog .el-dialog__title),
:deep(.custom-dialog .el-dialog__title) {
  font-weight: 600;
  font-size: 18px;
}

/* Scrollbar - hidden */
.home-page::-webkit-scrollbar {
  display: none;
}

.home-page {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

/* Responsive */
@media (max-width: 900px) {
  .features-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .features-grid {
    grid-template-columns: 1fr;
  }

  .hero-stats {
    flex-direction: column;
    gap: 16px;
  }

  .stat-divider {
    display: none;
  }

  .action-buttons {
    flex-direction: column;
    align-items: center;
  }
}
</style>
