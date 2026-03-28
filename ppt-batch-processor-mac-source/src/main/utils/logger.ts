import fs from 'fs/promises'
import path from 'path'
import { AppError } from './error-handler'

/**
 * Logger - 日志系统
 * 
 * 负责记录错误详情、生成日志文件和支持不同日志级别
 * 
 * 验证需求:
 * - 21.4: 批量任务完成时生成包含所有错误信息的日志文件
 * - 21.5: 查看日志时显示每个错误的文件名、错误类型和详细描述
 */

/**
 * 日志级别
 */
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

/**
 * 日志级别优先级
 */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  [LogLevel.DEBUG]: 0,
  [LogLevel.INFO]: 1,
  [LogLevel.WARN]: 2,
  [LogLevel.ERROR]: 3
}

/**
 * 日志条目
 */
export interface LogEntry {
  timestamp: Date
  level: LogLevel
  message: string
  context?: Record<string, any>
  error?: AppError
  stack?: string
}

/**
 * 日志配置
 */
export interface LoggerConfig {
  logLevel: LogLevel
  logDir: string
  maxFileSize: number  // 最大文件大小（字节）
  maxFiles: number     // 最大文件数量
  enableConsole: boolean
  enableFile: boolean
}

/**
 * Logger 类
 */
export class Logger {
  private config: LoggerConfig
  private logBuffer: LogEntry[] = []
  private currentLogFile: string | null = null
  private isWriting: boolean = false

  constructor(config?: Partial<LoggerConfig>) {
    this.config = {
      logLevel: LogLevel.INFO,
      logDir: path.join(process.env.APPDATA || process.env.HOME || '.', 'ppt-batch-processor', 'logs'),
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxFiles: 10,
      enableConsole: true,
      enableFile: true,
      ...config
    }
  }

  /**
   * 初始化日志系统
   */
  async initialize(): Promise<void> {
    if (this.config.enableFile) {
      // 创建日志目录
      await fs.mkdir(this.config.logDir, { recursive: true })

      // 生成当前日志文件名
      this.currentLogFile = this.generateLogFileName()

      // 清理旧日志文件
      await this.cleanupOldLogs()
    }
  }

  /**
   * 记录 DEBUG 级别日志
   */
  debug(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, context)
  }

  /**
   * 记录 INFO 级别日志
   */
  info(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, context)
  }

  /**
   * 记录 WARN 级别日志
   */
  warn(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, context)
  }

  /**
   * 记录 ERROR 级别日志
   */
  error(message: string, error?: Error | AppError, context?: Record<string, any>): void {
    const entry: LogEntry = {
      timestamp: new Date(),
      level: LogLevel.ERROR,
      message,
      context,
      error: error instanceof AppError ? error : undefined,
      stack: error?.stack
    }

    this.writeLog(entry)
  }

  /**
   * 记录日志
   */
  private log(level: LogLevel, message: string, context?: Record<string, any>): void {
    // 检查日志级别
    if (!this.shouldLog(level)) {
      return
    }

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      context
    }

    this.writeLog(entry)
  }

  /**
   * 写入日志
   */
  private writeLog(entry: LogEntry): void {
    // 添加到缓冲区
    this.logBuffer.push(entry)

    // 输出到控制台
    if (this.config.enableConsole) {
      this.writeToConsole(entry)
    }

    // 异步写入文件
    if (this.config.enableFile) {
      this.flushToFile().catch(err => {
        console.error('写入日志文件失败:', err)
      })
    }
  }

  /**
   * 输出到控制台
   */
  private writeToConsole(entry: LogEntry): void {
    const timestamp = entry.timestamp.toISOString()
    const level = entry.level.padEnd(5)
    const message = entry.message

    let logMessage = `[${timestamp}] [${level}] ${message}`

    if (entry.context) {
      logMessage += ` ${JSON.stringify(entry.context)}`
    }

    if (entry.error) {
      logMessage += `\n  Error: ${entry.error.message}`
      if (entry.error.context) {
        logMessage += `\n  Context: ${JSON.stringify(entry.error.context)}`
      }
    }

    if (entry.stack) {
      logMessage += `\n${entry.stack}`
    }

    // 根据级别选择输出方法
    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(logMessage)
        break
      case LogLevel.INFO:
        console.info(logMessage)
        break
      case LogLevel.WARN:
        console.warn(logMessage)
        break
      case LogLevel.ERROR:
        console.error(logMessage)
        break
    }
  }

  /**
   * 刷新缓冲区到文件
   */
  private async flushToFile(): Promise<void> {
    if (this.isWriting || this.logBuffer.length === 0 || !this.currentLogFile) {
      return
    }

    this.isWriting = true

    try {
      // 获取待写入的日志
      const entries = [...this.logBuffer]
      this.logBuffer = []

      // 格式化日志内容
      const logContent = entries.map(entry => this.formatLogEntry(entry)).join('\n') + '\n'

      // 写入文件
      const logFilePath = path.join(this.config.logDir, this.currentLogFile)
      
      // 确保目录存在
      await fs.mkdir(path.dirname(logFilePath), { recursive: true })
      
      await fs.appendFile(logFilePath, logContent, 'utf-8')

      // 检查文件大小
      await this.checkFileSize(logFilePath)
    } catch (error) {
      console.error('写入日志文件失败:', error)
      // 将日志放回缓冲区
      // this.logBuffer.unshift(...entries)
    } finally {
      this.isWriting = false
    }
  }

  /**
   * 格式化日志条目
   */
  private formatLogEntry(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString()
    const level = entry.level.padEnd(5)
    let logLine = `[${timestamp}] [${level}] ${entry.message}`

    if (entry.context) {
      logLine += ` | Context: ${JSON.stringify(entry.context)}`
    }

    if (entry.error) {
      logLine += `\n  Error Type: ${entry.error.type}`
      logLine += `\n  Error Severity: ${entry.error.severity}`
      logLine += `\n  Error Message: ${entry.error.message}`

      if (entry.error.context) {
        logLine += `\n  Error Context: ${JSON.stringify(entry.error.context)}`
      }

      if (entry.error.originalError) {
        logLine += `\n  Original Error: ${entry.error.originalError.message}`
      }
    }

    if (entry.stack) {
      logLine += `\n${entry.stack}`
    }

    return logLine
  }

  /**
   * 检查文件大小
   */
  private async checkFileSize(filePath: string): Promise<void> {
    try {
      const stats = await fs.stat(filePath)

      if (stats.size >= this.config.maxFileSize) {
        // 文件过大，创建新文件
        this.currentLogFile = this.generateLogFileName()
      }
    } catch (error) {
      // 文件不存在，忽略
    }
  }

  /**
   * 生成日志文件名
   */
  private generateLogFileName(): string {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hour = String(now.getHours()).padStart(2, '0')
    const minute = String(now.getMinutes()).padStart(2, '0')
    const second = String(now.getSeconds()).padStart(2, '0')

    return `app-${year}${month}${day}-${hour}${minute}${second}.log`
  }

  /**
   * 清理旧日志文件
   */
  private async cleanupOldLogs(): Promise<void> {
    try {
      const files = await fs.readdir(this.config.logDir)
      const logFiles = files
        .filter(file => file.endsWith('.log'))
        .map(file => ({
          name: file,
          path: path.join(this.config.logDir, file)
        }))

      // 按修改时间排序
      const filesWithStats = await Promise.all(
        logFiles.map(async file => ({
          ...file,
          stats: await fs.stat(file.path)
        }))
      )

      filesWithStats.sort((a, b) => b.stats.mtimeMs - a.stats.mtimeMs)

      // 删除超过最大数量的文件
      if (filesWithStats.length > this.config.maxFiles) {
        const filesToDelete = filesWithStats.slice(this.config.maxFiles)

        for (const file of filesToDelete) {
          try {
            await fs.unlink(file.path)
          } catch (error) {
            console.warn(`删除旧日志文件失败: ${file.name}`, error)
          }
        }
      }
    } catch (error) {
      console.warn('清理旧日志文件失败:', error)
    }
  }

  /**
   * 判断是否应该记录日志
   */
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.config.logLevel]
  }

  /**
   * 设置日志级别
   */
  setLogLevel(level: LogLevel): void {
    this.config.logLevel = level
  }

  /**
   * 获取日志级别
   */
  getLogLevel(): LogLevel {
    return this.config.logLevel
  }

  /**
   * 获取日志目录
   */
  getLogDir(): string {
    return this.config.logDir
  }

  /**
   * 获取当前日志文件路径
   */
  getCurrentLogFile(): string | null {
    if (!this.currentLogFile) {
      return null
    }
    return path.join(this.config.logDir, this.currentLogFile)
  }

  /**
   * 强制刷新缓冲区
   */
  async flush(): Promise<void> {
    if (this.config.enableFile) {
      await this.flushToFile()
    }
  }

  /**
   * 生成错误报告
   * 
   * @param errors - 错误列表
   * @param outputPath - 输出路径
   */
  async generateErrorReport(errors: AppError[], outputPath?: string): Promise<string> {
    const reportPath = outputPath || path.join(
      this.config.logDir,
      `error-report-${Date.now()}.log`
    )

    let report = '# 错误报告\n\n'
    report += `生成时间: ${new Date().toISOString()}\n`
    report += `错误总数: ${errors.length}\n\n`

    // 按类型分组
    const errorsByType = errors.reduce((acc, error) => {
      if (!acc[error.type]) {
        acc[error.type] = []
      }
      acc[error.type].push(error)
      return acc
    }, {} as Record<string, AppError[]>)

    // 生成报告内容
    for (const [type, typeErrors] of Object.entries(errorsByType)) {
      report += `## ${type} (${typeErrors.length})\n\n`

      for (const error of typeErrors) {
        report += `### ${error.message}\n`
        report += `- 时间: ${error.timestamp.toISOString()}\n`
        report += `- 严重程度: ${error.severity}\n`

        if (error.context) {
          report += `- 上下文:\n`
          for (const [key, value] of Object.entries(error.context)) {
            report += `  - ${key}: ${JSON.stringify(value)}\n`
          }
        }

        if (error.originalError) {
          report += `- 原始错误: ${error.originalError.message}\n`
        }

        if (error.stack) {
          report += `- 堆栈:\n\`\`\`\n${error.stack}\n\`\`\`\n`
        }

        report += '\n'
      }
    }

    // 写入文件
    await fs.writeFile(reportPath, report, 'utf-8')

    return reportPath
  }

  /**
   * 读取日志文件
   * 
   * @param fileName - 日志文件名（可选）
   * @returns 日志内容
   */
  async readLogFile(fileName?: string): Promise<string> {
    const logFile = fileName || this.currentLogFile

    if (!logFile) {
      throw new Error('没有可用的日志文件')
    }

    const logFilePath = path.join(this.config.logDir, logFile)

    try {
      return await fs.readFile(logFilePath, 'utf-8')
    } catch (error) {
      throw new Error(`读取日志文件失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 列出所有日志文件
   */
  async listLogFiles(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.config.logDir)
      return files.filter(file => file.endsWith('.log')).sort().reverse()
    } catch (error) {
      return []
    }
  }
}

// 导出默认实例
export const logger = new Logger()
