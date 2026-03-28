import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'
import { PageProcessor } from './page-processor'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'
import { PptxParser } from './pptx-parser'

/**
 * 属性测试：页面操作后总数一致性
 * 
 * Feature: ppt-batch-processor
 * Property 10: 页面操作后总数一致性
 * 
 * **验证需求: 12.5, 13.5**
 * 
 * 属性描述：
 * - 对于任意页面删除操作，删除后的总页数应等于原总页数减去删除的页数
 * - 对于任意页面插入操作，插入后的总页数应等于原总页数加上插入的页数
 */
describe('PageProcessor - Property: Page Count Consistency', () => {
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
   * 属性 10.1: 删除操作后页面总数一致性
   * 
   * 对于任意 PPT 文件和任意有效的页码范围，
   * 删除后的总页数应等于原总页数减去删除的页数
   */
  it('Property 10.1: Delete operation maintains page count consistency', async () => {
    await fc.assert(
      fc.asyncProperty(
        // 生成原始页数（5-20 页）
        fc.integer({ min: 5, max: 20 }),
        // 生成要删除的页数（1 到原始页数的一半）
        fc.integer({ min: 1, max: 10 }),
        async (originalPageCount, deleteCount) => {
          // 确保删除的页数不超过原始页数
          const actualDeleteCount = Math.min(deleteCount, originalPageCount - 1)
          
          // 创建测试文件
          const testFile = await createTestPptx(tempDir, `test-${Date.now()}.pptx`, originalPageCount)
          const outputPath = path.join(tempDir, `output-${Date.now()}.pptx`)

          // 生成要删除的页码范围（从第 1 页开始连续删除）
          const pageRange = `1-${actualDeleteCount}`

          // 执行删除操作
          const deletedCount = await processor.deletePages(testFile, outputPath, pageRange)

          // 验证删除的页数
          expect(deletedCount).toBe(actualDeleteCount)

          // 读取输出文件
          const doc = await parser.open(outputPath)

          // 验证页面总数一致性
          const expectedPageCount = originalPageCount - actualDeleteCount
          expect(doc.slides.length).toBe(expectedPageCount)

          // 清理
          await fs.unlink(testFile).catch(() => {})
          await fs.unlink(outputPath).catch(() => {})
        }
      ),
      { numRuns: 20 } // 运行 20 次迭代
    )
  })

  /**
   * 属性 10.2: 插入操作后页面总数一致性
   * 
   * 对于任意 PPT 文件和任意要插入的页面，
   * 插入后的总页数应等于原总页数加上插入的页数
   */
  it('Property 10.2: Insert operation maintains page count consistency', async () => {
    await fc.assert(
      fc.asyncProperty(
        // 生成目标文件页数（3-15 页）
        fc.integer({ min: 3, max: 15 }),
        // 生成源文件页数（2-10 页）
        fc.integer({ min: 2, max: 10 }),
        // 生成要插入的页数（1 到源文件页数）
        fc.integer({ min: 1, max: 5 }),
        // 生成插入位置类型：0=start, 1=end, 2=middle
        fc.integer({ min: 0, max: 2 }),
        async (targetPageCount, sourcePageCount, insertCount, positionType) => {
          // 确保插入的页数不超过源文件页数
          const actualInsertCount = Math.min(insertCount, sourcePageCount)
          
          // 创建测试文件
          const targetFile = await createTestPptx(tempDir, `target-${Date.now()}.pptx`, targetPageCount)
          const sourceFile = await createTestPptx(tempDir, `source-${Date.now()}.pptx`, sourcePageCount)
          const outputPath = path.join(tempDir, `output-${Date.now()}.pptx`)

          // 生成要插入的页码范围（从第 1 页开始连续插入）
          const pageRange = `1-${actualInsertCount}`

          // 确定插入位置
          let insertPosition: 'start' | 'end' | number
          if (positionType === 0) {
            insertPosition = 'start'
          } else if (positionType === 1) {
            insertPosition = 'end'
          } else {
            // 在中间位置插入（随机选择一个有效位置）
            const middlePosition = Math.floor(targetPageCount / 2) + 1
            insertPosition = middlePosition
          }

          // 执行插入操作
          const insertedCount = await processor.insertPages(
            targetFile,
            sourceFile,
            pageRange,
            insertPosition,
            outputPath
          )

          // 验证插入的页数
          expect(insertedCount).toBe(actualInsertCount)

          // 读取输出文件
          const doc = await parser.open(outputPath)

          // 验证页面总数一致性
          const expectedPageCount = targetPageCount + actualInsertCount
          expect(doc.slides.length).toBe(expectedPageCount)

          // 清理
          await fs.unlink(targetFile).catch(() => {})
          await fs.unlink(sourceFile).catch(() => {})
          await fs.unlink(outputPath).catch(() => {})
        }
      ),
      { numRuns: 20 } // 运行 20 次迭代
    )
  })

  /**
   * 属性 10.3: 提取操作后页面总数一致性
   * 
   * 对于任意 PPT 文件和任意有效的页码范围，
   * 提取后的文件页数应等于提取的页数
   */
  it('Property 10.3: Extract operation maintains page count consistency', async () => {
    await fc.assert(
      fc.asyncProperty(
        // 生成原始页数（5-20 页）
        fc.integer({ min: 5, max: 20 }),
        // 生成要提取的页数（1 到原始页数的一半）
        fc.integer({ min: 1, max: 10 }),
        async (originalPageCount, extractCount) => {
          // 确保提取的页数不超过原始页数
          const actualExtractCount = Math.min(extractCount, originalPageCount)
          
          // 创建测试文件
          const testFile = await createTestPptx(tempDir, `test-${Date.now()}.pptx`, originalPageCount)
          const outputPath = path.join(tempDir, `output-${Date.now()}.pptx`)

          // 生成要提取的页码范围（从第 1 页开始连续提取）
          const pageRange = `1-${actualExtractCount}`

          // 执行提取操作
          const extractedCount = await processor.extractPages(testFile, outputPath, pageRange)

          // 验证提取的页数
          expect(extractedCount).toBe(actualExtractCount)

          // 读取输出文件
          const doc = await parser.open(outputPath)

          // 验证页面总数一致性
          expect(doc.slides.length).toBe(actualExtractCount)

          // 清理
          await fs.unlink(testFile).catch(() => {})
          await fs.unlink(outputPath).catch(() => {})
        }
      ),
      { numRuns: 20 } // 运行 20 次迭代
    )
  })

  /**
   * 属性 10.4: 替换操作后页面总数不变
   * 
   * 对于任意 PPT 文件和任意有效的页面替换操作，
   * 替换后的总页数应等于原总页数（替换不改变页数）
   */
  it('Property 10.4: Replace operation maintains total page count', async () => {
    await fc.assert(
      fc.asyncProperty(
        // 生成目标文件页数（5-15 页）
        fc.integer({ min: 5, max: 15 }),
        // 生成源文件页数（3-10 页）
        fc.integer({ min: 3, max: 10 }),
        // 生成要替换的页数（1-5 页）
        fc.integer({ min: 1, max: 5 }),
        async (targetPageCount, sourcePageCount, replaceCount) => {
          // 确保替换的页数不超过目标和源文件的页数
          const actualReplaceCount = Math.min(replaceCount, targetPageCount, sourcePageCount)
          
          // 创建测试文件
          const targetFile = await createTestPptx(tempDir, `target-${Date.now()}.pptx`, targetPageCount)
          const sourceFile = await createTestPptx(tempDir, `source-${Date.now()}.pptx`, sourcePageCount)
          const outputPath = path.join(tempDir, `output-${Date.now()}.pptx`)

          // 生成页码范围（从第 1 页开始连续替换）
          const pageRange = `1-${actualReplaceCount}`

          // 执行替换操作
          const replacedCount = await processor.replacePages(
            targetFile,
            sourceFile,
            pageRange,
            pageRange,
            outputPath
          )

          // 验证替换的页数
          expect(replacedCount).toBe(actualReplaceCount)

          // 读取输出文件
          const doc = await parser.open(outputPath)

          // 验证页面总数不变
          expect(doc.slides.length).toBe(targetPageCount)

          // 清理
          await fs.unlink(targetFile).catch(() => {})
          await fs.unlink(sourceFile).catch(() => {})
          await fs.unlink(outputPath).catch(() => {})
        }
      ),
      { numRuns: 20 } // 运行 20 次迭代
    )
  })

  /**
   * 属性 10.5: 多次操作的累积效果
   * 
   * 对于任意一系列页面操作（删除、插入），
   * 最终的页面总数应等于初始页数加上所有插入的页数减去所有删除的页数
   */
  it('Property 10.5: Multiple operations maintain cumulative page count consistency', async () => {
    await fc.assert(
      fc.asyncProperty(
        // 生成初始页数（10-20 页）
        fc.integer({ min: 10, max: 20 }),
        async (initialPageCount) => {
          // 创建初始文件
          let currentFile = await createTestPptx(tempDir, `initial-${Date.now()}.pptx`, initialPageCount)
          let expectedPageCount = initialPageCount

          // 执行一系列操作
          // 操作 1: 删除 2 页
          const deleteFile = path.join(tempDir, `after-delete-${Date.now()}.pptx`)
          await processor.deletePages(currentFile, deleteFile, '1-2')
          expectedPageCount -= 2
          
          let doc = await parser.open(deleteFile)
          expect(doc.slides.length).toBe(expectedPageCount)

          // 操作 2: 插入 3 页
          const sourceFile = await createTestPptx(tempDir, `source-${Date.now()}.pptx`, 5)
          const insertFile = path.join(tempDir, `after-insert-${Date.now()}.pptx`)
          await processor.insertPages(deleteFile, sourceFile, '1-3', 'end', insertFile)
          expectedPageCount += 3
          
          doc = await parser.open(insertFile)
          expect(doc.slides.length).toBe(expectedPageCount)

          // 操作 3: 再删除 1 页
          const finalFile = path.join(tempDir, `final-${Date.now()}.pptx`)
          await processor.deletePages(insertFile, finalFile, '1')
          expectedPageCount -= 1
          
          doc = await parser.open(finalFile)
          expect(doc.slides.length).toBe(expectedPageCount)

          // 验证最终页数
          const finalExpectedCount = initialPageCount - 2 + 3 - 1
          expect(doc.slides.length).toBe(finalExpectedCount)

          // 清理
          await fs.unlink(currentFile).catch(() => {})
          await fs.unlink(deleteFile).catch(() => {})
          await fs.unlink(sourceFile).catch(() => {})
          await fs.unlink(insertFile).catch(() => {})
          await fs.unlink(finalFile).catch(() => {})
        }
      ),
      { numRuns: 10 } // 运行 10 次迭代（因为这个测试更复杂）
    )
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
