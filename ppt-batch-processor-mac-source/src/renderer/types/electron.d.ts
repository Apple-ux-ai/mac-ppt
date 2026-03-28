export interface ElectronAPI {
  selectFiles: () => Promise<{ files: string[]; validationResults?: any }>
  selectFolder: () => Promise<string>
  selectExcelFile: () => Promise<string>
  selectImageFile: () => Promise<string>
  getFileStats: (filePath: string) => Promise<{ size: number; mtime: Date }>
  getImageList: (filePath: string) => Promise<any[]>
  processFiles: (taskConfig: any) => Promise<any>
  cancelTask: (taskId: string) => Promise<void>
  downloadFile: (
    filePath: string
  ) => Promise<{ success: boolean; savedPath?: string; error?: string }>
  downloadAllFiles: (
    filePaths: string[]
  ) => Promise<{ success: boolean; savedCount: number; errors: string[] }>
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
    messageKey?: string
    messageParams?: Record<string, string | number>
    error?: string
    errorKey?: string
    errorParams?: Record<string, string | number>
  }>
  validateFiles: (
    filePaths: string[],
    options?: any
  ) => Promise<{
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
  exportTaskHistory: (
    outputPath: string,
    format?: string
  ) => Promise<{
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

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
