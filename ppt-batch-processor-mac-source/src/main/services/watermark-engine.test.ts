import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { WatermarkEngine } from './watermark-engine'
import { PptxParser } from './pptx-parser'
import type { PptxDocument, WatermarkOptions, ImageElement } from '../../shared/types'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'
import PizZip from 'pizzip'
import sharp from 'sharp'

describe('WatermarkEngine', () => {
  let watermarkEngine: WatermarkEngine
  let pptxParser: PptxParser
  let testPptxPath: string
  let tempDir: string
  let testFiles: string[] = []
  let testImagePath: string

  beforeEach(async () => {
    watermarkEngine = new WatermarkEngine()
    pptxParser = new PptxParser()
    
    // 创建临时目录
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'watermark-test-'))
    
    // 创建测试 PPTX 文件
    testPptxPath = path.join(tempDir, 'test.pptx')
    await createTestPptx(testPptxPath)
    testFiles.push(testPptxPath)
    
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
   * 创建一个包含幻灯片的测试 PPTX 文件
   */
  async function createTestPptx(filePath: string): Promise<void> {
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
    
    // ppt/slides/slide1.xml
    zip.file('ppt/slides/slide1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr/>
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
   * 创建一个简单的测试图片文件（1x1 PNG）
   */
  async function createTestImage(filePath: string): Promise<void> {
    // 创建一个最小的 1x1 PNG 图片
    // PNG 文件头 + IHDR + IDAT + IEND
    const pngData = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG 签名
      0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR 块
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 宽度和高度 (1x1)
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, // 位深度和颜色类型
      0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, // IDAT 块
      0x54, 0x08, 0xD7, 0x63, 0xF8, 0xFF, 0xFF, 0x3F,
      0x00, 0x05, 0xFE, 0x02, 0xFE, 0xDC, 0xCC, 0x59,
      0xE7, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, // IEND 块
      0x44, 0xAE, 0x42, 0x60, 0x82
    ])
    
    await fs.writeFile(filePath, pngData)
  }

  describe('addTextWatermark', () => {
    it('should add text watermark to slide', async () => {
      // 打开测试文件
      const document = await pptxParser.open(testPptxPath)
      expect(document.slides.length).toBeGreaterThan(0)
      
      const slide = document.slides[0]
      const originalElementCount = slide.elements.length
      
      // 添加文字水印
      const options: WatermarkOptions = {
        type: 'text',
        content: 'CONFIDENTIAL',
        position: 'center',
        opacity: 0.3,
        fontSize: 48,
        fontColor: '#FF0000'
      }
      
      const result = await watermarkEngine.addTextWatermark(document, slide, options)
      expect(result).toBe(true)
      
      // 保存并重新打开以验证
      const outputPath = path.join(tempDir, 'watermarked.pptx')
      await pptxParser.save(document, outputPath)
      
      // 验证文件已创建
      const stats = await fs.stat(outputPath)
      expect(stats.size).toBeGreaterThan(0)
    })

    it('should add watermark at top-left position', async () => {
      const document = await pptxParser.open(testPptxPath)
      const slide = document.slides[0]
      
      const options: WatermarkOptions = {
        type: 'text',
        content: 'TOP LEFT',
        position: 'top-left',
        opacity: 0.5,
        fontSize: 24,
        fontColor: '#0000FF'
      }
      
      const result = await watermarkEngine.addTextWatermark(document, slide, options)
      expect(result).toBe(true)
      
      const outputPath = path.join(tempDir, 'watermark-top-left.pptx')
      await pptxParser.save(document, outputPath)
      
      const stats = await fs.stat(outputPath)
      expect(stats.size).toBeGreaterThan(0)
    })

    it('should add watermark at top-right position', async () => {
      const document = await pptxParser.open(testPptxPath)
      const slide = document.slides[0]
      
      const options: WatermarkOptions = {
        type: 'text',
        content: 'TOP RIGHT',
        position: 'top-right',
        opacity: 0.5,
        fontSize: 24,
        fontColor: '#00FF00'
      }
      
      const result = await watermarkEngine.addTextWatermark(document, slide, options)
      expect(result).toBe(true)
      
      const outputPath = path.join(tempDir, 'watermark-top-right.pptx')
      await pptxParser.save(document, outputPath)
      
      const stats = await fs.stat(outputPath)
      expect(stats.size).toBeGreaterThan(0)
    })

    it('should add watermark at bottom-left position', async () => {
      const document = await pptxParser.open(testPptxPath)
      const slide = document.slides[0]
      
      const options: WatermarkOptions = {
        type: 'text',
        content: 'BOTTOM LEFT',
        position: 'bottom-left',
        opacity: 0.5,
        fontSize: 24,
        fontColor: '#FFFF00'
      }
      
      const result = await watermarkEngine.addTextWatermark(document, slide, options)
      expect(result).toBe(true)
      
      const outputPath = path.join(tempDir, 'watermark-bottom-left.pptx')
      await pptxParser.save(document, outputPath)
      
      const stats = await fs.stat(outputPath)
      expect(stats.size).toBeGreaterThan(0)
    })

    it('should add watermark at bottom-right position', async () => {
      const document = await pptxParser.open(testPptxPath)
      const slide = document.slides[0]
      
      const options: WatermarkOptions = {
        type: 'text',
        content: 'BOTTOM RIGHT',
        position: 'bottom-right',
        opacity: 0.5,
        fontSize: 24,
        fontColor: '#FF00FF'
      }
      
      const result = await watermarkEngine.addTextWatermark(document, slide, options)
      expect(result).toBe(true)
      
      const outputPath = path.join(tempDir, 'watermark-bottom-right.pptx')
      await pptxParser.save(document, outputPath)
      
      const stats = await fs.stat(outputPath)
      expect(stats.size).toBeGreaterThan(0)
    })

    it('should support different font sizes', async () => {
      const document = await pptxParser.open(testPptxPath)
      const slide = document.slides[0]
      
      const options: WatermarkOptions = {
        type: 'text',
        content: 'Large Text',
        position: 'center',
        opacity: 0.4,
        fontSize: 72,
        fontColor: '#000000'
      }
      
      const result = await watermarkEngine.addTextWatermark(document, slide, options)
      expect(result).toBe(true)
      
      const outputPath = path.join(tempDir, 'watermark-large-font.pptx')
      await pptxParser.save(document, outputPath)
      
      const stats = await fs.stat(outputPath)
      expect(stats.size).toBeGreaterThan(0)
    })

    it('should support different opacity levels', async () => {
      const document = await pptxParser.open(testPptxPath)
      const slide = document.slides[0]
      
      // 高透明度
      const options1: WatermarkOptions = {
        type: 'text',
        content: 'High Opacity',
        position: 'top-left',
        opacity: 0.9,
        fontSize: 24,
        fontColor: '#000000'
      }
      
      const result1 = await watermarkEngine.addTextWatermark(document, slide, options1)
      expect(result1).toBe(true)
      
      // 低透明度
      const options2: WatermarkOptions = {
        type: 'text',
        content: 'Low Opacity',
        position: 'bottom-right',
        opacity: 0.1,
        fontSize: 24,
        fontColor: '#000000'
      }
      
      const result2 = await watermarkEngine.addTextWatermark(document, slide, options2)
      expect(result2).toBe(true)
      
      const outputPath = path.join(tempDir, 'watermark-opacity.pptx')
      await pptxParser.save(document, outputPath)
      
      const stats = await fs.stat(outputPath)
      expect(stats.size).toBeGreaterThan(0)
    })

    it('should support different colors', async () => {
      const document = await pptxParser.open(testPptxPath)
      const slide = document.slides[0]
      
      const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF']
      
      for (let i = 0; i < colors.length; i++) {
        const options: WatermarkOptions = {
          type: 'text',
          content: `Color ${i + 1}`,
          position: 'center',
          opacity: 0.5,
          fontSize: 20,
          fontColor: colors[i]
        }
        
        const result = await watermarkEngine.addTextWatermark(document, slide, options)
        expect(result).toBe(true)
      }
      
      const outputPath = path.join(tempDir, 'watermark-colors.pptx')
      await pptxParser.save(document, outputPath)
      
      const stats = await fs.stat(outputPath)
      expect(stats.size).toBeGreaterThan(0)
    })

    it('should add watermark to multiple slides', async () => {
      const document = await pptxParser.open(testPptxPath)
      
      const options: WatermarkOptions = {
        type: 'text',
        content: 'DRAFT',
        position: 'center',
        opacity: 0.3,
        fontSize: 60,
        fontColor: '#808080'
      }
      
      // 为所有幻灯片添加水印
      for (const slide of document.slides) {
        const result = await watermarkEngine.addTextWatermark(document, slide, options)
        expect(result).toBe(true)
      }
      
      const outputPath = path.join(tempDir, 'watermark-all-slides.pptx')
      await pptxParser.save(document, outputPath)
      
      const stats = await fs.stat(outputPath)
      expect(stats.size).toBeGreaterThan(0)
    })

    it('should handle Chinese text watermark', async () => {
      const document = await pptxParser.open(testPptxPath)
      const slide = document.slides[0]
      
      const options: WatermarkOptions = {
        type: 'text',
        content: '机密文件',
        position: 'center',
        opacity: 0.4,
        fontSize: 48,
        fontColor: '#FF0000'
      }
      
      const result = await watermarkEngine.addTextWatermark(document, slide, options)
      expect(result).toBe(true)
      
      const outputPath = path.join(tempDir, 'watermark-chinese.pptx')
      await pptxParser.save(document, outputPath)
      
      const stats = await fs.stat(outputPath)
      expect(stats.size).toBeGreaterThan(0)
    })

    it('should throw error for invalid watermark type', async () => {
      const document = await pptxParser.open(testPptxPath)
      const slide = document.slides[0]
      
      const options: WatermarkOptions = {
        type: 'image' as any,
        content: 'test',
        position: 'center',
        opacity: 0.5
      }
      
      await expect(
        watermarkEngine.addTextWatermark(document, slide, options)
      ).rejects.toThrow('Invalid watermark type: expected "text"')
    })

    it('should return false for invalid slide', async () => {
      const document = await pptxParser.open(testPptxPath)
      
      // 创建一个不在文档中的幻灯片
      const invalidSlide = {
        index: 999,
        elements: [],
        notes: '',
        background: null
      }
      
      const options: WatermarkOptions = {
        type: 'text',
        content: 'Test',
        position: 'center',
        opacity: 0.5,
        fontSize: 24,
        fontColor: '#000000'
      }
      
      const result = await watermarkEngine.addTextWatermark(document, invalidSlide, options)
      expect(result).toBe(false)
    })

    it('should handle color without # prefix', async () => {
      const document = await pptxParser.open(testPptxPath)
      const slide = document.slides[0]
      
      const options: WatermarkOptions = {
        type: 'text',
        content: 'No Hash',
        position: 'center',
        opacity: 0.5,
        fontSize: 24,
        fontColor: 'FF0000'  // 没有 # 前缀
      }
      
      const result = await watermarkEngine.addTextWatermark(document, slide, options)
      expect(result).toBe(true)
      
      const outputPath = path.join(tempDir, 'watermark-no-hash.pptx')
      await pptxParser.save(document, outputPath)
      
      const stats = await fs.stat(outputPath)
      expect(stats.size).toBeGreaterThan(0)
    })

    it('should use default values when optional parameters are not provided', async () => {
      const document = await pptxParser.open(testPptxPath)
      const slide = document.slides[0]
      
      const options: WatermarkOptions = {
        type: 'text',
        content: 'Default Values',
        position: 'center',
        opacity: 0.5
        // fontSize 和 fontColor 未提供，应使用默认值
      }
      
      const result = await watermarkEngine.addTextWatermark(document, slide, options)
      expect(result).toBe(true)
      
      const outputPath = path.join(tempDir, 'watermark-defaults.pptx')
      await pptxParser.save(document, outputPath)
      
      const stats = await fs.stat(outputPath)
      expect(stats.size).toBeGreaterThan(0)
    })
  })

  describe('addImageWatermark', () => {
    it('should add image watermark to slide', async () => {
      const document = await pptxParser.open(testPptxPath)
      expect(document.slides.length).toBeGreaterThan(0)
      
      const slide = document.slides[0]
      
      // 添加图片水印
      const options: WatermarkOptions = {
        type: 'image',
        content: testImagePath,
        position: 'center',
        opacity: 0.5
      }
      
      const result = await watermarkEngine.addImageWatermark(document, slide, options)
      expect(result).toBe(true)
      
      // 保存并验证
      const outputPath = path.join(tempDir, 'image-watermarked.pptx')
      await pptxParser.save(document, outputPath)
      
      const stats = await fs.stat(outputPath)
      expect(stats.size).toBeGreaterThan(0)
    })

    it('should add image watermark at top-left position', async () => {
      const document = await pptxParser.open(testPptxPath)
      const slide = document.slides[0]
      
      const options: WatermarkOptions = {
        type: 'image',
        content: testImagePath,
        position: 'top-left',
        opacity: 0.6
      }
      
      const result = await watermarkEngine.addImageWatermark(document, slide, options)
      expect(result).toBe(true)
      
      const outputPath = path.join(tempDir, 'image-watermark-top-left.pptx')
      await pptxParser.save(document, outputPath)
      
      const stats = await fs.stat(outputPath)
      expect(stats.size).toBeGreaterThan(0)
    })

    it('should add image watermark at top-right position', async () => {
      const document = await pptxParser.open(testPptxPath)
      const slide = document.slides[0]
      
      const options: WatermarkOptions = {
        type: 'image',
        content: testImagePath,
        position: 'top-right',
        opacity: 0.6
      }
      
      const result = await watermarkEngine.addImageWatermark(document, slide, options)
      expect(result).toBe(true)
      
      const outputPath = path.join(tempDir, 'image-watermark-top-right.pptx')
      await pptxParser.save(document, outputPath)
      
      const stats = await fs.stat(outputPath)
      expect(stats.size).toBeGreaterThan(0)
    })

    it('should add image watermark at bottom-left position', async () => {
      const document = await pptxParser.open(testPptxPath)
      const slide = document.slides[0]
      
      const options: WatermarkOptions = {
        type: 'image',
        content: testImagePath,
        position: 'bottom-left',
        opacity: 0.6
      }
      
      const result = await watermarkEngine.addImageWatermark(document, slide, options)
      expect(result).toBe(true)
      
      const outputPath = path.join(tempDir, 'image-watermark-bottom-left.pptx')
      await pptxParser.save(document, outputPath)
      
      const stats = await fs.stat(outputPath)
      expect(stats.size).toBeGreaterThan(0)
    })

    it('should add image watermark at bottom-right position', async () => {
      const document = await pptxParser.open(testPptxPath)
      const slide = document.slides[0]
      
      const options: WatermarkOptions = {
        type: 'image',
        content: testImagePath,
        position: 'bottom-right',
        opacity: 0.6
      }
      
      const result = await watermarkEngine.addImageWatermark(document, slide, options)
      expect(result).toBe(true)
      
      const outputPath = path.join(tempDir, 'image-watermark-bottom-right.pptx')
      await pptxParser.save(document, outputPath)
      
      const stats = await fs.stat(outputPath)
      expect(stats.size).toBeGreaterThan(0)
    })

    it('should support custom image size', async () => {
      const document = await pptxParser.open(testPptxPath)
      const slide = document.slides[0]
      
      const options: WatermarkOptions = {
        type: 'image',
        content: testImagePath,
        position: 'center',
        opacity: 0.5,
        size: { width: 100, height: 100 }  // 100x100 像素
      }
      
      const result = await watermarkEngine.addImageWatermark(document, slide, options)
      expect(result).toBe(true)
      
      const outputPath = path.join(tempDir, 'image-watermark-custom-size.pptx')
      await pptxParser.save(document, outputPath)
      
      const stats = await fs.stat(outputPath)
      expect(stats.size).toBeGreaterThan(0)
    })

    it('should support different opacity levels', async () => {
      const document = await pptxParser.open(testPptxPath)
      const slide = document.slides[0]
      
      // 高透明度
      const options1: WatermarkOptions = {
        type: 'image',
        content: testImagePath,
        position: 'top-left',
        opacity: 0.9
      }
      
      const result1 = await watermarkEngine.addImageWatermark(document, slide, options1)
      expect(result1).toBe(true)
      
      // 低透明度
      const options2: WatermarkOptions = {
        type: 'image',
        content: testImagePath,
        position: 'bottom-right',
        opacity: 0.1
      }
      
      const result2 = await watermarkEngine.addImageWatermark(document, slide, options2)
      expect(result2).toBe(true)
      
      const outputPath = path.join(tempDir, 'image-watermark-opacity.pptx')
      await pptxParser.save(document, outputPath)
      
      const stats = await fs.stat(outputPath)
      expect(stats.size).toBeGreaterThan(0)
    })

    it('should add image watermark to multiple slides', async () => {
      const document = await pptxParser.open(testPptxPath)
      
      const options: WatermarkOptions = {
        type: 'image',
        content: testImagePath,
        position: 'center',
        opacity: 0.4
      }
      
      // 为所有幻灯片添加水印
      for (const slide of document.slides) {
        const result = await watermarkEngine.addImageWatermark(document, slide, options)
        expect(result).toBe(true)
      }
      
      const outputPath = path.join(tempDir, 'image-watermark-all-slides.pptx')
      await pptxParser.save(document, outputPath)
      
      const stats = await fs.stat(outputPath)
      expect(stats.size).toBeGreaterThan(0)
    })

    it('should throw error for invalid watermark type', async () => {
      const document = await pptxParser.open(testPptxPath)
      const slide = document.slides[0]
      
      const options: WatermarkOptions = {
        type: 'text' as any,
        content: testImagePath,
        position: 'center',
        opacity: 0.5
      }
      
      await expect(
        watermarkEngine.addImageWatermark(document, slide, options)
      ).rejects.toThrow('Invalid watermark type: expected "image"')
    })

    it('should return false for invalid slide', async () => {
      const document = await pptxParser.open(testPptxPath)
      
      // 创建一个不在文档中的幻灯片
      const invalidSlide = {
        index: 999,
        elements: [],
        notes: '',
        background: null
      }
      
      const options: WatermarkOptions = {
        type: 'image',
        content: testImagePath,
        position: 'center',
        opacity: 0.5
      }
      
      const result = await watermarkEngine.addImageWatermark(document, invalidSlide, options)
      expect(result).toBe(false)
    })

    it('should handle non-existent image file', async () => {
      const document = await pptxParser.open(testPptxPath)
      const slide = document.slides[0]
      
      const options: WatermarkOptions = {
        type: 'image',
        content: path.join(tempDir, 'non-existent.png'),
        position: 'center',
        opacity: 0.5
      }
      
      const result = await watermarkEngine.addImageWatermark(document, slide, options)
      expect(result).toBe(false)
    })

    it('should support both text and image watermarks on same slide', async () => {
      const document = await pptxParser.open(testPptxPath)
      const slide = document.slides[0]
      
      // 添加文字水印
      const textOptions: WatermarkOptions = {
        type: 'text',
        content: 'CONFIDENTIAL',
        position: 'top-left',
        opacity: 0.5,
        fontSize: 24,
        fontColor: '#FF0000'
      }
      
      const textResult = await watermarkEngine.addTextWatermark(document, slide, textOptions)
      expect(textResult).toBe(true)
      
      // 添加图片水印
      const imageOptions: WatermarkOptions = {
        type: 'image',
        content: testImagePath,
        position: 'bottom-right',
        opacity: 0.5
      }
      
      const imageResult = await watermarkEngine.addImageWatermark(document, slide, imageOptions)
      expect(imageResult).toBe(true)
      
      const outputPath = path.join(tempDir, 'mixed-watermarks.pptx')
      await pptxParser.save(document, outputPath)
      
      const stats = await fs.stat(outputPath)
      expect(stats.size).toBeGreaterThan(0)
    })
  })

  describe('addWatermarkToImage', () => {
    it('should add text watermark to image element', async () => {
      // 创建一个测试图片元素
      const testImageBuffer = await fs.readFile(testImagePath)
      const imageElement: ImageElement = {
        type: 'image',
        imageData: testImageBuffer,
        format: 'png',
        position: { x: 0, y: 0 },
        size: { width: 100, height: 100 }
      }
      
      // 添加文字水印
      const options: WatermarkOptions = {
        type: 'text',
        content: 'WATERMARK',
        position: 'center',
        opacity: 0.5,
        fontSize: 24,
        fontColor: '#FFFFFF'
      }
      
      const result = await watermarkEngine.addWatermarkToImage(imageElement, options)
      
      // 验证返回的是 Buffer
      expect(Buffer.isBuffer(result)).toBe(true)
      expect(result.length).toBeGreaterThan(0)
      
      // 验证图片可以被 sharp 读取
      const metadata = await sharp(result).metadata()
      expect(metadata.width).toBeDefined()
      expect(metadata.height).toBeDefined()
    })

    it('should add image watermark to image element', async () => {
      // 创建一个测试图片元素
      const testImageBuffer = await fs.readFile(testImagePath)
      const imageElement: ImageElement = {
        type: 'image',
        imageData: testImageBuffer,
        format: 'png',
        position: { x: 0, y: 0 },
        size: { width: 100, height: 100 }
      }
      
      // 添加图片水印
      const options: WatermarkOptions = {
        type: 'image',
        content: testImagePath,
        position: 'bottom-right',
        opacity: 0.6
      }
      
      const result = await watermarkEngine.addWatermarkToImage(imageElement, options)
      
      // 验证返回的是 Buffer
      expect(Buffer.isBuffer(result)).toBe(true)
      expect(result.length).toBeGreaterThan(0)
      
      // 验证图片可以被 sharp 读取
      const metadata = await sharp(result).metadata()
      expect(metadata.width).toBeDefined()
      expect(metadata.height).toBeDefined()
    })

    it('should add watermark at top-left position', async () => {
      const testImageBuffer = await fs.readFile(testImagePath)
      const imageElement: ImageElement = {
        type: 'image',
        imageData: testImageBuffer,
        format: 'png',
        position: { x: 0, y: 0 },
        size: { width: 100, height: 100 }
      }
      
      const options: WatermarkOptions = {
        type: 'text',
        content: 'TOP LEFT',
        position: 'top-left',
        opacity: 0.7,
        fontSize: 20,
        fontColor: '#FF0000'
      }
      
      const result = await watermarkEngine.addWatermarkToImage(imageElement, options)
      expect(Buffer.isBuffer(result)).toBe(true)
      expect(result.length).toBeGreaterThan(0)
    })

    it('should add watermark at top-right position', async () => {
      const testImageBuffer = await fs.readFile(testImagePath)
      const imageElement: ImageElement = {
        type: 'image',
        imageData: testImageBuffer,
        format: 'png',
        position: { x: 0, y: 0 },
        size: { width: 100, height: 100 }
      }
      
      const options: WatermarkOptions = {
        type: 'text',
        content: 'TOP RIGHT',
        position: 'top-right',
        opacity: 0.7,
        fontSize: 20,
        fontColor: '#00FF00'
      }
      
      const result = await watermarkEngine.addWatermarkToImage(imageElement, options)
      expect(Buffer.isBuffer(result)).toBe(true)
      expect(result.length).toBeGreaterThan(0)
    })

    it('should add watermark at bottom-left position', async () => {
      const testImageBuffer = await fs.readFile(testImagePath)
      const imageElement: ImageElement = {
        type: 'image',
        imageData: testImageBuffer,
        format: 'png',
        position: { x: 0, y: 0 },
        size: { width: 100, height: 100 }
      }
      
      const options: WatermarkOptions = {
        type: 'text',
        content: 'BOTTOM LEFT',
        position: 'bottom-left',
        opacity: 0.7,
        fontSize: 20,
        fontColor: '#0000FF'
      }
      
      const result = await watermarkEngine.addWatermarkToImage(imageElement, options)
      expect(Buffer.isBuffer(result)).toBe(true)
      expect(result.length).toBeGreaterThan(0)
    })

    it('should add watermark at bottom-right position', async () => {
      const testImageBuffer = await fs.readFile(testImagePath)
      const imageElement: ImageElement = {
        type: 'image',
        imageData: testImageBuffer,
        format: 'png',
        position: { x: 0, y: 0 },
        size: { width: 100, height: 100 }
      }
      
      const options: WatermarkOptions = {
        type: 'text',
        content: 'BOTTOM RIGHT',
        position: 'bottom-right',
        opacity: 0.7,
        fontSize: 20,
        fontColor: '#FFFF00'
      }
      
      const result = await watermarkEngine.addWatermarkToImage(imageElement, options)
      expect(Buffer.isBuffer(result)).toBe(true)
      expect(result.length).toBeGreaterThan(0)
    })

    it('should add watermark at center position', async () => {
      const testImageBuffer = await fs.readFile(testImagePath)
      const imageElement: ImageElement = {
        type: 'image',
        imageData: testImageBuffer,
        format: 'png',
        position: { x: 0, y: 0 },
        size: { width: 100, height: 100 }
      }
      
      const options: WatermarkOptions = {
        type: 'text',
        content: 'CENTER',
        position: 'center',
        opacity: 0.5,
        fontSize: 30,
        fontColor: '#FF00FF'
      }
      
      const result = await watermarkEngine.addWatermarkToImage(imageElement, options)
      expect(Buffer.isBuffer(result)).toBe(true)
      expect(result.length).toBeGreaterThan(0)
    })

    it('should support different opacity levels', async () => {
      const testImageBuffer = await fs.readFile(testImagePath)
      const imageElement: ImageElement = {
        type: 'image',
        imageData: testImageBuffer,
        format: 'png',
        position: { x: 0, y: 0 },
        size: { width: 100, height: 100 }
      }
      
      // 高透明度
      const options1: WatermarkOptions = {
        type: 'text',
        content: 'High Opacity',
        position: 'top-left',
        opacity: 0.9,
        fontSize: 16,
        fontColor: '#000000'
      }
      
      const result1 = await watermarkEngine.addWatermarkToImage(imageElement, options1)
      expect(Buffer.isBuffer(result1)).toBe(true)
      
      // 低透明度
      const options2: WatermarkOptions = {
        type: 'text',
        content: 'Low Opacity',
        position: 'bottom-right',
        opacity: 0.1,
        fontSize: 16,
        fontColor: '#000000'
      }
      
      const result2 = await watermarkEngine.addWatermarkToImage(imageElement, options2)
      expect(Buffer.isBuffer(result2)).toBe(true)
    })

    it('should support different font sizes', async () => {
      const testImageBuffer = await fs.readFile(testImagePath)
      const imageElement: ImageElement = {
        type: 'image',
        imageData: testImageBuffer,
        format: 'png',
        position: { x: 0, y: 0 },
        size: { width: 100, height: 100 }
      }
      
      const fontSizes = [12, 24, 36, 48]
      
      for (const fontSize of fontSizes) {
        const options: WatermarkOptions = {
          type: 'text',
          content: `Size ${fontSize}`,
          position: 'center',
          opacity: 0.5,
          fontSize,
          fontColor: '#000000'
        }
        
        const result = await watermarkEngine.addWatermarkToImage(imageElement, options)
        expect(Buffer.isBuffer(result)).toBe(true)
        expect(result.length).toBeGreaterThan(0)
      }
    })

    it('should support different colors', async () => {
      const testImageBuffer = await fs.readFile(testImagePath)
      const imageElement: ImageElement = {
        type: 'image',
        imageData: testImageBuffer,
        format: 'png',
        position: { x: 0, y: 0 },
        size: { width: 100, height: 100 }
      }
      
      const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFFFF', '#000000']
      
      for (const color of colors) {
        const options: WatermarkOptions = {
          type: 'text',
          content: 'Color Test',
          position: 'center',
          opacity: 0.5,
          fontSize: 20,
          fontColor: color
        }
        
        const result = await watermarkEngine.addWatermarkToImage(imageElement, options)
        expect(Buffer.isBuffer(result)).toBe(true)
        expect(result.length).toBeGreaterThan(0)
      }
    })

    it('should support custom image watermark size', async () => {
      const testImageBuffer = await fs.readFile(testImagePath)
      const imageElement: ImageElement = {
        type: 'image',
        imageData: testImageBuffer,
        format: 'png',
        position: { x: 0, y: 0 },
        size: { width: 100, height: 100 }
      }
      
      const options: WatermarkOptions = {
        type: 'image',
        content: testImagePath,
        position: 'center',
        opacity: 0.5,
        size: { width: 1, height: 1 }  // 使用 1x1 像素，因为测试图片是 1x1
      }
      
      const result = await watermarkEngine.addWatermarkToImage(imageElement, options)
      expect(Buffer.isBuffer(result)).toBe(true)
      expect(result.length).toBeGreaterThan(0)
    })

    it('should handle Chinese text watermark', async () => {
      const testImageBuffer = await fs.readFile(testImagePath)
      const imageElement: ImageElement = {
        type: 'image',
        imageData: testImageBuffer,
        format: 'png',
        position: { x: 0, y: 0 },
        size: { width: 100, height: 100 }
      }
      
      const options: WatermarkOptions = {
        type: 'text',
        content: '机密',
        position: 'center',
        opacity: 0.6,
        fontSize: 32,
        fontColor: '#FF0000'
      }
      
      const result = await watermarkEngine.addWatermarkToImage(imageElement, options)
      expect(Buffer.isBuffer(result)).toBe(true)
      expect(result.length).toBeGreaterThan(0)
    })

    it('should handle color without # prefix', async () => {
      const testImageBuffer = await fs.readFile(testImagePath)
      const imageElement: ImageElement = {
        type: 'image',
        imageData: testImageBuffer,
        format: 'png',
        position: { x: 0, y: 0 },
        size: { width: 100, height: 100 }
      }
      
      const options: WatermarkOptions = {
        type: 'text',
        content: 'No Hash',
        position: 'center',
        opacity: 0.5,
        fontSize: 24,
        fontColor: 'FF0000'  // 没有 # 前缀
      }
      
      const result = await watermarkEngine.addWatermarkToImage(imageElement, options)
      expect(Buffer.isBuffer(result)).toBe(true)
      expect(result.length).toBeGreaterThan(0)
    })

    it('should use default values when optional parameters are not provided', async () => {
      const testImageBuffer = await fs.readFile(testImagePath)
      const imageElement: ImageElement = {
        type: 'image',
        imageData: testImageBuffer,
        format: 'png',
        position: { x: 0, y: 0 },
        size: { width: 100, height: 100 }
      }
      
      const options: WatermarkOptions = {
        type: 'text',
        content: 'Default Values',
        position: 'center',
        opacity: 0.5
        // fontSize 和 fontColor 未提供，应使用默认值
      }
      
      const result = await watermarkEngine.addWatermarkToImage(imageElement, options)
      expect(Buffer.isBuffer(result)).toBe(true)
      expect(result.length).toBeGreaterThan(0)
    })

    it('should throw error for unsupported watermark type', async () => {
      const testImageBuffer = await fs.readFile(testImagePath)
      const imageElement: ImageElement = {
        type: 'image',
        imageData: testImageBuffer,
        format: 'png',
        position: { x: 0, y: 0 },
        size: { width: 100, height: 100 }
      }
      
      const options: any = {
        type: 'invalid',
        content: 'test',
        position: 'center',
        opacity: 0.5
      }
      
      await expect(
        watermarkEngine.addWatermarkToImage(imageElement, options)
      ).rejects.toThrow('Unsupported watermark type')
    })

    it('should handle non-existent watermark image file', async () => {
      const testImageBuffer = await fs.readFile(testImagePath)
      const imageElement: ImageElement = {
        type: 'image',
        imageData: testImageBuffer,
        format: 'png',
        position: { x: 0, y: 0 },
        size: { width: 100, height: 100 }
      }
      
      const options: WatermarkOptions = {
        type: 'image',
        content: path.join(tempDir, 'non-existent.png'),
        position: 'center',
        opacity: 0.5
      }
      
      await expect(
        watermarkEngine.addWatermarkToImage(imageElement, options)
      ).rejects.toThrow()
    })

    it('should preserve image dimensions', async () => {
      const testImageBuffer = await fs.readFile(testImagePath)
      const originalMetadata = await sharp(testImageBuffer).metadata()
      
      const imageElement: ImageElement = {
        type: 'image',
        imageData: testImageBuffer,
        format: 'png',
        position: { x: 0, y: 0 },
        size: { width: 100, height: 100 }
      }
      
      const options: WatermarkOptions = {
        type: 'text',
        content: 'Test',
        position: 'center',
        opacity: 0.5,
        fontSize: 24,
        fontColor: '#000000'
      }
      
      const result = await watermarkEngine.addWatermarkToImage(imageElement, options)
      const resultMetadata = await sharp(result).metadata()
      
      // 验证尺寸保持不变
      expect(resultMetadata.width).toBe(originalMetadata.width)
      expect(resultMetadata.height).toBe(originalMetadata.height)
    })

    it('should work with larger images', async () => {
      // 创建一个更大的测试图片 (100x100)
      const largeImageBuffer = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 4,
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        }
      })
        .png()
        .toBuffer()
      
      const imageElement: ImageElement = {
        type: 'image',
        imageData: largeImageBuffer,
        format: 'png',
        position: { x: 0, y: 0 },
        size: { width: 100, height: 100 }
      }
      
      const options: WatermarkOptions = {
        type: 'text',
        content: 'Large Image Watermark',
        position: 'center',
        opacity: 0.5,
        fontSize: 48,
        fontColor: '#000000'
      }
      
      const result = await watermarkEngine.addWatermarkToImage(imageElement, options)
      expect(Buffer.isBuffer(result)).toBe(true)
      expect(result.length).toBeGreaterThan(0)
      
      const metadata = await sharp(result).metadata()
      expect(metadata.width).toBe(100)
      expect(metadata.height).toBe(100)
    })

    it('should save watermarked image to file', async () => {
      const testImageBuffer = await fs.readFile(testImagePath)
      const imageElement: ImageElement = {
        type: 'image',
        imageData: testImageBuffer,
        format: 'png',
        position: { x: 0, y: 0 },
        size: { width: 100, height: 100 }
      }
      
      const options: WatermarkOptions = {
        type: 'text',
        content: 'WATERMARKED',
        position: 'center',
        opacity: 0.5,
        fontSize: 24,
        fontColor: '#FF0000'
      }
      
      const result = await watermarkEngine.addWatermarkToImage(imageElement, options)
      
      // 保存到文件
      const outputPath = path.join(tempDir, 'watermarked-image.png')
      await fs.writeFile(outputPath, result)
      testFiles.push(outputPath)
      
      // 验证文件已创建
      const stats = await fs.stat(outputPath)
      expect(stats.size).toBeGreaterThan(0)
      
      // 验证文件可以被读取
      const savedImage = await sharp(outputPath).metadata()
      expect(savedImage.width).toBeDefined()
      expect(savedImage.height).toBeDefined()
    })
  })
})
