/**
 * ErrorHandler - 错误处理器
 *
 * 负责错误分类、处理策略和错误隔离
 *
 * 验证需求:
 * - 21.1: 处理文件发生错误时记录详情并继续处理其他文件
 * - 21.2: 文件损坏或无法读取时提示用户
 * - 21.3: 磁盘空间不足时提示用户并暂停处理
 * - 21.6: 发生致命错误时保存当前状态并提示用户重启应用
 */
/**
 * 错误类型枚举
 */
export var ErrorType;
(function (ErrorType) {
    ErrorType["FILE_ERROR"] = "FILE_ERROR";
    ErrorType["PROCESSING_ERROR"] = "PROCESSING_ERROR";
    ErrorType["CONFIG_ERROR"] = "CONFIG_ERROR";
    ErrorType["SYSTEM_ERROR"] = "SYSTEM_ERROR"; // 系统错误
})(ErrorType || (ErrorType = {}));
/**
 * 错误严重程度
 */
export var ErrorSeverity;
(function (ErrorSeverity) {
    ErrorSeverity["INFO"] = "INFO";
    ErrorSeverity["WARNING"] = "WARNING";
    ErrorSeverity["ERROR"] = "ERROR";
    ErrorSeverity["FATAL"] = "FATAL"; // 致命错误
})(ErrorSeverity || (ErrorSeverity = {}));
/**
 * 应用错误基类
 */
export class AppError extends Error {
    constructor(message, type, severity = ErrorSeverity.ERROR, context, originalError) {
        super(message);
        this.name = 'AppError';
        this.type = type;
        this.severity = severity;
        this.timestamp = new Date();
        this.context = context;
        this.originalError = originalError;
        // 维护正确的原型链
        Object.setPrototypeOf(this, AppError.prototype);
    }
    /**
     * 判断是否为致命错误
     */
    isFatal() {
        return this.severity === ErrorSeverity.FATAL;
    }
    /**
     * 转换为 JSON 对象
     */
    toJSON() {
        return {
            name: this.name,
            message: this.message,
            type: this.type,
            severity: this.severity,
            timestamp: this.timestamp.toISOString(),
            context: this.context,
            stack: this.stack,
            originalError: this.originalError ? {
                message: this.originalError.message,
                stack: this.originalError.stack
            } : undefined
        };
    }
}
/**
 * 文件错误
 */
export class FileError extends AppError {
    constructor(message, severity = ErrorSeverity.ERROR, context, originalError) {
        super(message, ErrorType.FILE_ERROR, severity, context, originalError);
        this.name = 'FileError';
        Object.setPrototypeOf(this, FileError.prototype);
    }
}
/**
 * 处理错误
 */
export class ProcessingError extends AppError {
    constructor(message, severity = ErrorSeverity.ERROR, context, originalError) {
        super(message, ErrorType.PROCESSING_ERROR, severity, context, originalError);
        this.name = 'ProcessingError';
        Object.setPrototypeOf(this, ProcessingError.prototype);
    }
}
/**
 * 配置错误
 */
export class ConfigError extends AppError {
    constructor(message, severity = ErrorSeverity.ERROR, context, originalError) {
        super(message, ErrorType.CONFIG_ERROR, severity, context, originalError);
        this.name = 'ConfigError';
        Object.setPrototypeOf(this, ConfigError.prototype);
    }
}
/**
 * 系统错误
 */
export class SystemError extends AppError {
    constructor(message, severity = ErrorSeverity.FATAL, context, originalError) {
        super(message, ErrorType.SYSTEM_ERROR, severity, context, originalError);
        this.name = 'SystemError';
        Object.setPrototypeOf(this, SystemError.prototype);
    }
}
/**
 * 错误操作
 */
export var ErrorAction;
(function (ErrorAction) {
    ErrorAction["CONTINUE"] = "CONTINUE";
    ErrorAction["SKIP"] = "SKIP";
    ErrorAction["RETRY"] = "RETRY";
    ErrorAction["PAUSE"] = "PAUSE";
    ErrorAction["ABORT"] = "ABORT";
    ErrorAction["RESTART"] = "RESTART"; // 重启应用
})(ErrorAction || (ErrorAction = {}));
/**
 * 错误处理器类
 */
export class ErrorHandler {
    constructor() {
        this.errorLog = [];
        this.maxLogSize = 1000;
    }
    /**
     * 处理错误
     *
     * @param error - 错误对象
     * @returns 错误处理结果
     */
    handle(error) {
        // 转换为 AppError
        const appError = this.normalizeError(error);
        // 记录错误
        this.logError(appError);
        // 根据错误类型和严重程度决定处理策略
        return this.determineHandlingStrategy(appError);
    }
    /**
     * 标准化错误对象
     *
     * @param error - 原始错误
     * @returns AppError 实例
     */
    normalizeError(error) {
        if (error instanceof AppError) {
            return error;
        }
        // 根据错误消息推断错误类型
        const errorMessage = error.message.toLowerCase();
        // 文件相关错误
        if (errorMessage.includes('enoent') ||
            errorMessage.includes('file not found') ||
            errorMessage.includes('文件不存在') ||
            errorMessage.includes('cannot read') ||
            errorMessage.includes('无法读取')) {
            return new FileError('文件不存在或无法读取', ErrorSeverity.ERROR, undefined, error);
        }
        // 权限错误
        if (errorMessage.includes('eacces') ||
            errorMessage.includes('permission denied') ||
            errorMessage.includes('权限不足')) {
            return new FileError('权限不足', ErrorSeverity.ERROR, undefined, error);
        }
        // 磁盘空间错误
        if (errorMessage.includes('enospc') ||
            errorMessage.includes('no space') ||
            errorMessage.includes('磁盘空间不足')) {
            return new SystemError('磁盘空间不足', ErrorSeverity.FATAL, undefined, error);
        }
        // 内存错误
        if (errorMessage.includes('out of memory') ||
            errorMessage.includes('内存不足')) {
            return new SystemError('内存不足', ErrorSeverity.FATAL, undefined, error);
        }
        // 文件损坏
        if (errorMessage.includes('corrupt') ||
            errorMessage.includes('invalid') ||
            errorMessage.includes('损坏') ||
            errorMessage.includes('无效')) {
            return new FileError('文件损坏或格式无效', ErrorSeverity.ERROR, undefined, error);
        }
        // 默认为处理错误
        return new ProcessingError(error.message, ErrorSeverity.ERROR, undefined, error);
    }
    /**
     * 确定错误处理策略
     *
     * @param error - AppError 实例
     * @returns 错误处理结果
     */
    determineHandlingStrategy(error) {
        // 致命错误：停止所有处理
        if (error.isFatal()) {
            return {
                shouldContinue: false,
                shouldRetry: false,
                userMessage: this.getUserFriendlyMessage(error),
                action: ErrorAction.RESTART
            };
        }
        // 根据错误类型决定策略
        switch (error.type) {
            case ErrorType.FILE_ERROR:
                return this.handleFileError(error);
            case ErrorType.PROCESSING_ERROR:
                return this.handleProcessingError(error);
            case ErrorType.CONFIG_ERROR:
                return this.handleConfigError(error);
            case ErrorType.SYSTEM_ERROR:
                return this.handleSystemError(error);
            default:
                return {
                    shouldContinue: true,
                    shouldRetry: false,
                    userMessage: error.message,
                    action: ErrorAction.SKIP
                };
        }
    }
    /**
     * 处理文件错误
     */
    handleFileError(error) {
        // 文件错误：跳过当前文件，继续处理其他文件
        return {
            shouldContinue: true,
            shouldRetry: false,
            userMessage: this.getUserFriendlyMessage(error),
            action: ErrorAction.SKIP
        };
    }
    /**
     * 处理处理错误
     */
    handleProcessingError(error) {
        // 处理错误：跳过当前文件，继续处理其他文件
        return {
            shouldContinue: true,
            shouldRetry: false,
            userMessage: this.getUserFriendlyMessage(error),
            action: ErrorAction.SKIP
        };
    }
    /**
     * 处理配置错误
     */
    handleConfigError(error) {
        // 配置错误：中止处理，需要用户修正配置
        return {
            shouldContinue: false,
            shouldRetry: false,
            userMessage: this.getUserFriendlyMessage(error),
            action: ErrorAction.ABORT
        };
    }
    /**
     * 处理系统错误
     */
    handleSystemError(error) {
        // 系统错误：根据严重程度决定
        if (error.severity === ErrorSeverity.FATAL) {
            return {
                shouldContinue: false,
                shouldRetry: false,
                userMessage: this.getUserFriendlyMessage(error),
                action: ErrorAction.RESTART
            };
        }
        return {
            shouldContinue: false,
            shouldRetry: false,
            userMessage: this.getUserFriendlyMessage(error),
            action: ErrorAction.PAUSE
        };
    }
    /**
     * 获取用户友好的错误消息
     */
    getUserFriendlyMessage(error) {
        const baseMessage = error.message;
        // 添加建议操作
        switch (error.type) {
            case ErrorType.FILE_ERROR:
                if (error.message.includes('不存在')) {
                    return `${baseMessage}。请检查文件路径是否正确。`;
                }
                if (error.message.includes('权限')) {
                    return `${baseMessage}。请检查文件访问权限。`;
                }
                if (error.message.includes('损坏')) {
                    return `${baseMessage}。请尝试使用其他工具修复文件。`;
                }
                return `${baseMessage}。该文件将被跳过。`;
            case ErrorType.SYSTEM_ERROR:
                if (error.message.includes('磁盘空间')) {
                    return `${baseMessage}。请清理磁盘空间后重试。`;
                }
                if (error.message.includes('内存')) {
                    return `${baseMessage}。请关闭其他应用程序后重试。`;
                }
                return `${baseMessage}。请重启应用程序。`;
            case ErrorType.CONFIG_ERROR:
                return `${baseMessage}。请检查配置参数。`;
            case ErrorType.PROCESSING_ERROR:
                return `${baseMessage}。该文件将被跳过。`;
            default:
                return baseMessage;
        }
    }
    /**
     * 记录错误
     */
    logError(error) {
        this.errorLog.push(error);
        // 限制日志大小
        if (this.errorLog.length > this.maxLogSize) {
            this.errorLog.shift();
        }
    }
    /**
     * 获取错误日志
     */
    getErrorLog() {
        return [...this.errorLog];
    }
    /**
     * 获取特定类型的错误
     */
    getErrorsByType(type) {
        return this.errorLog.filter(error => error.type === type);
    }
    /**
     * 获取特定严重程度的错误
     */
    getErrorsBySeverity(severity) {
        return this.errorLog.filter(error => error.severity === severity);
    }
    /**
     * 清空错误日志
     */
    clearErrorLog() {
        this.errorLog = [];
    }
    /**
     * 获取错误统计
     */
    getErrorStats() {
        const stats = {
            total: this.errorLog.length,
            byType: {
                [ErrorType.FILE_ERROR]: 0,
                [ErrorType.PROCESSING_ERROR]: 0,
                [ErrorType.CONFIG_ERROR]: 0,
                [ErrorType.SYSTEM_ERROR]: 0
            },
            bySeverity: {
                [ErrorSeverity.INFO]: 0,
                [ErrorSeverity.WARNING]: 0,
                [ErrorSeverity.ERROR]: 0,
                [ErrorSeverity.FATAL]: 0
            }
        };
        for (const error of this.errorLog) {
            stats.byType[error.type]++;
            stats.bySeverity[error.severity]++;
        }
        return stats;
    }
    /**
     * 设置最大日志大小
     */
    setMaxLogSize(size) {
        this.maxLogSize = size;
    }
}
// 导出默认实例
export const errorHandler = new ErrorHandler();
