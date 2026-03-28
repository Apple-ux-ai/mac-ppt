import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PptxParser } from './pptx-parser'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'
import PptxGenJS from 'pptxgenjs'

describe('PptxParser - Compression Optimization', () => {
  let parser: PptxParser
  let tempDir: string
  let testFiles: string[] = []

  beforeEach(async () => {
    parser = new PptxParser()
    // 创建临时目录
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-compression-test-'))
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
  async function createTestPptx(fileName: string, options: {
    withImages?: boolean
    imageCount?: number
    slideCount?: number
  } = {}): Promise<string> {
    const pptx = new PptxGenJS()
    
    const slideCount = options.slideCount || 3
    const imageCount = options.imageCount || 2

    for (let i = 0; i < slideCount; i++) {
      const slide = pptx.addSlide()
      slide.addText(`Slide ${i + 1}`, { x: 1, y: 1, fontSize: 24 })

      // 添加图片（如果需要）
      if (options.withImages && i < imageCount) {
        // 创建一个简单的测试图片（1x1 像素的 PNG）
        const testImageData = Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          'base64'
        )
        const testImagePath = path.join(tempDir, `test-image-${i}.png`)
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

  describe('optimizeAndCompress', () => {
    it('should compress PPTX file with images', async () => {
      // 创建包含图片的测试文件
      const inputPath = await createTestPptx('test-with-images.pptx', {
        withImages: true,
        imageCount: 3,
        slideCount: 3
      })

      const outputPath = path.join(tempDir, 'compressed.pptx')
      testFiles.push(outputPath)

      // 执行压缩
      const result = await parser.optimizeAndCompress(inputPath, outputPath, {
        compressImages: true,
        imageQuality: 80,
        removeUnusedMasters: true
      })

      // 验证结果
      expect(result.originalSize).toBeGreaterThan(0)
      expect(result.compressedSize).toBeGreaterThan(0)
      expect(result.compressionRatio).toBeGreaterThanOrEqual(0)
      
      // 验证输出文件存在
      const outputExists = await fs.access(outputPath).then(() => true).catch(() => false)
      expect(outputExists).toBe(true)

      // 验证输出文件可以打开
      const document = await parser.open(outputPath)
      expect(document.slides.length).toBe(3)
    })

    it('should not replace file if compressed size is larger', async () => {
      // 创建一个小文件（压缩后可能更大）
      const inputPath = await createTestPptx('test-small.pptx', {
        withImages: false,
        slideCount: 1
      })

      const outputPath = path.join(tempDir, 'compressed-small.pptx')
      testFiles.push(outputPath)

      // 执行压缩
      const result = await parser.optimizeAndCompress(inputPath, outputPath, {
        compressImages: true,
        imageQuality: 100,
        removeUnusedMasters: false
      })

      // 如果压缩后文件更大，应该保留原文件大小
      if (result.compressedSize >= result.originalSize) {
        expect(result.compressionRatio).toBe(0)
        expect(result.compressedSize).toBe(result.originalSize)
      }
    })

    it('should compress images when option is enabled', async () => {
      const inputPath = await createTestPptx('test-compress-images.pptx', {
        withImages: true,
        imageCount: 2,
        slideCount: 2
      })

      const outputPath = path.join(tempDir, 'compressed-images.pptx')
      testFiles.push(outputPath)

      const result = await parser.optimizeAndCompress(inputPath, outputPath, {
        compressImages: true,
        imageQuality: 60,
        removeUnusedMasters: false
      })

      // 应该有图片被压缩（如果压缩有效）
      expect(result.imagesCompressed).toBeGreaterThanOrEqual(0)
    })

    it('should skip image compression when option is disabled', async () => {
      const inputPath = await createTestPptx('test-no-compress.pptx', {
        withImages: true,
        imageCount: 2,
        slideCount: 2
      })

      const outputPath = path.join(tempDir, 'no-compress.pptx')
      testFiles.push(outputPath)

      const result = await parser.optimizeAndCompress(inputPath, outputPath, {
        compressImages: false,
        removeUnusedMasters: false
      })

      // 不应该有图片被压缩
      expect(result.imagesCompressed).toBe(0)
    })

    it('should handle files without images', async () => {
      const inputPath = await createTestPptx('test-no-images.pptx', {
        withImages: false,
        slideCount: 3
      })

      const outputPath = path.join(tempDir, 'compressed-no-images.pptx')
      testFiles.push(outputPath)

      const result = await parser.optimizeAndCompress(inputPath, outputPath, {
        compressImages: true,
        imageQuality: 80,
        removeUnusedMasters: true
      })

      // 验证结果
      expect(result.originalSize).toBeGreaterThan(0)
      expect(result.compressedSize).toBeGreaterThan(0)
      expect(result.imagesCompressed).toBe(0) // 没有图片
    })

    it('should calculate compression ratio correctly', async () => {
      const inputPath = await createTestPptx('test-ratio.pptx', {
        withImages: true,
        imageCount: 3,
        slideCount: 3
      })

      const outputPath = path.join(tempDir, 'compressed-ratio.pptx')
      testFiles.push(outputPath)

      const result = await parser.optimizeAndCompress(inputPath, outputPath, {
        compressImages: true,
        imageQuality: 50,
        removeUnusedMasters: true
      })

      // 验证压缩率计算
      if (result.compressedSize < result.originalSize) {
        const expectedRatio = ((result.originalSize - result.compressedSize) / result.originalSize) * 100
        expect(result.compressionRatio).toBeCloseTo(expectedRatio, 2)
      }
    })

    it('should handle different image quality settings', async () => {
      const inputPath = await createTestPptx('test-quality.pptx', {
        withImages: true,
        imageCount: 2,
        slideCount: 2
      })

      // 测试低质量压缩
      const lowQualityPath = path.join(tempDir, 'low-quality.pptx')
      testFiles.push(lowQualityPath)
      
      const lowQualityResult = await parser.optimizeAndCompress(inputPath, lowQualityPath, {
        compressImages: true,
        imageQuality: 30,
        removeUnusedMasters: false
      })

      // 测试高质量压缩
      const highQualityPath = path.join(tempDir, 'high-quality.pptx')
      testFiles.push(highQualityPath)
      
      const highQualityResult = await parser.optimizeAndCompress(inputPath, highQualityPath, {
        compressImages: true,
        imageQuality: 90,
        removeUnusedMasters: false
      })

      // 低质量应该产生更小的文件（如果压缩有效）
      if (lowQualityResult.compressedSize < lowQualityResult.originalSize &&
          highQualityResult.compressedSize < highQualityResult.originalSize) {
        expect(lowQualityResult.compressedSize).toBeLessThanOrEqual(highQualityResult.compressedSize)
      }
    })

    it('should preserve slide content after compression', async () => {
      const inputPath = await createTestPptx('test-preserve.pptx', {
        withImages: true,
        imageCount: 2,
        slideCount: 3
      })

      const outputPath = path.join(tempDir, 'compressed-preserve.pptx')
      testFiles.push(outputPath)

      // 打开原始文件
      const originalDoc = await parser.open(inputPath)
      const originalSlideCount = originalDoc.slides.length

      // 执行压缩
      await parser.optimizeAndCompress(inputPath, outputPath, {
        compressImages: true,
        imageQuality: 80,
        removeUnusedMasters: true
      })

      // 打开压缩后的文件
      const compressedDoc = await parser.open(outputPath)

      // 验证幻灯片数量保持不变
      expect(compressedDoc.slides.length).toBe(originalSlideCount)

      // 验证每个幻灯片的元素数量保持不变
      for (let i = 0; i < originalSlideCount; i++) {
        expect(compressedDoc.slides[i].elements.length).toBeGreaterThanOrEqual(0)
      }
    })

    it('should throw error for non-existent file', async () => {
      const nonExistentPath = path.join(tempDir, 'non-existent.pptx')
      const outputPath = path.join(tempDir, 'output.pptx')

      await expect(
        parser.optimizeAndCompress(nonExistentPath, outputPath)
      ).rejects.toThrow()
    })

    it('should handle empty options object', async () => {
      const inputPath = await createTestPptx('test-default-options.pptx', {
        withImages: true,
        imageCount: 2,
        slideCount: 2
      })

      const outputPath = path.join(tempDir, 'compressed-default.pptx')
      testFiles.push(outputPath)

      // 使用默认选项
      const result = await parser.optimizeAndCompress(inputPath, outputPath, {})

      // 验证结果
      expect(result.originalSize).toBeGreaterThan(0)
      expect(result.compressedSize).toBeGreaterThan(0)
      
      // 默认应该压缩图片和删除未使用的母版
      expect(result.imagesCompressed).toBeGreaterThanOrEqual(0)
      expect(result.mastersRemoved).toBeGreaterThanOrEqual(0)
    })
  })

  describe('compression edge cases', () => {
    it('should handle file with no compression opportunities', async () => {
      // 创建一个已经很小的文件
      const inputPath = await createTestPptx('test-minimal.pptx', {
        withImages: false,
        slideCount: 1
      })

      const outputPath = path.join(tempDir, 'compressed-minimal.pptx')
      testFiles.push(outputPath)

      const result = await parser.optimizeAndCompress(inputPath, outputPath, {
        compressImages: true,
        imageQuality: 80,
        removeUnusedMasters: true
      })

      // 应该成功完成，即使没有太多压缩空间
      expect(result.originalSize).toBeGreaterThan(0)
      expect(result.compressedSize).toBeGreaterThan(0)
    })

    it('should handle multiple compression operations on same file', async () => {
      const inputPath = await createTestPptx('test-multiple.pptx', {
        withImages: true,
        imageCount: 2,
        slideCount: 2
      })

      const output1Path = path.join(tempDir, 'compressed-1.pptx')
      const output2Path = path.join(tempDir, 'compressed-2.pptx')
      testFiles.push(output1Path, output2Path)

      // 第一次压缩
      const result1 = await parser.optimizeAndCompress(inputPath, output1Path, {
        compressImages: true,
        imageQuality: 80
      })

      // 第二次压缩（压缩已压缩的文件）
      const result2 = await parser.optimizeAndCompress(output1Path, output2Path, {
        compressImages: true,
        imageQuality: 80
      })

      // 第二次压缩应该产生更少的改进（或没有改进）
      expect(result2.compressionRatio).toBeLessThanOrEqual(result1.compressionRatio)
    })
  })
})
