import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import { createHash } from 'crypto'
import { ErrorCode, AppError } from './error-codes'
import { TaskProgress, ProgressStage } from './progress-tracker'

export interface PersistedTask {
  id: string
  type: string
  config: Record<string, any>
  files: TaskFileInfo[]
  status: 'pending' | 'running' | 'paused' | 'completed' | 'cancelled' | 'error'
  progress: TaskProgress
  createdAt: number
  updatedAt: number
  checkpoint?: TaskCheckpoint
}

export interface TaskFileInfo {
  path: string
  name: string
  size: number
  hash?: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped'
  output?: string
  error?: string
  processedAt?: number
}

export interface TaskCheckpoint {
  lastProcessedIndex: number
  processedFiles: string[]
  failedFiles: string[]
  partialResults: Record<string, any>
}

export interface TaskPersistenceConfig {
  storageDir?: string
  maxStoredTasks?: number
  autoSaveInterval?: number
  retentionDays?: number
}

const DEFAULT_CONFIG: Required<TaskPersistenceConfig> = {
  storageDir: '',
  maxStoredTasks: 100,
  autoSaveInterval: 5000,
  retentionDays: 7
}

class TaskPersistenceService {
  private config: Required<TaskPersistenceConfig>
  private storagePath: string
  private tasks: Map<string, PersistedTask> = new Map()
  private autoSaveTimers: Map<string, NodeJS.Timeout> = new Map()
  private initialized: boolean = false

  constructor(config?: TaskPersistenceConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.storagePath = this.config.storageDir || path.join(app.getPath('userData'), 'task-storage')
  }

  async initialize(): Promise<void> {
    if (this.initialized) return
    
    try {
      await this.ensureDirectory(this.storagePath)
      await this.loadAllTasks()
      await this.cleanupExpiredTasks()
      this.initialized = true
    } catch (error) {
      console.error('Failed to initialize task persistence:', error)
      throw AppError.fromError(error, ErrorCode.TEMP_DIR_CREATION_FAILED)
    }
  }

  async saveTask(task: PersistedTask): Promise<void> {
    task.updatedAt = Date.now()
    
    const taskPath = this.getTaskPath(task.id)
    const tempPath = `${taskPath}.tmp`
    
    try {
      const content = JSON.stringify(task, null, 2)
      await fs.promises.writeFile(tempPath, content, 'utf-8')
      await fs.promises.rename(tempPath, taskPath)
      
      this.tasks.set(task.id, task)
    } catch (error) {
      console.error(`Failed to save task ${task.id}:`, error)
      throw AppError.fromError(error, ErrorCode.BACKUP_FAILED)
    }
  }

  async loadTask(taskId: string): Promise<PersistedTask | null> {
    const cached = this.tasks.get(taskId)
    if (cached) return cached
    
    const taskPath = this.getTaskPath(taskId)
    
    try {
      const content = await fs.promises.readFile(taskPath, 'utf-8')
      const task = JSON.parse(content) as PersistedTask
      this.tasks.set(taskId, task)
      return task
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null
      }
      console.error(`Failed to load task ${taskId}:`, error)
      return null
    }
  }

  async deleteTask(taskId: string): Promise<void> {
    const taskPath = this.getTaskPath(taskId)
    
    try {
      await fs.promises.unlink(taskPath)
      this.tasks.delete(taskId)
      this.stopAutoSave(taskId)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error(`Failed to delete task ${taskId}:`, error)
      }
    }
  }

  async getAllTasks(): Promise<PersistedTask[]> {
    return Array.from(this.tasks.values())
  }

  async getResumableTasks(): Promise<PersistedTask[]> {
    const tasks = await this.getAllTasks()
    return tasks.filter(t => 
      t.status === 'paused' || 
      (t.status === 'error' && t.checkpoint && t.checkpoint.lastProcessedIndex < t.files.length - 1)
    )
  }

  async createCheckpoint(
    taskId: string, 
    processedIndex: number, 
    partialResults?: Record<string, any>
  ): Promise<void> {
    const task = await this.loadTask(taskId)
    if (!task) return
    
    task.checkpoint = {
      lastProcessedIndex: processedIndex,
      processedFiles: task.files
        .filter(f => f.status === 'completed')
        .map(f => f.path),
      failedFiles: task.files
        .filter(f => f.status === 'failed')
        .map(f => f.path),
      partialResults: partialResults || {}
    }
    
    await this.saveTask(task)
  }

  async updateFileStatus(
    taskId: string,
    filePath: string,
    status: TaskFileInfo['status'],
    output?: string,
    error?: string
  ): Promise<void> {
    const task = await this.loadTask(taskId)
    if (!task) return
    
    const file = task.files.find(f => f.path === filePath)
    if (file) {
      file.status = status
      if (output) file.output = output
      if (error) file.error = error
      if (status === 'completed' || status === 'failed') {
        file.processedAt = Date.now()
      }
    }
    
    await this.saveTask(task)
  }

  async calculateFileHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = createHash('md5')
      const stream = fs.createReadStream(filePath)
      
      stream.on('data', (chunk) => hash.update(chunk))
      stream.on('end', () => resolve(hash.digest('hex')))
      stream.on('error', reject)
    })
  }

  startAutoSave(taskId: string, getTaskData: () => PersistedTask): void {
    this.stopAutoSave(taskId)
    
    const timer = setInterval(async () => {
      try {
        const task = getTaskData()
        await this.saveTask(task)
      } catch (error) {
        console.error(`Auto-save failed for task ${taskId}:`, error)
      }
    }, this.config.autoSaveInterval)
    
    this.autoSaveTimers.set(taskId, timer)
  }

  stopAutoSave(taskId: string): void {
    const timer = this.autoSaveTimers.get(taskId)
    if (timer) {
      clearInterval(timer)
      this.autoSaveTimers.delete(taskId)
    }
  }

  async resumeTask(taskId: string): Promise<{
    task: PersistedTask
    resumeFrom: number
    pendingFiles: TaskFileInfo[]
  } | null> {
    const task = await this.loadTask(taskId)
    if (!task) return null
    
    if (task.status !== 'paused' && task.status !== 'error') {
      return null
    }
    
    const resumeFrom = task.checkpoint?.lastProcessedIndex ?? -1
    const pendingFiles = task.files.filter((f, i) => 
      i > resumeFrom && f.status === 'pending'
    )
    
    return { task, resumeFrom: resumeFrom + 1, pendingFiles }
  }

  async exportTaskHistory(outputPath: string, format: 'json' | 'csv' = 'json'): Promise<void> {
    const tasks = await this.getAllTasks()
    
    if (format === 'json') {
      await fs.promises.writeFile(outputPath, JSON.stringify(tasks, null, 2), 'utf-8')
    } else {
      const headers = ['ID', 'Type', 'Status', 'Created', 'Updated', 'Total Files', 'Processed', 'Failed']
      const rows = tasks.map(t => [
        t.id,
        t.type,
        t.status,
        new Date(t.createdAt).toISOString(),
        new Date(t.updatedAt).toISOString(),
        t.files.length,
        t.progress.processedFiles,
        t.progress.failedFiles
      ])
      
      const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
      await fs.promises.writeFile(outputPath, csv, 'utf-8')
    }
  }

  private async loadAllTasks(): Promise<void> {
    try {
      const files = await fs.promises.readdir(this.storagePath)
      const taskFiles = files.filter(f => f.endsWith('.json'))
      
      for (const file of taskFiles) {
        try {
          const content = await fs.promises.readFile(
            path.join(this.storagePath, file), 
            'utf-8'
          )
          const task = JSON.parse(content) as PersistedTask
          this.tasks.set(task.id, task)
        } catch (e) {
          console.error(`Failed to load task file ${file}:`, e)
        }
      }
      
      if (this.tasks.size > this.config.maxStoredTasks) {
        await this.cleanupOldestTasks()
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }
    }
  }

  private async cleanupExpiredTasks(): Promise<void> {
    const now = Date.now()
    const expirationTime = this.config.retentionDays * 24 * 60 * 60 * 1000
    
    for (const [id, task] of this.tasks) {
      if (task.status === 'completed' || task.status === 'cancelled') {
        if (now - task.updatedAt > expirationTime) {
          await this.deleteTask(id)
        }
      }
    }
  }

  private async cleanupOldestTasks(): Promise<void> {
    const sortedTasks = Array.from(this.tasks.values())
      .sort((a, b) => a.updatedAt - b.updatedAt)
    
    const toRemove = sortedTasks.slice(0, sortedTasks.length - this.config.maxStoredTasks)
    
    for (const task of toRemove) {
      await this.deleteTask(task.id)
    }
  }

  private async ensureDirectory(dir: string): Promise<void> {
    try {
      await fs.promises.mkdir(dir, { recursive: true })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error
      }
    }
  }

  private getTaskPath(taskId: string): string {
    return path.join(this.storagePath, `${taskId}.json`)
  }
}

export const taskPersistence = new TaskPersistenceService()
