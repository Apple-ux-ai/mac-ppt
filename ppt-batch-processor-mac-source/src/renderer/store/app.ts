import { defineStore } from 'pinia'
import { translate } from '../i18n'
import type {
  FileInfo,
  TaskConfig,
  ProcessProgress,
  ProcessResult,
  TaskType,
  TaskCategory,
  TaskOptions,
  OutputConfig,
  AppSettings,
} from '../../shared/types'

export interface DetailedProgress {
  taskId: string
  taskType: string
  totalFiles: number
  processedFiles: number
  failedFiles: number
  currentFileIndex: number
  currentFile?: {
    fileName: string
    filePath: string
    fileSize: number
    stage: string
    progress: number
    currentOperation: string
    currentOperationKey?: string
    currentOperationParams?: Record<string, string | number>
    startTime: number
    estimatedTimeRemaining?: number
    error?: string
    warning?: string
  }
  overallProgress: number
  stage: string
  startTime: number
  elapsedTime: number
  estimatedTimeRemaining?: number
  averageFileTime?: number
  filesPerMinute?: number
  status: 'pending' | 'running' | 'paused' | 'completed' | 'cancelled' | 'error'
  errors: Array<{ fileName: string; error: string }>
  warnings: Array<{ fileName: string; warning: string }>
}

export interface AppError {
  code: number
  message: string
  userMessage: string
  suggestion: string
  recoverable: boolean
  retryable: boolean
  severity: 'info' | 'warning' | 'error' | 'critical'
  context?: Record<string, any>
}

export interface ResumableTask {
  id: string
  type: string
  config: Record<string, any>
  files: any[]
  status: string
  progress: DetailedProgress
  createdAt: number
  updatedAt: number
}

interface AppState {
  fileList: FileInfo[]
  currentTask: TaskConfig | null
  progress: ProcessProgress | null
  detailedProgress: DetailedProgress | null
  results: ProcessResult[]
  settings: AppSettings
  isProcessing: boolean
  selectedCategory: TaskCategory | null
  selectedTaskType: TaskType | null
  showHomePage: boolean
  lastError: AppError | null
  resumableTasks: ResumableTask[]
  validationWarnings: Array<{ file: string; warnings: any[] }>
}

export const useAppStore = defineStore('app', {
  state: (): AppState => ({
    fileList: [],
    currentTask: null,
    progress: null,
    detailedProgress: null,
    results: [],
    settings: {
      defaultOutputDir: '',
      concurrency: 4,
      autoBackup: true,
      logLevel: 'info',
      language: 'zh-CN',
      theme: 'light',
    },
    isProcessing: false,
    selectedCategory: null,
    selectedTaskType: null,
    showHomePage: true,
    lastError: null,
    resumableTasks: [],
    validationWarnings: [],
  }),

  getters: {
    hasFiles: (state) => state.fileList.length > 0,

    totalFileSize: (state) => {
      return state.fileList.reduce((sum, file) => sum + file.size, 0)
    },

    isTaskConfigured: (state) => {
      return state.selectedTaskType !== null && state.fileList.length > 0
    },

    successCount: (state) => {
      return state.results.filter((r) => r.status === 'success').length
    },

    errorCount: (state) => {
      return state.results.filter((r) => r.status === 'error').length
    },

    hasResumableTasks: (state) => state.resumableTasks.length > 0,

    formattedElapsedTime: (state) => {
      if (!state.detailedProgress) return ''
      const ms = state.detailedProgress.elapsedTime
      const seconds = Math.floor(ms / 1000)
      const minutes = Math.floor(seconds / 60)
      const hours = Math.floor(minutes / 60)

      if (hours > 0) {
        return translate('store.duration.hoursMinutesSeconds', {
          hours,
          minutes: minutes % 60,
          seconds: seconds % 60,
        })
      } else if (minutes > 0) {
        return translate('store.duration.minutesSeconds', {
          minutes,
          seconds: seconds % 60,
        })
      } else {
        return translate('store.duration.seconds', { seconds })
      }
    },

    formattedEstimatedTime: (state) => {
      if (!state.detailedProgress?.estimatedTimeRemaining) return ''
      const ms = state.detailedProgress.estimatedTimeRemaining
      const seconds = Math.floor(ms / 1000)
      const minutes = Math.floor(seconds / 60)
      const hours = Math.floor(minutes / 60)

      if (hours > 0) {
        return translate('store.duration.approxHoursMinutes', {
          hours,
          minutes: minutes % 60,
        })
      } else if (minutes > 0) {
        return translate('store.duration.approxMinutes', { minutes })
      } else {
        return translate('store.duration.approxSeconds', { seconds })
      }
    },
  },

  actions: {
    addFiles(files: FileInfo[]) {
      const existingPaths = new Set(this.fileList.map((f) => f.path))
      const newFiles = files.filter((f) => !existingPaths.has(f.path))
      this.fileList.push(...newFiles)
    },

    removeFile(path: string) {
      const index = this.fileList.findIndex((f) => f.path === path)
      if (index !== -1) {
        this.fileList.splice(index, 1)
      }
    },

    clearFiles() {
      this.fileList = []
      this.validationWarnings = []
    },

    setTaskCategory(category: TaskCategory) {
      this.selectedCategory = category
      this.selectedTaskType = null
      this.showHomePage = false
    },

    setTaskType(category: TaskCategory, type: TaskType) {
      this.selectedCategory = category
      this.selectedTaskType = type
      this.showHomePage = false
    },

    createTaskConfig(options: TaskOptions, outputConfig: OutputConfig): TaskConfig {
      const cleanedFiles = this.fileList.map((file) => ({
        name: file.name,
        path: file.path,
        size: file.size,
        format: file.format,
        slideCount: file.slideCount,
      }))

      return {
        id: `task-${Date.now()}`,
        name: translate('store.task.defaultName'),
        category: this.selectedCategory!,
        type: this.selectedTaskType!,
        inputFiles: cleanedFiles,
        outputConfig,
        options,
        createdAt: new Date(),
        status: 'pending',
      }
    },

    async startProcessing(taskConfig: TaskConfig) {
      this.isProcessing = true
      this.currentTask = taskConfig
      this.progress = null
      this.detailedProgress = null
      this.results = []
      this.lastError = null

      console.log('开始处理任务:', {
        id: taskConfig.id,
        type: taskConfig.type,
        fileCount: taskConfig.inputFiles?.length || 0,
        files: taskConfig.inputFiles,
      })

      try {
        const cleanOptions: any = {}
        for (const [key, value] of Object.entries(taskConfig.options)) {
          if (value === undefined || typeof value === 'function') {
            continue
          }
          if (value === null) {
            cleanOptions[key] = null
            continue
          }
          if (typeof value === 'object' && !Array.isArray(value)) {
            cleanOptions[key] = { ...value }
          } else {
            cleanOptions[key] = value
          }
        }

        const serializableConfig = {
          id: taskConfig.id,
          name: taskConfig.name,
          category: taskConfig.category,
          type: taskConfig.type,
          inputFiles: taskConfig.inputFiles,
          outputConfig: {
            directory: taskConfig.outputConfig.directory,
            overwriteOriginal: taskConfig.outputConfig.overwriteOriginal,
            fileNamePattern: taskConfig.outputConfig.fileNamePattern,
            createSubfolders: taskConfig.outputConfig.createSubfolders,
          },
          options: cleanOptions,
          createdAt:
            taskConfig.createdAt instanceof Date
              ? taskConfig.createdAt.toISOString()
              : taskConfig.createdAt,
          status: taskConfig.status,
        }

        try {
          const testSerialization = JSON.stringify(serializableConfig)
          console.log(
            '✓ 序列化测试通过，数据大小:',
            (testSerialization.length / 1024).toFixed(2),
            'KB'
          )
        } catch (serializeError) {
          console.error('❌ 序列化测试失败:', serializeError)
          throw new Error(
            translate('store.error.unserializableConfig', { error: String(serializeError) })
          )
        }

        console.log('→ 发送到主进程...')
        await window.electronAPI.processFiles(serializableConfig)
        console.log('✓ 任务已提交到后端处理')
      } catch (error) {
        console.error('处理失败:', error)
        this.isProcessing = false
        this.setError({
          code: 1,
          message: error instanceof Error ? error.message : 'Unknown error',
          userMessage: translate('store.error.taskStartFailed'),
          suggestion: translate('store.error.checkConfigRetry'),
          recoverable: true,
          retryable: true,
          severity: 'error',
        })
        throw error
      }
    },

    async cancelProcessing() {
      if (this.currentTask) {
        await window.electronAPI.cancelTask(this.currentTask.id)
        this.isProcessing = false
      }
    },

    updateProgress(progress: ProcessProgress) {
      this.progress = progress
    },

    updateDetailedProgress(progress: DetailedProgress) {
      this.detailedProgress = progress
      this.progress = {
        totalFiles: progress.totalFiles,
        completedFiles: progress.processedFiles,
        currentFile: progress.currentFile?.fileName || '',
        percentage: progress.overallProgress,
        status: progress.status as any,
      }
    },

    addFileResult(result: ProcessResult) {
      this.results.push(result)
    },

    setError(error: AppError) {
      this.lastError = error
      console.error('应用错误:', error)
    },

    clearError() {
      this.lastError = null
    },

    setValidationWarnings(warnings: Array<{ file: string; warnings: any[] }>) {
      this.validationWarnings = warnings
    },

    async loadResumableTasks() {
      try {
        const tasks = await window.electronAPI.getResumableTasks()
        this.resumableTasks = tasks
      } catch (error) {
        console.error('加载可恢复任务失败:', error)
      }
    },

    async resumeTask(taskId: string): Promise<boolean> {
      try {
        const result = await window.electronAPI.resumeTask(taskId)
        if (result.success && result.task) {
          this.currentTask = {
            id: result.task.id,
            name: translate('store.task.resumedName'),
            category: 'file-content' as TaskCategory,
            type: result.task.type as TaskType,
            inputFiles: result.task.files,
            outputConfig: {
              directory: '',
              overwriteOriginal: false,
              fileNamePattern: '',
              createSubfolders: false,
            },
            options: result.task.config,
            createdAt: new Date(result.task.createdAt),
            status: 'running',
          }
          this.isProcessing = true
          return true
        }
        return false
      } catch (error) {
        console.error('恢复任务失败:', error)
        return false
      }
    },

    updateSettings(settings: Partial<AppSettings>) {
      this.settings = { ...this.settings, ...settings }
      localStorage.setItem('app-settings', JSON.stringify(this.settings))
    },

    loadSettings() {
      const saved = localStorage.getItem('app-settings')
      if (saved) {
        try {
          this.settings = { ...this.settings, ...JSON.parse(saved) }
        } catch (error) {
          console.error('加载设置失败:', error)
        }
      }
    },

    goToHomePage() {
      this.showHomePage = true
      this.selectedCategory = null
      this.selectedTaskType = null
    },
  },
})
