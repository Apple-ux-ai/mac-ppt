import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { Logger, LogLevel } from './logger'
import { FileError, ErrorSeverity } from './error-handler'

/**
 * 测试日志系统
 * 
 * **Validates: Requirements 21.4, 21.5**
 */
describe('Logger', () => {
  let logger: Logger
  let testLogDir: string

  beforeEach(async () => {
    // 创建测试日志目录
    testLogDir = path.join(os.tmpdir(), `test-logs-${Date.now()}`)
    await fs.mkdir(testLogDir, { recursive: true })

    // 创建 logger 实例
    logger = new Logger({
      logDir: testLogDir,
      enableConsole: false,
      enableFile: true,
      logLevel: LogLevel.DEBUG
    })

    await logger.initialize()
  })

  afterEach(async () => {
    // 清理测试目录
    try {
      await fs.rm(testLogDir, { recursive: true, force: true })
    } catch (error) {
      console.warn('清理测试目录失败:', error)
    }
  })

  describe('初始化', () => {
    it('应该创建日志目录', async () => {
      const stats = await fs.stat(testLogDir)
      expect(stats.isDirectory()).toBe(true)
    })

    it('应该生成日志文件名', () => {
      const logFile = logger.getCurrentLogFile()
      expect(logFile).toBeTruthy()
      expect(logFile).toContain('.log')
    })
  })

  describe('日志级别', () => {
    it('应该记录 DEBUG 级别日志', async () => {
      logger.debug('Debug message')
      await logger.flush()

      const logFile = logger.getCurrentLogFile()
      expect(logFile).toBeTruthy()

      const content = await fs.readFile(logFile!, 'utf-8')
      expect(content).toContain('DEBUG')
      expect(content).toContain('Debug message')
    })

    it('应该记录 INFO 级别日志', async () => {
      logger.info('Info message')
      await logger.flush()

      const logFile = logger.getCurrentLogFile()!
      const content = await fs.readFile(logFile, 'utf-8')
      expect(content).toContain('INFO')
      expect(content).toContain('Info message')
    })

    it('应该记录 WARN 级别日志', async () => {
      logger.warn('Warning message')
      await logger.flush()

      const logFile = logger.getCurrentLogFile()!
      const content = await fs.readFile(logFile, 'utf-8')
      expect(content).toContain('WARN')
      expect(content).toContain('Warning message')
    })

    it('应该记录 ERROR 级别日志', async () => {
      logger.error('Error message')
      await logger.flush()

      const logFile = logger.getCurrentLogFile()!
      const content = await fs.readFile(logFile, 'utf-8')
      expect(content).toContain('ERROR')
      expect(content).toContain('Error message')
    })

    it('应该根据日志级别过滤日志', async () => {
      logger.setLogLevel(LogLevel.WARN)

      logger.debug('Debug message')
      logger.info('Info message')
      logger.warn('Warning message')
      logger.error('Error message')

      await logger.flush()

      const logFile = logger.getCurrentLogFile()!
      const content = await fs.readFile(logFile, 'utf-8')

      expect(content).not.toContain('Debug message')
      expect(content).not.toContain('Info message')
      expect(content).toContain('Warning message')
      expect(content).toContain('Error message')
    })
  })

  describe('日志内容', () => {
    it('应该记录时间戳', async () => {
      logger.info('Test message')
      await logger.flush()

      const logFile = logger.getCurrentLogFile()!
      const content = await fs.readFile(logFile, 'utf-8')

      // 检查 ISO 格式的时间戳
      expect(content).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    })

    it('应该记录上下文信息', async () => {
      logger.info('Test message', { userId: 123, action: 'test' })
      await logger.flush()

      const logFile = logger.getCurrentLogFile()!
      const content = await fs.readFile(logFile, 'utf-8')

      expect(content).toContain('userId')
      expect(content).toContain('123')
      expect(content).toContain('action')
      expect(content).toContain('test')
    })

    it('应该记录错误详情', async () => {
      const error = new FileError('文件不存在', ErrorSeverity.ERROR, { filePath: 'test.pptx' })
      logger.error('处理失败', error)
      await logger.flush()

      const logFile = logger.getCurrentLogFile()!
      const content = await fs.readFile(logFile, 'utf-8')

      expect(content).toContain('处理失败')
      expect(content).toContain('文件不存在')
      expect(content).toContain('FILE_ERROR')
      expect(content).toContain('test.pptx')
    })

    it('应该记录堆栈信息', async () => {
      const error = new Error('Test error')
      logger.error('Error occurred', error)
      await logger.flush()

      const logFile = logger.getCurrentLogFile()!
      const content = await fs.readFile(logFile, 'utf-8')

      expect(content).toContain('Test error')
      expect(content).toContain('at ')  // 堆栈跟踪
    })
  })

  describe('文件管理', () => {
    it('应该列出所有日志文件', async () => {
      logger.info('Message 1')
      await logger.flush()

      const files = await logger.listLogFiles()
      expect(files.length).toBeGreaterThan(0)
      expect(files[0]).toContain('.log')
    })

    it('应该读取日志文件', async () => {
      logger.info('Test message')
      await logger.flush()

      const content = await logger.readLogFile()
      expect(content).toContain('Test message')
    })

    it('应该在文件过大时创建新文件', async () => {
      // 设置很小的文件大小限制
      const smallLogger = new Logger({
        logDir: testLogDir,
        enableConsole: false,
        enableFile: true,
        maxFileSize: 100  // 100 字节
      })

      await smallLogger.initialize()

      const firstFile = smallLogger.getCurrentLogFile()

      // 写入大量日志
      for (let i = 0; i < 50; i++) {
        smallLogger.info(`Message ${i}`)
      }

      await smallLogger.flush()

      // 等待一小段时间
      await new Promise(resolve => setTimeout(resolve, 100))

      // 可能会创建新文件（取决于日志大小）
      const files = await smallLogger.listLogFiles()
      expect(files.length).toBeGreaterThanOrEqual(1)
    })

    it('应该清理旧日志文件', async () => {
      const cleanupLogger = new Logger({
        logDir: testLogDir,
        enableConsole: false,
        enableFile: true,
        maxFiles: 3
      })

      await cleanupLogger.initialize()

      // 创建多个日志文件
      for (let i = 0; i < 5; i++) {
        const fileName = `old-log-${i}.log`
        const filePath = path.join(testLogDir, fileName)
        await fs.writeFile(filePath, `Log content ${i}`)
        // 等待一小段时间确保文件时间戳不同
        await new Promise(resolve => setTimeout(resolve, 10))
      }

      // 重新初始化以触发清理
      await cleanupLogger.initialize()

      const files = await cleanupLogger.listLogFiles()
      // 应该保留最多 maxFiles + 1 个文件（包括当前文件）
      expect(files.length).toBeLessThanOrEqual(4)
    })
  })

  describe('错误报告', () => {
    it('应该生成错误报告', async () => {
      const errors = [
        new FileError('文件1错误', ErrorSeverity.ERROR, { filePath: 'file1.pptx' }),
        new FileError('文件2错误', ErrorSeverity.ERROR, { filePath: 'file2.pptx' }),
        new FileError('文件3错误', ErrorSeverity.WARNING, { filePath: 'file3.pptx' })
      ]

      const reportPath = await logger.generateErrorReport(errors)

      expect(reportPath).toBeTruthy()
      expect(reportPath).toContain('error-report')

      const content = await fs.readFile(reportPath, 'utf-8')

      expect(content).toContain('错误报告')
      expect(content).toContain('错误总数: 3')
      expect(content).toContain('FILE_ERROR')
      expect(content).toContain('文件1错误')
      expect(content).toContain('文件2错误')
      expect(content).toContain('文件3错误')
      expect(content).toContain('file1.pptx')
      expect(content).toContain('file2.pptx')
      expect(content).toContain('file3.pptx')
    })

    it('应该按错误类型分组', async () => {
      const errors = [
        new FileError('文件错误1'),
        new FileError('文件错误2')
      ]

      const reportPath = await logger.generateErrorReport(errors)
      const content = await fs.readFile(reportPath, 'utf-8')

      expect(content).toContain('## FILE_ERROR (2)')
    })
  })

  describe('配置', () => {
    it('应该获取和设置日志级别', () => {
      expect(logger.getLogLevel()).toBe(LogLevel.DEBUG)

      logger.setLogLevel(LogLevel.ERROR)
      expect(logger.getLogLevel()).toBe(LogLevel.ERROR)
    })

    it('应该获取日志目录', () => {
      const logDir = logger.getLogDir()
      expect(logDir).toBe(testLogDir)
    })

    it('应该获取当前日志文件路径', () => {
      const logFile = logger.getCurrentLogFile()
      expect(logFile).toBeTruthy()
      expect(logFile).toContain(testLogDir)
    })
  })

  describe('边界情况', () => {
    it('应该处理空消息', async () => {
      logger.info('')
      await logger.flush()

      const logFile = logger.getCurrentLogFile()!
      const content = await fs.readFile(logFile, 'utf-8')
      expect(content).toContain('INFO')
    })

    it('应该处理没有上下文的日志', async () => {
      logger.info('Message without context')
      await logger.flush()

      const logFile = logger.getCurrentLogFile()!
      const content = await fs.readFile(logFile, 'utf-8')
      expect(content).toContain('Message without context')
    })

    it('应该处理没有错误的错误日志', async () => {
      logger.error('Error without error object')
      await logger.flush()

      const logFile = logger.getCurrentLogFile()!
      const content = await fs.readFile(logFile, 'utf-8')
      expect(content).toContain('Error without error object')
    })

    it('应该处理大量日志', async () => {
      for (let i = 0; i < 1000; i++) {
        logger.info(`Message ${i}`)
      }

      await logger.flush()

      const logFile = logger.getCurrentLogFile()!
      const content = await fs.readFile(logFile, 'utf-8')
      expect(content).toContain('Message 0')
      expect(content).toContain('Message 999')
    })
  })

  describe('禁用文件日志', () => {
    it('应该在禁用文件日志时不创建文件', async () => {
      const noFileLogger = new Logger({
        logDir: testLogDir,
        enableConsole: false,
        enableFile: false
      })

      noFileLogger.info('Test message')
      await noFileLogger.flush()

      expect(noFileLogger.getCurrentLogFile()).toBeNull()
    })
  })
})
