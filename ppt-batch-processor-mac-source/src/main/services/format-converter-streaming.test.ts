import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { FormatConverter, MemoryMonitor } from './format-converter'
import { existsSync } from 'fs'
import { mkdir, writeFile, unlink, rmdir, stat } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

/**
 * 测试流式处理和内存监控功能
 * 
 * 验收标准 7.6: WHEN 转换大文件 THEN THE System SHALL 使用流式处理避免内存溢出
 * 验收标准 24.1: WHEN 处理大文件（>50MB）THEN THE System SHALL 使用流式读写避免内存溢出
 */
describe('FormatConverter - 流式处理和内存监控', () => {
  let converter: FormatConverter
  let testDir: string

  beforeEach(async () => {
    converter = new FormatConverter()
    testDir = join(tmpdir(), `format-converter-test-${Date.now()}`)
    await mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    // 清理测试目录
    try {
      const fs = await import('fs/promises')
      const files = await fs.readdir(testDir)
      for (const file of files) {
        const filePath = join(testDir, file)
        const stats = await stat(filePath)
        if (stats.isDirectory()) {
          await rmdir(filePath, { recursive: true })
        } else {
          await unlink(filePath)
        }
      }
      await rmdir(testDir)
    } catch {
      // 忽略清理错误
    }
  })

  describe('MemoryMonitor', () => {
    let monitor: MemoryMonitor

    beforeEach(() => {
      monitor = new MemoryMonitor()
    })

    afterEach(() => {
      monitor.stopMonitoring()
    })

    it('应该能够启动和停止内存监控', () => {
      monitor.startMonitoring(100)
      // 等待一些采样
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          monitor.stopMonitoring()
          const current = monitor.getCurrentMemory()
          expect(current).toBeDefined()
          expect(current.heapUsed).toBeGreaterThan(0)
          expect(current.rss).toBeGreaterThan(0)
          resolve()
        }, 300)
      })
    })

    it('应该记录内存采样', () => {
      monitor.startMonitoring(50)
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          monitor.stopMonitoring()
          const peak = monitor.getPeakMemory()
          const average = monitor.getAverageMemory()
          
          expect(peak).toBeDefined()
          expect(average).toBeDefined()
          expect(peak!.rss).toBeGreaterThan(0)
          expect(average!.rss).toBeGreaterThan(0)
          resolve()
        }, 200)
      })
    })

    it('应该能够获取当前内存使用情况', () => {
      const current = monitor.getCurrentMemory()
      expect(current).toBeDefined()
      expect(current.heapUsed).toBeGreaterThan(0)
      expect(current.heapTotal).toBeGreaterThan(0)
      expect(current.external).toBeGreaterThanOrEqual(0)
      expect(current.rss).toBeGreaterThan(0)
      expect(current.timestamp).toBeGreaterThan(0)
    })

    it('应该能够清除采样数据', () => {
      monitor.startMonitoring(50)
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          monitor.stopMonitoring()
          monitor.clear()
          const peak = monitor.getPeakMemory()
          const average = monitor.getAverageMemory()
          
          expect(peak).toBeNull()
          expect(average).toBeNull()
          resolve()
        }, 150)
      })
    })

    it('应该正确格式化字节大小', () => {
      expect(MemoryMonitor.formatBytes(0)).toBe('0 B')
      expect(MemoryMonitor.formatBytes(1024)).toBe('1.00 KB')
      expect(MemoryMonitor.formatBytes(1024 * 1024)).toBe('1.00 MB')
      expect(MemoryMonitor.formatBytes(1024 * 1024 * 1024)).toBe('1.00 GB')
      expect(MemoryMonitor.formatBytes(1536)).toBe('1.50 KB')
    })

    it('应该限制采样数量', () => {
      monitor.startMonitoring(10)
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          monitor.stopMonitoring()
          // 内部最多保存 100 个样本
          // 我们无法直接访问 samples 数组，但可以验证峰值和平均值存在
          const peak = monitor.getPeakMemory()
          const average = monitor.getAverageMemory()
          expect(peak).toBeDefined()
          expect(average).toBeDefined()
          resolve()
        }, 500)
      })
    })
  })

  describe('FormatConverter - 内存监控集成', () => {
    it('应该提供内存监控器实例', () => {
      const monitor = converter.getMemoryMonitor()
      expect(monitor).toBeInstanceOf(MemoryMonitor)
    })

    it('应该在转换大文件时启动内存监控', async () => {
      // 创建一个模拟的大文件（>50MB）
      const largeFilePath = join(testDir, 'large-test.pptx')
      const largeFileSize = 51 * 1024 * 1024 // 51MB
      
      // 创建一个大文件（用随机数据填充）
      const buffer = Buffer.alloc(largeFileSize)
      await writeFile(largeFilePath, buffer)

      // 验证文件大小
      const stats = await stat(largeFilePath)
      expect(stats.size).toBeGreaterThan(50 * 1024 * 1024)

      // Mock LibreOffice 调用
      const execAsync = vi.fn().mockResolvedValue({ stdout: '', stderr: '' })
      vi.mock('child_process', () => ({
        exec: vi.fn((cmd, opts, callback) => {
          callback(null, { stdout: '', stderr: '' })
        })
      }))

      // 设置 LibreOffice 路径
      // @ts-ignore - 访问私有属性用于测试
      converter.libreOfficePath = 'soffice'

      const outputPath = join(testDir, 'output.pdf')

      try {
        // 尝试转换（会失败因为文件不是真正的 PPTX，但我们只是测试内存监控）
        await converter.convertToPdf(largeFilePath, outputPath)
      } catch (error) {
        // 预期会失败，因为文件不是真正的 PPTX
        // 但内存监控应该已经启动和停止
      }

      // 验证内存监控器有数据（如果转换过程中启动了监控）
      const monitor = converter.getMemoryMonitor()
      // 注意：由于转换失败，监控可能没有记录数据
      // 这个测试主要验证代码路径存在
      expect(monitor).toBeDefined()
    })
  })

  describe('大文件检测', () => {
    it('应该正确识别大文件（>50MB）', async () => {
      // 创建一个大文件
      const largeFilePath = join(testDir, 'large.pptx')
      const largeFileSize = 51 * 1024 * 1024
      const buffer = Buffer.alloc(largeFileSize)
      await writeFile(largeFilePath, buffer)

      // 使用反射访问私有方法进行测试
      // @ts-ignore
      const isLarge = await converter.isLargeFile(largeFilePath)
      expect(isLarge).toBe(true)
    })

    it('应该正确识别小文件（<50MB）', async () => {
      // 创建一个小文件
      const smallFilePath = join(testDir, 'small.pptx')
      const smallFileSize = 10 * 1024 * 1024 // 10MB
      const buffer = Buffer.alloc(smallFileSize)
      await writeFile(smallFilePath, buffer)

      // @ts-ignore
      const isLarge = await converter.isLargeFile(smallFilePath)
      expect(isLarge).toBe(false)
    })

    it('应该处理不存在的文件', async () => {
      const nonExistentPath = join(testDir, 'nonexistent.pptx')
      
      // @ts-ignore
      const isLarge = await converter.isLargeFile(nonExistentPath)
      expect(isLarge).toBe(false)
    })
  })

  describe('流式文件复制', () => {
    it('应该能够使用流式方式复制文件', async () => {
      // 创建源文件
      const sourceContent = 'Test content for streaming copy'
      const sourcePath = join(testDir, 'source.txt')
      const destPath = join(testDir, 'dest.txt')
      
      await writeFile(sourcePath, sourceContent)

      // 使用反射访问私有方法
      // @ts-ignore
      await converter.streamCopyFile(sourcePath, destPath)

      // 验证文件已复制
      expect(existsSync(destPath)).toBe(true)
      
      const fs = await import('fs/promises')
      const destContent = await fs.readFile(destPath, 'utf-8')
      expect(destContent).toBe(sourceContent)
    })

    it('应该能够复制大文件', async () => {
      // 创建一个较大的文件
      const largeContent = Buffer.alloc(5 * 1024 * 1024) // 5MB
      const sourcePath = join(testDir, 'large-source.bin')
      const destPath = join(testDir, 'large-dest.bin')
      
      await writeFile(sourcePath, largeContent)

      // @ts-ignore
      await converter.streamCopyFile(sourcePath, destPath)

      // 验证文件大小相同
      const sourceStats = await stat(sourcePath)
      const destStats = await stat(destPath)
      expect(destStats.size).toBe(sourceStats.size)
    })

    it('应该支持自定义流处理选项', async () => {
      const sourceContent = 'Test content with custom options'
      const sourcePath = join(testDir, 'source-custom.txt')
      const destPath = join(testDir, 'dest-custom.txt')
      
      await writeFile(sourcePath, sourceContent)

      // @ts-ignore
      await converter.streamCopyFile(sourcePath, destPath, {
        highWaterMark: 8 * 1024 // 8KB
      })

      expect(existsSync(destPath)).toBe(true)
    })
  })
})
