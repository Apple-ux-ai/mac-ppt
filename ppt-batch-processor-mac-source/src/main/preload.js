import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld('electronAPI', {
    selectFiles: () => ipcRenderer.invoke('select-files'),
    selectFolder: () => ipcRenderer.invoke('select-folder'),
    selectExcelFile: () => ipcRenderer.invoke('select-excel-file'),
    selectImageFile: () => ipcRenderer.invoke('select-image-file'),
    getFileStats: (filePath) => ipcRenderer.invoke('get-file-stats', filePath),
    getImageList: (filePath) => ipcRenderer.invoke('get-image-list', filePath),
    processFiles: (taskConfig) => ipcRenderer.invoke('process-files', taskConfig),
    cancelTask: (taskId) => ipcRenderer.invoke('cancel-task', taskId),
    downloadFile: (filePath) => ipcRenderer.invoke('download-file', filePath),
    downloadAllFiles: (filePaths) => ipcRenderer.invoke('download-all-files', filePaths),
    openExternal: (url) => ipcRenderer.invoke('open-external', url),
    checkUpdate: () => ipcRenderer.invoke('check-update'),
    validateFiles: (filePaths, options) => ipcRenderer.invoke('validate-files', filePaths, options),
    getTaskProgress: (taskId) => ipcRenderer.invoke('get-task-progress', taskId),
    getResumableTasks: () => ipcRenderer.invoke('get-resumable-tasks'),
    resumeTask: (taskId) => ipcRenderer.invoke('resume-task', taskId),
    getTaskHistory: () => ipcRenderer.invoke('get-task-history'),
    exportTaskHistory: (outputPath, format) => ipcRenderer.invoke('export-task-history', outputPath, format),
    onProgressUpdate: (callback) => {
        ipcRenderer.on('progress-update', (_event, progress) => callback(progress));
    },
    onFileCompleted: (callback) => {
        ipcRenderer.on('file-completed', (_event, result) => callback(result));
    },
    onTaskCompleted: (callback) => {
        ipcRenderer.on('task-completed', (_event, results) => callback(results));
    },
    onLoginSuccess: (callback) => {
        ipcRenderer.on('login-success', (_event, token) => callback(token));
    },
    removeProgressListener: () => {
        ipcRenderer.removeAllListeners('progress-update');
    },
    removeLoginSuccessListener: () => {
        ipcRenderer.removeAllListeners('login-success');
    },
    removeFileCompletedListener: () => {
        ipcRenderer.removeAllListeners('file-completed');
    },
    removeTaskCompletedListener: () => {
        ipcRenderer.removeAllListeners('task-completed');
    },
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
});
