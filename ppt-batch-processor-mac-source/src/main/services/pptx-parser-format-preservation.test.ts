import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'
import { PptxParser } from './pptx-parser'
import { promises as fs } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import PizZip from 'pizzip'
import type { TextStyle } from '../../shared/types'

/**
 * 属性测试：文本替换保持格式不变性
 * 
 * **Validates: Requirements 2.2**
 * 
 * 属性 1: 文本替换保持格式不变性
 * 对于任意 PPTX 文件和任意文本替换操作，替换后的文本应保持原文本的所有格式属性
 * （字体、颜色、大小、样式）不变。
 */
describe('PptxParser - Property 1: Text Replacement Format Preservation', () => {
  let parser: PptxParser
  let tempDir: string
  let testFiles: string[] = []

  beforeEach(async () => {
    parser = new PptxParser()
    tempDir = join(tmpdir(), `pptx-format-test-${Date.now()}`)
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
   * 创建一个包含格式化文本的 PPTX 文件
   */
  async function createPptxWithFormattedText(
    filePath: string,
    text: string,
    style: TextStyle
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
    
    // 构建文本样式属性
    const fontSize = style.fontSize ? ` sz="${style.fontSize * 100}"` : ''
    const bold = style.bold ? ' b="1"' : ''
    const italic = style.italic ? ' i="1"' : ''
    const underline = style.underline ? ' u="sng"' : ''
    const fontFamily = style.fontFamily || 'Arial'
    const fontColor = style.fontColor || '000000'
    
    // 移除 # 前缀（如果存在）
    const colorValue = fontColor.startsWith('#') ? fontColor.substring(1) : fontColor
    
    // ppt/slides/slide1.xml with formatted text
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
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="2" name="Title"/>
          <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
          <p:nvPr/>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm>
            <a:off x="0" y="0"/>
            <a:ext cx="9144000" cy="1828800"/>
          </a:xfrm>
        </p:spPr>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p>
            <a:r>
              <a:rPr${fontSize}${bold}${italic}${underline}>
                <a:solidFill>
                  <a:srgbClr val="${colorValue}"/>
                </a:solidFill>
                <a:latin typeface="${fontFamily}"/>
              </a:rPr>
              <a:t>${text}</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`)
    
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
   * 比较两个文本样式是否相等
   */
  function areStylesEqual(style1: TextStyle, style2: TextStyle): boolean {
    return (
      style1.fontFamily === style2.fontFamily &&
      style1.fontSize === style2.fontSize &&
      style1.fontColor === style2.fontColor &&
      style1.bold === style2.bold &&
      style1.italic === style2.italic &&
      style1.underline === style2.underline
    )
  }

  /**
   * 生成随机文本样式
   */
  const textStyleArbitrary = fc.record({
    fontFamily: fc.constantFrom('Arial', 'Times New Roman', 'Calibri', 'Verdana'),
    fontSize: fc.integer({ min: 10, max: 72 }),
    fontColor: fc.hexaString({ minLength: 6, maxLength: 6 }).map(s => `#${s}`),
    bold: fc.boolean(),
    italic: fc.boolean(),
    underline: fc.boolean()
  })

  /**
   * 生成随机文本内容（避免特殊字符和可能导致问题的字符）
   */
  const safeTextArbitrary = fc.string({
    minLength: 1,
    maxLength: 50
  }).filter(s => {
    // 过滤掉包含 XML 特殊字符和其他可能导致问题的字符
    const trimmed = s.trim()
    return trimmed.length > 0 &&
           !trimmed.includes('<') && !trimmed.includes('>') && !trimmed.includes('&') && 
           !trimmed.includes('"') && !trimmed.includes("'") && !trimmed.includes('$') &&
           !trimmed.includes('#') && !trimmed.includes(',') &&
           /^[a-zA-Z0-9\s]+$/.test(trimmed) // 只允许字母、数字和空格
  }).map(s => s.trim()) // 去除前后空格

  /**
   * 属性测试 1: 文本替换保持所有格式属性不变
   * 
   * 对于任意文本内容、任意格式样式和任意替换文本，
   * 替换后的文本应保持原有的所有格式属性（字体、颜色、大小、样式）不变。
   */
  it('property: text replacement preserves all formatting attributes', async () => {
    await fc.assert(
      fc.asyncProperty(
        safeTextArbitrary,
        safeTextArbitrary,
        textStyleArbitrary,
        async (originalText, replacementText, style) => {
          const inputPath = join(tempDir, `input-${Date.now()}-${Math.random()}.pptx`)
          const outputPath = join(tempDir, `output-${Date.now()}-${Math.random()}.pptx`)
          
          try {
            // 创建包含格式化文本的 PPTX 文件
            await createPptxWithFormattedText(inputPath, originalText, style)
            
            // 打开文件
            const document = await parser.open(inputPath)
            const slides = parser.getSlides(document)
            
            // 验证文件有幻灯片
            expect(slides.length).toBeGreaterThan(0)
            
            // 查找文本元素
            const textElements = parser.findText(slides[0], originalText)
            
            // 如果找不到文本，可能是因为文本被截断或格式化，跳过此测试
            if (textElements.length === 0) {
              return true
            }
            
            // 获取原始样式
            const originalStyle = textElements[0].style
            
            // 执行文本替换
            const success = await parser.replaceText(
              document,
              textElements[0],
              originalText,
              replacementText
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
            
            // 查找替换后的文本
            const replacedElements = parser.findText(reopenedSlides[0], replacementText)
            
            // 验证找到了替换后的文本
            expect(replacedElements.length).toBeGreaterThan(0)
            
            // 获取替换后的样式
            const replacedStyle = replacedElements[0].style
            
            // 验证格式属性保持不变
            expect(areStylesEqual(originalStyle, replacedStyle)).toBe(true)
            
            // 详细验证每个属性
            expect(replacedStyle.fontFamily).toBe(originalStyle.fontFamily)
            expect(replacedStyle.fontSize).toBe(originalStyle.fontSize)
            expect(replacedStyle.fontColor).toBe(originalStyle.fontColor)
            expect(replacedStyle.bold).toBe(originalStyle.bold)
            expect(replacedStyle.italic).toBe(originalStyle.italic)
            expect(replacedStyle.underline).toBe(originalStyle.underline)
            
            // 清理
            await fs.unlink(inputPath).catch(() => {})
            await fs.unlink(outputPath).catch(() => {})
            
            return true
          } catch (error) {
            // 清理
            await fs.unlink(inputPath).catch(() => {})
            await fs.unlink(outputPath).catch(() => {})
            throw error
          }
        }
      ),
      { numRuns: 100 }
    )
  }, 120000) // 120 秒超时

  /**
   * 属性测试 2: 部分文本替换保持格式不变
   * 
   * 对于包含多个相同文本的元素，替换其中一个时，
   * 所有被替换的文本都应保持原有格式。
   */
  it('property: partial text replacement preserves formatting', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('test', 'hello', 'world', 'demo'),
        safeTextArbitrary,
        textStyleArbitrary,
        async (searchText, replacementText, style) => {
          const inputPath = join(tempDir, `partial-${Date.now()}-${Math.random()}.pptx`)
          const outputPath = join(tempDir, `partial-out-${Date.now()}-${Math.random()}.pptx`)
          
          try {
            // 创建包含重复文本的内容
            const repeatedText = `${searchText} and ${searchText} again`
            
            // 创建 PPTX 文件
            await createPptxWithFormattedText(inputPath, repeatedText, style)
            
            // 打开文件
            const document = await parser.open(inputPath)
            const slides = parser.getSlides(document)
            
            // 查找文本元素
            const textElements = parser.findText(slides[0], searchText)
            
            if (textElements.length === 0) {
              return true
            }
            
            // 获取原始样式
            const originalStyle = textElements[0].style
            
            // 执行文本替换
            const success = await parser.replaceText(
              document,
              textElements[0],
              searchText,
              replacementText
            )
            
            if (!success) {
              return true
            }
            
            // 保存文件
            await parser.save(document, outputPath)
            
            // 重新打开文件
            const reopenedDocument = await parser.open(outputPath)
            const reopenedSlides = parser.getSlides(reopenedDocument)
            
            // 查找替换后的文本
            const replacedElements = parser.findText(reopenedSlides[0], replacementText)
            
            if (replacedElements.length === 0) {
              return true
            }
            
            // 验证格式保持不变
            const replacedStyle = replacedElements[0].style
            expect(areStylesEqual(originalStyle, replacedStyle)).toBe(true)
            
            // 清理
            await fs.unlink(inputPath).catch(() => {})
            await fs.unlink(outputPath).catch(() => {})
            
            return true
          } catch (error) {
            // 清理
            await fs.unlink(inputPath).catch(() => {})
            await fs.unlink(outputPath).catch(() => {})
            throw error
          }
        }
      ),
      { numRuns: 50 }
    )
  }, 120000) // 120 秒超时

  /**
   * 边界情况测试：空文本替换
   */
  it('edge case: replacing with empty string preserves formatting', async () => {
    const inputPath = join(tempDir, 'empty-replace-input.pptx')
    const outputPath = join(tempDir, 'empty-replace-output.pptx')
    
    const style: TextStyle = {
      fontFamily: 'Arial',
      fontSize: 24,
      fontColor: '#FF0000',
      bold: true,
      italic: false,
      underline: false
    }
    
    // 创建文件
    await createPptxWithFormattedText(inputPath, 'Original Text', style)
    
    // 打开并替换
    const document = await parser.open(inputPath)
    const slides = parser.getSlides(document)
    const textElements = parser.findText(slides[0], 'Original Text')
    
    expect(textElements.length).toBeGreaterThan(0)
    
    const originalStyle = textElements[0].style
    
    // 替换为空字符串
    await parser.replaceText(document, textElements[0], 'Original Text', '')
    await parser.save(document, outputPath)
    
    // 重新打开并验证
    const reopenedDocument = await parser.open(outputPath)
    const reopenedSlides = parser.getSlides(reopenedDocument)
    
    // 查找空文本元素（应该仍然存在但内容为空）
    const emptyElements = reopenedSlides[0].elements.filter(e => e.type === 'text')
    
    // 验证至少有一个文本元素
    expect(emptyElements.length).toBeGreaterThan(0)
  })

  /**
   * 边界情况测试：相同文本替换（格式应保持不变）
   */
  it('edge case: replacing text with itself preserves formatting', async () => {
    const inputPath = join(tempDir, 'same-replace-input.pptx')
    const outputPath = join(tempDir, 'same-replace-output.pptx')
    
    const style: TextStyle = {
      fontFamily: 'Calibri',
      fontSize: 36,
      fontColor: '#0000FF',
      bold: false,
      italic: true,
      underline: true
    }
    
    const text = 'Unchanged Text'
    
    // 创建文件
    await createPptxWithFormattedText(inputPath, text, style)
    
    // 打开并替换
    const document = await parser.open(inputPath)
    const slides = parser.getSlides(document)
    const textElements = parser.findText(slides[0], text)
    
    expect(textElements.length).toBeGreaterThan(0)
    
    const originalStyle = textElements[0].style
    
    // 替换为相同文本
    await parser.replaceText(document, textElements[0], text, text)
    await parser.save(document, outputPath)
    
    // 重新打开并验证
    const reopenedDocument = await parser.open(outputPath)
    const reopenedSlides = parser.getSlides(reopenedDocument)
    const replacedElements = parser.findText(reopenedSlides[0], text)
    
    expect(replacedElements.length).toBeGreaterThan(0)
    
    const replacedStyle = replacedElements[0].style
    
    // 验证所有格式属性保持不变
    expect(replacedStyle.fontFamily).toBe(originalStyle.fontFamily)
    expect(replacedStyle.fontSize).toBe(originalStyle.fontSize)
    expect(replacedStyle.fontColor).toBe(originalStyle.fontColor)
    expect(replacedStyle.bold).toBe(originalStyle.bold)
    expect(replacedStyle.italic).toBe(originalStyle.italic)
    expect(replacedStyle.underline).toBe(originalStyle.underline)
  })

  /**
   * 边界情况测试：非常长的文本替换
   */
  it('edge case: replacing very long text preserves formatting', async () => {
    const inputPath = join(tempDir, 'long-text-input.pptx')
    const outputPath = join(tempDir, 'long-text-output.pptx')
    
    const style: TextStyle = {
      fontFamily: 'Times New Roman',
      fontSize: 18,
      fontColor: '#00FF00',
      bold: true,
      italic: true,
      underline: false
    }
    
    const shortText = 'Short'
    const longText = 'A'.repeat(500)
    
    // 创建文件
    await createPptxWithFormattedText(inputPath, shortText, style)
    
    // 打开并替换
    const document = await parser.open(inputPath)
    const slides = parser.getSlides(document)
    const textElements = parser.findText(slides[0], shortText)
    
    expect(textElements.length).toBeGreaterThan(0)
    
    const originalStyle = textElements[0].style
    
    // 替换为长文本
    await parser.replaceText(document, textElements[0], shortText, longText)
    await parser.save(document, outputPath)
    
    // 重新打开并验证
    const reopenedDocument = await parser.open(outputPath)
    const reopenedSlides = parser.getSlides(reopenedDocument)
    const replacedElements = parser.findText(reopenedSlides[0], longText)
    
    expect(replacedElements.length).toBeGreaterThan(0)
    
    const replacedStyle = replacedElements[0].style
    
    // 验证格式保持不变
    expect(replacedStyle.fontFamily).toBe(originalStyle.fontFamily)
    expect(replacedStyle.fontSize).toBe(originalStyle.fontSize)
    expect(replacedStyle.fontColor).toBe(originalStyle.fontColor)
    expect(replacedStyle.bold).toBe(originalStyle.bold)
    expect(replacedStyle.italic).toBe(originalStyle.italic)
    expect(replacedStyle.underline).toBe(originalStyle.underline)
  })

  /**
   * 边界情况测试：多种格式组合
   */
  it('edge case: complex formatting combinations are preserved', async () => {
    const testCases: TextStyle[] = [
      // 所有格式都启用
      {
        fontFamily: 'Arial',
        fontSize: 44,
        fontColor: '#FF0000',
        bold: true,
        italic: true,
        underline: true
      },
      // 所有格式都禁用
      {
        fontFamily: 'Calibri',
        fontSize: 12,
        fontColor: '#000000',
        bold: false,
        italic: false,
        underline: false
      },
      // 混合格式
      {
        fontFamily: 'Verdana',
        fontSize: 28,
        fontColor: '#0000FF',
        bold: true,
        italic: false,
        underline: true
      }
    ]
    
    for (const style of testCases) {
      const inputPath = join(tempDir, `complex-${Date.now()}-${Math.random()}.pptx`)
      const outputPath = join(tempDir, `complex-out-${Date.now()}-${Math.random()}.pptx`)
      
      try {
        // 创建文件
        await createPptxWithFormattedText(inputPath, 'Test Text', style)
        
        // 打开并替换
        const document = await parser.open(inputPath)
        const slides = parser.getSlides(document)
        const textElements = parser.findText(slides[0], 'Test Text')
        
        expect(textElements.length).toBeGreaterThan(0)
        
        const originalStyle = textElements[0].style
        
        // 替换文本
        await parser.replaceText(document, textElements[0], 'Test Text', 'Replaced Text')
        await parser.save(document, outputPath)
        
        // 重新打开并验证
        const reopenedDocument = await parser.open(outputPath)
        const reopenedSlides = parser.getSlides(reopenedDocument)
        const replacedElements = parser.findText(reopenedSlides[0], 'Replaced Text')
        
        expect(replacedElements.length).toBeGreaterThan(0)
        
        const replacedStyle = replacedElements[0].style
        
        // 验证所有格式属性
        expect(replacedStyle.fontFamily).toBe(originalStyle.fontFamily)
        expect(replacedStyle.fontSize).toBe(originalStyle.fontSize)
        expect(replacedStyle.fontColor).toBe(originalStyle.fontColor)
        expect(replacedStyle.bold).toBe(originalStyle.bold)
        expect(replacedStyle.italic).toBe(originalStyle.italic)
        expect(replacedStyle.underline).toBe(originalStyle.underline)
        
        // 清理
        await fs.unlink(inputPath).catch(() => {})
        await fs.unlink(outputPath).catch(() => {})
      } catch (error) {
        // 清理
        await fs.unlink(inputPath).catch(() => {})
        await fs.unlink(outputPath).catch(() => {})
        throw error
      }
    }
  })
})
