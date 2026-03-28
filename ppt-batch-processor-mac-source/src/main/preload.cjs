const { contextBridge, ipcRenderer } = require('electron')

// 暴露安全的 API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 文件选择
  selectFiles: () => ipcRenderer.invoke('select-files'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  selectExcelFile: () => ipcRenderer.invoke('select-excel-file'),
  selectImageFile: () => ipcRenderer.invoke('select-image-file'),
  getFileStats: (filePath) => ipcRenderer.invoke('get-file-stats', filePath),
  getImageList: (filePath) => ipcRenderer.invoke('get-image-list', filePath),
  
  // 批量处理
  processFiles: (taskConfig) => ipcRenderer.invoke('process-files', taskConfig),
  cancelTask: (taskId) => ipcRenderer.invoke('cancel-task', taskId),
  
  // 进度监听
  onProgressUpdate: (callback) => {
    ipcRenderer.on('progress-update', (_event, progress) => callback(progress))
  },
  onFileCompleted: (callback) => {
    ipcRenderer.on('file-completed', (_event, result) => callback(result))
  },
  onTaskCompleted: (callback) => {
    ipcRenderer.on('task-completed', (_event, results) => callback(results))
  },
  
  // 移除监听器
  removeProgressListener: () => {
    ipcRenderer.removeAllListeners('progress-update')
  },
  removeFileCompletedListener: () => {
    ipcRenderer.removeAllListeners('file-completed')
  },
  removeTaskCompletedListener: () => {
    ipcRenderer.removeAllListeners('task-completed')
  },
  
  // 通用 invoke 方法（用于窗口控制和登录等功能）
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
})
