import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'
import { FormatConverter, MemoryMonitor } from './format-converter'
import { mkdir, writeFile, unlink, rmdir, stat } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { existsSync } from 'fs'

/**
 * 属性测试：流式处理内存限制
 * 
 * **Validates: Requirements 7.6, 24.1**
 * 
 * 属性 18: 流式处理内存限制
 * 
 * *对于任意* 大文件（>50MB）处理操作，系统内存使用应保持在合理范围内（不超过文件大小的 2 倍），
 * 不应出现内存溢出。
 * 
 * 验收标准 7.6: WHEN 转换大文件 THEN THE System SHALL 使用流式处理避免内存溢出
 * 验收标准 24.1: WHEN 处理大文件（>50MB）THEN THE System SHALL 使用流式读写避免内存溢出
 */
describe('Property 18: 流式处理内存限制', () => {
  let converter: FormatConverter
  let testDir: string

  beforeEach(async () => {
    converter = new FormatConverter()
    testDir = join(tmpdir(), `format-converter-memory-test-${Date.now()}`)
    await mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    // 清理测试目录
    try {
      const fs = await import('fs/promises')
      const files = await fs.readdir(testDir)
      for (const file of files) {
        const filePath = join(testDir, file)
        const fileStats = await stat(filePath)
        if (fileStats.isDirectory()) {
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

  /**
   * 生成器：生成大文件大小（50MB - 200MB）
   * 
   * 为了测试性能，我们使用较小的文件大小范围，但仍然大于 50MB 阈值
   */
  const largeFileSizeArbitrary = fc.integer({ min: 50, max: 100 }).map(mb => mb * 1024 * 1024)

  /**
   * 生成器：生成文件内容块大小
   */
  const chunkSizeArbitrary = fc.integer({ min: 1024, max: 64 * 1024 }) // 1KB - 64KB

  /**
   * 辅助函数：创建指定大小的测试文件
   */
  async function createTestFile(filePath: string, size: number): Promise<void> {
    // 使用流式写入创建大文件，避免一次性分配大内存
    const fs = await import('fs')
    const writeStream = fs.createWriteStream(filePath)
    
    const chunkSize = 64 * 1024 // 64KB chunks
    let written = 0
    
    while (written < size) {
      const remaining = size - written
      const currentChunkSize = Math.min(chunkSize, remaining)
      const chunk = Buffer.alloc(currentChunkSize, 0)
      
      // 写入一些模式数据以避免压缩
      for (let i = 0; i < currentChunkSize; i++) {
        chunk[i] = (written + i) % 256
      }
      
      writeStream.write(chunk)
      written += currentChunkSize
    }
    
    return new Promise((resolve, reject) => {
      writeStream.end(() => resolve())
      writeStream.on('error', reject)
    })
  }

  /**
   * 辅助函数：测试流式文件复制的内存使用
   */
  async function testStreamCopyMemory(fileSize: number): Promise<{
    fileSize: number
    peakMemory: number
    memoryRatio: number
    success: boolean
  }> {
    const sourcePath = join(testDir, `source-${Date.now()}.bin`)
    const destPath = join(testDir, `dest-${Date.now()}.bin`)
    
    try {
      // 创建测试文件
      await createTestFile(sourcePath, fileSize)
      
      // 验证文件大小
      const stats = await stat(sourcePath)
      expect(stats.size).toBe(fileSize)
      
      // 获取内存监控器
      const monitor = converter.getMemoryMonitor()
      monitor.clear()
      
      // 记录开始时的内存
      const startMemory = monitor.getCurrentMemory()
      
      // 启动内存监控
      monitor.startMonitoring(100) // 每 100ms 采样
      
      // 执行流式复制
      // @ts-ignore - 访问私有方法用于测试
      await converter.streamCopyFile(sourcePath, destPath, {
        highWaterMark: 16 * 1024 // 16KB 缓冲区
      })
      
      // 停止监控
      monitor.stopMonitoring()
      
      // 获取峰值内存
      const peakMemory = monitor.getPeakMemory()
      expect(peakMemory).not.toBeNull()
      
      // 计算内存增长（峰值 - 开始）
      const memoryGrowth = peakMemory!.rss - startMemory.rss
      
      // 计算内存使用比率（相对于文件大小）
      const memoryRatio = memoryGrowth / fileSize
      
      // 验证目标文件存在且大小正确
      expect(existsSync(destPath)).toBe(true)
      const destStats = await stat(destPath)
      expect(destStats.size).toBe(fileSize)
      
      // 清理文件
      await unlink(sourcePath)
      await unlink(destPath)
      
      return {
        fileSize,
        peakMemory: memoryGrowth,
        memoryRatio,
        success: true
      }
    } catch (error) {
      // 清理文件
      try {
        if (existsSync(sourcePath)) await unlink(sourcePath)
        if (existsSync(destPath)) await unlink(destPath)
      } catch {
        // 忽略清理错误
      }
      
      throw error
    }
  }

  /**
   * 属性测试 1: 流式文件复制的内存使用应该有上限
   * 
   * 对于任意大文件（>50MB），流式复制操作的内存增长应该有一个固定的上限，
   * 证明使用了流式处理而不是一次性加载整个文件
   */
  it('属性 18.1: 流式文件复制的内存使用应该有上限', async () => {
    await fc.assert(
      fc.asyncProperty(
        largeFileSizeArbitrary,
        async (fileSize) => {
          const result = await testStreamCopyMemory(fileSize)
          
          // 验证内存增长有一个固定的上限（60MB）
          // 如果使用流式处理，内存增长应该不会随文件大小线性增长
          const memoryUpperBound = 60 * 1024 * 1024 // 60MB 上限
          expect(result.peakMemory).toBeLessThan(memoryUpperBound)
          
          return result.success
        }
      ),
      {
        numRuns: 10, // 由于创建大文件较慢，减少运行次数
        timeout: 60000, // 60 秒超时
        verbose: true
      }
    )
  }, 120000) // 测试超时 2 分钟

  /**
   * 属性测试 2: 流式处理的内存使用应该有上限
   * 
   * 对于任意大文件，流式处理的内存使用应该有一个固定的上限，
   * 而不是随文件大小线性增长。这证明使用了流式处理。
   */
  it('属性 18.2: 流式处理的内存使用应该有固定上限', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 50, max: 150 }).map(mb => mb * 1024 * 1024), // 50MB - 150MB
        async (fileSize) => {
          const sourcePath = join(testDir, `source-bounded-${Date.now()}.bin`)
          const destPath = join(testDir, `dest-bounded-${Date.now()}.bin`)
          
          try {
            // 创建测试文件
            await createTestFile(sourcePath, fileSize)
            
            const monitor = converter.getMemoryMonitor()
            monitor.clear()
            
            const startMemory = monitor.getCurrentMemory()
            monitor.startMonitoring(50)
            
            // 流式复制
            // @ts-ignore
            await converter.streamCopyFile(sourcePath, destPath, {
              highWaterMark: 16 * 1024 // 16KB 缓冲区
            })
            
            await new Promise(resolve => setTimeout(resolve, 100))
            monitor.stopMonitoring()
            
            const effectiveMemory = monitor.getPeakMemory() || monitor.getCurrentMemory()
            const memoryGrowth = effectiveMemory.rss - startMemory.rss
            
            // 验证内存增长有一个固定的上限（例如 70MB）
            // 无论文件多大，流式处理的内存使用都不应超过这个上限
            const memoryUpperBound = 70 * 1024 * 1024 // 70MB 上限
            expect(memoryGrowth).toBeLessThan(memoryUpperBound)
            
            // 清理
            await unlink(sourcePath)
            await unlink(destPath)
            
            return true
          } catch (error) {
            // 清理
            try {
              if (existsSync(sourcePath)) await unlink(sourcePath)
              if (existsSync(destPath)) await unlink(destPath)
            } catch {
              // 忽略
            }
            throw error
          }
        }
      ),
      {
        numRuns: 10,
        timeout: 60000,
        verbose: true
      }
    )
  }, 120000)

  /**
   * 属性测试 3: 连续处理多个大文件时内存不应无限增长
   * 
   * 对于任意数量的大文件连续处理，总体内存使用应该保持在合理范围内，
   * 不应该随着处理文件数量线性增长
   */
  it('属性 18.3: 连续处理多个大文件时内存不应无限增长', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 4 }), // 处理 2-4 个文件
        fc.constant(55 * 1024 * 1024), // 每个文件 55MB
        async (fileCount, fileSize) => {
          const monitor = converter.getMemoryMonitor()
          monitor.clear()
          
          // 记录初始内存
          const initialMemory = monitor.getCurrentMemory()
          
          monitor.startMonitoring(200)
          
          for (let i = 0; i < fileCount; i++) {
            const sourcePath = join(testDir, `source-${i}-${Date.now()}.bin`)
            const destPath = join(testDir, `dest-${i}-${Date.now()}.bin`)
            
            try {
              // 创建文件
              await createTestFile(sourcePath, fileSize)
              
              // 流式复制
              // @ts-ignore
              await converter.streamCopyFile(sourcePath, destPath)
              
              // 清理文件以释放磁盘空间
              await unlink(sourcePath)
              await unlink(destPath)
              
              // 强制垃圾回收（如果可用）
              if (global.gc) {
                global.gc()
              }
              
              // 等待一小段时间让内存稳定
              await new Promise(resolve => setTimeout(resolve, 200))
              
            } catch (error) {
              // 清理
              try {
                if (existsSync(sourcePath)) await unlink(sourcePath)
                if (existsSync(destPath)) await unlink(destPath)
              } catch {
                // 忽略
              }
              throw error
            }
          }
          
          monitor.stopMonitoring()
          
          // 获取峰值内存
          const peakMemory = monitor.getPeakMemory()
          expect(peakMemory).not.toBeNull()
          
          // 验证峰值内存增长不超过单个文件大小的 2 倍
          // 这证明内存没有随着文件数量线性增长
          const memoryGrowth = peakMemory!.rss - initialMemory.rss
          const maxExpectedGrowth = fileSize * 2
          
          expect(memoryGrowth).toBeLessThan(maxExpectedGrowth)
          
          return true
        }
      ),
      {
        numRuns: 5, // 减少运行次数因为测试较慢
        timeout: 120000, // 2 分钟超时
        verbose: true
      }
    )
  }, 180000) // 测试超时 3 分钟

  /**
   * 单元测试：验证大文件检测功能
   */
  it('应该正确检测大文件（>50MB）', async () => {
    const largeFilePath = join(testDir, 'large.bin')
    const largeFileSize = 51 * 1024 * 1024 // 51MB
    
    await createTestFile(largeFilePath, largeFileSize)
    
    // @ts-ignore - 访问私有方法
    const isLarge = await converter.isLargeFile(largeFilePath)
    expect(isLarge).toBe(true)
    
    await unlink(largeFilePath)
  })

  /**
   * 单元测试：验证小文件不触发大文件处理逻辑
   */
  it('应该正确识别小文件（<50MB）', async () => {
    const smallFilePath = join(testDir, 'small.bin')
    const smallFileSize = 10 * 1024 * 1024 // 10MB
    
    await createTestFile(smallFilePath, smallFileSize)
    
    // @ts-ignore
    const isLarge = await converter.isLargeFile(smallFilePath)
    expect(isLarge).toBe(false)
    
    await unlink(smallFilePath)
  })

  /**
   * 单元测试：验证内存监控器的基本功能
   */
  it('内存监控器应该能够记录和报告内存使用', async () => {
    const monitor = new MemoryMonitor()
    
    monitor.startMonitoring(50)
    
    // 等待一些采样
    await new Promise(resolve => setTimeout(resolve, 300))
    
    monitor.stopMonitoring()
    
    const peak = monitor.getPeakMemory()
    const average = monitor.getAverageMemory()
    
    expect(peak).not.toBeNull()
    expect(average).not.toBeNull()
    expect(peak!.rss).toBeGreaterThan(0)
    expect(average!.rss).toBeGreaterThan(0)
  })

  /**
   * 边界测试：恰好 50MB 的文件
   */
  it('应该将恰好 50MB 的文件视为小文件', async () => {
    const filePath = join(testDir, 'exactly-50mb.bin')
    const fileSize = 50 * 1024 * 1024 // 恰好 50MB
    
    await createTestFile(filePath, fileSize)
    
    // @ts-ignore
    const isLarge = await converter.isLargeFile(filePath)
    expect(isLarge).toBe(false) // 应该是 false，因为阈值是 >50MB
    
    await unlink(filePath)
  })

  /**
   * 边界测试：50MB + 1 字节的文件
   */
  it('应该将 50MB + 1 字节的文件视为大文件', async () => {
    const filePath = join(testDir, 'just-over-50mb.bin')
    const fileSize = 50 * 1024 * 1024 + 1 // 50MB + 1 字节
    
    await createTestFile(filePath, fileSize)
    
    // @ts-ignore
    const isLarge = await converter.isLargeFile(filePath)
    expect(isLarge).toBe(true)
    
    await unlink(filePath)
  })
})
