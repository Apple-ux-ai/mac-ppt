import { translate as t } from './i18n'

// Mock Electron API for browser preview
let progressCallback: ((progress: any) => void) | null = null
let fileCompletedCallback: ((result: any) => void) | null = null
let taskCompletedCallback: ((results: any) => void) | null = null

export const mockElectronAPI = {
  selectFiles: async () => {
    console.log('Mock: selectFiles called')
    return { files: [], validationResults: {} }
  },

  selectFolder: async () => {
    console.log('Mock: selectFolder called')
    // 模拟选择输出目录
    return 'C:/Users/test/Documents/output'
  },

  selectExcelFile: async () => {
    console.log('Mock: selectExcelFile called')
    // 模拟选择 Excel 文件
    return 'C:/Users/test/Documents/rules.xlsx'
  },

  getFileStats: async (filePath: string) => {
    console.log('Mock: getFileStats called', filePath)
    // 模拟文件统计信息
    return {
      size: 1024000 + Math.floor(Math.random() * 5000000),
      created: new Date(),
      modified: new Date(),
    }
  },

  processFiles: async (taskConfig: any) => {
    console.log('Mock: processFiles called', taskConfig)

    const totalFiles = taskConfig.inputFiles.length
    const results = []

    for (let i = 0; i < totalFiles; i++) {
      const file = taskConfig.inputFiles[i]

      // 发送进度更新
      if (progressCallback) {
        progressCallback({
          totalFiles,
          completedFiles: i,
          currentFile: file.name,
          percentage: Math.round((i / totalFiles) * 100),
          status: 'running',
        })
      }

      // 模拟处理时间（500ms - 2s）
      await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 1500))

      // 模拟 90% 成功率
      const isSuccess = Math.random() > 0.1

      const result = {
        inputFile: file.path,
        outputFile: taskConfig.outputConfig.overwriteOriginal
          ? file.path
          : `${taskConfig.outputConfig.directory}/${file.name.replace('.pptx', '_processed.pptx')}`,
        status: isSuccess ? 'success' : 'error',
        error: isSuccess ? undefined : t('模拟处理错误'),
        metadata: isSuccess
          ? {
              originalSize: file.size || 1024000,
              newSize: Math.floor((file.size || 1024000) * (0.7 + Math.random() * 0.3)),
              itemsProcessed: Math.floor(Math.random() * 20) + 1,
            }
          : undefined,
      }

      results.push(result)

      // 发送文件完成事件
      if (fileCompletedCallback) {
        fileCompletedCallback(result)
      }
    }

    // 发送最终进度
    if (progressCallback) {
      progressCallback({
        totalFiles,
        completedFiles: totalFiles,
        currentFile: '',
        percentage: 100,
        status: 'completed',
      })
    }

    // 发送任务完成事件
    if (taskCompletedCallback) {
      taskCompletedCallback(results)
    }

    return results
  },

  cancelTask: async (taskId: string) => {
    console.log('Mock: cancelTask called', taskId)
  },

  openExternal: async (url: string) => {
    console.log('Mock: openExternal called', url)
    const normalizedUrl = /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(url) ? url : `https://${url}`
    window.open(normalizedUrl, '_blank', 'noopener,noreferrer')
    return { success: true, url: normalizedUrl }
  },

  invoke: async (channel: string, ...args: any[]) => {
    console.log('Mock: invoke called', channel, args)

    switch (channel) {
      case 'open-external':
        return mockElectronAPI.openExternal(args[0])
      case 'window-minimize':
      case 'window-maximize':
        return { success: false, error: `${channel} is unavailable in browser preview mode` }
      case 'window-close':
        window.close()
        return { success: true }
      default:
        return { success: false, error: `${channel} is unavailable in browser preview mode` }
    }
  },

  onProgressUpdate: (callback: (progress: any) => void) => {
    console.log('Mock: onProgressUpdate registered')
    progressCallback = callback
  },

  onFileCompleted: (callback: (result: any) => void) => {
    console.log('Mock: onFileCompleted registered')
    fileCompletedCallback = callback
  },

  onTaskCompleted: (callback: (results: any) => void) => {
    console.log('Mock: onTaskCompleted registered')
    taskCompletedCallback = callback
  },

  removeProgressListener: () => {
    console.log('Mock: removeProgressListener called')
    progressCallback = null
  },

  removeFileCompletedListener: () => {
    console.log('Mock: removeFileCompletedListener called')
    fileCompletedCallback = null
  },

  removeTaskCompletedListener: () => {
    console.log('Mock: removeTaskCompletedListener called')
    taskCompletedCallback = null
  },
}

// 在浏览器环境中注入 mock API（仅当 electronAPI 不存在时）
// 必须在 DOMContentLoaded 之后检查，确保 preload 已经执行
if (typeof window !== 'undefined') {
  const injectMock = () => {
    if (!window.electronAPI) {
      console.warn('⚠️ 使用 Mock Electron API - 这是浏览器预览模式，功能受限')
      console.warn('⚠️ 请使用 Electron 应用以获得完整功能')
      ;(window as any).electronAPI = mockElectronAPI
    } else {
      console.log('✅ 使用真实 Electron API')
    }
  }

  // 如果 DOM 已经加载，立即检查
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectMock)
  } else {
    injectMock()
  }
}
