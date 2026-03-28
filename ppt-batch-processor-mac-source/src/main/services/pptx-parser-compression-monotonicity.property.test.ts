import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'
import { PptxParser } from './pptx-parser'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'
import PptxGenJS from 'pptxgenjs'

/**
 * 属性测试：压缩操作单调性
 * 
 * **Validates: Requirements 19.6**
 * 
 * 属性 13: 压缩操作单调性
 * 对于任意文件压缩操作，如果压缩后文件大小大于或等于原文件，
 * 系统应保留原文件不进行替换。
 * 
 * 这个属性确保压缩操作永远不会使文件变大，保护用户数据不会因为
 * 压缩操作而增加存储空间。
 */
describe('Property Test: Compression Operation Monotonicity', () => {
  let parser: PptxParser
  let tempDir: string
  let testFiles: string[] = []

  beforeEach(async () => {
    parser = new PptxParser()
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-compression-monotonicity-'))
  })

  afterEach(async () => {
    // 清理测试文件
    for (const file of testFiles) {
      try {
        await fs.unlink(file)
      } catch (error) {
        // 忽略删除错误
      }
    }
    testFiles = []

    // 清理临时目录
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch (error) {
      // 忽略删除错误
    }
  })

  /**
   * 创建测试用的 PPTX 文件
   */
  async function createTestPptx(
    fileName: string,
    slideCount: number,
    withImages: boolean,
    imageCount: number
  ): Promise<string> {
    const pptx = new PptxGenJS()

    for (let i = 0; i < slideCount; i++) {
      const slide = pptx.addSlide()
      slide.addText(`Slide ${i + 1}`, { x: 1, y: 1, fontSize: 24 })
      slide.addText(`Content for slide ${i + 1}`, { x: 1, y: 2, fontSize: 14 })

      // 添加图片（如果需要）
      if (withImages && i < imageCount) {
        // 创建一个简单的测试图片（1x1 像素的 PNG）
        const testImageData = Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          'base64'
        )
        const testImagePath = path.join(tempDir, `test-image-${fileName}-${i}.png`)
        await fs.writeFile(testImagePath, testImageData)

        slide.addImage({
          path: testImagePath,
          x: 2,
          y: 2,
          w: 2,
          h: 2
        })
      }
    }

    const filePath = path.join(tempDir, fileName)
    await pptx.writeFile({ fileName: filePath })
    testFiles.push(filePath)
    return filePath
  }

  /**
   * 属性 13: 压缩操作单调性
   * 
   * **Validates: Requirements 19.6**
   * 
   * 对于任意文件压缩操作，如果压缩后文件大小大于或等于原文件，
   * 系统应保留原文件不进行替换。
   * 
   * 测试策略：
   * 1. 生成随机的 PPTX 文件配置（幻灯片数量、是否包含图片、图片数量）
   * 2. 生成随机的压缩选项（图片质量、是否压缩图片、是否删除未使用的母版）
   * 3. 执行压缩操作
   * 4. 验证如果压缩后文件大小 >= 原文件大小，则输出文件大小应等于原文件大小
   * 5. 验证如果压缩后文件大小 >= 原文件大小，则压缩率应为 0
   */
  it('Property 13: Compression operation monotonicity - compressed size never exceeds original', async () => {
    await fc.assert(
      fc.asyncProperty(
        // 生成器：幻灯片数量 (1-5)
        fc.integer({ min: 1, max: 5 }),
        // 生成器：是否包含图片
        fc.boolean(),
        // 生成器：图片数量 (0-3)
        fc.integer({ min: 0, max: 3 }),
        // 生成器：图片质量 (1-100)
        fc.integer({ min: 1, max: 100 }),
        // 生成器：是否压缩图片
        fc.boolean(),
        // 生成器：是否删除未使用的母版
        fc.boolean(),
        async (slideCount, withImages, imageCount, imageQuality, compressImages, removeUnusedMasters) => {
          // 创建测试文件
          const fileName = `test-${Date.now()}-${Math.random().toString(36).substring(7)}.pptx`
          const inputPath = await createTestPptx(
            fileName,
            slideCount,
            withImages,
            imageCount
          )

          const outputPath = path.join(tempDir, `compressed-${fileName}`)
          testFiles.push(outputPath)

          // 获取原始文件大小
          const originalStats = await fs.stat(inputPath)
          const originalSize = originalStats.size

          // 执行压缩操作
          const result = await parser.optimizeAndCompress(inputPath, outputPath, {
            compressImages,
            imageQuality,
            removeUnusedMasters
          })

          // 获取输出文件大小
          const outputStats = await fs.stat(outputPath)
          const outputSize = outputStats.size

          // 属性验证：如果压缩后文件大小 >= 原文件大小，则输出文件应等于原文件
          if (result.compressedSize >= result.originalSize) {
            // 验证返回的压缩后大小等于原始大小
            expect(result.compressedSize).toBe(result.originalSize)
            
            // 验证压缩率为 0
            expect(result.compressionRatio).toBe(0)
            
            // 验证实际输出文件大小等于原始文件大小
            expect(outputSize).toBe(originalSize)
            
            // 验证图片压缩计数为 0（因为保留了原文件）
            expect(result.imagesCompressed).toBe(0)
            
            // 验证母版删除计数为 0（因为保留了原文件）
            expect(result.mastersRemoved).toBe(0)
          } else {
            // 如果压缩有效，验证输出文件确实更小
            expect(outputSize).toBeLessThan(originalSize)
            expect(result.compressedSize).toBeLessThan(result.originalSize)
            expect(result.compressionRatio).toBeGreaterThan(0)
          }

          // 通用验证：输出文件大小永远不应该大于原始文件大小
          expect(outputSize).toBeLessThanOrEqual(originalSize)
          
          // 验证返回的大小与实际文件大小一致
          expect(result.originalSize).toBe(originalSize)
          expect(result.compressedSize).toBe(outputSize)
        }
      ),
      {
        numRuns: 100, // 运行 100 次迭代
        verbose: true,
        endOnFailure: true
      }
    )
  }, 300000) // 5 分钟超时，因为需要创建和压缩多个文件

  /**
   * 属性 13 的边界情况测试：已经很小的文件
   * 
   * **Validates: Requirements 19.6**
   * 
   * 对于已经很小的文件（没有图片，只有少量内容），压缩操作
   * 可能会使文件变大。这种情况下应该保留原文件。
   */
  it('Property 13: Monotonicity for minimal files - preserves original when compression increases size', async () => {
    await fc.assert(
      fc.asyncProperty(
        // 生成器：图片质量 (1-100)
        fc.integer({ min: 1, max: 100 }),
        async (imageQuality) => {
          // 创建一个最小的测试文件（1 张幻灯片，无图片）
          const fileName = `minimal-${Date.now()}-${Math.random().toString(36).substring(7)}.pptx`
          const inputPath = await createTestPptx(fileName, 1, false, 0)

          const outputPath = path.join(tempDir, `compressed-${fileName}`)
          testFiles.push(outputPath)

          // 获取原始文件大小
          const originalStats = await fs.stat(inputPath)
          const originalSize = originalStats.size

          // 执行压缩操作（使用高质量设置，可能导致文件变大）
          const result = await parser.optimizeAndCompress(inputPath, outputPath, {
            compressImages: true,
            imageQuality,
            removeUnusedMasters: true
          })

          // 获取输出文件大小
          const outputStats = await fs.stat(outputPath)
          const outputSize = outputStats.size

          // 属性验证：输出文件大小永远不应该大于原始文件大小
          expect(outputSize).toBeLessThanOrEqual(originalSize)

          // 如果压缩后文件大小 >= 原文件大小，验证保留了原文件
          if (result.compressedSize >= result.originalSize) {
            expect(result.compressedSize).toBe(result.originalSize)
            expect(result.compressionRatio).toBe(0)
            expect(outputSize).toBe(originalSize)
          }
        }
      ),
      {
        numRuns: 100,
        verbose: true
      }
    )
  }, 300000)

  /**
   * 属性 13 的边界情况测试：极端压缩设置
   * 
   * **Validates: Requirements 19.6**
   * 
   * 测试极端的压缩设置（非常低或非常高的质量），确保单调性
   * 属性在所有情况下都成立。
   */
  it('Property 13: Monotonicity with extreme compression settings', async () => {
    await fc.assert(
      fc.asyncProperty(
        // 生成器：幻灯片数量 (1-3)
        fc.integer({ min: 1, max: 3 }),
        // 生成器：图片数量 (0-2)
        fc.integer({ min: 0, max: 2 }),
        // 生成器：极端图片质量（1 或 100）
        fc.constantFrom(1, 100),
        async (slideCount, imageCount, imageQuality) => {
          const withImages = imageCount > 0
          const fileName = `extreme-${Date.now()}-${Math.random().toString(36).substring(7)}.pptx`
          const inputPath = await createTestPptx(
            fileName,
            slideCount,
            withImages,
            imageCount
          )

          const outputPath = path.join(tempDir, `compressed-${fileName}`)
          testFiles.push(outputPath)

          // 获取原始文件大小
          const originalStats = await fs.stat(inputPath)
          const originalSize = originalStats.size

          // 执行压缩操作
          const result = await parser.optimizeAndCompress(inputPath, outputPath, {
            compressImages: true,
            imageQuality,
            removeUnusedMasters: true
          })

          // 获取输出文件大小
          const outputStats = await fs.stat(outputPath)
          const outputSize = outputStats.size

          // 核心属性：输出文件大小永远不应该大于原始文件大小
          expect(outputSize).toBeLessThanOrEqual(originalSize)

          // 验证返回值的一致性
          expect(result.compressedSize).toBe(outputSize)
          expect(result.originalSize).toBe(originalSize)

          // 如果压缩无效，验证保留了原文件
          if (outputSize >= originalSize) {
            expect(result.compressionRatio).toBe(0)
            expect(result.imagesCompressed).toBe(0)
            expect(result.mastersRemoved).toBe(0)
          }
        }
      ),
      {
        numRuns: 100,
        verbose: true
      }
    )
  }, 300000)

  /**
   * 属性 13 的内容验证测试：压缩后内容完整性
   * 
   * **Validates: Requirements 19.6**
   * 
   * 验证当保留原文件时（压缩后文件更大），输出文件的内容
   * 与原文件完全相同。
   */
  it('Property 13: Content preservation when original is kept', async () => {
    await fc.assert(
      fc.asyncProperty(
        // 生成器：幻灯片数量 (1-3)
        fc.integer({ min: 1, max: 3 }),
        async (slideCount) => {
          // 创建一个小文件（更可能在压缩后变大）
          const fileName = `preserve-${Date.now()}-${Math.random().toString(36).substring(7)}.pptx`
          const inputPath = await createTestPptx(fileName, slideCount, false, 0)

          const outputPath = path.join(tempDir, `compressed-${fileName}`)
          testFiles.push(outputPath)

          // 打开原始文件获取内容
          const originalDoc = await parser.open(inputPath)
          const originalSlideCount = originalDoc.slides.length

          // 执行压缩操作
          const result = await parser.optimizeAndCompress(inputPath, outputPath, {
            compressImages: true,
            imageQuality: 100,
            removeUnusedMasters: true
          })

          // 打开输出文件
          const outputDoc = await parser.open(outputPath)

          // 验证幻灯片数量保持不变
          expect(outputDoc.slides.length).toBe(originalSlideCount)

          // 如果保留了原文件，验证内容完全相同
          if (result.compressedSize >= result.originalSize) {
            // 验证每个幻灯片的元素数量相同
            for (let i = 0; i < originalSlideCount; i++) {
              expect(outputDoc.slides[i].elements.length).toBe(
                originalDoc.slides[i].elements.length
              )
            }
          }
        }
      ),
      {
        numRuns: 50, // 减少迭代次数，因为需要打开和比较文件内容
        verbose: true
      }
    )
  }, 300000)
})
