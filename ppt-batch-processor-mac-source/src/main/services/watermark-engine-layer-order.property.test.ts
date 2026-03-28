import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'
import { WatermarkEngine } from './watermark-engine'
import { PptxParser } from './pptx-parser'
import type { PptxDocument, WatermarkOptions, Slide } from '../../shared/types'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'
import PizZip from 'pizzip'
import { parseString } from 'xml2js'
import { promisify } from 'util'

const parseXml = promisify(parseString)

/**
 * 属性测试：水印图层顺序保持
 * 
 * **Validates: Requirements 9.6**
 * 
 * 属性 19: 水印图层顺序保持
 * 对于任意水印添加操作，添加水印后原幻灯片内容的图层顺序应保持不变，
 * 水印应位于最上层。
 */
describe('WatermarkEngine - Property 19: Layer Order Preservation', () => {
  let watermarkEngine: WatermarkEngine
  let pptxParser: PptxParser
  let tempDir: string
  let testFiles: string[] = []
  let testImagePath: string

  beforeEach(async () => {
    watermarkEngine = new WatermarkEngine()
    pptxParser = new PptxParser()
    
    // 创建临时目录
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'watermark-layer-test-'))
    
    // 创建测试图片文件
    testImagePath = path.join(tempDir, 'watermark.png')
    await createTestImage(testImagePath)
    testFiles.push(testImagePath)
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
   * 创建一个简单的测试图片文件（1x1 PNG）
   */
  async function createTestImage(filePath: string): Promise<void> {
    const pngData = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
      0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
      0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
      0x54, 0x08, 0xD7, 0x63, 0xF8, 0xFF, 0xFF, 0x3F,
      0x00, 0x05, 0xFE, 0x02, 0xFE, 0xDC, 0xCC, 0x59,
      0xE7, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E,
      0x44, 0xAE, 0x42, 0x60, 0x82
    ])
    
    await fs.writeFile(filePath, pngData)
  }

  /**
   * 创建一个包含指定数量元素的测试 PPTX 文件
   */
  async function createTestPptxWithElements(
    filePath: string,
    numShapes: number,
    numPictures: number
  ): Promise<void> {
    const zip = new PizZip()
    
    // [Content_Types].xml
    zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
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
    
    // ppt/_rels/presentation.xml.rels
    zip.file('ppt/_rels/presentation.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
</Relationships>`)
    
    // ppt/presentation.xml
    zip.file('ppt/presentation.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:sldIdLst>
    <p:sldId id="256" r:id="rId1"/>
  </p:sldIdLst>
</p:presentation>`)
    
    // 生成幻灯片内容，包含指定数量的形状和图片
    let shapeElements = ''
    for (let i = 0; i < numShapes; i++) {
      shapeElements += `
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="${100 + i}" name="Shape ${i + 1}"/>
          <p:cNvSpPr/>
          <p:nvPr/>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm>
            <a:off x="${1000000 + i * 100000}" y="${1000000 + i * 100000}"/>
            <a:ext cx="1000000" cy="500000"/>
          </a:xfrm>
          <a:prstGeom prst="rect">
            <a:avLst/>
          </a:prstGeom>
        </p:spPr>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p>
            <a:r>
              <a:t>Text ${i + 1}</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>`
    }
    
    let pictureElements = ''
    for (let i = 0; i < numPictures; i++) {
      pictureElements += `
      <p:pic>
        <p:nvPicPr>
          <p:cNvPr id="${200 + i}" name="Picture ${i + 1}"/>
          <p:cNvPicPr/>
          <p:nvPr/>
        </p:nvPicPr>
        <p:blipFill>
          <a:blip r:embed="rId${i + 2}"/>
          <a:stretch>
            <a:fillRect/>
          </a:stretch>
        </p:blipFill>
        <p:spPr>
          <a:xfrm>
            <a:off x="${2000000 + i * 100000}" y="${2000000 + i * 100000}"/>
            <a:ext cx="1000000" cy="1000000"/>
          </a:xfrm>
        </p:spPr>
      </p:pic>`
    }
    
    // ppt/slides/slide1.xml
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
      ${shapeElements}
      ${pictureElements}
    </p:spTree>
  </p:cSld>
</p:sld>`)
    
    // docProps/core.xml
    zip.file('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Test Presentation</dc:title>
  <dc:creator>Test Author</dc:creator>
  <dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:modified>
</cp:coreProperties>`)
    
    // docProps/app.xml
    zip.file('docProps/app.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
  <Company>Test Company</Company>
</Properties>`)
    
    const content = zip.generate({
      type: 'nodebuffer',
      compression: 'DEFLATE'
    })
    
    await fs.writeFile(filePath, content)
  }

  /**
   * 获取幻灯片中元素的顺序
   * 返回元素 ID 的数组，表示从底层到顶层的顺序
   * 
   * 注意：xml2js 将 XML 元素按类型分组到数组中，但实际的 z-order
   * 是由元素在原始 XML 中出现的顺序决定的。我们需要解析原始 XML
   * 来获取正确的顺序。
   */
  async function getElementOrder(document: PptxDocument, slideIndex: number): Promise<string[]> {
    const zip = document.zipArchive as PizZip
    const slidePath = `ppt/slides/slide${slideIndex + 1}.xml`
    
    const slideFile = zip.file(slidePath)
    if (!slideFile) {
      return []
    }
    
    const slideXml = slideFile.asText()
    
    // 使用正则表达式从原始 XML 中提取元素顺序
    // 匹配 <p:sp> 和 <p:pic> 元素的 ID
    const elementIds: string[] = []
    
    // 匹配 <p:sp> 元素
    const spRegex = /<p:sp>[\s\S]*?<p:cNvPr\s+id="(\d+)"/g
    let match
    
    // 匹配 <p:pic> 元素
    const picRegex = /<p:pic>[\s\S]*?<p:cNvPr\s+id="(\d+)"/g
    
    // 创建一个包含所有匹配及其位置的数组
    const matches: Array<{ type: string; id: string; index: number }> = []
    
    while ((match = spRegex.exec(slideXml)) !== null) {
      matches.push({
        type: 'sp',
        id: match[1],
        index: match.index
      })
    }
    
    while ((match = picRegex.exec(slideXml)) !== null) {
      matches.push({
        type: 'pic',
        id: match[1],
        index: match.index
      })
    }
    
    // 按照在 XML 中出现的位置排序
    matches.sort((a, b) => a.index - b.index)
    
    // 提取 ID，跳过 nvGrpSpPr 元素（ID 为 1）
    for (const m of matches) {
      if (m.id !== '1') {  // 跳过 nvGrpSpPr
        elementIds.push(`${m.type}-${m.id}`)
      }
    }
    
    return elementIds
  }

  /**
   * 检查水印是否在最上层
   * 水印元素应该是最后添加的元素
   */
  function isWatermarkOnTop(elementIds: string[], watermarkId: string): boolean {
    if (elementIds.length === 0) {
      return false
    }
    
    // 水印应该是最后一个元素（最上层）
    return elementIds[elementIds.length - 1] === watermarkId
  }

  /**
   * 检查原始元素顺序是否保持不变
   */
  function isOriginalOrderPreserved(
    originalIds: string[],
    newIds: string[],
    watermarkId: string
  ): boolean {
    // 从新的 ID 列表中移除水印 ID
    const newIdsWithoutWatermark = newIds.filter(id => id !== watermarkId)
    
    // 检查原始顺序是否保持
    if (originalIds.length !== newIdsWithoutWatermark.length) {
      return false
    }
    
    for (let i = 0; i < originalIds.length; i++) {
      if (originalIds[i] !== newIdsWithoutWatermark[i]) {
        return false
      }
    }
    
    return true
  }

  // 生成器：水印类型
  const watermarkTypeArb = fc.constantFrom('text', 'image')
  
  // 生成器：水印位置
  const watermarkPositionArb = fc.constantFrom(
    'top-left',
    'top-right',
    'center',
    'bottom-left',
    'bottom-right'
  )
  
  // 生成器：透明度（0-1）
  const opacityArb = fc.double({ min: 0.1, max: 1.0 })
  
  // 生成器：字体大小
  const fontSizeArb = fc.integer({ min: 12, max: 72 })
  
  // 生成器：颜色
  const colorArb = fc.hexaString({ minLength: 6, maxLength: 6 }).map(s => `#${s}`)
  
  // 生成器：幻灯片元素数量
  const elementCountArb = fc.record({
    shapes: fc.integer({ min: 0, max: 5 }),
    pictures: fc.integer({ min: 0, max: 3 })
  })

  it('Property 19: Watermark should be on top layer and original order preserved - text watermark', async () => {
    await fc.assert(
      fc.asyncProperty(
        elementCountArb,
        watermarkPositionArb,
        opacityArb,
        fontSizeArb,
        colorArb,
        fc.string({ minLength: 1, maxLength: 20 }),
        async (elementCount, position, opacity, fontSize, color, text) => {
          // 创建测试文件
          const testPptxPath = path.join(tempDir, `test-${Date.now()}-${Math.random()}.pptx`)
          await createTestPptxWithElements(
            testPptxPath,
            elementCount.shapes,
            elementCount.pictures
          )
          testFiles.push(testPptxPath)
          
          // 打开文档
          const document = await pptxParser.open(testPptxPath)
          expect(document.slides.length).toBeGreaterThan(0)
          
          const slide = document.slides[0]
          
          // 获取添加水印前的元素顺序
          const originalOrder = await getElementOrder(document, 0)
          
          // 添加文字水印
          const options: WatermarkOptions = {
            type: 'text',
            content: text,
            position: position as any,
            opacity,
            fontSize,
            fontColor: color
          }
          
          const result = await watermarkEngine.addTextWatermark(document, slide, options)
          expect(result).toBe(true)
          
          // 保存文档
          const outputPath = path.join(tempDir, `output-${Date.now()}-${Math.random()}.pptx`)
          await pptxParser.save(document, outputPath)
          testFiles.push(outputPath)
          
          // 重新打开文档以验证
          const verifyDocument = await pptxParser.open(outputPath)
          const newOrder = await getElementOrder(verifyDocument, 0)
          
          // 验证：新增了一个元素（水印）
          expect(newOrder.length).toBe(originalOrder.length + 1)
          
          // 验证：水印在最上层（最后一个元素）
          const watermarkId = newOrder[newOrder.length - 1]
          expect(isWatermarkOnTop(newOrder, watermarkId)).toBe(true)
          
          // 验证：原始元素顺序保持不变
          expect(isOriginalOrderPreserved(originalOrder, newOrder, watermarkId)).toBe(true)
        }
      ),
      { numRuns: 20 }  // 运行 20 次迭代以平衡测试时间和覆盖率
    )
  })

  it('Property 19: Watermark should be on top layer and original order preserved - image watermark', async () => {
    await fc.assert(
      fc.asyncProperty(
        elementCountArb,
        watermarkPositionArb,
        opacityArb,
        async (elementCount, position, opacity) => {
          // 创建测试文件
          const testPptxPath = path.join(tempDir, `test-${Date.now()}-${Math.random()}.pptx`)
          await createTestPptxWithElements(
            testPptxPath,
            elementCount.shapes,
            elementCount.pictures
          )
          testFiles.push(testPptxPath)
          
          // 打开文档
          const document = await pptxParser.open(testPptxPath)
          expect(document.slides.length).toBeGreaterThan(0)
          
          const slide = document.slides[0]
          
          // 获取添加水印前的元素顺序
          const originalOrder = await getElementOrder(document, 0)
          
          // 添加图片水印
          const options: WatermarkOptions = {
            type: 'image',
            content: testImagePath,
            position: position as any,
            opacity
          }
          
          const result = await watermarkEngine.addImageWatermark(document, slide, options)
          expect(result).toBe(true)
          
          // 保存文档
          const outputPath = path.join(tempDir, `output-${Date.now()}-${Math.random()}.pptx`)
          await pptxParser.save(document, outputPath)
          testFiles.push(outputPath)
          
          // 重新打开文档以验证
          const verifyDocument = await pptxParser.open(outputPath)
          const newOrder = await getElementOrder(verifyDocument, 0)
          
          // 验证：新增了一个元素（水印）
          expect(newOrder.length).toBe(originalOrder.length + 1)
          
          // 验证：水印在最上层（最后一个元素）
          const watermarkId = newOrder[newOrder.length - 1]
          expect(isWatermarkOnTop(newOrder, watermarkId)).toBe(true)
          
          // 验证：原始元素顺序保持不变
          expect(isOriginalOrderPreserved(originalOrder, newOrder, watermarkId)).toBe(true)
        }
      ),
      { numRuns: 20 }  // 运行 20 次迭代以平衡测试时间和覆盖率
    )
  })

  it('Property 19: Multiple watermarks should maintain order', async () => {
    await fc.assert(
      fc.asyncProperty(
        elementCountArb,
        fc.integer({ min: 2, max: 4 }),  // 添加 2-4 个水印
        async (elementCount, numWatermarks) => {
          // 创建测试文件
          const testPptxPath = path.join(tempDir, `test-${Date.now()}-${Math.random()}.pptx`)
          await createTestPptxWithElements(
            testPptxPath,
            elementCount.shapes,
            elementCount.pictures
          )
          testFiles.push(testPptxPath)
          
          // 打开文档
          const document = await pptxParser.open(testPptxPath)
          const slide = document.slides[0]
          
          // 获取初始元素顺序
          const originalOrder = await getElementOrder(document, 0)
          const watermarkIds: string[] = []
          
          // 添加多个水印
          for (let i = 0; i < numWatermarks; i++) {
            const options: WatermarkOptions = {
              type: i % 2 === 0 ? 'text' : 'image',
              content: i % 2 === 0 ? `Watermark ${i + 1}` : testImagePath,
              position: 'center',
              opacity: 0.5,
              fontSize: 24,
              fontColor: '#000000'
            }
            
            if (options.type === 'text') {
              await watermarkEngine.addTextWatermark(document, slide, options)
            } else {
              await watermarkEngine.addImageWatermark(document, slide, options)
            }
            
            // 获取当前顺序并记录新添加的水印 ID
            const currentOrder = await getElementOrder(document, 0)
            watermarkIds.push(currentOrder[currentOrder.length - 1])
          }
          
          // 保存并重新打开
          const outputPath = path.join(tempDir, `output-${Date.now()}-${Math.random()}.pptx`)
          await pptxParser.save(document, outputPath)
          testFiles.push(outputPath)
          
          const verifyDocument = await pptxParser.open(outputPath)
          const finalOrder = await getElementOrder(verifyDocument, 0)
          
          // 验证：元素总数正确
          expect(finalOrder.length).toBe(originalOrder.length + numWatermarks)
          
          // 验证：原始元素顺序保持不变（在水印之前）
          for (let i = 0; i < originalOrder.length; i++) {
            expect(finalOrder[i]).toBe(originalOrder[i])
          }
          
          // 验证：所有水印都在原始元素之后（在最上层）
          const watermarksInFinalOrder = finalOrder.slice(originalOrder.length)
          expect(watermarksInFinalOrder.length).toBe(numWatermarks)
        }
      ),
      { numRuns: 10 }  // 运行 10 次迭代（多水印测试较慢）
    )
  })

  it('Property 19: Empty slide should have watermark as only element on top', async () => {
    await fc.assert(
      fc.asyncProperty(
        watermarkTypeArb,
        watermarkPositionArb,
        opacityArb,
        async (watermarkType, position, opacity) => {
          // 创建空幻灯片
          const testPptxPath = path.join(tempDir, `test-${Date.now()}-${Math.random()}.pptx`)
          await createTestPptxWithElements(testPptxPath, 0, 0)
          testFiles.push(testPptxPath)
          
          const document = await pptxParser.open(testPptxPath)
          const slide = document.slides[0]
          
          // 获取初始元素顺序（应该为空）
          const originalOrder = await getElementOrder(document, 0)
          expect(originalOrder.length).toBe(0)
          
          // 添加水印
          const options: WatermarkOptions = {
            type: watermarkType as any,
            content: watermarkType === 'text' ? 'Test' : testImagePath,
            position: position as any,
            opacity,
            fontSize: 24,
            fontColor: '#000000'
          }
          
          if (watermarkType === 'text') {
            await watermarkEngine.addTextWatermark(document, slide, options)
          } else {
            await watermarkEngine.addImageWatermark(document, slide, options)
          }
          
          // 保存并验证
          const outputPath = path.join(tempDir, `output-${Date.now()}-${Math.random()}.pptx`)
          await pptxParser.save(document, outputPath)
          testFiles.push(outputPath)
          
          const verifyDocument = await pptxParser.open(outputPath)
          const newOrder = await getElementOrder(verifyDocument, 0)
          
          // 验证：只有一个元素（水印）
          expect(newOrder.length).toBe(1)
          
          // 验证：水印在最上层（唯一元素）
          expect(isWatermarkOnTop(newOrder, newOrder[0])).toBe(true)
        }
      ),
      { numRuns: 20 }
    )
  })
})
