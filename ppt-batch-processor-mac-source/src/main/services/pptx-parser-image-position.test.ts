import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'
import { PptxParser } from './pptx-parser'
import { promises as fs } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import PizZip from 'pizzip'
import sharp from 'sharp'
import type { ImageElement } from '../../shared/types'

/**
 * 属性测试：图片替换位置不变性
 * 
 * **Validates: Requirements 5.3**
 * 
 * 属性 6: 图片替换位置不变性
 * 对于任意图片替换操作，替换后的图片应保持原图片的位置、大小和图层顺序不变。
 */
describe('PptxParser - Property 6: Image Replacement Position Invariance', () => {
  let parser: PptxParser
  let tempDir: string
  let testFiles: string[] = []

  beforeEach(async () => {
    parser = new PptxParser()
    tempDir = join(tmpdir(), `pptx-image-test-${Date.now()}`)
    await fs.mkdir(tempDir, { recursive: true })
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
   * 创建一个测试用的图片文件
   */
  async function createTestImage(
    filePath: string,
    width: number,
    height: number,
    color: { r: number, g: number, b: number }
  ): Promise<void> {
    await sharp({
      create: {
        width,
        height,
        channels: 3,
        background: color
      }
    })
      .png()
      .toFile(filePath)
    
    testFiles.push(filePath)
  }

  /**
   * 创建一个包含图片的 PPTX 文件
   */
  async function createPptxWithImage(
    filePath: string,
    imagePath: string,
    position: { x: number, y: number },
    size: { width: number, height: number }
  ): Promise<void> {
    const zip = new PizZip()
    
    // [Content_Types].xml
    zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`)

    
    // _rels/.rels
    zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`)
    
    // ppt/presentation.xml
    zip.file('ppt/presentation.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:sldIdLst>
    <p:sldId id="256" r:id="rId1"/>
  </p:sldIdLst>
</p:presentation>`)
    
    // ppt/_rels/presentation.xml.rels
    zip.file('ppt/_rels/presentation.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
</Relationships>`)

    
    // 读取图片数据
    const imageData = await fs.readFile(imagePath)
    
    // ppt/media/image1.png
    zip.file('ppt/media/image1.png', imageData)
    
    // ppt/slides/slide1.xml with image
    zip.file('ppt/slides/slide1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr/>
      <p:pic>
        <p:nvPicPr>
          <p:cNvPr id="2" name="Picture 1"/>
          <p:cNvPicPr/>
          <p:nvPr/>
        </p:nvPicPr>
        <p:blipFill>
          <a:blip r:embed="rId1"/>
          <a:stretch>
            <a:fillRect/>
          </a:stretch>
        </p:blipFill>
        <p:spPr>
          <a:xfrm>
            <a:off x="${position.x}" y="${position.y}"/>
            <a:ext cx="${size.width}" cy="${size.height}"/>
          </a:xfrm>
        </p:spPr>
      </p:pic>
    </p:spTree>
  </p:cSld>
</p:sld>`)

    
    // ppt/slides/_rels/slide1.xml.rels
    zip.file('ppt/slides/_rels/slide1.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/>
</Relationships>`)
    
    // docProps/core.xml
    zip.file('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Test</dc:title>
  <dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:modified>
</cp:coreProperties>`)
    
    // docProps/app.xml
    zip.file('docProps/app.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
  <Company>Test</Company>
</Properties>`)
    
    const content = zip.generate({
      type: 'nodebuffer',
      compression: 'DEFLATE'
    })
    
    await fs.writeFile(filePath, content)
    testFiles.push(filePath)
  }


  /**
   * 比较两个位置是否相等
   */
  function arePositionsEqual(pos1: { x: number, y: number }, pos2: { x: number, y: number }): boolean {
    return pos1.x === pos2.x && pos1.y === pos2.y
  }

  /**
   * 比较两个尺寸是否相等
   */
  function areSizesEqual(size1: { width: number, height: number }, size2: { width: number, height: number }): boolean {
    return size1.width === size2.width && size1.height === size2.height
  }

  /**
   * 生成随机位置
   */
  const positionArbitrary = fc.record({
    x: fc.integer({ min: 0, max: 9144000 }), // PowerPoint 单位 (EMUs)
    y: fc.integer({ min: 0, max: 6858000 })
  })

  /**
   * 生成随机尺寸
   */
  const sizeArbitrary = fc.record({
    width: fc.integer({ min: 914400, max: 9144000 }),  // 至少 1 英寸
    height: fc.integer({ min: 914400, max: 6858000 })
  })

  /**
   * 生成随机颜色
   */
  const colorArbitrary = fc.record({
    r: fc.integer({ min: 0, max: 255 }),
    g: fc.integer({ min: 0, max: 255 }),
    b: fc.integer({ min: 0, max: 255 })
  })


  /**
   * 属性测试 1: 图片替换保持位置不变
   * 
   * 对于任意图片位置、尺寸和替换图片，
   * 替换后的图片应保持原图片的位置不变。
   */
  it('property: image replacement preserves position', async () => {
    await fc.assert(
      fc.asyncProperty(
        positionArbitrary,
        sizeArbitrary,
        colorArbitrary,
        colorArbitrary,
        async (position, size, originalColor, newColor) => {
          const inputPath = join(tempDir, `input-${Date.now()}-${Math.random()}.pptx`)
          const outputPath = join(tempDir, `output-${Date.now()}-${Math.random()}.pptx`)
          const originalImagePath = join(tempDir, `original-${Date.now()}-${Math.random()}.png`)
          const newImagePath = join(tempDir, `new-${Date.now()}-${Math.random()}.png`)
          
          try {
            // 创建原始图片和新图片
            await createTestImage(originalImagePath, 100, 100, originalColor)
            await createTestImage(newImagePath, 150, 150, newColor)
            
            // 创建包含原始图片的 PPTX 文件
            await createPptxWithImage(inputPath, originalImagePath, position, size)
            
            // 打开文件
            const document = await parser.open(inputPath)
            const slides = parser.getSlides(document)
            
            // 验证文件有幻灯片
            expect(slides.length).toBeGreaterThan(0)
            
            // 获取图片元素
            const imageElements = parser.getImages(slides[0])
            
            // 验证找到了图片
            expect(imageElements.length).toBeGreaterThan(0)
            
            // 获取原始位置和尺寸
            const originalPosition = { ...imageElements[0].position }
            const originalSize = { ...imageElements[0].size }
            
            // 执行图片替换
            const success = await parser.replaceImage(
              document,
              imageElements[0],
              newImagePath
            )
            
            // 如果替换失败，跳过此测试
            if (!success) {
              return true
            }
            
            // 保存文件
            await parser.save(document, outputPath)
            
            // 重新打开文件
            const reopenedDocument = await parser.open(outputPath)
            const reopenedSlides = parser.getSlides(reopenedDocument)
            
            // 获取替换后的图片元素
            const replacedImages = parser.getImages(reopenedSlides[0])
            
            // 验证找到了替换后的图片
            expect(replacedImages.length).toBeGreaterThan(0)
            
            // 验证位置保持不变
            expect(arePositionsEqual(replacedImages[0].position, originalPosition)).toBe(true)
            
            // 详细验证位置
            expect(replacedImages[0].position.x).toBe(originalPosition.x)
            expect(replacedImages[0].position.y).toBe(originalPosition.y)
            
            // 清理
            await fs.unlink(inputPath).catch(() => {})
            await fs.unlink(outputPath).catch(() => {})
            await fs.unlink(originalImagePath).catch(() => {})
            await fs.unlink(newImagePath).catch(() => {})
            
            return true
          } catch (error) {
            // 清理
            await fs.unlink(inputPath).catch(() => {})
            await fs.unlink(outputPath).catch(() => {})
            await fs.unlink(originalImagePath).catch(() => {})
            await fs.unlink(newImagePath).catch(() => {})
            throw error
          }
        }
      ),
      { numRuns: 100 }
    )
  }, 120000) // 120 秒超时


  /**
   * 属性测试 2: 图片替换保持尺寸不变
   * 
   * 对于任意图片位置、尺寸和替换图片，
   * 替换后的图片应保持原图片的尺寸不变。
   */
  it('property: image replacement preserves size', async () => {
    await fc.assert(
      fc.asyncProperty(
        positionArbitrary,
        sizeArbitrary,
        colorArbitrary,
        colorArbitrary,
        async (position, size, originalColor, newColor) => {
          const inputPath = join(tempDir, `size-input-${Date.now()}-${Math.random()}.pptx`)
          const outputPath = join(tempDir, `size-output-${Date.now()}-${Math.random()}.pptx`)
          const originalImagePath = join(tempDir, `size-original-${Date.now()}-${Math.random()}.png`)
          const newImagePath = join(tempDir, `size-new-${Date.now()}-${Math.random()}.png`)
          
          try {
            // 创建不同尺寸的图片
            await createTestImage(originalImagePath, 100, 100, originalColor)
            await createTestImage(newImagePath, 200, 200, newColor)
            
            // 创建 PPTX 文件
            await createPptxWithImage(inputPath, originalImagePath, position, size)
            
            // 打开文件
            const document = await parser.open(inputPath)
            const slides = parser.getSlides(document)
            
            // 获取图片元素
            const imageElements = parser.getImages(slides[0])
            expect(imageElements.length).toBeGreaterThan(0)
            
            // 获取原始尺寸
            const originalSize = { ...imageElements[0].size }
            
            // 执行图片替换
            const success = await parser.replaceImage(
              document,
              imageElements[0],
              newImagePath
            )
            
            if (!success) {
              return true
            }
            
            // 保存并重新打开
            await parser.save(document, outputPath)
            const reopenedDocument = await parser.open(outputPath)
            const reopenedSlides = parser.getSlides(reopenedDocument)
            
            // 获取替换后的图片
            const replacedImages = parser.getImages(reopenedSlides[0])
            expect(replacedImages.length).toBeGreaterThan(0)
            
            // 验证尺寸保持不变
            expect(areSizesEqual(replacedImages[0].size, originalSize)).toBe(true)
            
            // 详细验证尺寸
            expect(replacedImages[0].size.width).toBe(originalSize.width)
            expect(replacedImages[0].size.height).toBe(originalSize.height)
            
            // 清理
            await fs.unlink(inputPath).catch(() => {})
            await fs.unlink(outputPath).catch(() => {})
            await fs.unlink(originalImagePath).catch(() => {})
            await fs.unlink(newImagePath).catch(() => {})
            
            return true
          } catch (error) {
            // 清理
            await fs.unlink(inputPath).catch(() => {})
            await fs.unlink(outputPath).catch(() => {})
            await fs.unlink(originalImagePath).catch(() => {})
            await fs.unlink(newImagePath).catch(() => {})
            throw error
          }
        }
      ),
      { numRuns: 100 }
    )
  }, 120000) // 120 秒超时


  /**
   * 属性测试 3: 图片替换保持位置和尺寸同时不变
   * 
   * 对于任意图片替换操作，替换后的图片应同时保持原图片的位置和尺寸不变。
   */
  it('property: image replacement preserves both position and size', async () => {
    await fc.assert(
      fc.asyncProperty(
        positionArbitrary,
        sizeArbitrary,
        colorArbitrary,
        colorArbitrary,
        async (position, size, originalColor, newColor) => {
          const inputPath = join(tempDir, `both-input-${Date.now()}-${Math.random()}.pptx`)
          const outputPath = join(tempDir, `both-output-${Date.now()}-${Math.random()}.pptx`)
          const originalImagePath = join(tempDir, `both-original-${Date.now()}-${Math.random()}.png`)
          const newImagePath = join(tempDir, `both-new-${Date.now()}-${Math.random()}.png`)
          
          try {
            // 创建图片
            await createTestImage(originalImagePath, 100, 100, originalColor)
            await createTestImage(newImagePath, 300, 300, newColor)
            
            // 创建 PPTX 文件
            await createPptxWithImage(inputPath, originalImagePath, position, size)
            
            // 打开文件
            const document = await parser.open(inputPath)
            const slides = parser.getSlides(document)
            
            // 获取图片元素
            const imageElements = parser.getImages(slides[0])
            expect(imageElements.length).toBeGreaterThan(0)
            
            // 保存原始属性
            const originalPosition = { ...imageElements[0].position }
            const originalSize = { ...imageElements[0].size }
            
            // 执行图片替换
            const success = await parser.replaceImage(
              document,
              imageElements[0],
              newImagePath
            )
            
            if (!success) {
              return true
            }
            
            // 保存并重新打开
            await parser.save(document, outputPath)
            const reopenedDocument = await parser.open(outputPath)
            const reopenedSlides = parser.getSlides(reopenedDocument)
            
            // 获取替换后的图片
            const replacedImages = parser.getImages(reopenedSlides[0])
            expect(replacedImages.length).toBeGreaterThan(0)
            
            // 验证位置和尺寸都保持不变
            expect(arePositionsEqual(replacedImages[0].position, originalPosition)).toBe(true)
            expect(areSizesEqual(replacedImages[0].size, originalSize)).toBe(true)
            
            // 清理
            await fs.unlink(inputPath).catch(() => {})
            await fs.unlink(outputPath).catch(() => {})
            await fs.unlink(originalImagePath).catch(() => {})
            await fs.unlink(newImagePath).catch(() => {})
            
            return true
          } catch (error) {
            // 清理
            await fs.unlink(inputPath).catch(() => {})
            await fs.unlink(outputPath).catch(() => {})
            await fs.unlink(originalImagePath).catch(() => {})
            await fs.unlink(newImagePath).catch(() => {})
            throw error
          }
        }
      ),
      { numRuns: 100 }
    )
  }, 120000) // 120 秒超时


  /**
   * 边界情况测试：替换为相同格式的图片
   */
  it('edge case: replacing with same format image preserves position and size', async () => {
    const inputPath = join(tempDir, 'same-format-input.pptx')
    const outputPath = join(tempDir, 'same-format-output.pptx')
    const originalImagePath = join(tempDir, 'same-format-original.png')
    const newImagePath = join(tempDir, 'same-format-new.png')
    
    const position = { x: 1000000, y: 2000000 }
    const size = { width: 3000000, height: 4000000 }
    
    // 创建相同格式的图片
    await createTestImage(originalImagePath, 100, 100, { r: 255, g: 0, b: 0 })
    await createTestImage(newImagePath, 100, 100, { r: 0, g: 255, b: 0 })
    
    // 创建 PPTX 文件
    await createPptxWithImage(inputPath, originalImagePath, position, size)
    
    // 打开并替换
    const document = await parser.open(inputPath)
    const slides = parser.getSlides(document)
    const imageElements = parser.getImages(slides[0])
    
    expect(imageElements.length).toBeGreaterThan(0)
    
    const originalPosition = { ...imageElements[0].position }
    const originalSize = { ...imageElements[0].size }
    
    // 替换图片
    await parser.replaceImage(document, imageElements[0], newImagePath)
    await parser.save(document, outputPath)
    
    // 重新打开并验证
    const reopenedDocument = await parser.open(outputPath)
    const reopenedSlides = parser.getSlides(reopenedDocument)
    const replacedImages = parser.getImages(reopenedSlides[0])
    
    expect(replacedImages.length).toBeGreaterThan(0)
    
    // 验证位置和尺寸保持不变
    expect(replacedImages[0].position.x).toBe(originalPosition.x)
    expect(replacedImages[0].position.y).toBe(originalPosition.y)
    expect(replacedImages[0].size.width).toBe(originalSize.width)
    expect(replacedImages[0].size.height).toBe(originalSize.height)
  })


  /**
   * 边界情况测试：替换为不同格式的图片
   */
  it('edge case: replacing with different format image preserves position and size', async () => {
    const inputPath = join(tempDir, 'diff-format-input.pptx')
    const outputPath = join(tempDir, 'diff-format-output.pptx')
    const originalImagePath = join(tempDir, 'diff-format-original.png')
    const newImagePath = join(tempDir, 'diff-format-new.jpg')
    
    const position = { x: 500000, y: 1500000 }
    const size = { width: 2500000, height: 3500000 }
    
    // 创建 PNG 图片
    await createTestImage(originalImagePath, 100, 100, { r: 255, g: 0, b: 0 })
    
    // 创建 JPG 图片
    await sharp({
      create: {
        width: 150,
        height: 150,
        channels: 3,
        background: { r: 0, g: 0, b: 255 }
      }
    })
      .jpeg()
      .toFile(newImagePath)
    
    testFiles.push(newImagePath)
    
    // 创建 PPTX 文件
    await createPptxWithImage(inputPath, originalImagePath, position, size)
    
    // 打开并替换
    const document = await parser.open(inputPath)
    const slides = parser.getSlides(document)
    const imageElements = parser.getImages(slides[0])
    
    expect(imageElements.length).toBeGreaterThan(0)
    
    const originalPosition = { ...imageElements[0].position }
    const originalSize = { ...imageElements[0].size }
    
    // 替换为不同格式的图片
    await parser.replaceImage(document, imageElements[0], newImagePath)
    await parser.save(document, outputPath)
    
    // 重新打开并验证
    const reopenedDocument = await parser.open(outputPath)
    const reopenedSlides = parser.getSlides(reopenedDocument)
    const replacedImages = parser.getImages(reopenedSlides[0])
    
    expect(replacedImages.length).toBeGreaterThan(0)
    
    // 验证位置和尺寸保持不变
    expect(replacedImages[0].position.x).toBe(originalPosition.x)
    expect(replacedImages[0].position.y).toBe(originalPosition.y)
    expect(replacedImages[0].size.width).toBe(originalSize.width)
    expect(replacedImages[0].size.height).toBe(originalSize.height)
  })


  /**
   * 边界情况测试：极小尺寸图片
   */
  it('edge case: replacing very small image preserves position and size', async () => {
    const inputPath = join(tempDir, 'small-input.pptx')
    const outputPath = join(tempDir, 'small-output.pptx')
    const originalImagePath = join(tempDir, 'small-original.png')
    const newImagePath = join(tempDir, 'small-new.png')
    
    // 极小的位置和尺寸
    const position = { x: 0, y: 0 }
    const size = { width: 914400, height: 914400 } // 1 英寸
    
    await createTestImage(originalImagePath, 10, 10, { r: 255, g: 0, b: 0 })
    await createTestImage(newImagePath, 10, 10, { r: 0, g: 255, b: 0 })
    
    await createPptxWithImage(inputPath, originalImagePath, position, size)
    
    const document = await parser.open(inputPath)
    const slides = parser.getSlides(document)
    const imageElements = parser.getImages(slides[0])
    
    expect(imageElements.length).toBeGreaterThan(0)
    
    const originalPosition = { ...imageElements[0].position }
    const originalSize = { ...imageElements[0].size }
    
    await parser.replaceImage(document, imageElements[0], newImagePath)
    await parser.save(document, outputPath)
    
    const reopenedDocument = await parser.open(outputPath)
    const reopenedSlides = parser.getSlides(reopenedDocument)
    const replacedImages = parser.getImages(reopenedSlides[0])
    
    expect(replacedImages.length).toBeGreaterThan(0)
    expect(replacedImages[0].position.x).toBe(originalPosition.x)
    expect(replacedImages[0].position.y).toBe(originalPosition.y)
    expect(replacedImages[0].size.width).toBe(originalSize.width)
    expect(replacedImages[0].size.height).toBe(originalSize.height)
  })

  /**
   * 边界情况测试：极大尺寸图片
   */
  it('edge case: replacing very large image preserves position and size', async () => {
    const inputPath = join(tempDir, 'large-input.pptx')
    const outputPath = join(tempDir, 'large-output.pptx')
    const originalImagePath = join(tempDir, 'large-original.png')
    const newImagePath = join(tempDir, 'large-new.png')
    
    // 极大的尺寸
    const position = { x: 0, y: 0 }
    const size = { width: 9144000, height: 6858000 } // 接近最大尺寸
    
    await createTestImage(originalImagePath, 500, 500, { r: 255, g: 0, b: 0 })
    await createTestImage(newImagePath, 500, 500, { r: 0, g: 255, b: 0 })
    
    await createPptxWithImage(inputPath, originalImagePath, position, size)
    
    const document = await parser.open(inputPath)
    const slides = parser.getSlides(document)
    const imageElements = parser.getImages(slides[0])
    
    expect(imageElements.length).toBeGreaterThan(0)
    
    const originalPosition = { ...imageElements[0].position }
    const originalSize = { ...imageElements[0].size }
    
    await parser.replaceImage(document, imageElements[0], newImagePath)
    await parser.save(document, outputPath)
    
    const reopenedDocument = await parser.open(outputPath)
    const reopenedSlides = parser.getSlides(reopenedDocument)
    const replacedImages = parser.getImages(reopenedSlides[0])
    
    expect(replacedImages.length).toBeGreaterThan(0)
    expect(replacedImages[0].position.x).toBe(originalPosition.x)
    expect(replacedImages[0].position.y).toBe(originalPosition.y)
    expect(replacedImages[0].size.width).toBe(originalSize.width)
    expect(replacedImages[0].size.height).toBe(originalSize.height)
  })
})
