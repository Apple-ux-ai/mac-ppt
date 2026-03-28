// @ts-nocheck
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PageProcessor } from './page-processor'
import { PptxParser } from './pptx-parser'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'
import fc from 'fast-check'

/**
 * 属性测试：拆分后页面完整性
 * 
 * **属性 8: 拆分后页面完整性**
 * 对于任意 PPT 拆分操作，所有拆分文件中的页面总数应等于原文件的页面数，
 * 且每个页面内容应完整保留。
 * 
 * **验证需求: 10.3, 10.4**
 * - 10.3: WHEN 拆分 PPT THEN THE System SHALL 保持每个幻灯片的完整内容和格式
 * - 10.4: WHEN 最后一个拆分文件页数不足 THEN THE System SHALL 创建包含剩余页面的文件
 */
describe('PageProcessor - Property Tests', () => {
  let processor: PageProcessor
  let parser: PptxParser
  let tempDir: string

  beforeEach(async () => {
    processor = new PageProcessor()
    parser = new PptxParser()
    tempDir = path.join(os.tmpdir(), `ppt-prop-test-${Date.now()}`)
    await fs.mkdir(tempDir, { recursive: true })
  })

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch (error) {
      // 忽略清理错误
    }
  })

  describe('Property 8: Split Page Completeness', () => {
    it('should preserve total page count after split', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成随机的幻灯片数量（5-20，减少范围以提高速度）
          fc.integer({ min: 5, max: 20 }),
          // 生成随机的每个文件页数（2-5）
          fc.integer({ min: 2, max: 5 }),
          async (totalSlides, pagesPerFile) => {
            // 使用唯一的文件名避免冲突
            const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(7)}`
            const testFile = await createTestPptx(tempDir, `test-${uniqueId}.pptx`, totalSlides)
            const outputDir = path.join(tempDir, `output-${uniqueId}`)

            try {
              // 拆分文件
              const outputFiles = await processor.splitPpt(testFile, outputDir, pagesPerFile)

              // 属性 1: 所有拆分文件中的页面总数应等于原文件的页面数
              let totalPagesInSplitFiles = 0
              for (const outputFile of outputFiles) {
                const doc = await parser.open(outputFile)
                totalPagesInSplitFiles += doc.slides.length
              }

              expect(totalPagesInSplitFiles).toBe(totalSlides)

              // 属性 2: 每个拆分文件的页数应该 <= pagesPerFile（除了最后一个可能更少）
              for (let i = 0; i < outputFiles.length - 1; i++) {
                const doc = await parser.open(outputFiles[i])
                expect(doc.slides.length).toBe(pagesPerFile)
              }

              // 属性 3: 最后一个文件的页数应该是剩余页数
              const lastDoc = await parser.open(outputFiles[outputFiles.length - 1])
              const expectedLastFilePages = totalSlides % pagesPerFile || pagesPerFile
              expect(lastDoc.slides.length).toBe(expectedLastFilePages)

              // 属性 4: 文件数量应该正确
              const expectedFileCount = Math.ceil(totalSlides / pagesPerFile)
              expect(outputFiles.length).toBe(expectedFileCount)

              // 清理
              await fs.rm(outputDir, { recursive: true, force: true }).catch(() => {})
              await fs.unlink(testFile).catch(() => {})
            } catch (error) {
              // 如果是预期的错误（文件太小无需拆分），跳过
              if (error instanceof Error && error.message.includes('no split needed')) {
                return true
              }
              throw error
            }

            return true
          }
        ),
        { numRuns: 10 } // 减少迭代次数以提高速度
      )
    }, 60000) // 60 秒超时

    it('should preserve slide content integrity after split', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成随机的幻灯片数量（5-15，减少范围）
          fc.integer({ min: 5, max: 15 }),
          // 生成随机的每个文件页数（2-4）
          fc.integer({ min: 2, max: 4 }),
          async (totalSlides, pagesPerFile) => {
            // 使用唯一的文件名避免冲突
            const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(7)}`
            const testFile = await createTestPptx(tempDir, `test-${uniqueId}.pptx`, totalSlides)
            const outputDir = path.join(tempDir, `output-${uniqueId}`)

            try {
              // 读取原始文件
              const originalDoc = await parser.open(testFile)
              const originalSlides = originalDoc.slides

              // 拆分文件
              const outputFiles = await processor.splitPpt(testFile, outputDir, pagesPerFile)

              // 属性: 每个页面的内容应该完整保留
              let currentSlideIndex = 0
              for (const outputFile of outputFiles) {
                const splitDoc = await parser.open(outputFile)
                
                for (const splitSlide of splitDoc.slides) {
                  const originalSlide = originalSlides[currentSlideIndex]
                  
                  // 验证元素数量相同
                  expect(splitSlide.elements.length).toBe(originalSlide.elements.length)
                  
                  // 验证每个元素的内容
                  for (let i = 0; i < splitSlide.elements.length; i++) {
                    const splitElement = splitSlide.elements[i]
                    const originalElement = originalSlide.elements[i]
                    
                    // 验证元素类型相同
                    expect(splitElement.type).toBe(originalElement.type)
                    
                    // 如果是文本元素，验证内容相同
                    if (splitElement.type === 'text' && originalElement.type === 'text') {
                      expect(splitElement.content).toBe(originalElement.content)
                    }
                  }
                  
                  currentSlideIndex++
                }
              }

              // 清理
              await fs.rm(outputDir, { recursive: true, force: true }).catch(() => {})
              await fs.unlink(testFile).catch(() => {})
            } catch (error) {
              // 如果是预期的错误（文件太小无需拆分），跳过
              if (error instanceof Error && error.message.includes('no split needed')) {
                return true
              }
              throw error
            }

            return true
          }
        ),
        { numRuns: 8 } // 减少迭代次数
      )
    }, 60000) // 60 秒超时

    it('should generate correct number of files for any valid input', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成随机的幻灯片数量（5-20）
          fc.integer({ min: 5, max: 20 }),
          // 生成随机的每个文件页数（2-6）
          fc.integer({ min: 2, max: 6 }),
          async (totalSlides, pagesPerFile) => {
            // 使用唯一的文件名避免冲突
            const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(7)}`
            const testFile = await createTestPptx(tempDir, `test-${uniqueId}.pptx`, totalSlides)
            const outputDir = path.join(tempDir, `output-${uniqueId}`)

            try {
              // 拆分文件
              const outputFiles = await processor.splitPpt(testFile, outputDir, pagesPerFile)

              // 属性: 文件数量应该等于 ceil(totalSlides / pagesPerFile)
              const expectedFileCount = Math.ceil(totalSlides / pagesPerFile)
              expect(outputFiles.length).toBe(expectedFileCount)

              // 属性: 所有文件都应该存在且可读
              for (const outputFile of outputFiles) {
                const exists = await fs.access(outputFile).then(() => true).catch(() => false)
                expect(exists).toBe(true)
                
                // 验证文件可以被解析
                const doc = await parser.open(outputFile)
                expect(doc.slides.length).toBeGreaterThan(0)
              }

              // 清理
              await fs.rm(outputDir, { recursive: true, force: true }).catch(() => {})
              await fs.unlink(testFile).catch(() => {})
            } catch (error) {
              // 如果是预期的错误（文件太小无需拆分），跳过
              if (error instanceof Error && error.message.includes('no split needed')) {
                return true
              }
              throw error
            }

            return true
          }
        ),
        { numRuns: 10 } // 减少迭代次数
      )
    }, 60000) // 60 秒超时

    it('should maintain slide order across split files', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成随机的幻灯片数量（5-12）
          fc.integer({ min: 5, max: 12 }),
          // 生成随机的每个文件页数（2-3）
          fc.integer({ min: 2, max: 3 }),
          async (totalSlides, pagesPerFile) => {
            // 使用唯一的文件名避免冲突
            const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(7)}`
            const testFile = await createTestPptx(tempDir, `test-${uniqueId}.pptx`, totalSlides)
            const outputDir = path.join(tempDir, `output-${uniqueId}`)

            try {
              // 读取原始文件
              const originalDoc = await parser.open(testFile)
              const originalSlides = originalDoc.slides

              // 拆分文件
              const outputFiles = await processor.splitPpt(testFile, outputDir, pagesPerFile)

              // 属性: 拆分后的幻灯片顺序应该与原始文件一致
              let currentSlideIndex = 0
              for (const outputFile of outputFiles) {
                const splitDoc = await parser.open(outputFile)
                
                for (const splitSlide of splitDoc.slides) {
                  const originalSlide = originalSlides[currentSlideIndex]
                  
                  // 验证幻灯片内容匹配（通过比较第一个文本元素）
                  const splitTextElements = splitSlide.elements.filter(e => e.type === 'text')
                  const originalTextElements = originalSlide.elements.filter(e => e.type === 'text')
                  
                  if (splitTextElements.length > 0 && originalTextElements.length > 0) {
                    expect(splitTextElements[0].content).toBe(originalTextElements[0].content)
                  }
                  
                  currentSlideIndex++
                }
              }

              // 清理
              await fs.rm(outputDir, { recursive: true, force: true }).catch(() => {})
              await fs.unlink(testFile).catch(() => {})
            } catch (error) {
              // 如果是预期的错误（文件太小无需拆分），跳过
              if (error instanceof Error && error.message.includes('no split needed')) {
                return true
              }
              throw error
            }

            return true
          }
        ),
        { numRuns: 8 } // 减少迭代次数
      )
    }, 60000) // 60 秒超时
  })
})

/**
 * 创建测试用的 PPTX 文件
 */
async function createTestPptx(
  dir: string,
  filename: string,
  slideCount: number
): Promise<string> {
  const PptxGenJS = (await import('pptxgenjs')).default
  const pptx = new PptxGenJS()

  for (let i = 0; i < slideCount; i++) {
    const slide = pptx.addSlide()
    slide.addText(`Slide ${i + 1}`, {
      x: 1,
      y: 1,
      w: 8,
      h: 1,
      fontSize: 24,
      bold: true
    })
    slide.addText(`Content of slide ${i + 1}`, {
      x: 1,
      y: 2,
      w: 8,
      h: 2,
      fontSize: 14
    })
  }

  const filePath = path.join(dir, filename)
  await pptx.writeFile({ fileName: filePath })

  return filePath
}
