import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { FileValidator, fileValidator } from './file-validator'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import PizZip from 'pizzip'

function createTestPptx(filePath: string, files: Record<string, string> = {}): Promise<void> {
  const zip = new PizZip()
  
  if (!files['[Content_Types].xml']) {
    zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>')
  }
  if (!files['_rels/.rels']) {
    zip.file('_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>')
  }
  
  for (const [name, content] of Object.entries(files)) {
    zip.file(name, content)
  }
  
  const content = zip.generate({ type: 'nodebuffer' })
  return fs.writeFile(filePath, content)
}

describe('FileValidator', () => {
  let validator: FileValidator
  let tempDir: string
  
  beforeEach(async () => {
    validator = fileValidator
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'file-validator-test-'))
  })
  
  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch (error) {
      // 忽略清理错误
    }
  })
  
  describe('文件存在性检查', () => {
    it('应该拒绝不存在的文件', async () => {
      const result = await validator.validateFile('/nonexistent/file.pptx')
      
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0].message).toContain('文件不存在')
    })
  })
  
  describe('文件格式检查', () => {
    it('应该接受 .pptx 扩展名', async () => {
      const testFile = path.join(tempDir, 'test.pptx')
      await createTestPptx(testFile)
      
      const result = await validator.validateFile(testFile)
      
      expect(result.valid).toBe(true)
      expect(result.info.extension).toBe('.pptx')
    })
    
    it('应该接受 .ppt 扩展名', async () => {
      const testFile = path.join(tempDir, 'test.ppt')
      const pptSignature = Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1])
      const content = Buffer.concat([pptSignature, Buffer.alloc(100)])
      await fs.writeFile(testFile, content)
      
      const result = await validator.validateFile(testFile, { checkIntegrity: false })
      
      expect(result.valid).toBe(true)
      expect(result.info.extension).toBe('.ppt')
    })
  })
  
  describe('文件大小检查', () => {
    it('应该拒绝空文件', async () => {
      const testFile = path.join(tempDir, 'empty.pptx')
      await fs.writeFile(testFile, '')
      
      const result = await validator.validateFile(testFile)
      
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.message.includes('文件为空') || e.message.includes('损坏'))).toBe(true)
    })
    
    it('应该拒绝超过大小限制的文件', async () => {
      const testFile = path.join(tempDir, 'large.pptx')
      const content = Buffer.alloc(1024)
      await fs.writeFile(testFile, content)
      
      const result = await validator.validateFile(testFile, { maxSizeMB: 0.0005 })
      
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.code === 1004)).toBe(true)
    })
  })
  
  describe('PPTX 结构验证', () => {
    it('应该验证 PPTX 文件包含必需的文件', async () => {
      const testFile = path.join(tempDir, 'complete.pptx')
      await createTestPptx(testFile, {
        'ppt/presentation.xml': '<?xml version="1.0"?><p:presentation/>'
      })
      
      const result = await validator.validateFile(testFile)
      
      expect(result.valid).toBe(true)
    })
    
    it('应该拒绝缺少 [Content_Types].xml 的 PPTX 文件', async () => {
      const testFile = path.join(tempDir, 'incomplete.pptx')
      const zip = new PizZip()
      zip.file('_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>')
      zip.file('ppt/presentation.xml', '<?xml version="1.0"?><p:presentation/>')
      const content = zip.generate({ type: 'nodebuffer' })
      await fs.writeFile(testFile, content)
      
      const result = await validator.validateFile(testFile)
      
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.message.includes('PPTX') || e.message.includes('结构'))).toBe(true)
    })
    
    it('应该拒绝缺少 ppt/presentation.xml 的 PPTX 文件', async () => {
      const testFile = path.join(tempDir, 'incomplete2.pptx')
      await createTestPptx(testFile)
      
      const result = await validator.validateFile(testFile)
      
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.message.includes('PPTX') || e.message.includes('结构'))).toBe(true)
    })
  })
  
  describe('批量验证', () => {
    it('应该批量验证多个文件', async () => {
      const validFile = path.join(tempDir, 'valid.pptx')
      await createTestPptx(validFile, {
        'ppt/presentation.xml': '<?xml version="1.0"?><p:presentation/>'
      })
      
      const invalidFile = path.join(tempDir, 'invalid.txt')
      await fs.writeFile(invalidFile, 'test')
      
      const nonexistentFile = path.join(tempDir, 'nonexistent.pptx')
      
      const results = await validator.validateFiles([validFile, invalidFile, nonexistentFile])
      
      expect(results.size).toBe(3)
      expect(results.get(validFile)?.valid).toBe(true)
      expect(results.get(invalidFile)?.valid).toBe(false)
      expect(results.get(nonexistentFile)?.valid).toBe(false)
    })
  })
  
  describe('文件锁定检测', () => {
    it('应该检测文件是否被锁定', async () => {
      const testFile = path.join(tempDir, 'test.pptx')
      await createTestPptx(testFile, {
        'ppt/presentation.xml': '<?xml version="1.0"?><p:presentation/>'
      })
      
      const isLocked = await validator.isFileLocked(testFile)
      expect(typeof isLocked).toBe('boolean')
    })
  })
  
  describe('快速验证', () => {
    it('应该快速验证存在的文件', async () => {
      const testFile = path.join(tempDir, 'test.pptx')
      await createTestPptx(testFile, {
        'ppt/presentation.xml': '<?xml version="1.0"?><p:presentation/>'
      })
      
      const isValid = await validator.quickValidate(testFile)
      expect(isValid).toBe(true)
    })
    
    it('应该拒绝不存在的文件', async () => {
      const isValid = await validator.quickValidate('/nonexistent/file.pptx')
      expect(isValid).toBe(false)
    })
  })
  
  describe('边界情况', () => {
    it('应该处理文件路径中的特殊字符', async () => {
      const specialDir = path.join(tempDir, '特殊 文件夹')
      await fs.mkdir(specialDir, { recursive: true })
      
      const testFile = path.join(specialDir, '测试文件.pptx')
      await createTestPptx(testFile, {
        'ppt/presentation.xml': '<?xml version="1.0"?><p:presentation/>'
      })
      
      const result = await validator.validateFile(testFile)
      
      expect(result.valid).toBe(true)
    })
    
    it('应该处理大小写不敏感的扩展名', async () => {
      const testFile = path.join(tempDir, 'test.PPTX')
      await createTestPptx(testFile, {
        'ppt/presentation.xml': '<?xml version="1.0"?><p:presentation/>'
      })
      
      const result = await validator.validateFile(testFile)
      
      expect(result.valid).toBe(true)
      expect(result.info.extension.toLowerCase()).toBe('.pptx')
    })
  })
  
  describe('文件信息提取', () => {
    it('应该提取文件基本信息', async () => {
      const testFile = path.join(tempDir, 'test.pptx')
      await createTestPptx(testFile, {
        'ppt/presentation.xml': '<?xml version="1.0"?><p:presentation/>',
        'ppt/slides/slide1.xml': '<?xml version="1.0"?><p:sld/>'
      })
      
      const result = await validator.validateFile(testFile)
      
      expect(result.valid).toBe(true)
      expect(result.info.name).toBe('test.pptx')
      expect(result.info.size).toBeGreaterThan(0)
      expect(result.info.slideCount).toBe(1)
    })
  })
})
