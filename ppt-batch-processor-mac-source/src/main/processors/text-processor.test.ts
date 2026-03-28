import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { TextProcessor } from './text-processor'
import { PptxParser } from '../services/pptx-parser'
import { promises as fs } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import PizZip from 'pizzip'
import type { FileInfo, TaskOptions } from '../../shared/types'

describe('TextProcessor', () => {
  let processor: TextProcessor
  let parser: PptxParser
  let testDir: string
  let testFiles: string[] = []

  beforeEach(async () => {
    processor = new TextProcessor()
    parser = new PptxParser()
    
    // 创建临时测试目录
    testDir = join(tmpdir(), `text-processor-test-${Date.now()}`)
    await fs.mkdir(testDir, { recursive: true })
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
    
    // 清理测试目录
    try {
      await fs.rmdir(testDir)
    } catch (error) {
      // 忽略删除错误
    }
  })

  /**
   * 创建测试用的 PPTX 文件
   */
  async function createTestPptx(fileName: string, textContent: string): Promise<string> {
    const filePath = join(testDir, fileName)
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
    
    // ppt/slides/slide1.xml with text content
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
          <p:cNvPr id="2" name="TextBox"/>
          <p:cNvSpPr txBox="1"/>
          <p:nvPr/>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm>
            <a:off x="914400" y="914400"/>
            <a:ext cx="7315200" cy="914400"/>
          </a:xfrm>
        </p:spPr>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p>
            <a:r>
              <a:rPr lang="en-US" sz="1800" b="1">
                <a:solidFill>
                  <a:srgbClr val="363636"/>
                </a:solidFill>
                <a:latin typeface="Arial"/>
              </a:rPr>
              <a:t>${textContent}</a:t>
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
  <dc:creator>Test</dc:creator>
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
    
    return filePath
  }

  describe('processFile', () => {
    it('should replace text in a single file', async () => {
      // 创建测试文件
      const filePath = await createTestPptx('test1.pptx', 'Hello World')
      const stats = await fs.stat(filePath)
      
      const fileInfo: FileInfo = {
        name: 'test1.pptx',
        path: filePath,
        size: stats.size,
        format: 'pptx'
      }
      
      const options: TaskOptions = {
        searchText: 'World',
        replaceText: 'Universe',
        overwriteOriginal: false,
        fileNamePattern: '{name}_replaced'
      }
      
      // 执行替换
      const result = await processor.processFile(fileInfo, options)
      
      // 验证结果
      expect(result.status).toBe('success')
      expect(result.inputFile).toBe(filePath)
      expect(result.outputFile).toContain('_replaced')
      expect(result.metadata?.itemsProcessed).toBeGreaterThan(0)
      
      // 验证输出文件存在
      testFiles.push(result.outputFile)
      const outputExists = await fs.access(result.outputFile).then(() => true).catch(() => false)
      expect(outputExists).toBe(true)
      
      // 验证替换后的内容
      const outputDoc = await parser.open(result.outputFile)
      const slides = parser.getSlides(outputDoc)
      expect(slides.length).toBeGreaterThan(0)
      
      const textElements = slides[0].elements.filter(e => e.type === 'text')
      const hasUniverse = textElements.some(e => (e as any).content.includes('Universe'))
      expect(hasUniverse).toBe(true)
    })

    it('should return error when search text is missing', async () => {
      const filePath = await createTestPptx('test2.pptx', 'Test content')
      const stats = await fs.stat(filePath)
      
      const fileInfo: FileInfo = {
        name: 'test2.pptx',
        path: filePath,
        size: stats.size,
        format: 'pptx'
      }
      
      const options: TaskOptions = {
        replaceText: 'New text'
      }
      
      const result = await processor.processFile(fileInfo, options)
      
      expect(result.status).toBe('error')
      expect(result.error).toContain('required')
    })

    it('should handle file not found error', async () => {
      const fileInfo: FileInfo = {
        name: 'nonexistent.pptx',
        path: '/nonexistent/path/file.pptx',
        size: 0,
        format: 'pptx'
      }
      
      const options: TaskOptions = {
        searchText: 'test',
        replaceText: 'new'
      }
      
      const result = await processor.processFile(fileInfo, options)
      
      expect(result.status).toBe('error')
      expect(result.error).toBeDefined()
    })

    it('should overwrite original file when specified', async () => {
      const filePath = await createTestPptx('test3.pptx', 'Original text')
      const stats = await fs.stat(filePath)
      
      const fileInfo: FileInfo = {
        name: 'test3.pptx',
        path: filePath,
        size: stats.size,
        format: 'pptx'
      }
      
      const options: TaskOptions = {
        searchText: 'Original',
        replaceText: 'Modified',
        overwriteOriginal: true
      }
      
      const result = await processor.processFile(fileInfo, options)
      
      expect(result.status).toBe('success')
      expect(result.outputFile).toBe(filePath)
    })

    it('should count multiple occurrences correctly', async () => {
      const filePath = await createTestPptx('test4.pptx', 'test test test')
      const stats = await fs.stat(filePath)
      
      const fileInfo: FileInfo = {
        name: 'test4.pptx',
        path: filePath,
        size: stats.size,
        format: 'pptx'
      }
      
      const options: TaskOptions = {
        searchText: 'test',
        replaceText: 'demo',
        overwriteOriginal: false
      }
      
      const result = await processor.processFile(fileInfo, options)
      
      expect(result.status).toBe('success')
      expect(result.metadata?.itemsProcessed).toBe(3)
    })
  })

  describe('processBatch', () => {
    it('should process multiple files and generate statistics', async () => {
      // 创建多个测试文件
      const file1Path = await createTestPptx('batch1.pptx', 'Hello World')
      const file2Path = await createTestPptx('batch2.pptx', 'Hello Universe')
      const file3Path = await createTestPptx('batch3.pptx', 'Goodbye World')
      
      const files: FileInfo[] = []
      for (const path of [file1Path, file2Path, file3Path]) {
        const stats = await fs.stat(path)
        const fileName = path.replace(/^.*[\\\/]/, '')
        files.push({
          name: fileName,
          path,
          size: stats.size,
          format: 'pptx'
        })
      }
      
      const options: TaskOptions = {
        searchText: 'World',
        replaceText: 'Earth',
        overwriteOriginal: false
      }
      
      const { results, stats } = await processor.processBatch(files, options)
      
      // 验证结果
      expect(results.length).toBe(3)
      expect(stats.filesProcessed).toBe(3)
      expect(stats.filesWithReplacements).toBe(2) // file1 和 file3 包含 "World"
      expect(stats.totalReplacements).toBe(2)
      expect(stats.replacementsPerFile.size).toBe(3)
      
      // 清理输出文件
      for (const result of results) {
        if (result.status === 'success') {
          testFiles.push(result.outputFile)
        }
      }
    })

    it('should handle mixed success and failure', async () => {
      const file1Path = await createTestPptx('mixed1.pptx', 'Test content')
      const stats1 = await fs.stat(file1Path)
      
      const files: FileInfo[] = [
        {
          name: 'mixed1.pptx',
          path: file1Path,
          size: stats1.size,
          format: 'pptx'
        },
        {
          name: 'nonexistent.pptx',
          path: '/invalid/path.pptx',
          size: 0,
          format: 'pptx'
        }
      ]
      
      const options: TaskOptions = {
        searchText: 'Test',
        replaceText: 'Demo',
        overwriteOriginal: false
      }
      
      const { results, stats } = await processor.processBatch(files, options)
      
      expect(results.length).toBe(2)
      expect(results[0].status).toBe('success')
      expect(results[1].status).toBe('error')
      expect(stats.filesProcessed).toBe(1)
      
      if (results[0].status === 'success') {
        testFiles.push(results[0].outputFile)
      }
    })

    it('should track replacements per file correctly', async () => {
      const file1Path = await createTestPptx('track1.pptx', 'apple apple')
      const file2Path = await createTestPptx('track2.pptx', 'apple')
      const file3Path = await createTestPptx('track3.pptx', 'banana')
      
      const files: FileInfo[] = []
      for (const path of [file1Path, file2Path, file3Path]) {
        const stats = await fs.stat(path)
        // Use path module or regex to properly extract filename
        const fileName = path.replace(/^.*[\\\/]/, '')
        files.push({
          name: fileName,
          path,
          size: stats.size,
          format: 'pptx'
        })
      }
      
      const options: TaskOptions = {
        searchText: 'apple',
        replaceText: 'orange',
        overwriteOriginal: false
      }
      
      const { results, stats } = await processor.processBatch(files, options)
      
      expect(stats.replacementsPerFile.get('track1.pptx')).toBe(2)
      expect(stats.replacementsPerFile.get('track2.pptx')).toBe(1)
      expect(stats.replacementsPerFile.get('track3.pptx')).toBe(0)
      expect(stats.filesWithReplacements).toBe(2)
      
      for (const result of results) {
        if (result.status === 'success') {
          testFiles.push(result.outputFile)
        }
      }
    })
  })

  describe('generateStatsReport', () => {
    it('should generate formatted statistics report', () => {
      const stats = {
        totalReplacements: 10,
        replacementsPerFile: new Map([
          ['file1.pptx', 5],
          ['file2.pptx', 3],
          ['file3.pptx', 2]
        ]),
        filesProcessed: 3,
        filesWithReplacements: 3
      }
      
      const report = processor.generateStatsReport(stats)
      
      expect(report).toContain('文本替换统计报告')
      expect(report).toContain('处理文件总数: 3')
      expect(report).toContain('有替换的文件数: 3')
      expect(report).toContain('替换总次数: 10')
      expect(report).toContain('file1.pptx: 5 次')
      expect(report).toContain('file2.pptx: 3 次')
      expect(report).toContain('file3.pptx: 2 次')
    })

    it('should handle empty statistics', () => {
      const stats = {
        totalReplacements: 0,
        replacementsPerFile: new Map(),
        filesProcessed: 0,
        filesWithReplacements: 0
      }
      
      const report = processor.generateStatsReport(stats)
      
      expect(report).toContain('处理文件总数: 0')
      expect(report).toContain('替换总次数: 0')
    })

    it('should sort files alphabetically in report', () => {
      const stats = {
        totalReplacements: 6,
        replacementsPerFile: new Map([
          ['zebra.pptx', 1],
          ['apple.pptx', 2],
          ['banana.pptx', 3]
        ]),
        filesProcessed: 3,
        filesWithReplacements: 3
      }
      
      const report = processor.generateStatsReport(stats)
      const lines = report.split('\n')
      
      // 找到文件列表部分
      const fileLines = lines.filter(line => line.includes('.pptx'))
      
      expect(fileLines[0]).toContain('apple.pptx')
      expect(fileLines[1]).toContain('banana.pptx')
      expect(fileLines[2]).toContain('zebra.pptx')
    })
  })

  describe('edge cases', () => {
    it('should handle empty search text', async () => {
      const filePath = await createTestPptx('empty-search.pptx', 'Test content')
      const stats = await fs.stat(filePath)
      
      const fileInfo: FileInfo = {
        name: 'empty-search.pptx',
        path: filePath,
        size: stats.size,
        format: 'pptx'
      }
      
      const options: TaskOptions = {
        searchText: '',
        replaceText: 'new'
      }
      
      const result = await processor.processFile(fileInfo, options)
      
      expect(result.status).toBe('error')
    })

    it('should handle empty replace text', async () => {
      const filePath = await createTestPptx('empty-replace.pptx', 'Delete this')
      const stats = await fs.stat(filePath)
      
      const fileInfo: FileInfo = {
        name: 'empty-replace.pptx',
        path: filePath,
        size: stats.size,
        format: 'pptx'
      }
      
      const options: TaskOptions = {
        searchText: 'this',
        replaceText: '',
        overwriteOriginal: false
      }
      
      const result = await processor.processFile(fileInfo, options)
      
      expect(result.status).toBe('success')
      expect(result.metadata?.itemsProcessed).toBeGreaterThan(0)
      
      testFiles.push(result.outputFile)
    })

    it('should handle text not found', async () => {
      const filePath = await createTestPptx('not-found.pptx', 'Hello World')
      const stats = await fs.stat(filePath)
      
      const fileInfo: FileInfo = {
        name: 'not-found.pptx',
        path: filePath,
        size: stats.size,
        format: 'pptx'
      }
      
      const options: TaskOptions = {
        searchText: 'NonExistent',
        replaceText: 'New',
        overwriteOriginal: false
      }
      
      const result = await processor.processFile(fileInfo, options)
      
      expect(result.status).toBe('success')
      expect(result.metadata?.itemsProcessed).toBe(0)
      
      testFiles.push(result.outputFile)
    })

    it('should handle special characters in search text', async () => {
      const filePath = await createTestPptx('special-chars.pptx', 'Price: $100')
      const stats = await fs.stat(filePath)
      
      const fileInfo: FileInfo = {
        name: 'special-chars.pptx',
        path: filePath,
        size: stats.size,
        format: 'pptx'
      }
      
      const options: TaskOptions = {
        searchText: '$100',
        replaceText: '$200',
        overwriteOriginal: false
      }
      
      const result = await processor.processFile(fileInfo, options)
      
      expect(result.status).toBe('success')
      expect(result.metadata?.itemsProcessed).toBeGreaterThan(0)
      
      testFiles.push(result.outputFile)
    })
  })
})
