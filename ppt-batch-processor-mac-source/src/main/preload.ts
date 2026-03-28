import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  selectFiles: () => ipcRenderer.invoke('select-files'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  selectExcelFile: () => ipcRenderer.invoke('select-excel-file'),
  selectImageFile: () => ipcRenderer.invoke('select-image-file'),
  getFileStats: (filePath: string) => ipcRenderer.invoke('get-file-stats', filePath),
  getImageList: (filePath: string) => ipcRenderer.invoke('get-image-list', filePath),
  
  processFiles: (taskConfig: any) => ipcRenderer.invoke('process-files', taskConfig),
  cancelTask: (taskId: string) => ipcRenderer.invoke('cancel-task', taskId),
  
  downloadFile: (filePath: string) => ipcRenderer.invoke('download-file', filePath),
  downloadAllFiles: (filePaths: string[]) => ipcRenderer.invoke('download-all-files', filePaths),
  
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  
  checkUpdate: () => ipcRenderer.invoke('check-update'),
  
  validateFiles: (filePaths: string[], options?: any) => 
    ipcRenderer.invoke('validate-files', filePaths, options),
  getTaskProgress: (taskId: string) => 
    ipcRenderer.invoke('get-task-progress', taskId),
  getResumableTasks: () => 
    ipcRenderer.invoke('get-resumable-tasks'),
  resumeTask: (taskId: string) => 
    ipcRenderer.invoke('resume-task', taskId),
  getTaskHistory: () => 
    ipcRenderer.invoke('get-task-history'),
  exportTaskHistory: (outputPath: string, format?: string) => 
    ipcRenderer.invoke('export-task-history', outputPath, format),
  
  onProgressUpdate: (callback: (progress: any) => void) => {
    ipcRenderer.on('progress-update', (_event, progress) => callback(progress))
  },
  onFileCompleted: (callback: (result: any) => void) => {
    ipcRenderer.on('file-completed', (_event, result) => callback(result))
  },
  onTaskCompleted: (callback: (results: any) => void) => {
    ipcRenderer.on('task-completed', (_event, results) => callback(results))
  },
  onLoginSuccess: (callback: (token: string) => void) => {
    ipcRenderer.on('login-success', (_event, token) => callback(token))
  },
  
  removeProgressListener: () => {
    ipcRenderer.removeAllListeners('progress-update')
  },
  removeLoginSuccessListener: () => {
    ipcRenderer.removeAllListeners('login-success')
  },
  removeFileCompletedListener: () => {
    ipcRenderer.removeAllListeners('file-completed')
  },
  removeTaskCompletedListener: () => {
    ipcRenderer.removeAllListeners('task-completed')
  },
  
  invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
})

declare global {
  interface Window {
    electronAPI: {
      selectFiles: () => Promise<{ files: string[]; validationResults?: any }>
      selectFolder: () => Promise<string>
      selectExcelFile: () => Promise<string>
      selectImageFile: () => Promise<string>
      getFileStats: (filePath: string) => Promise<any>
      getImageList: (filePath: string) => Promise<any[]>
      processFiles: (taskConfig: any) => Promise<any>
      cancelTask: (taskId: string) => Promise<void>
      downloadFile: (filePath: string) => Promise<{ success: boolean; savedPath?: string; error?: string }>
      downloadAllFiles: (filePaths: string[]) => Promise<{ success: boolean; savedCount: number; errors: string[] }>
      openExternal: (url: string) => Promise<void>
      checkUpdate: () => Promise<{
        success: boolean
        hasUpdate?: boolean
        currentVersion?: string
        latestVersion?: string
        updateUrl?: string
        updateNotes?: string
        forceUpdate?: boolean
        message?: string
        error?: string
      }>
      validateFiles: (filePaths: string[], options?: any) => Promise<{
        valid: boolean
        results: Array<{
          path: string
          valid: boolean
          errors: any[]
          warnings: any[]
          info: any
        }>
      }>
      getTaskProgress: (taskId: string) => Promise<any>
      getResumableTasks: () => Promise<any[]>
      resumeTask: (taskId: string) => Promise<{
        success: boolean
        task?: any
        resumeFrom?: number
        pendingFiles?: any[]
        error?: string
        errorKey?: string
        errorParams?: Record<string, string | number>
      }>
      getTaskHistory: () => Promise<any[]>
      exportTaskHistory: (outputPath: string, format?: string) => Promise<{
        success: boolean
        error?: string
      }>
      onProgressUpdate: (callback: (progress: any) => void) => void
      onFileCompleted: (callback: (result: any) => void) => void
      onTaskCompleted: (callback: (results: any) => void) => void
      onLoginSuccess: (callback: (token: string) => void) => void
      removeProgressListener: () => void
      removeFileCompletedListener: () => void
      removeTaskCompletedListener: () => void
      removeLoginSuccessListener: () => void
      invoke: (channel: string, ...args: any[]) => Promise<any>
    }
  }
}
