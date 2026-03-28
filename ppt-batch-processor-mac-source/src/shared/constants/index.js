// IPC 通道名称
export const IPC_CHANNELS = {
    SELECT_FILES: 'select-files',
    SELECT_FOLDER: 'select-folder',
    PROCESS_FILES: 'process-files',
    CANCEL_TASK: 'cancel-task',
    PROGRESS_UPDATE: 'progress-update',
    FILE_COMPLETED: 'file-completed',
    TASK_COMPLETED: 'task-completed',
};
// 文件大小限制（字节）
export const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
// 大文件阈值（字节）
export const LARGE_FILE_THRESHOLD = 50 * 1024 * 1024; // 50MB
// 默认并发数
export const DEFAULT_CONCURRENCY = 4;
// 支持的文件格式
export const SUPPORTED_FORMATS = {
    INPUT: ['.pptx', '.ppt'],
    OUTPUT: {
        PDF: '.pdf',
        PNG: '.png',
        JPG: '.jpg',
        HTML: '.html',
        PPTX: '.pptx',
        PPT: '.ppt',
    },
};
// 默认设置
export const DEFAULT_SETTINGS = {
    defaultOutputDir: '',
    concurrency: DEFAULT_CONCURRENCY,
    autoBackup: true,
    logLevel: 'info',
    language: 'zh-CN',
    theme: 'light',
};
// 错误消息
export const ERROR_MESSAGES = {
    FILE_NOT_FOUND: '文件不存在',
    FILE_TOO_LARGE: '文件过大',
    INVALID_FORMAT: '不支持的文件格式',
    FILE_CORRUPTED: '文件已损坏',
    INSUFFICIENT_SPACE: '磁盘空间不足',
    PERMISSION_DENIED: '权限不足',
    PROCESSING_FAILED: '处理失败',
};
// 任务分类映射
export const TASK_CATEGORIES = {
    content: '文件内容类',
    conversion: '格式转换类',
    'header-footer': '页眉页脚类',
    watermark: '文件水印类',
    'merge-split': '合并拆分类',
    page: '页面处理类',
    extraction: '数据提取类',
    properties: '文件属性类',
};
