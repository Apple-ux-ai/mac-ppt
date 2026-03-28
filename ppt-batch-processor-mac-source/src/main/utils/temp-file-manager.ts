import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { randomBytes } from 'crypto'

/**
 * TempFileManager - 临时文件管理器
 * 
 * 负责创建、跟踪和清理临时文件
 * 
 * 验证需求:
 * - 22.2: 创建临时文件、自动清理临时文件、使用系统临时目录
 */
export class TempFileManager {
  // 临时文件目录
  private tempDir: string
  
  // 跟踪创建的临时文件
  private tempFiles: Set<string> = new Set()
  
  // 应用程序临时目录名称
  private static readonly APP_TEMP_DIR = 'ppt-batch-processor'
  
  constructor(customTempDir?: string) {
    // 使用自定义临时目录或系统临时目录
    this.tempDir = customTempDir || path.join(os.tmpdir(), TempFileManager.APP_TEMP_DIR)
  }
  
  /**
   * 初始化临时目录
   * 确保临时目录存在
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.tempDir, { recursive: true })
    } catch (error) {
      throw new Error(`无法创建临时目录: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  
  /**
   * 创建临时文件
   * 
   * @param originalPath - 原始文件路径（用于保留扩展名）
   * @returns 临时文件路径
   */
  async createTempFile(originalPath: string): Promise<string> {
    // 确保临时目录存在
    await this.initialize()
    
    // 获取原始文件的扩展名
    const ext = path.extname(originalPath)
    
    // 生成唯一的临时文件名
    const uniqueName = this.generateUniqueName(ext)
    const tempFilePath = path.join(this.tempDir, uniqueName)
    
    // 复制原始文件到临时位置
    try {
      await fs.copyFile(originalPath, tempFilePath)
      
      // 跟踪临时文件
      this.tempFiles.add(tempFilePath)
      
      return tempFilePath
    } catch (error) {
      throw new Error(`无法创建临时文件: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  
  /**
   * 创建空的临时文件
   * 
   * @param extension - 文件扩展名（包含点，如 '.pptx'）
   * @returns 临时文件路径
   */
  async createEmptyTempFile(extension: string = ''): Promise<string> {
    // 确保临时目录存在
    await this.initialize()
    
    // 生成唯一的临时文件名
    const uniqueName = this.generateUniqueName(extension)
    const tempFilePath = path.join(this.tempDir, uniqueName)
    
    // 创建空文件
    try {
      await fs.writeFile(tempFilePath, '')
      
      // 跟踪临时文件
      this.tempFiles.add(tempFilePath)
      
      return tempFilePath
    } catch (error) {
      throw new Error(`无法创建空临时文件: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  
  /**
   * 创建临时目录
   * 
   * @param prefix - 目录名前缀
   * @returns 临时目录路径
   */
  async createTempDir(prefix: string = 'temp'): Promise<string> {
    // 确保临时目录存在
    await this.initialize()
    
    // 生成唯一的目录名
    const uniqueName = `${prefix}-${this.generateUniqueId()}`
    const tempDirPath = path.join(this.tempDir, uniqueName)
    
    try {
      await fs.mkdir(tempDirPath, { recursive: true })
      
      // 跟踪临时目录
      this.tempFiles.add(tempDirPath)
      
      return tempDirPath
    } catch (error) {
      throw new Error(`无法创建临时目录: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  
  /**
   * 删除指定的临时文件
   * 
   * @param tempFilePath - 临时文件路径
   */
  async deleteTempFile(tempFilePath: string): Promise<void> {
    if (!this.tempFiles.has(tempFilePath)) {
      // 不是由此管理器创建的临时文件，跳过
      return
    }
    
    try {
      const stats = await fs.stat(tempFilePath)
      
      if (stats.isDirectory()) {
        // 递归删除目录
        await fs.rm(tempFilePath, { recursive: true, force: true })
      } else {
        // 删除文件
        await fs.unlink(tempFilePath)
      }
      
      // 从跟踪集合中移除
      this.tempFiles.delete(tempFilePath)
    } catch (error) {
      // 文件可能已经被删除，忽略错误
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn(`删除临时文件失败: ${tempFilePath}`, error)
      }
      
      // 即使删除失败，也从跟踪集合中移除
      this.tempFiles.delete(tempFilePath)
    }
  }
  
  /**
   * 清理所有临时文件
   * 删除所有由此管理器创建的临时文件
   */
  async cleanupTempFiles(): Promise<void> {
    const deletePromises: Promise<void>[] = []
    
    // 删除所有跟踪的临时文件
    for (const tempFile of this.tempFiles) {
      deletePromises.push(this.deleteTempFile(tempFile))
    }
    
    await Promise.all(deletePromises)
    
    // 清空跟踪集合
    this.tempFiles.clear()
  }
  
  /**
   * 清理整个临时目录
   * 删除应用程序的整个临时目录及其所有内容
   */
  async cleanupTempDir(): Promise<void> {
    try {
      // 先清理跟踪的文件
      await this.cleanupTempFiles()
      
      // 检查临时目录是否存在
      try {
        await fs.access(this.tempDir)
      } catch {
        // 目录不存在，无需清理
        return
      }
      
      // 删除整个临时目录
      await fs.rm(this.tempDir, { recursive: true, force: true })
    } catch (error) {
      console.warn(`清理临时目录失败: ${this.tempDir}`, error)
    }
  }
  
  /**
   * 获取临时目录路径
   * 
   * @returns 临时目录路径
   */
  getTempDir(): string {
    return this.tempDir
  }
  
  /**
   * 获取跟踪的临时文件数量
   * 
   * @returns 临时文件数量
   */
  getTempFileCount(): number {
    return this.tempFiles.size
  }
  
  /**
   * 获取所有跟踪的临时文件路径
   * 
   * @returns 临时文件路径数组
   */
  getTempFiles(): string[] {
    return Array.from(this.tempFiles)
  }
  
  /**
   * 检查文件是否是临时文件
   * 
   * @param filePath - 文件路径
   * @returns 是否是临时文件
   */
  isTempFile(filePath: string): boolean {
    return this.tempFiles.has(filePath)
  }
  
  /**
   * 生成唯一的文件名
   * 
   * @param extension - 文件扩展名
   * @returns 唯一文件名
   */
  private generateUniqueName(extension: string): string {
    const timestamp = Date.now()
    const uniqueId = this.generateUniqueId()
    return `temp-${timestamp}-${uniqueId}${extension}`
  }
  
  /**
   * 生成唯一 ID
   * 
   * @returns 唯一 ID 字符串
   */
  private generateUniqueId(): string {
    return randomBytes(8).toString('hex')
  }
}

// 导出默认实例
export const tempFileManager = new TempFileManager()

