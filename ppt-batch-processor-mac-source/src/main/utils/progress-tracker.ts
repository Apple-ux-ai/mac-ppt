import { EventEmitter } from 'events'

type MessageParams = Record<string, string | number>

export enum ProgressStage {
  INITIALIZING = 'initializing',
  VALIDATING = 'validating',
  BACKING_UP = 'backing_up',
  PROCESSING = 'processing',
  CONVERTING = 'converting',
  FINALIZING = 'finalizing',
  COMPLETED = 'completed',
}

export interface FileProgress {
  fileName: string
  filePath: string
  fileSize: number
  stage: ProgressStage
  progress: number
  currentOperation: string
  currentOperationKey?: string
  currentOperationParams?: MessageParams
  startTime: number
  estimatedTimeRemaining?: number
  error?: string
  warning?: string
}

export interface TaskProgress {
  taskId: string
  taskType: string
  totalFiles: number
  processedFiles: number
  failedFiles: number
  currentFileIndex: number
  currentFile?: FileProgress
  overallProgress: number
  stage: ProgressStage
  startTime: number
  elapsedTime: number
  estimatedTimeRemaining?: number
  averageFileTime?: number
  filesPerMinute?: number
  status: 'pending' | 'running' | 'paused' | 'completed' | 'cancelled' | 'error'
  errors: Array<{ fileName: string; error: string }>
  warnings: Array<{ fileName: string; warning: string }>
}

export interface ProgressUpdate {
  type: 'task' | 'file' | 'stage' | 'error' | 'warning' | 'complete'
  taskId: string
  progress: TaskProgress
  timestamp: number
  delta?: Partial<TaskProgress>
}

export type ProgressCallback = (update: ProgressUpdate) => void

export class ProgressTracker extends EventEmitter {
  private tasks: Map<string, TaskProgress> = new Map()
  private callbacks: Map<string, Set<ProgressCallback>> = new Map()
  private fileStartTimes: Map<string, number> = new Map()
  private fileProcessingTimes: number[] = []
  private maxTimeSamples = 100

  createTask(taskId: string, taskType: string, totalFiles: number): TaskProgress {
    const progress: TaskProgress = {
      taskId,
      taskType,
      totalFiles,
      processedFiles: 0,
      failedFiles: 0,
      currentFileIndex: -1,
      overallProgress: 0,
      stage: ProgressStage.INITIALIZING,
      startTime: Date.now(),
      elapsedTime: 0,
      status: 'pending',
      errors: [],
      warnings: [],
    }

    this.tasks.set(taskId, progress)
    this.callbacks.set(taskId, new Set())

    this.emitUpdate(taskId, 'task', progress)

    return progress
  }

  registerCallback(taskId: string, callback: ProgressCallback): () => void {
    const callbacks = this.callbacks.get(taskId)
    if (callbacks) {
      callbacks.add(callback)
    }

    return () => {
      callbacks?.delete(callback)
    }
  }

  startTask(taskId: string): void {
    const progress = this.tasks.get(taskId)
    if (!progress) return

    progress.status = 'running'
    progress.stage = ProgressStage.VALIDATING
    progress.startTime = Date.now()

    this.emitUpdate(taskId, 'stage', progress)
  }

  setStage(
    taskId: string,
    stage: ProgressStage,
    operation?: string,
    operationKey?: string,
    operationParams?: MessageParams
  ): void {
    const progress = this.tasks.get(taskId)
    if (!progress) return

    progress.stage = stage

    if (progress.currentFile) {
      progress.currentFile.stage = stage
      if (operation) {
        progress.currentFile.currentOperation = operation
      }
      if (operationKey) {
        progress.currentFile.currentOperationKey = operationKey
      }
      if (operationParams) {
        progress.currentFile.currentOperationParams = operationParams
      }
    }

    this.emitUpdate(taskId, 'stage', progress)
  }

  startFile(taskId: string, filePath: string, fileSize: number): void {
    const progress = this.tasks.get(taskId)
    if (!progress) return

    const fileName = filePath.split(/[/\\]/).pop() || filePath
    const fileKey = `${taskId}:${filePath}`

    progress.currentFileIndex++
    progress.currentFile = {
      fileName,
      filePath,
      fileSize,
      stage: ProgressStage.PROCESSING,
      progress: 0,
      currentOperation: '正在处理...',
      currentOperationKey: 'main.progress.processing',
      startTime: Date.now(),
    }

    this.fileStartTimes.set(fileKey, Date.now())

    this.calculateOverallProgress(progress)
    this.emitUpdate(taskId, 'file', progress)
  }

  updateFileProgress(
    taskId: string,
    progressPercent: number,
    operation?: string,
    operationKey?: string,
    operationParams?: MessageParams
  ): void {
    const progress = this.tasks.get(taskId)
    if (!progress?.currentFile) return

    progress.currentFile.progress = Math.min(100, Math.max(0, progressPercent))

    if (operation) {
      progress.currentFile.currentOperation = operation
    }
    if (operationKey) {
      progress.currentFile.currentOperationKey = operationKey
    }
    if (operationParams) {
      progress.currentFile.currentOperationParams = operationParams
    }

    if (progress.currentFile.startTime > 0) {
      const elapsed = Date.now() - progress.currentFile.startTime
      if (progress.currentFile.progress > 0 && progress.currentFile.progress < 100) {
        const estimatedTotal = elapsed / (progress.currentFile.progress / 100)
        progress.currentFile.estimatedTimeRemaining = Math.round(estimatedTotal - elapsed)
      }
    }

    this.calculateOverallProgress(progress)
    this.emitUpdate(taskId, 'file', progress)
  }

  completeFile(taskId: string, filePath: string, success: boolean = true): void {
    const progress = this.tasks.get(taskId)
    if (!progress) return

    const fileKey = `${taskId}:${filePath}`
    const startTime = this.fileStartTimes.get(fileKey)

    if (startTime) {
      const processingTime = Date.now() - startTime
      this.recordProcessingTime(processingTime)
      this.fileStartTimes.delete(fileKey)
    }

    if (success) {
      progress.processedFiles++
    } else {
      progress.failedFiles++
    }

    if (progress.currentFile) {
      progress.currentFile.progress = 100
      progress.currentFile.stage = ProgressStage.COMPLETED
    }

    this.calculateOverallProgress(progress)
    this.calculateTimeEstimates(progress)

    this.emitUpdate(taskId, 'file', progress)
  }

  addError(taskId: string, fileName: string, error: string): void {
    const progress = this.tasks.get(taskId)
    if (!progress) return

    progress.errors.push({ fileName, error })
    progress.failedFiles++

    if (progress.currentFile) {
      progress.currentFile.error = error
    }

    this.emitUpdate(taskId, 'error', progress, { errors: progress.errors })
  }

  addWarning(taskId: string, fileName: string, warning: string): void {
    const progress = this.tasks.get(taskId)
    if (!progress) return

    progress.warnings.push({ fileName, warning })

    if (progress.currentFile) {
      progress.currentFile.warning = warning
    }

    this.emitUpdate(taskId, 'warning', progress, { warnings: progress.warnings })
  }

  pauseTask(taskId: string): void {
    const progress = this.tasks.get(taskId)
    if (!progress) return

    progress.status = 'paused'
    this.emitUpdate(taskId, 'task', progress)
  }

  resumeTask(taskId: string): void {
    const progress = this.tasks.get(taskId)
    if (!progress) return

    progress.status = 'running'
    this.emitUpdate(taskId, 'task', progress)
  }

  completeTask(taskId: string, success: boolean = true): void {
    const progress = this.tasks.get(taskId)
    if (!progress) return

    progress.status = success ? 'completed' : 'error'
    progress.stage = ProgressStage.COMPLETED
    progress.overallProgress = 100
    progress.elapsedTime = Date.now() - progress.startTime

    if (progress.currentFile) {
      progress.currentFile.progress = 100
      progress.currentFile.stage = ProgressStage.COMPLETED
    }

    this.emitUpdate(taskId, 'complete', progress)
  }

  cancelTask(taskId: string): void {
    const progress = this.tasks.get(taskId)
    if (!progress) return

    progress.status = 'cancelled'
    progress.elapsedTime = Date.now() - progress.startTime

    this.emitUpdate(taskId, 'task', progress)
  }

  getProgress(taskId: string): TaskProgress | undefined {
    const progress = this.tasks.get(taskId)
    if (!progress) return undefined

    return { ...progress }
  }

  getAllProgress(): TaskProgress[] {
    return Array.from(this.tasks.values()).map((p) => ({ ...p }))
  }

  clearTask(taskId: string): void {
    this.tasks.delete(taskId)
    this.callbacks.delete(taskId)

    for (const key of this.fileStartTimes.keys()) {
      if (key.startsWith(taskId)) {
        this.fileStartTimes.delete(key)
      }
    }
  }

  private calculateOverallProgress(progress: TaskProgress): void {
    const fileWeight = progress.totalFiles > 0 ? 100 / progress.totalFiles : 0
    const completedProgress = progress.processedFiles * fileWeight
    const currentFileWeight = progress.currentFile
      ? (progress.currentFile.progress / 100) * fileWeight
      : 0

    progress.overallProgress = Math.round(completedProgress + currentFileWeight)
    progress.elapsedTime = Date.now() - progress.startTime
  }

  private calculateTimeEstimates(progress: TaskProgress): void {
    if (this.fileProcessingTimes.length === 0) return

    const avgTime = this.getAverageProcessingTime()
    const remainingFiles = progress.totalFiles - progress.processedFiles - progress.failedFiles

    progress.averageFileTime = avgTime
    progress.estimatedTimeRemaining = Math.round(avgTime * remainingFiles)
    progress.filesPerMinute = avgTime > 0 ? Math.round(60000 / avgTime) : 0
  }

  private recordProcessingTime(time: number): void {
    this.fileProcessingTimes.push(time)
    if (this.fileProcessingTimes.length > this.maxTimeSamples) {
      this.fileProcessingTimes.shift()
    }
  }

  private getAverageProcessingTime(): number {
    if (this.fileProcessingTimes.length === 0) return 0

    const sorted = [...this.fileProcessingTimes].sort((a, b) => a - b)
    const q1 = sorted[Math.floor(sorted.length * 0.25)]
    const q3 = sorted[Math.floor(sorted.length * 0.75)]
    const iqr = q3 - q1
    const lowerBound = q1 - 1.5 * iqr
    const upperBound = q3 + 1.5 * iqr

    const filtered = this.fileProcessingTimes.filter((t) => t >= lowerBound && t <= upperBound)

    if (filtered.length === 0) return 0
    return filtered.reduce((a, b) => a + b, 0) / filtered.length
  }

  private emitUpdate(
    taskId: string,
    type: ProgressUpdate['type'],
    progress: TaskProgress,
    delta?: Partial<TaskProgress>
  ): void {
    const update: ProgressUpdate = {
      type,
      taskId,
      progress: { ...progress },
      timestamp: Date.now(),
      delta,
    }

    this.emit('progress', update)

    const callbacks = this.callbacks.get(taskId)
    if (callbacks) {
      for (const callback of callbacks) {
        try {
          callback(update)
        } catch (e) {
          console.error('Progress callback error:', e)
        }
      }
    }
  }
}

export const progressTracker = new ProgressTracker()
