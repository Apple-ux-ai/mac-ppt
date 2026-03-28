import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PageProcessor } from './page-processor'
import { PptxParser } from './pptx-parser'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'
import fc from 'fast-check'

/**
 * 属性测试：合并后顺序保持性
 * 
 * **属性 9: 合并后顺序保持性**
 * 
 * 对于任意多个 PPT 文件的合并操作，合并后文件中的页面顺序应严格按照
 * 输入文件列表顺序和每个文件内部的页面顺序排列。
 * 
 * **验证需求: 11.1, 11.2**
 * 
 * 需求 11.1: WHEN 用户选择多个 PPT 文件进行合并 THEN THE Batch_Processor 
 *           SHALL 按文件列表顺序合并所有幻灯片
 * 
 * 需求 11.2: WHEN 执行合并操作 THEN THE System SHALL 保持每个源文件中
 *           幻灯片的原始顺序
 */
describe('PageProcessor - Property Tests: Merge Order Preservation', () => {
  let processor: PageProcessor
  let parser: PptxParser
  let tempDir: string

  beforeEach(async () => {
    processor = new PageProcessor()
    parser = new PptxParser()
    tempDir = path.join(os.tmpdir(), `ppt-test-${Date.now()}`)
    await fs.mkdir(tempDir, { recursive: true })
  })

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch (error) {
      // 忽略清理错误
    }
  })

  /**
   * 属性 9: 合并后顺序保持性
   * 
   * 验证合并后的幻灯片顺序与输入文件顺序一致
   */
  it('Property 9: Merged slides maintain order from input files', async () => {
    await fc.assert(
      fc.asyncProperty(
        // 生成 2-5 个文件，每个文件有 1-5 张幻灯片
        fc.array(fc.integer({ min: 1, max: 5 }), { minLength: 2, maxLength: 5 }),
        async (slideCounts) => {
          // 创建测试文件
          const files: string[] = []
          const expectedSlideOrder: string[] = []

          for (let i = 0; i < slideCounts.length; i++) {
            const slideCount = slideCounts[i]
            const fileName = `file${i}.pptx`
            const filePath = await createTestPptxWithMarkers(
              tempDir,
              fileName,
              slideCount,
              i
            )
            files.push(filePath)

            // 记录期望的幻灯片顺序
            for (let j = 0; j < slideCount; j++) {
              expectedSlideOrder.push(`File${i}-Slide${j}`)
            }
          }

          // 合并文件
          const outputPath = path.join(tempDir, 'merged.pptx')
          await processor.mergePpt(files, outputPath)

          // 验证合并后的文件
          const mergedDoc = await parser.open(outputPath)

          // 验证总幻灯片数
          const expectedTotalSlides = slideCounts.reduce((sum, count) => sum + count, 0)
          expect(mergedDoc.slides.length).toBe(expectedTotalSlides)

          // 验证幻灯片顺序
          for (let i = 0; i < mergedDoc.slides.length; i++) {
            const slide = mergedDoc.slides[i]
            
            // 验证索引正确
            expect(slide.index).toBe(i)

            // 验证幻灯片内容顺序（通过检查文本内容）
            const textElements = slide.elements.filter(e => e.type === 'text')
            if (textElements.length > 0) {
              const firstText = (textElements[0] as any).content || ''
              // 文本应该包含期望的标记
              expect(firstText).toContain(expectedSlideOrder[i])
            }
          }

          // 清理测试文件
          for (const file of files) {
            await fs.unlink(file).catch(() => {})
          }
          await fs.unlink(outputPath).catch(() => {})
        }
      ),
      { numRuns: 20 } // 运行 20 次迭代
    )
  })

  /**
   * 属性 9 变体: 验证文件内部幻灯片顺序保持
   * 
   * 每个源文件内部的幻灯片顺序应该在合并后保持不变
   */
  it('Property 9 Variant: Internal slide order within each file is preserved', async () => {
    await fc.assert(
      fc.asyncProperty(
        // 生成 2-4 个文件，每个文件有 2-6 张幻灯片
        fc.array(fc.integer({ min: 2, max: 6 }), { minLength: 2, maxLength: 4 }),
        async (slideCounts) => {
          // 创建测试文件并记录每个文件的幻灯片内容
          const files: string[] = []
          const fileSlideContents: string[][] = []

          for (let fileIdx = 0; fileIdx < slideCounts.length; fileIdx++) {
            const slideCount = slideCounts[fileIdx]
            const fileName = `file${fileIdx}.pptx`
            const filePath = await createTestPptxWithMarkers(
              tempDir,
              fileName,
              slideCount,
              fileIdx
            )
            files.push(filePath)

            // 记录这个文件的幻灯片内容
            const slideContents: string[] = []
            for (let slideIdx = 0; slideIdx < slideCount; slideIdx++) {
              slideContents.push(`File${fileIdx}-Slide${slideIdx}`)
            }
            fileSlideContents.push(slideContents)
          }

          // 合并文件
          const outputPath = path.join(tempDir, 'merged.pptx')
          await processor.mergePpt(files, outputPath)

          // 验证合并后的文件
          const mergedDoc = await parser.open(outputPath)

          // 验证每个文件的幻灯片在合并后的相对顺序
          let currentSlideIndex = 0
          for (let fileIdx = 0; fileIdx < fileSlideContents.length; fileIdx++) {
            const expectedContents = fileSlideContents[fileIdx]
            
            for (let slideIdx = 0; slideIdx < expectedContents.length; slideIdx++) {
              const slide = mergedDoc.slides[currentSlideIndex]
              const textElements = slide.elements.filter(e => e.type === 'text')
              
              if (textElements.length > 0) {
                const firstText = (textElements[0] as any).content || ''
                expect(firstText).toContain(expectedContents[slideIdx])
              }
              
              currentSlideIndex++
            }
          }

          // 清理测试文件
          for (const file of files) {
            await fs.unlink(file).catch(() => {})
          }
          await fs.unlink(outputPath).catch(() => {})
        }
      ),
      { numRuns: 20 }
    )
  })

  /**
   * 属性 9 变体: 合并后索引连续性
   * 
   * 合并后的幻灯片索引应该是连续的，从 0 开始
   */
  it('Property 9 Variant: Merged slides have continuous indices starting from 0', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.integer({ min: 1, max: 5 }), { minLength: 2, maxLength: 5 }),
        async (slideCounts) => {
          // 创建测试文件
          const files: string[] = []
          for (let i = 0; i < slideCounts.length; i++) {
            const filePath = await createTestPptxWithMarkers(
              tempDir,
              `file${i}.pptx`,
              slideCounts[i],
              i
            )
            files.push(filePath)
          }

          // 合并文件
          const outputPath = path.join(tempDir, 'merged.pptx')
          await processor.mergePpt(files, outputPath)

          // 验证索引连续性
          const mergedDoc = await parser.open(outputPath)
          
          for (let i = 0; i < mergedDoc.slides.length; i++) {
            expect(mergedDoc.slides[i].index).toBe(i)
          }

          // 清理测试文件
          for (const file of files) {
            await fs.unlink(file).catch(() => {})
          }
          await fs.unlink(outputPath).catch(() => {})
        }
      ),
      { numRuns: 20 }
    )
  })

  /**
   * 属性 9 变体: 合并两个文件的顺序
   * 
   * 简化版本：只合并两个文件，验证第一个文件的所有幻灯片在前，
   * 第二个文件的所有幻灯片在后
   */
  it('Property 9 Variant: Two-file merge maintains file order', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }),
        fc.integer({ min: 1, max: 5 }),
        async (slideCount1, slideCount2) => {
          // 创建两个测试文件
          const file1 = await createTestPptxWithMarkers(
            tempDir,
            'file1.pptx',
            slideCount1,
            0
          )
          const file2 = await createTestPptxWithMarkers(
            tempDir,
            'file2.pptx',
            slideCount2,
            1
          )

          // 合并文件
          const outputPath = path.join(tempDir, 'merged.pptx')
          await processor.mergePpt([file1, file2], outputPath)

          // 验证合并后的文件
          const mergedDoc = await parser.open(outputPath)

          // 验证总数
          expect(mergedDoc.slides.length).toBe(slideCount1 + slideCount2)

          // 验证前 slideCount1 张幻灯片来自 file1
          for (let i = 0; i < slideCount1; i++) {
            const slide = mergedDoc.slides[i]
            const textElements = slide.elements.filter(e => e.type === 'text')
            if (textElements.length > 0) {
              const firstText = (textElements[0] as any).content || ''
              expect(firstText).toContain('File0-')
            }
          }

          // 验证后 slideCount2 张幻灯片来自 file2
          for (let i = slideCount1; i < slideCount1 + slideCount2; i++) {
            const slide = mergedDoc.slides[i]
            const textElements = slide.elements.filter(e => e.type === 'text')
            if (textElements.length > 0) {
              const firstText = (textElements[0] as any).content || ''
              expect(firstText).toContain('File1-')
            }
          }

          // 清理测试文件
          await fs.unlink(file1).catch(() => {})
          await fs.unlink(file2).catch(() => {})
          await fs.unlink(outputPath).catch(() => {})
        }
      ),
      { numRuns: 30 }
    )
  })
})

/**
 * 创建带有标记的测试 PPTX 文件
 * 每张幻灯片包含唯一标识符，用于验证顺序
 */
async function createTestPptxWithMarkers(
  dir: string,
  filename: string,
  slideCount: number,
  fileIndex: number
): Promise<string> {
  const PptxGenJS = (await import('pptxgenjs')).default
  const pptx = new PptxGenJS()

  for (let i = 0; i < slideCount; i++) {
    const slide = pptx.addSlide()
    
    // 添加唯一标识符
    const marker = `File${fileIndex}-Slide${i}`
    slide.addText(marker, {
      x: 0.5,
      y: 0.5,
      w: 9,
      h: 0.5,
      fontSize: 18,
      bold: true,
      color: '363636'
    })
    
    // 添加一些内容
    slide.addText(`Content for ${marker}`, {
      x: 0.5,
      y: 1.5,
      w: 9,
      h: 1,
      fontSize: 14
    })
  }

  const filePath = path.join(dir, filename)
  await pptx.writeFile({ fileName: filePath })

  return filePath
}
