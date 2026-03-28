<template>
  <div class="task-config">
    <div class="category-tabs">
      <button type="button" class="home-btn" @click="goHome">
        <span class="home-icon">🏠</span>
        <span class="home-text">{{ t('category.home') }}</span>
      </button>
      <div class="tabs-divider"></div>

      <div class="search-box">
        <el-icon class="search-icon"><Search /></el-icon>
        <input
          v-model="searchQuery"
          type="text"
          class="search-input"
          :placeholder="t('common.searchFeatures')"
          @input="handleSearch"
        />
        <Transition name="fade">
          <button
            v-if="searchQuery"
            type="button"
            class="search-clear"
            @click="clearSearch"
            :title="t('common.clear')"
          >
            <el-icon><Close /></el-icon>
          </button>
        </Transition>
      </div>

      <div class="tabs-divider"></div>

      <div class="tabs-scroll">
        <button
          v-for="cat in categories"
          :key="cat.id"
          type="button"
          class="category-tab"
          :class="[`tab-${cat.color}`, { active: selectedCategory === cat.id && !searchQuery }]"
          @click="selectCategory(cat.id)"
        >
          <span class="tab-icon">
            <el-icon :size="16"><component :is="cat.icon" /></el-icon>
          </span>
          <span class="tab-name">{{ cat.name }}</span>
          <span class="tab-count">{{ cat.tasks.length }}</span>
        </button>
      </div>
    </div>

    <div v-if="!selectedTaskType" class="task-grid-container">
      <Transition name="fade" mode="out-in">
        <div :key="selectedCategory + searchQuery" class="task-grid-wrapper">
          <div v-if="searchQuery && filteredTasks.length === 0" class="no-results">
            <el-icon :size="48" color="#9ca3af"><Search /></el-icon>
            <p>{{ t('common.noMatchedFeatures') }}</p>
            <button type="button" class="clear-search-btn" @click="clearSearch">
              {{ t('common.clearSearch') }}
            </button>
          </div>

          <template v-else>
            <div class="task-grid">
              <div
                v-for="task in displayTasks"
                :key="task.type"
                class="task-card"
                :class="[
                  `card-${getTaskCategory(task.type)?.color}`,
                  { 'task-card-hot': task.hot },
                ]"
                @click="selectTask(task)"
                @mouseenter="hoveredTask = task.type"
                @mouseleave="hoveredTask = null"
              >
                <div class="card-header">
                  <div class="card-icon-wrapper">
                    <el-icon :size="24"><component :is="task.icon" /></el-icon>
                  </div>
                  <div class="card-title-row">
                    <h3 class="card-title">{{ task.name }}</h3>
                    <span v-if="task.hot" class="hot-badge">HOT</span>
                  </div>
                  <button
                    type="button"
                    class="favorite-btn"
                    :class="{ active: isFavorite(task.type) }"
                    @click.stop="toggleFavorite(task.type)"
                  >
                    <span>{{ isFavorite(task.type) ? '⭐' : '☆' }}</span>
                  </button>
                </div>
                <div class="card-content">
                  <p class="card-desc">{{ task.description }}</p>
                </div>
                <div class="card-footer">
                  <span class="card-action">{{ t('common.clickToUse') }}</span>
                  <span class="card-arrow">→</span>
                </div>
              </div>
            </div>
          </template>
        </div>
      </Transition>
    </div>

    <Transition name="slide-up">
      <div v-if="selectedTaskType" class="workspace">
        <div class="workspace-header">
          <button type="button" class="back-btn" @click="closeWorkspace">
            <span>←</span>
            <span>{{ t('common.back') }}</span>
          </button>
          <div class="workspace-title">
            <span class="workspace-icon">
              <el-icon :size="24"><component :is="currentTask?.icon" /></el-icon>
            </span>
            <div class="workspace-title-text">
              <h2>{{ currentTask?.name }}</h2>
              <p>{{ currentTask?.description }}</p>
            </div>
          </div>
          <button type="button" class="help-btn" @click="showHelp = true">
            <el-icon><QuestionFilled /></el-icon>
          </button>
        </div>

        <div class="workspace-body">
          <div class="workspace-main">
            <div class="main-scroll-wrapper">
              <div class="config-panel" :class="{ minimized: isConfigMinimized }">
                <div class="panel-header" @click="isConfigMinimized = !isConfigMinimized">
                  <h4 class="panel-title">
                    <el-icon><Setting /></el-icon>
                    {{ t('common.configOptions') }}
                  </h4>
                  <span class="panel-toggle">{{
                    isConfigMinimized ? t('common.expand') : t('common.collapse')
                  }}</span>
                </div>
                <div v-show="!isConfigMinimized" class="config-form">
                  <component
                    :is="currentConfigComponent"
                    v-model="taskOptions"
                    :task-type="selectedTaskType"
                  />
                </div>
              </div>

              <div class="files-panel">
                <FileSelector />
              </div>

              <Transition name="slide-up">
                <div v-if="isProcessing" class="progress-panel">
                  <div class="progress-header">
                    <h4 class="panel-title">
                      <el-icon><DataAnalysis /></el-icon>
                      {{ t('common.processingProgress') }}
                    </h4>
                  </div>
                  <div class="progress-content">
                    <div class="progress-active">
                      <div class="progress-info">
                        <span class="current-file">{{
                          progress?.currentFile || t('common.prepare')
                        }}</span>
                        <span class="progress-percent">{{ progress?.percentage || 0 }}%</span>
                      </div>
                      <div class="progress-bar">
                        <div
                          class="progress-fill"
                          :style="{ width: (progress?.percentage || 0) + '%' }"
                        >
                          <div class="progress-glow"></div>
                        </div>
                      </div>
                      <div class="progress-meta">
                        <span class="progress-count">{{
                          t('common.fileCount', {
                            completed: progress?.completedFiles || 0,
                            total: progress?.totalFiles || 0,
                          })
                        }}</span>
                        <button type="button" class="cancel-btn" @click="cancelProcessing">
                          <span>{{ t('common.cancelTask') }}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </Transition>
            </div>
          </div>

          <div class="workspace-sidebar">
            <div class="output-panel">
              <h4 class="panel-title">
                <el-icon><FolderOpened /></el-icon>
                {{ t('common.outputSettings') }}
              </h4>
              <OutputSettings
                v-model="outputConfig"
                :show-overwrite="true"
                :show-file-name-pattern="true"
              />
            </div>

            <div class="action-panel">
              <button
                type="button"
                class="start-btn"
                :class="{
                  disabled: !canStart,
                  processing: isProcessing,
                  ready: canStart && !isProcessing,
                }"
                :disabled="!canStart || isProcessing"
                @click="startProcessing"
              >
                <span class="btn-icon">{{ isProcessing ? '⏳' : '▶' }}</span>
                <span>{{
                  isProcessing ? t('common.processing') : t('common.startProcessing')
                }}</span>
              </button>
              <div class="action-status">
                <Transition name="fade" mode="out-in">
                  <span v-if="!selectedTaskType" key="no-task" class="status-item">
                    <span class="status-dot pending"></span>
                    {{ t('common.selectFeature') }}
                  </span>
                  <span v-else-if="!hasConfig" key="no-config" class="status-item">
                    <span class="status-dot pending"></span>
                    {{ t('common.completeConfig') }}
                  </span>
                  <span v-else-if="!store.hasFiles" key="no-files" class="status-item">
                    <span class="status-dot pending"></span>
                    {{ t('common.selectFiles') }}
                  </span>
                  <span v-else key="ready" class="status-item ready">
                    <span class="status-dot ready"></span>
                    {{ t('common.readyToStart') }}
                  </span>
                </Transition>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <Transition name="fade">
      <div v-if="showHelp" class="help-modal-overlay" @click="showHelp = false">
        <div class="help-modal" @click.stop>
          <div class="help-modal-header">
            <h3>{{ t('common.featureHelp') }}</h3>
            <button
              type="button"
              class="close-btn"
              @click="showHelp = false"
              :aria-label="t('common.close')"
            >
              ✕
            </button>
          </div>
          <div class="help-modal-body">
            <h4>{{ currentTask?.name }}</h4>
            <p>{{ currentTask?.description }}</p>
            <div class="help-tips">
              <h5>{{ t('common.helpSteps') }}</h5>
              <ol>
                <li>{{ t('common.helpStepConfig') }}</li>
                <li>{{ t('common.helpStepSelectFiles') }}</li>
                <li>{{ t('common.helpStepStart') }}</li>
                <li>{{ t('common.helpStepOutput') }}</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, markRaw, watch, onMounted } from 'vue'
import { useAppStore } from '../store/app'
import FileSelector from './FileSelector.vue'
import { OutputSettings } from './common'
import type { TaskType, OutputConfig } from '../../shared/types'
import {
  TextReplaceConfig,
  ExcelRulesConfig,
  TemplateGenerateConfig,
  ImageReplaceConfig,
  FormatConvertConfig,
  WatermarkConfig,
  SplitMergeConfig,
  PageOperationConfig,
  ExtractionConfig,
  MetadataConfig,
} from './config'
import {
  Edit,
  DocumentCopy,
  Delete,
  Upload,
  Download,
  Picture,
  Link,
  Switch,
  Lock,
  Unlock,
  Refresh,
  Files,
  Grid,
  Document,
  Setting,
  DataAnalysis,
  Operation,
  Stamp,
  Key,
  Notebook,
  Search,
  Close,
  QuestionFilled,
  FolderOpened,
  Clock,
} from '@element-plus/icons-vue'
import type { Component } from 'vue'
import { useI18n } from '../i18n'

const store = useAppStore()
const { t } = useI18n()

interface Task {
  type: TaskType
  name: string
  description: string
  icon: any
  hot?: boolean
}

interface Category {
  id: string
  name: string
  icon: Component
  color: 'blue' | 'green' | 'orange' | 'purple' | 'red' | 'cyan' | 'indigo' | 'pink'
  tasks: Task[]
}

const categories = computed<Category[]>(() => [
  {
    id: 'content',
    name: t('category.content'),
    icon: Document,
    color: 'blue',
    tasks: [
      {
        type: 'text-replace',
        name: t('task.textReplace.title'),
        description: t('task.textReplace.description'),
        icon: Edit,
        hot: true,
      },
      {
        type: 'excel-rules',
        name: t('task.excelRules.title'),
        description: t('task.excelRules.description'),
        icon: Grid,
      },
      {
        type: 'template-generate',
        name: t('task.templateGenerate.title'),
        description: t('task.templateGenerate.description'),
        icon: DocumentCopy,
        hot: true,
      },
      {
        type: 'image-replace',
        name: t('task.imageReplace.title'),
        description: t('task.imageReplace.description'),
        icon: Picture,
        hot: true,
      },
      {
        type: 'delete-blank-pages',
        name: t('task.deleteBlankPages.title'),
        description: t('task.deleteBlankPages.description'),
        icon: Delete,
      },
      {
        type: 'delete-notes',
        name: t('task.deleteNotes.title'),
        description: t('task.deleteNotes.description'),
        icon: Document,
      },
      {
        type: 'delete-background',
        name: t('task.deleteBackground.title'),
        description: t('task.deleteBackground.description'),
        icon: Picture,
      },
      {
        type: 'delete-macros',
        name: t('task.deleteMacros.title'),
        description: t('task.deleteMacros.description'),
        icon: Setting,
      },
    ],
  },
  {
    id: 'conversion',
    name: t('category.conversion'),
    icon: Refresh,
    color: 'green',
    tasks: [
      {
        type: 'format-convert',
        name: t('task.formatConvert.title'),
        description: t('task.formatConvert.description'),
        icon: Refresh,
      },
    ],
  },
  {
    id: 'watermark',
    name: t('category.watermark'),
    icon: Stamp,
    color: 'purple',
    tasks: [
      {
        type: 'add-watermark',
        name: t('task.watermark.title'),
        description: t('task.watermark.description'),
        icon: Stamp,
      },
    ],
  },
  {
    id: 'merge-split',
    name: t('category.mergeSplit'),
    icon: Link,
    color: 'red',
    tasks: [
      {
        type: 'split-ppt',
        name: t('task.splitPpt.title'),
        description: t('task.splitPpt.description'),
        icon: Switch,
      },
      {
        type: 'merge-ppt',
        name: t('task.mergePpt.title'),
        description: t('task.mergePpt.description'),
        icon: Link,
      },
    ],
  },
  {
    id: 'page',
    name: t('category.page'),
    icon: Files,
    color: 'cyan',
    tasks: [
      {
        type: 'delete-pages',
        name: t('task.deletePages.title'),
        description: t('task.deletePages.description'),
        icon: Delete,
      },
      {
        type: 'extract-pages',
        name: t('task.extractPages.title'),
        description: t('task.extractPages.description'),
        icon: Upload,
      },
    ],
  },
  {
    id: 'extraction',
    name: t('category.extraction'),
    icon: Download,
    color: 'indigo',
    tasks: [
      {
        type: 'extract-images',
        name: t('task.extractImages.title'),
        description: t('task.extractImages.description'),
        icon: Picture,
      },
      {
        type: 'extract-notes',
        name: t('task.extractNotes.title'),
        description: t('task.extractNotes.description'),
        icon: Document,
      },
    ],
  },
  {
    id: 'properties',
    name: t('category.properties'),
    icon: Setting,
    color: 'pink',
    tasks: [
      {
        type: 'edit-metadata',
        name: t('task.editMetadata.title'),
        description: t('task.editMetadata.description'),
        icon: Edit,
      },
      {
        type: 'clear-metadata',
        name: t('task.clearMetadata.title'),
        description: t('task.clearMetadata.description'),
        icon: Lock,
      },
      {
        type: 'add-password',
        name: t('task.addPassword.title'),
        description: t('task.addPassword.description'),
        icon: Key,
      },
      {
        type: 'remove-password',
        name: t('task.removePassword.title'),
        description: t('task.removePassword.description'),
        icon: Unlock,
      },
      {
        type: 'optimize-compress',
        name: t('task.optimizeCompress.title'),
        description: t('task.optimizeCompress.description'),
        icon: Operation,
      },
    ],
  },
  {
    id: 'header-footer',
    name: t('category.headerFooter'),
    icon: Notebook,
    color: 'orange',
    tasks: [
      {
        type: 'delete-header-footer',
        name: t('task.deleteHeaderFooter.title'),
        description: t('task.deleteHeaderFooter.description'),
        icon: Document,
      },
    ],
  },
])

const localCategory = ref('content')
const localTaskType = ref<TaskType | null>(null)

const selectedCategory = computed({
  get: () => store.selectedCategory || localCategory.value,
  set: (val) => {
    localCategory.value = val
  },
})

const selectedTaskType = computed({
  get: () => store.selectedTaskType || localTaskType.value,
  set: (val) => {
    localTaskType.value = val
  },
})

const taskOptions = ref<Record<string, any>>({})

const outputConfig = ref<OutputConfig>({
  directory: '',
  overwriteOriginal: false,
  fileNamePattern: '{original}_processed',
  createSubfolders: false,
})

const searchQuery = ref('')
const hoveredTask = ref<string | null>(null)
const showHelp = ref(false)
const isConfigMinimized = ref(false)

const favorites = ref<string[]>([])

onMounted(() => {
  const savedFavorites = localStorage.getItem('ppt-processor-favorites')
  if (savedFavorites) {
    favorites.value = JSON.parse(savedFavorites)
  }
})

watch(
  favorites,
  (newVal) => {
    localStorage.setItem('ppt-processor-favorites', JSON.stringify(newVal))
  },
  { deep: true }
)

const allTasks = computed(() => categories.value.flatMap((c) => c.tasks))

const filteredTasks = computed(() => {
  if (!searchQuery.value) return []
  const query = searchQuery.value.toLowerCase()
  return allTasks.value.filter(
    (task) =>
      task.name.toLowerCase().includes(query) || task.description.toLowerCase().includes(query)
  )
})

const displayTasks = computed(() => {
  if (searchQuery.value) {
    return filteredTasks.value
  }

  const favoriteTasks = currentTasks.value.filter((t) => favorites.value.includes(t.type))
  const otherTasks = currentTasks.value.filter((t) => !favorites.value.includes(t.type))

  return [...favoriteTasks, ...otherTasks]
})

const currentTasks = computed(() => {
  const cat = categories.value.find((c) => c.id === selectedCategory.value)
  return cat ? cat.tasks : []
})

const currentCategory = computed(() => {
  return categories.value.find((c) => c.id === selectedCategory.value)
})

const currentTask = computed(() => {
  if (!selectedTaskType.value) return null
  return categories.value.flatMap((c) => c.tasks).find((t) => t.type === selectedTaskType.value)
})

const currentConfigComponent = computed(() => {
  const type = selectedTaskType.value
  if (!type) return null

  const configMap: Record<string, any> = {
    'text-replace': markRaw(TextReplaceConfig),
    'excel-rules': markRaw(ExcelRulesConfig),
    'template-generate': markRaw(TemplateGenerateConfig),
    'image-replace': markRaw(ImageReplaceConfig),
    'format-convert': markRaw(FormatConvertConfig),
    'add-watermark': markRaw(WatermarkConfig),
    'split-ppt': markRaw(SplitMergeConfig),
    'merge-ppt': markRaw(SplitMergeConfig),
    'delete-pages': markRaw(PageOperationConfig),
    'extract-pages': markRaw(PageOperationConfig),
    'extract-images': markRaw(ExtractionConfig),
    'extract-notes': markRaw(ExtractionConfig),
    'delete-blank-pages': markRaw(ExtractionConfig),
    'delete-notes': markRaw(ExtractionConfig),
    'delete-background': markRaw(ExtractionConfig),
    'delete-macros': markRaw(ExtractionConfig),
    'delete-header-footer': markRaw(ExtractionConfig),
    'edit-metadata': markRaw(MetadataConfig),
    'clear-metadata': markRaw(MetadataConfig),
    'add-password': markRaw(MetadataConfig),
    'remove-password': markRaw(MetadataConfig),
    'optimize-compress': markRaw(MetadataConfig),
  }

  return configMap[type] || null
})

const hasConfig = computed(() => {
  return Object.keys(taskOptions.value).length > 0 || currentConfigComponent.value === null
})

const canStart = computed(() => {
  if (!selectedTaskType.value) return false
  return store.hasFiles && (outputConfig.value.overwriteOriginal || outputConfig.value.directory)
})

const isProcessing = computed(() => store.isProcessing)
const progress = computed(() => store.progress)

function handleSearch() {
  if (searchQuery.value) {
    selectedCategory.value = ''
  }
}

function clearSearch() {
  searchQuery.value = ''
  selectedCategory.value = 'content'
}

function selectCategory(catId: string) {
  localCategory.value = catId
  searchQuery.value = ''
  localTaskType.value = null
  store.selectedCategory = catId as any
  store.selectedTaskType = null
}

function selectTask(task: Task) {
  localTaskType.value = task.type
  store.selectedTaskType = task.type
  taskOptions.value = {}
}

function closeWorkspace() {
  localTaskType.value = null
  store.selectedTaskType = null
}

function goHome() {
  store.goToHomePage()
}

function getTaskCategory(taskType: string): Category | undefined {
  return categories.value.find((c) => c.tasks.some((t) => t.type === taskType))
}

function isFavorite(taskType: string): boolean {
  return favorites.value.includes(taskType)
}

function toggleFavorite(taskType: string) {
  if (isFavorite(taskType)) {
    favorites.value = favorites.value.filter((t) => t !== taskType)
  } else {
    favorites.value.push(taskType)
  }
}

async function startProcessing() {
  if (!canStart.value) return
  const taskConfig = store.createTaskConfig(taskOptions.value, outputConfig.value)
  await store.startProcessing(taskConfig)
}

function cancelProcessing() {
  store.cancelProcessing()
}
</script>

<style scoped>
.task-config {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%);
  overflow: hidden;
}

.category-tabs {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 24px;
  background: white;
  border-bottom: 1px solid #e5e7eb;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.home-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 18px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  color: white;
  cursor: pointer;
  transition: all 0.3s ease;
  white-space: nowrap;
  flex-shrink: 0;
}

.home-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
}

.home-icon {
  font-size: 16px;
}

.tabs-divider {
  width: 1px;
  height: 28px;
  background: #e5e7eb;
  flex-shrink: 0;
}

.search-box {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  transition: all 0.2s ease;
  flex-shrink: 0;
  width: 220px;
}

.search-box:focus-within {
  background: white;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.search-icon {
  color: #9ca3af;
}

.search-input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 14px;
  color: #374151;
  outline: none;
}

.search-input::placeholder {
  color: #9ca3af;
}

.search-clear {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 50%;
  font-size: 14px;
  color: #9ca3af;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.search-clear:hover {
  background: #e5e7eb;
  color: #374151;
}

.search-clear:active {
  background: #d1d5db;
  transform: scale(0.95);
}

.tabs-scroll {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow-x: auto;
  padding: 4px 0;
  scrollbar-width: thin;
  scrollbar-color: #cbd5e1 #f1f5f9;
}

.tabs-scroll::-webkit-scrollbar {
  height: 6px;
}

.tabs-scroll::-webkit-scrollbar-track {
  background: #f1f5f9;
  border-radius: 3px;
}

.tabs-scroll::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 3px;
}

.tabs-scroll::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

.category-tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  background: #f3f4f6;
  border: 1px solid transparent;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  color: #4b5563;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.category-tab:hover {
  background: #e5e7eb;
  transform: translateY(-1px);
}

.category-tab.active {
  background: white;
  border-color: currentColor;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.category-tab.tab-blue {
  color: #3b82f6;
}
.category-tab.tab-green {
  color: #10b981;
}
.category-tab.tab-orange {
  color: #f59e0b;
}
.category-tab.tab-purple {
  color: #8b5cf6;
}
.category-tab.tab-red {
  color: #ef4444;
}
.category-tab.tab-cyan {
  color: #06b6d4;
}
.category-tab.tab-indigo {
  color: #6366f1;
}
.category-tab.tab-pink {
  color: #ec4899;
}

.tab-count {
  padding: 2px 8px;
  background: rgba(0, 0, 0, 0.08);
  border-radius: 10px;
  font-size: 12px;
}

.task-grid-container {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  min-height: 0;
}

.task-grid-wrapper {
  max-width: 1400px;
  margin: 0 auto;
  min-height: 100%;
}

.no-results {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  color: #9ca3af;
}

.no-results p {
  margin-top: 16px;
  font-size: 16px;
}

.clear-search-btn {
  margin-top: 16px;
  padding: 8px 20px;
  background: #667eea;
  border: none;
  border-radius: 8px;
  color: white;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.clear-search-btn:hover {
  background: #5a67d8;
}

.recent-section {
  margin-bottom: 24px;
  padding: 20px;
  background: white;
  border-radius: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #6b7280;
  margin: 0;
}

.clear-recent-btn {
  padding: 4px 12px;
  background: transparent;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-size: 12px;
  color: #9ca3af;
  cursor: pointer;
  transition: all 0.2s ease;
}

.clear-recent-btn:hover {
  background: #fee2e2;
  border-color: #fca5a5;
  color: #dc2626;
}

.recent-tasks {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.recent-task-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
  border: 1px solid #e5e7eb;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  color: #374151;
  cursor: pointer;
  transition: all 0.2s ease;
}

.recent-task-chip:hover {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-color: transparent;
  color: white;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.task-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.task-card {
  display: flex;
  flex-direction: column;
  padding: 20px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.task-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: currentColor;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.task-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1);
}

.task-card:hover::before {
  opacity: 1;
}

.task-card.card-blue {
  color: #3b82f6;
}
.task-card.card-green {
  color: #10b981;
}
.task-card.card-orange {
  color: #f59e0b;
}
.task-card.card-purple {
  color: #8b5cf6;
}
.task-card.card-red {
  color: #ef4444;
}
.task-card.card-cyan {
  color: #06b6d4;
}
.task-card.card-indigo {
  color: #6366f1;
}
.task-card.card-pink {
  color: #ec4899;
}

.task-card-hot {
  background: linear-gradient(135deg, #fff9f0 0%, #fff 100%);
  border-color: #fed7aa;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.card-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
  border-radius: 10px;
  color: inherit;
  flex-shrink: 0;
}

.card-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.card-title {
  font-size: 15px;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.favorite-btn {
  padding: 4px 8px;
  background: transparent;
  border: none;
  font-size: 16px;
  cursor: pointer;
  opacity: 0.3;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.favorite-btn:hover,
.favorite-btn.active {
  opacity: 1;
  transform: scale(1.2);
}

.card-content {
  flex: 1;
}

.hot-badge {
  padding: 2px 8px;
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  border-radius: 4px;
  font-size: 10px;
  font-weight: 700;
  color: white;
  letter-spacing: 0.5px;
}

.card-desc {
  font-size: 13px;
  color: #6b7280;
  line-height: 1.5;
  margin: 0;
}

.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid #f3f4f6;
}

.card-action {
  font-size: 12px;
  font-weight: 500;
  color: #9ca3af;
  transition: all 0.2s ease;
}

.task-card:hover .card-action {
  color: inherit;
}

.card-arrow {
  font-size: 14px;
  color: #9ca3af;
  transition: all 0.2s ease;
}

.task-card:hover .card-arrow {
  transform: translateX(4px);
  color: inherit;
}

.workspace {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: white;
  overflow: hidden;
}

.workspace-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
}

.back-btn:hover {
  background: rgba(255, 255, 255, 0.25);
}

.workspace-title {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.workspace-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 10px;
}

.workspace-title-text h2 {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

.workspace-title-text p {
  font-size: 13px;
  opacity: 0.8;
  margin: 2px 0 0;
}

.help-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: rgba(255, 255, 255, 0.15);
  border: none;
  border-radius: 8px;
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
}

.help-btn:hover {
  background: rgba(255, 255, 255, 0.25);
}

.workspace-body {
  flex: 1;
  display: flex;
  overflow: hidden;
  min-height: 0;
}

.workspace-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 16px;
  min-height: 0;
}

.main-scroll-wrapper {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-right: 8px; /* 为滚动条留出空间 */
  margin-right: -8px; /* 抵消内边距，防止挤压 */
}

.config-panel {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.3s ease;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
}

.config-panel.minimized {
  background: #f8fafc;
  max-height: 44px;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #f8fafc;
  cursor: pointer;
  user-select: none;
  flex-shrink: 0;
}

.panel-header:hover {
  background: #f3f4f6;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  margin: 0;
}

.panel-toggle {
  font-size: 12px;
  color: #9ca3af;
}

.config-form {
  padding: 14px;
}

.config-form::-webkit-scrollbar {
  width: 6px;
}

.config-form::-webkit-scrollbar-track {
  background: #f1f5f9;
  border-radius: 3px;
}

.config-form::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 3px;
}

.config-form::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

.files-panel {
  min-height: 200px; /* 保证最小高度 */
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.progress-panel {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  overflow: hidden;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  max-height: 200px;
}

.progress-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
}

.progress-content {
  padding: 16px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.progress-active {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.progress-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.current-file {
  font-size: 14px;
  color: #374151;
  font-weight: 500;
}

.progress-percent {
  font-size: 18px;
  font-weight: 700;
  color: #667eea;
}

.progress-bar {
  height: 8px;
  background: #e5e7eb;
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

.progress-glow {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.4) 50%,
    transparent 100%
  );
  animation: progressGlow 1.5s infinite;
}

@keyframes progressGlow {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

.progress-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.progress-count {
  font-size: 13px;
  color: #6b7280;
}

.cancel-btn {
  padding: 6px 14px;
  background: transparent;
  border: 1px solid #fca5a5;
  border-radius: 6px;
  font-size: 13px;
  color: #dc2626;
  cursor: pointer;
  transition: all 0.2s ease;
}

.cancel-btn:hover {
  background: #fee2e2;
}

.workspace-sidebar {
  width: 300px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  background: #f8fafc;
  border-left: 1px solid #e5e7eb;
  overflow-y: auto;
}

.workspace-main::-webkit-scrollbar,
.workspace-sidebar::-webkit-scrollbar {
  width: 8px;
}

.workspace-main::-webkit-scrollbar-track,
.workspace-sidebar::-webkit-scrollbar-track {
  background: #f1f5f9;
  border-radius: 4px;
}

.workspace-main::-webkit-scrollbar-thumb,
.workspace-sidebar::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}

.workspace-main::-webkit-scrollbar-thumb:hover,
.workspace-sidebar::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

.output-panel {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 16px;
}

.output-panel .panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  margin: 0 0 16px;
}

.action-panel {
  margin-top: auto;
}

.start-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 14px;
  background: linear-gradient(135deg, #9ca3af 0%, #6b7280 100%);
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  color: white;
  cursor: not-allowed;
  transition: all 0.3s ease;
}

.start-btn.ready {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  cursor: pointer;
}

.start-btn.ready:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
}

.start-btn.processing {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  cursor: wait;
}

.btn-icon {
  font-size: 16px;
}

.action-status {
  margin-top: 12px;
  text-align: center;
}

.status-item {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 13px;
  color: #6b7280;
}

.status-item.ready {
  color: #10b981;
  font-weight: 500;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #9ca3af;
}

.status-dot.ready {
  background: #10b981;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.help-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.help-modal {
  width: 480px;
  max-width: 90vw;
  background: white;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
}

.help-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.help-modal-header h3 {
  margin: 0;
  font-size: 16px;
}

.close-btn {
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: 4px;
  color: white;
  cursor: pointer;
}

.help-modal-body {
  padding: 20px;
}

.help-modal-body h4 {
  margin: 0 0 8px;
  font-size: 18px;
  color: #1f2937;
}

.help-modal-body p {
  margin: 0 0 16px;
  font-size: 14px;
  color: #6b7280;
}

.help-tips {
  background: #f8fafc;
  border-radius: 8px;
  padding: 16px;
}

.help-tips h5 {
  margin: 0 0 12px;
  font-size: 14px;
  color: #374151;
}

.help-tips ol {
  margin: 0;
  padding-left: 20px;
}

.help-tips li {
  margin-bottom: 8px;
  font-size: 13px;
  color: #4b5563;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(20px);
}
</style>
