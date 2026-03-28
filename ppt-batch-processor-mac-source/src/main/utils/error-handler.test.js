import { describe, it, expect, beforeEach } from 'vitest';
import { ErrorHandler, AppError, FileError, ProcessingError, ConfigError, SystemError, ErrorType, ErrorSeverity, ErrorAction } from './error-handler';
/**
 * 测试错误处理器
 *
 * **Validates: Requirements 21.1, 21.2, 21.3, 21.6**
 */
describe('ErrorHandler', () => {
    let errorHandler;
    beforeEach(() => {
        errorHandler = new ErrorHandler();
    });
    describe('错误分类', () => {
        it('应该正确识别文件不存在错误', () => {
            const error = new Error('ENOENT: file not found');
            const result = errorHandler.handle(error);
            expect(result.shouldContinue).toBe(true);
            expect(result.action).toBe(ErrorAction.SKIP);
            expect(result.userMessage).toContain('文件不存在');
        });
        it('应该正确识别权限错误', () => {
            const error = new Error('EACCES: permission denied');
            const result = errorHandler.handle(error);
            expect(result.shouldContinue).toBe(true);
            expect(result.action).toBe(ErrorAction.SKIP);
            expect(result.userMessage).toContain('权限');
        });
        it('应该正确识别磁盘空间不足错误', () => {
            const error = new Error('ENOSPC: no space left on device');
            const result = errorHandler.handle(error);
            expect(result.shouldContinue).toBe(false);
            expect(result.action).toBe(ErrorAction.RESTART);
            expect(result.userMessage).toContain('磁盘空间');
        });
        it('应该正确识别内存不足错误', () => {
            const error = new Error('Out of memory');
            const result = errorHandler.handle(error);
            expect(result.shouldContinue).toBe(false);
            expect(result.action).toBe(ErrorAction.RESTART);
            expect(result.userMessage).toContain('内存');
        });
        it('应该正确识别文件损坏错误', () => {
            const error = new Error('File is corrupt or invalid');
            const result = errorHandler.handle(error);
            expect(result.shouldContinue).toBe(true);
            expect(result.action).toBe(ErrorAction.SKIP);
            expect(result.userMessage).toContain('损坏');
        });
    });
    describe('错误处理策略', () => {
        it('应该对文件错误继续处理其他文件', () => {
            const error = new FileError('文件不存在', ErrorSeverity.ERROR, { filePath: 'test.pptx' });
            const result = errorHandler.handle(error);
            expect(result.shouldContinue).toBe(true);
            expect(result.shouldRetry).toBe(false);
            expect(result.action).toBe(ErrorAction.SKIP);
        });
        it('应该对处理错误继续处理其他文件', () => {
            const error = new ProcessingError('解析失败', ErrorSeverity.ERROR);
            const result = errorHandler.handle(error);
            expect(result.shouldContinue).toBe(true);
            expect(result.shouldRetry).toBe(false);
            expect(result.action).toBe(ErrorAction.SKIP);
        });
        it('应该对配置错误中止处理', () => {
            const error = new ConfigError('无效的配置参数', ErrorSeverity.ERROR);
            const result = errorHandler.handle(error);
            expect(result.shouldContinue).toBe(false);
            expect(result.shouldRetry).toBe(false);
            expect(result.action).toBe(ErrorAction.ABORT);
        });
        it('应该对致命系统错误要求重启', () => {
            const error = new SystemError('磁盘空间不足', ErrorSeverity.FATAL);
            const result = errorHandler.handle(error);
            expect(result.shouldContinue).toBe(false);
            expect(result.shouldRetry).toBe(false);
            expect(result.action).toBe(ErrorAction.RESTART);
        });
        it('应该对非致命系统错误暂停处理', () => {
            const error = new SystemError('临时系统错误', ErrorSeverity.ERROR);
            const result = errorHandler.handle(error);
            expect(result.shouldContinue).toBe(false);
            expect(result.action).toBe(ErrorAction.PAUSE);
        });
    });
    describe('错误隔离', () => {
        it('应该记录错误但不影响其他文件处理', () => {
            const error1 = new FileError('文件1错误');
            const error2 = new FileError('文件2错误');
            const error3 = new FileError('文件3错误');
            errorHandler.handle(error1);
            errorHandler.handle(error2);
            errorHandler.handle(error3);
            const errorLog = errorHandler.getErrorLog();
            expect(errorLog).toHaveLength(3);
            expect(errorLog[0].message).toContain('文件1');
            expect(errorLog[1].message).toContain('文件2');
            expect(errorLog[2].message).toContain('文件3');
        });
        it('应该在单个文件失败后继续处理', () => {
            const errors = [
                new FileError('文件1失败'),
                new ProcessingError('文件2失败'),
                new FileError('文件3失败')
            ];
            const results = errors.map(error => errorHandler.handle(error));
            // 所有非致命错误都应该允许继续
            expect(results.every(r => r.shouldContinue)).toBe(true);
            expect(results.every(r => r.action === ErrorAction.SKIP)).toBe(true);
        });
    });
    describe('错误日志', () => {
        it('应该记录所有错误', () => {
            const error1 = new FileError('错误1');
            const error2 = new ProcessingError('错误2');
            errorHandler.handle(error1);
            errorHandler.handle(error2);
            const errorLog = errorHandler.getErrorLog();
            expect(errorLog).toHaveLength(2);
        });
        it('应该按类型过滤错误', () => {
            errorHandler.handle(new FileError('文件错误1'));
            errorHandler.handle(new ProcessingError('处理错误1'));
            errorHandler.handle(new FileError('文件错误2'));
            const fileErrors = errorHandler.getErrorsByType(ErrorType.FILE_ERROR);
            expect(fileErrors).toHaveLength(2);
            const processingErrors = errorHandler.getErrorsByType(ErrorType.PROCESSING_ERROR);
            expect(processingErrors).toHaveLength(1);
        });
        it('应该按严重程度过滤错误', () => {
            errorHandler.handle(new FileError('错误1', ErrorSeverity.ERROR));
            errorHandler.handle(new FileError('警告1', ErrorSeverity.WARNING));
            errorHandler.handle(new SystemError('致命错误', ErrorSeverity.FATAL));
            const errors = errorHandler.getErrorsBySeverity(ErrorSeverity.ERROR);
            expect(errors).toHaveLength(1);
            const warnings = errorHandler.getErrorsBySeverity(ErrorSeverity.WARNING);
            expect(warnings).toHaveLength(1);
            const fatalErrors = errorHandler.getErrorsBySeverity(ErrorSeverity.FATAL);
            expect(fatalErrors).toHaveLength(1);
        });
        it('应该生成错误统计', () => {
            errorHandler.handle(new FileError('文件错误1'));
            errorHandler.handle(new FileError('文件错误2'));
            errorHandler.handle(new ProcessingError('处理错误1'));
            errorHandler.handle(new SystemError('系统错误1', ErrorSeverity.FATAL));
            const stats = errorHandler.getErrorStats();
            expect(stats.total).toBe(4);
            expect(stats.byType[ErrorType.FILE_ERROR]).toBe(2);
            expect(stats.byType[ErrorType.PROCESSING_ERROR]).toBe(1);
            expect(stats.byType[ErrorType.SYSTEM_ERROR]).toBe(1);
            expect(stats.bySeverity[ErrorSeverity.ERROR]).toBe(3);
            expect(stats.bySeverity[ErrorSeverity.FATAL]).toBe(1);
        });
        it('应该清空错误日志', () => {
            errorHandler.handle(new FileError('错误1'));
            errorHandler.handle(new FileError('错误2'));
            expect(errorHandler.getErrorLog()).toHaveLength(2);
            errorHandler.clearErrorLog();
            expect(errorHandler.getErrorLog()).toHaveLength(0);
        });
        it('应该限制日志大小', () => {
            errorHandler.setMaxLogSize(5);
            // 添加 10 个错误
            for (let i = 0; i < 10; i++) {
                errorHandler.handle(new FileError(`错误${i}`));
            }
            const errorLog = errorHandler.getErrorLog();
            expect(errorLog).toHaveLength(5);
            // 应该保留最新的 5 个错误
            expect(errorLog[0].message).toContain('错误5');
            expect(errorLog[4].message).toContain('错误9');
        });
    });
    describe('用户友好消息', () => {
        it('应该为文件不存在错误提供建议', () => {
            const error = new FileError('文件不存在');
            const result = errorHandler.handle(error);
            expect(result.userMessage).toContain('检查文件路径');
        });
        it('应该为权限错误提供建议', () => {
            const error = new FileError('权限不足');
            const result = errorHandler.handle(error);
            expect(result.userMessage).toContain('检查文件访问权限');
        });
        it('应该为磁盘空间错误提供建议', () => {
            const error = new SystemError('磁盘空间不足', ErrorSeverity.FATAL);
            const result = errorHandler.handle(error);
            expect(result.userMessage).toContain('清理磁盘空间');
        });
        it('应该为内存错误提供建议', () => {
            const error = new SystemError('内存不足', ErrorSeverity.FATAL);
            const result = errorHandler.handle(error);
            expect(result.userMessage).toContain('关闭其他应用程序');
        });
    });
    describe('AppError 类', () => {
        it('应该正确创建 AppError 实例', () => {
            const error = new AppError('测试错误', ErrorType.FILE_ERROR, ErrorSeverity.ERROR, { filePath: 'test.pptx' });
            expect(error.message).toBe('测试错误');
            expect(error.type).toBe(ErrorType.FILE_ERROR);
            expect(error.severity).toBe(ErrorSeverity.ERROR);
            expect(error.context).toEqual({ filePath: 'test.pptx' });
            expect(error.timestamp).toBeInstanceOf(Date);
        });
        it('应该正确判断致命错误', () => {
            const fatalError = new AppError('致命错误', ErrorType.SYSTEM_ERROR, ErrorSeverity.FATAL);
            const normalError = new AppError('普通错误', ErrorType.FILE_ERROR, ErrorSeverity.ERROR);
            expect(fatalError.isFatal()).toBe(true);
            expect(normalError.isFatal()).toBe(false);
        });
        it('应该正确转换为 JSON', () => {
            const error = new AppError('测试错误', ErrorType.FILE_ERROR, ErrorSeverity.ERROR, { filePath: 'test.pptx' });
            const json = error.toJSON();
            expect(json.name).toBe('AppError');
            expect(json.message).toBe('测试错误');
            expect(json.type).toBe(ErrorType.FILE_ERROR);
            expect(json.severity).toBe(ErrorSeverity.ERROR);
            expect(json.context).toEqual({ filePath: 'test.pptx' });
            expect(json.timestamp).toBeTruthy();
        });
        it('应该保留原始错误信息', () => {
            const originalError = new Error('原始错误');
            const appError = new AppError('包装错误', ErrorType.PROCESSING_ERROR, ErrorSeverity.ERROR, undefined, originalError);
            expect(appError.originalError).toBe(originalError);
            const json = appError.toJSON();
            expect(json.originalError?.message).toBe('原始错误');
        });
    });
    describe('错误类型继承', () => {
        it('FileError 应该继承 AppError', () => {
            const error = new FileError('文件错误');
            expect(error).toBeInstanceOf(AppError);
            expect(error).toBeInstanceOf(FileError);
            expect(error.type).toBe(ErrorType.FILE_ERROR);
        });
        it('ProcessingError 应该继承 AppError', () => {
            const error = new ProcessingError('处理错误');
            expect(error).toBeInstanceOf(AppError);
            expect(error).toBeInstanceOf(ProcessingError);
            expect(error.type).toBe(ErrorType.PROCESSING_ERROR);
        });
        it('ConfigError 应该继承 AppError', () => {
            const error = new ConfigError('配置错误');
            expect(error).toBeInstanceOf(AppError);
            expect(error).toBeInstanceOf(ConfigError);
            expect(error.type).toBe(ErrorType.CONFIG_ERROR);
        });
        it('SystemError 应该继承 AppError', () => {
            const error = new SystemError('系统错误');
            expect(error).toBeInstanceOf(AppError);
            expect(error).toBeInstanceOf(SystemError);
            expect(error.type).toBe(ErrorType.SYSTEM_ERROR);
        });
    });
    describe('边界情况', () => {
        it('应该处理空错误消息', () => {
            const error = new FileError('');
            const result = errorHandler.handle(error);
            expect(result.userMessage).toBeTruthy();
        });
        it('应该处理没有上下文的错误', () => {
            const error = new FileError('错误');
            const result = errorHandler.handle(error);
            expect(result).toBeTruthy();
            expect(result.userMessage).toBeTruthy();
        });
        it('应该处理未知错误类型', () => {
            const error = new Error('未知错误');
            const result = errorHandler.handle(error);
            expect(result.shouldContinue).toBe(true);
            expect(result.action).toBe(ErrorAction.SKIP);
        });
    });
});
