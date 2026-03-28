export var ErrorCode;
(function (ErrorCode) {
    ErrorCode[ErrorCode["SUCCESS"] = 0] = "SUCCESS";
    ErrorCode[ErrorCode["UNKNOWN_ERROR"] = 1] = "UNKNOWN_ERROR";
    ErrorCode[ErrorCode["FILE_NOT_FOUND"] = 1001] = "FILE_NOT_FOUND";
    ErrorCode[ErrorCode["FILE_ACCESS_DENIED"] = 1002] = "FILE_ACCESS_DENIED";
    ErrorCode[ErrorCode["FILE_LOCKED"] = 1003] = "FILE_LOCKED";
    ErrorCode[ErrorCode["FILE_TOO_LARGE"] = 1004] = "FILE_TOO_LARGE";
    ErrorCode[ErrorCode["FILE_CORRUPTED"] = 1005] = "FILE_CORRUPTED";
    ErrorCode[ErrorCode["FILE_INVALID_FORMAT"] = 1006] = "FILE_INVALID_FORMAT";
    ErrorCode[ErrorCode["FILE_ALREADY_EXISTS"] = 1007] = "FILE_ALREADY_EXISTS";
    ErrorCode[ErrorCode["FILE_ENCRYPTED"] = 1008] = "FILE_ENCRYPTED";
    ErrorCode[ErrorCode["DIRECTORY_NOT_FOUND"] = 1009] = "DIRECTORY_NOT_FOUND";
    ErrorCode[ErrorCode["DIRECTORY_ACCESS_DENIED"] = 1010] = "DIRECTORY_ACCESS_DENIED";
    ErrorCode[ErrorCode["INVALID_PPTX_STRUCTURE"] = 2001] = "INVALID_PPTX_STRUCTURE";
    ErrorCode[ErrorCode["INVALID_SLIDE_INDEX"] = 2002] = "INVALID_SLIDE_INDEX";
    ErrorCode[ErrorCode["INVALID_PAGE_RANGE"] = 2003] = "INVALID_PAGE_RANGE";
    ErrorCode[ErrorCode["INVALID_METADATA"] = 2004] = "INVALID_METADATA";
    ErrorCode[ErrorCode["IMAGE_NOT_FOUND"] = 2005] = "IMAGE_NOT_FOUND";
    ErrorCode[ErrorCode["IMAGE_FORMAT_UNSUPPORTED"] = 2006] = "IMAGE_FORMAT_UNSUPPORTED";
    ErrorCode[ErrorCode["TEXT_NOT_FOUND"] = 2007] = "TEXT_NOT_FOUND";
    ErrorCode[ErrorCode["TEMPLATE_PARSE_ERROR"] = 2008] = "TEMPLATE_PARSE_ERROR";
    ErrorCode[ErrorCode["EXCEL_PARSE_ERROR"] = 2009] = "EXCEL_PARSE_ERROR";
    ErrorCode[ErrorCode["WATERMARK_FAILED"] = 2010] = "WATERMARK_FAILED";
    ErrorCode[ErrorCode["PASSWORD_INCORRECT"] = 2011] = "PASSWORD_INCORRECT";
    ErrorCode[ErrorCode["PASSWORD_REQUIRED"] = 2012] = "PASSWORD_REQUIRED";
    ErrorCode[ErrorCode["LIBREOFFICE_NOT_FOUND"] = 3001] = "LIBREOFFICE_NOT_FOUND";
    ErrorCode[ErrorCode["LIBREOFFICE_TIMEOUT"] = 3002] = "LIBREOFFICE_TIMEOUT";
    ErrorCode[ErrorCode["LIBREOFFICE_CRASH"] = 3003] = "LIBREOFFICE_CRASH";
    ErrorCode[ErrorCode["CONVERSION_FAILED"] = 3004] = "CONVERSION_FAILED";
    ErrorCode[ErrorCode["IMAGEMAGICK_NOT_FOUND"] = 3005] = "IMAGEMAGICK_NOT_FOUND";
    ErrorCode[ErrorCode["GHOSTSCRIPT_NOT_FOUND"] = 3006] = "GHOSTSCRIPT_NOT_FOUND";
    ErrorCode[ErrorCode["TASK_CANCELLED"] = 4001] = "TASK_CANCELLED";
    ErrorCode[ErrorCode["TASK_TIMEOUT"] = 4002] = "TASK_TIMEOUT";
    ErrorCode[ErrorCode["TASK_ALREADY_RUNNING"] = 4003] = "TASK_ALREADY_RUNNING";
    ErrorCode[ErrorCode["TASK_NOT_FOUND"] = 4004] = "TASK_NOT_FOUND";
    ErrorCode[ErrorCode["TASK_QUEUE_FULL"] = 4005] = "TASK_QUEUE_FULL";
    ErrorCode[ErrorCode["INSUFFICIENT_MEMORY"] = 5001] = "INSUFFICIENT_MEMORY";
    ErrorCode[ErrorCode["INSUFFICIENT_DISK_SPACE"] = 5002] = "INSUFFICIENT_DISK_SPACE";
    ErrorCode[ErrorCode["TEMP_DIR_CREATION_FAILED"] = 5003] = "TEMP_DIR_CREATION_FAILED";
    ErrorCode[ErrorCode["BACKUP_FAILED"] = 5004] = "BACKUP_FAILED";
    ErrorCode[ErrorCode["NETWORK_ERROR"] = 6001] = "NETWORK_ERROR";
    ErrorCode[ErrorCode["API_ERROR"] = 6002] = "API_ERROR";
    ErrorCode[ErrorCode["AUTHENTICATION_FAILED"] = 6003] = "AUTHENTICATION_FAILED";
    ErrorCode[ErrorCode["SESSION_EXPIRED"] = 6004] = "SESSION_EXPIRED";
})(ErrorCode || (ErrorCode = {}));
export const ERROR_DETAILS = {
    [ErrorCode.SUCCESS]: {
        code: ErrorCode.SUCCESS,
        message: 'Success',
        userMessage: '操作成功',
        suggestion: '',
        recoverable: true,
        retryable: false,
        severity: 'info'
    },
    [ErrorCode.UNKNOWN_ERROR]: {
        code: ErrorCode.UNKNOWN_ERROR,
        message: 'Unknown error',
        userMessage: '发生未知错误',
        suggestion: '请重试操作，如果问题持续存在，请联系技术支持',
        recoverable: false,
        retryable: true,
        severity: 'error'
    },
    [ErrorCode.FILE_NOT_FOUND]: {
        code: ErrorCode.FILE_NOT_FOUND,
        message: 'File not found',
        userMessage: '文件不存在',
        suggestion: '请检查文件路径是否正确，文件是否已被移动或删除',
        recoverable: false,
        retryable: false,
        severity: 'error'
    },
    [ErrorCode.FILE_ACCESS_DENIED]: {
        code: ErrorCode.FILE_ACCESS_DENIED,
        message: 'File access denied',
        userMessage: '没有文件访问权限',
        suggestion: '请检查文件权限，或以管理员身份运行程序',
        recoverable: false,
        retryable: false,
        severity: 'error'
    },
    [ErrorCode.FILE_LOCKED]: {
        code: ErrorCode.FILE_LOCKED,
        message: 'File is locked by another process',
        userMessage: '文件被其他程序占用',
        suggestion: '请关闭正在使用该文件的程序（如 PowerPoint），然后重试',
        recoverable: true,
        retryable: true,
        severity: 'warning'
    },
    [ErrorCode.FILE_TOO_LARGE]: {
        code: ErrorCode.FILE_TOO_LARGE,
        message: 'File size exceeds limit',
        userMessage: '文件大小超过限制',
        suggestion: '请尝试压缩文件或分批处理',
        recoverable: false,
        retryable: false,
        severity: 'warning'
    },
    [ErrorCode.FILE_CORRUPTED]: {
        code: ErrorCode.FILE_CORRUPTED,
        message: 'File is corrupted',
        userMessage: '文件已损坏',
        suggestion: '请尝试使用 PowerPoint 的修复功能打开文件，或从备份恢复',
        recoverable: false,
        retryable: false,
        severity: 'error'
    },
    [ErrorCode.FILE_INVALID_FORMAT]: {
        code: ErrorCode.FILE_INVALID_FORMAT,
        message: 'Invalid file format',
        userMessage: '文件格式无效',
        suggestion: '请确保文件是有效的 PPTX 格式',
        recoverable: false,
        retryable: false,
        severity: 'error'
    },
    [ErrorCode.FILE_ALREADY_EXISTS]: {
        code: ErrorCode.FILE_ALREADY_EXISTS,
        message: 'File already exists',
        userMessage: '文件已存在',
        suggestion: '请选择不同的输出路径，或启用覆盖选项',
        recoverable: true,
        retryable: false,
        severity: 'warning'
    },
    [ErrorCode.FILE_ENCRYPTED]: {
        code: ErrorCode.FILE_ENCRYPTED,
        message: 'File is encrypted',
        userMessage: '文件已加密',
        suggestion: '请先使用"移除密码"功能解密文件',
        recoverable: true,
        retryable: false,
        severity: 'warning'
    },
    [ErrorCode.DIRECTORY_NOT_FOUND]: {
        code: ErrorCode.DIRECTORY_NOT_FOUND,
        message: 'Directory not found',
        userMessage: '目录不存在',
        suggestion: '请检查目录路径是否正确',
        recoverable: false,
        retryable: false,
        severity: 'error'
    },
    [ErrorCode.DIRECTORY_ACCESS_DENIED]: {
        code: ErrorCode.DIRECTORY_ACCESS_DENIED,
        message: 'Directory access denied',
        userMessage: '没有目录访问权限',
        suggestion: '请检查目录权限，或选择其他输出位置',
        recoverable: false,
        retryable: false,
        severity: 'error'
    },
    [ErrorCode.INVALID_PPTX_STRUCTURE]: {
        code: ErrorCode.INVALID_PPTX_STRUCTURE,
        message: 'Invalid PPTX structure',
        userMessage: 'PPT 文件结构无效',
        suggestion: '请尝试用 PowerPoint 重新保存文件',
        recoverable: false,
        retryable: false,
        severity: 'error'
    },
    [ErrorCode.INVALID_SLIDE_INDEX]: {
        code: ErrorCode.INVALID_SLIDE_INDEX,
        message: 'Invalid slide index',
        userMessage: '幻灯片索引无效',
        suggestion: '请检查页码范围是否正确',
        recoverable: false,
        retryable: false,
        severity: 'error'
    },
    [ErrorCode.INVALID_PAGE_RANGE]: {
        code: ErrorCode.INVALID_PAGE_RANGE,
        message: 'Invalid page range',
        userMessage: '页码范围无效',
        suggestion: '请使用正确的格式，如 "1-3,5,7-9"',
        recoverable: false,
        retryable: false,
        severity: 'error'
    },
    [ErrorCode.INVALID_METADATA]: {
        code: ErrorCode.INVALID_METADATA,
        message: 'Invalid metadata',
        userMessage: '元数据无效',
        suggestion: '请检查元数据字段格式',
        recoverable: false,
        retryable: false,
        severity: 'warning'
    },
    [ErrorCode.IMAGE_NOT_FOUND]: {
        code: ErrorCode.IMAGE_NOT_FOUND,
        message: 'Image not found',
        userMessage: '图片不存在',
        suggestion: '请检查图片路径是否正确',
        recoverable: false,
        retryable: false,
        severity: 'error'
    },
    [ErrorCode.IMAGE_FORMAT_UNSUPPORTED]: {
        code: ErrorCode.IMAGE_FORMAT_UNSUPPORTED,
        message: 'Image format not supported',
        userMessage: '图片格式不支持',
        suggestion: '请使用 PNG、JPG、GIF 或 BMP 格式的图片',
        recoverable: false,
        retryable: false,
        severity: 'warning'
    },
    [ErrorCode.TEXT_NOT_FOUND]: {
        code: ErrorCode.TEXT_NOT_FOUND,
        message: 'Text not found',
        userMessage: '未找到指定文本',
        suggestion: '请检查搜索文本是否正确，或尝试启用"忽略大小写"选项',
        recoverable: true,
        retryable: false,
        severity: 'info'
    },
    [ErrorCode.TEMPLATE_PARSE_ERROR]: {
        code: ErrorCode.TEMPLATE_PARSE_ERROR,
        message: 'Template parse error',
        userMessage: '模板解析失败',
        suggestion: '请检查模板文件和数据源格式是否匹配',
        recoverable: false,
        retryable: false,
        severity: 'error'
    },
    [ErrorCode.EXCEL_PARSE_ERROR]: {
        code: ErrorCode.EXCEL_PARSE_ERROR,
        message: 'Excel parse error',
        userMessage: 'Excel 文件解析失败',
        suggestion: '请确保 Excel 文件格式正确，包含必需的列（类型、查找内容、替换内容）',
        recoverable: false,
        retryable: false,
        severity: 'error'
    },
    [ErrorCode.WATERMARK_FAILED]: {
        code: ErrorCode.WATERMARK_FAILED,
        message: 'Watermark operation failed',
        userMessage: '水印操作失败',
        suggestion: '请检查水印图片是否存在，或减少水印透明度',
        recoverable: false,
        retryable: true,
        severity: 'warning'
    },
    [ErrorCode.PASSWORD_INCORRECT]: {
        code: ErrorCode.PASSWORD_INCORRECT,
        message: 'Incorrect password',
        userMessage: '密码错误',
        suggestion: '请输入正确的密码',
        recoverable: true,
        retryable: false,
        severity: 'warning'
    },
    [ErrorCode.PASSWORD_REQUIRED]: {
        code: ErrorCode.PASSWORD_REQUIRED,
        message: 'Password required',
        userMessage: '需要密码',
        suggestion: '此文件已加密，请提供正确的密码',
        recoverable: true,
        retryable: false,
        severity: 'warning'
    },
    [ErrorCode.LIBREOFFICE_NOT_FOUND]: {
        code: ErrorCode.LIBREOFFICE_NOT_FOUND,
        message: 'LibreOffice not found',
        userMessage: '未找到 LibreOffice',
        suggestion: '应用已内置 LibreOffice，如出现此错误请联系技术支持',
        recoverable: false,
        retryable: false,
        severity: 'critical'
    },
    [ErrorCode.LIBREOFFICE_TIMEOUT]: {
        code: ErrorCode.LIBREOFFICE_TIMEOUT,
        message: 'LibreOffice operation timeout',
        userMessage: 'LibreOffice 操作超时',
        suggestion: '文件可能过大，请尝试处理较小的文件',
        recoverable: true,
        retryable: true,
        severity: 'warning'
    },
    [ErrorCode.LIBREOFFICE_CRASH]: {
        code: ErrorCode.LIBREOFFICE_CRASH,
        message: 'LibreOffice crashed',
        userMessage: 'LibreOffice 意外退出',
        suggestion: '请重试操作，如果问题持续存在，请联系技术支持',
        recoverable: true,
        retryable: true,
        severity: 'error'
    },
    [ErrorCode.CONVERSION_FAILED]: {
        code: ErrorCode.CONVERSION_FAILED,
        message: 'Format conversion failed',
        userMessage: '格式转换失败',
        suggestion: '请检查文件是否损坏，或尝试其他格式',
        recoverable: false,
        retryable: true,
        severity: 'error'
    },
    [ErrorCode.IMAGEMAGICK_NOT_FOUND]: {
        code: ErrorCode.IMAGEMAGICK_NOT_FOUND,
        message: 'ImageMagick not found',
        userMessage: 'ImageMagick 未找到',
        suggestion: '多页图片导出需要 ImageMagick，单页导出仍可使用',
        recoverable: true,
        retryable: false,
        severity: 'warning'
    },
    [ErrorCode.GHOSTSCRIPT_NOT_FOUND]: {
        code: ErrorCode.GHOSTSCRIPT_NOT_FOUND,
        message: 'Ghostscript not found',
        userMessage: 'Ghostscript 未找到',
        suggestion: '多页 PDF 转图片需要 Ghostscript',
        recoverable: true,
        retryable: false,
        severity: 'warning'
    },
    [ErrorCode.TASK_CANCELLED]: {
        code: ErrorCode.TASK_CANCELLED,
        message: 'Task cancelled by user',
        userMessage: '任务已取消',
        suggestion: '',
        recoverable: true,
        retryable: true,
        severity: 'info'
    },
    [ErrorCode.TASK_TIMEOUT]: {
        code: ErrorCode.TASK_TIMEOUT,
        message: 'Task timeout',
        userMessage: '任务超时',
        suggestion: '请尝试处理较少的文件，或检查是否有大文件',
        recoverable: true,
        retryable: true,
        severity: 'warning'
    },
    [ErrorCode.TASK_ALREADY_RUNNING]: {
        code: ErrorCode.TASK_ALREADY_RUNNING,
        message: 'Task already running',
        userMessage: '已有任务在运行',
        suggestion: '请等待当前任务完成，或取消当前任务',
        recoverable: true,
        retryable: false,
        severity: 'warning'
    },
    [ErrorCode.TASK_NOT_FOUND]: {
        code: ErrorCode.TASK_NOT_FOUND,
        message: 'Task not found',
        userMessage: '任务不存在',
        suggestion: '任务可能已完成或被清除',
        recoverable: false,
        retryable: false,
        severity: 'warning'
    },
    [ErrorCode.TASK_QUEUE_FULL]: {
        code: ErrorCode.TASK_QUEUE_FULL,
        message: 'Task queue is full',
        userMessage: '任务队列已满',
        suggestion: '请等待当前任务完成后再添加新任务',
        recoverable: true,
        retryable: true,
        severity: 'warning'
    },
    [ErrorCode.INSUFFICIENT_MEMORY]: {
        code: ErrorCode.INSUFFICIENT_MEMORY,
        message: 'Insufficient memory',
        userMessage: '内存不足',
        suggestion: '请关闭其他应用程序后重试，或处理较小的文件',
        recoverable: true,
        retryable: true,
        severity: 'error'
    },
    [ErrorCode.INSUFFICIENT_DISK_SPACE]: {
        code: ErrorCode.INSUFFICIENT_DISK_SPACE,
        message: 'Insufficient disk space',
        userMessage: '磁盘空间不足',
        suggestion: '请清理磁盘空间后重试',
        recoverable: false,
        retryable: true,
        severity: 'error'
    },
    [ErrorCode.TEMP_DIR_CREATION_FAILED]: {
        code: ErrorCode.TEMP_DIR_CREATION_FAILED,
        message: 'Failed to create temporary directory',
        userMessage: '无法创建临时目录',
        suggestion: '请检查磁盘权限和空间',
        recoverable: false,
        retryable: true,
        severity: 'error'
    },
    [ErrorCode.BACKUP_FAILED]: {
        code: ErrorCode.BACKUP_FAILED,
        message: 'Backup failed',
        userMessage: '备份失败',
        suggestion: '请检查备份目录权限',
        recoverable: true,
        retryable: true,
        severity: 'warning'
    },
    [ErrorCode.NETWORK_ERROR]: {
        code: ErrorCode.NETWORK_ERROR,
        message: 'Network error',
        userMessage: '网络错误',
        suggestion: '请检查网络连接后重试',
        recoverable: true,
        retryable: true,
        severity: 'warning'
    },
    [ErrorCode.API_ERROR]: {
        code: ErrorCode.API_ERROR,
        message: 'API error',
        userMessage: '服务暂时不可用',
        suggestion: '请稍后重试',
        recoverable: true,
        retryable: true,
        severity: 'warning'
    },
    [ErrorCode.AUTHENTICATION_FAILED]: {
        code: ErrorCode.AUTHENTICATION_FAILED,
        message: 'Authentication failed',
        userMessage: '登录失败',
        suggestion: '请重新登录',
        recoverable: true,
        retryable: false,
        severity: 'warning'
    },
    [ErrorCode.SESSION_EXPIRED]: {
        code: ErrorCode.SESSION_EXPIRED,
        message: 'Session expired',
        userMessage: '登录已过期',
        suggestion: '请重新登录',
        recoverable: true,
        retryable: false,
        severity: 'warning'
    }
};
export class AppError extends Error {
    constructor(code, context, originalError) {
        const detail = ERROR_DETAILS[code];
        super(detail.message);
        this.code = code;
        this.userMessage = detail.userMessage;
        this.suggestion = detail.suggestion;
        this.recoverable = detail.recoverable;
        this.retryable = detail.retryable;
        this.severity = detail.severity;
        this.context = context;
        this.timestamp = new Date();
        this.name = 'AppError';
        if (originalError) {
            this.stack = originalError.stack;
            this.cause = originalError;
        }
    }
    toJSON() {
        return {
            code: this.code,
            message: this.message,
            userMessage: this.userMessage,
            suggestion: this.suggestion,
            recoverable: this.recoverable,
            retryable: this.retryable,
            severity: this.severity,
            context: this.context
        };
    }
    static fromError(error, defaultCode = ErrorCode.UNKNOWN_ERROR) {
        if (error instanceof AppError) {
            return error;
        }
        if (error instanceof Error) {
            const message = error.message.toLowerCase();
            if (message.includes('enoent') || message.includes('not found')) {
                return new AppError(ErrorCode.FILE_NOT_FOUND, { originalMessage: error.message }, error);
            }
            if (message.includes('eacces') || message.includes('permission')) {
                return new AppError(ErrorCode.FILE_ACCESS_DENIED, { originalMessage: error.message }, error);
            }
            if (message.includes('ebusy') || message.includes('locked') || message.includes('being used')) {
                return new AppError(ErrorCode.FILE_LOCKED, { originalMessage: error.message }, error);
            }
            if (message.includes('enosp') || message.includes('disk space')) {
                return new AppError(ErrorCode.INSUFFICIENT_DISK_SPACE, { originalMessage: error.message }, error);
            }
            if (message.includes('invalid pptx') || message.includes('invalid format')) {
                return new AppError(ErrorCode.FILE_INVALID_FORMAT, { originalMessage: error.message }, error);
            }
            if (message.includes('password')) {
                return new AppError(ErrorCode.PASSWORD_REQUIRED, { originalMessage: error.message }, error);
            }
            if (message.includes('timeout')) {
                return new AppError(ErrorCode.TASK_TIMEOUT, { originalMessage: error.message }, error);
            }
            if (message.includes('cancel')) {
                return new AppError(ErrorCode.TASK_CANCELLED, { originalMessage: error.message }, error);
            }
            return new AppError(defaultCode, { originalMessage: error.message }, error);
        }
        return new AppError(defaultCode, { originalError: String(error) });
    }
}
export function createError(code, context) {
    return new AppError(code, context);
}
export function isErrorType(error, code) {
    if (error instanceof AppError) {
        return error.code === code;
    }
    return false;
}
export function isRecoverable(error) {
    if (error instanceof AppError) {
        return error.recoverable;
    }
    return false;
}
export function isRetryable(error) {
    if (error instanceof AppError) {
        return error.retryable;
    }
    return false;
}
