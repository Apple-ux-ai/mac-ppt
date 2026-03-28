import { describe, it, expect, beforeEach, vi } from 'vitest'
import { TemplateEngine } from './template-engine'
import { PptxParser } from './pptx-parser'
import type { PptxDocument, Slide, TextElement } from '../../shared/types'

// Mock PptxParser
vi.mock('./pptx-parser')

describe('TemplateEngine', () => {
  let templateEngine: TemplateEngine
  let mockParser: any

  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks()
    
    templateEngine = new TemplateEngine()
    mockParser = vi.mocked(PptxParser).prototype
  })

  describe('loadTemplate', () => {
    it('should load template and identify placeholders', async () => {
      // 创建模拟的 PPTX 文档
      const mockDocument: PptxDocument = {
        filePath: '/path/to/template.pptx',
        slides: [
          {
            index: 0,
            elements: [
              {
                type: 'text',
                content: 'Hello {{name}}, welcome to {{company}}!',
                style: {},
                position: { x: 0, y: 0 },
                size: { width: 100, height: 50 }
              } as TextElement,
              {
                type: 'text',
                content: 'Your email is {{email}}',
                style: {},
                position: { x: 0, y: 100 },
                size: { width: 100, height: 50 }
              } as TextElement
            ],
            notes: '',
            background: null
          } as Slide
        ],
        metadata: {},
        zipArchive: null
      }

      mockParser.open.mockResolvedValue(mockDocument)

      const template = await templateEngine.loadTemplate('/path/to/template.pptx')

      expect(template.document).toBe(mockDocument)
      expect(template.placeholders).toHaveLength(3)
      
      // 验证占位符名称
      const placeholderNames = template.placeholders.map(p => p.name)
      expect(placeholderNames).toContain('name')
      expect(placeholderNames).toContain('company')
      expect(placeholderNames).toContain('email')
      
      // 验证占位符类型
      expect(template.placeholders.every(p => p.type === 'text')).toBe(true)
      
      // 验证占位符位置
      const namePlaceholder = template.placeholders.find(p => p.name === 'name')
      expect(namePlaceholder?.location.slideIndex).toBe(0)
      expect(namePlaceholder?.location.elementIndex).toBe(0)
    })

    it('should handle multiple occurrences of same placeholder', async () => {
      // 同一个占位符出现多次，应该只记录一次
      const mockDocument: PptxDocument = {
        filePath: '/path/to/template.pptx',
        slides: [
          {
            index: 0,
            elements: [
              {
                type: 'text',
                content: '{{name}} is a member of {{company}}',
                style: {},
                position: { x: 0, y: 0 },
                size: { width: 100, height: 50 }
              } as TextElement,
              {
                type: 'text',
                content: 'Contact {{name}} at {{email}}',
                style: {},
                position: { x: 0, y: 100 },
                size: { width: 100, height: 50 }
              } as TextElement
            ],
            notes: '',
            background: null
          } as Slide
        ],
        metadata: {},
        zipArchive: null
      }

      mockParser.open.mockResolvedValue(mockDocument)

      const template = await templateEngine.loadTemplate('/path/to/template.pptx')

      // name 出现了两次，但应该只记录一次
      expect(template.placeholders).toHaveLength(3)
      const placeholderNames = template.placeholders.map(p => p.name)
      expect(placeholderNames).toContain('name')
      expect(placeholderNames).toContain('company')
      expect(placeholderNames).toContain('email')
      
      // 验证 name 只出现一次
      const nameCount = placeholderNames.filter(n => n === 'name').length
      expect(nameCount).toBe(1)
    })

    it('should handle placeholders across multiple slides', async () => {
      const mockDocument: PptxDocument = {
        filePath: '/path/to/template.pptx',
        slides: [
          {
            index: 0,
            elements: [
              {
                type: 'text',
                content: 'Slide 1: {{title}}',
                style: {},
                position: { x: 0, y: 0 },
                size: { width: 100, height: 50 }
              } as TextElement
            ],
            notes: '',
            background: null
          } as Slide,
          {
            index: 1,
            elements: [
              {
                type: 'text',
                content: 'Slide 2: {{content}}',
                style: {},
                position: { x: 0, y: 0 },
                size: { width: 100, height: 50 }
              } as TextElement
            ],
            notes: '',
            background: null
          } as Slide
        ],
        metadata: {},
        zipArchive: null
      }

      mockParser.open.mockResolvedValue(mockDocument)

      const template = await templateEngine.loadTemplate('/path/to/template.pptx')

      expect(template.placeholders).toHaveLength(2)
      
      const titlePlaceholder = template.placeholders.find(p => p.name === 'title')
      expect(titlePlaceholder?.location.slideIndex).toBe(0)
      
      const contentPlaceholder = template.placeholders.find(p => p.name === 'content')
      expect(contentPlaceholder?.location.slideIndex).toBe(1)
    })

    it('should handle Chinese placeholders', async () => {
      const mockDocument: PptxDocument = {
        filePath: '/path/to/template.pptx',
        slides: [
          {
            index: 0,
            elements: [
              {
                type: 'text',
                content: '姓名：{{姓名}}，公司：{{公司}}',
                style: {},
                position: { x: 0, y: 0 },
                size: { width: 100, height: 50 }
              } as TextElement
            ],
            notes: '',
            background: null
          } as Slide
        ],
        metadata: {},
        zipArchive: null
      }

      mockParser.open.mockResolvedValue(mockDocument)

      const template = await templateEngine.loadTemplate('/path/to/template.pptx')

      expect(template.placeholders).toHaveLength(2)
      const placeholderNames = template.placeholders.map(p => p.name)
      expect(placeholderNames).toContain('姓名')
      expect(placeholderNames).toContain('公司')
    })

    it('should handle placeholders with numbers and underscores', async () => {
      const mockDocument: PptxDocument = {
        filePath: '/path/to/template.pptx',
        slides: [
          {
            index: 0,
            elements: [
              {
                type: 'text',
                content: '{{user_name}} {{user_id_123}} {{field2}}',
                style: {},
                position: { x: 0, y: 0 },
                size: { width: 100, height: 50 }
              } as TextElement
            ],
            notes: '',
            background: null
          } as Slide
        ],
        metadata: {},
        zipArchive: null
      }

      mockParser.open.mockResolvedValue(mockDocument)

      const template = await templateEngine.loadTemplate('/path/to/template.pptx')

      expect(template.placeholders).toHaveLength(3)
      const placeholderNames = template.placeholders.map(p => p.name)
      expect(placeholderNames).toContain('user_name')
      expect(placeholderNames).toContain('user_id_123')
      expect(placeholderNames).toContain('field2')
    })

    it('should ignore non-text elements', async () => {
      const mockDocument: PptxDocument = {
        filePath: '/path/to/template.pptx',
        slides: [
          {
            index: 0,
            elements: [
              {
                type: 'text',
                content: '{{name}}',
                style: {},
                position: { x: 0, y: 0 },
                size: { width: 100, height: 50 }
              } as TextElement,
              {
                type: 'image',
                imageData: Buffer.from([]),
                format: 'png',
                position: { x: 0, y: 100 },
                size: { width: 100, height: 100 }
              }
            ],
            notes: '',
            background: null
          } as Slide
        ],
        metadata: {},
        zipArchive: null
      }

      mockParser.open.mockResolvedValue(mockDocument)

      const template = await templateEngine.loadTemplate('/path/to/template.pptx')

      // 应该只识别文本元素中的占位符
      expect(template.placeholders).toHaveLength(1)
      expect(template.placeholders[0].name).toBe('name')
    })

    it('should handle template with no placeholders', async () => {
      const mockDocument: PptxDocument = {
        filePath: '/path/to/template.pptx',
        slides: [
          {
            index: 0,
            elements: [
              {
                type: 'text',
                content: 'This is a regular text without placeholders',
                style: {},
                position: { x: 0, y: 0 },
                size: { width: 100, height: 50 }
              } as TextElement
            ],
            notes: '',
            background: null
          } as Slide
        ],
        metadata: {},
        zipArchive: null
      }

      mockParser.open.mockResolvedValue(mockDocument)

      const template = await templateEngine.loadTemplate('/path/to/template.pptx')

      expect(template.placeholders).toHaveLength(0)
    })

    it('should handle empty slides', async () => {
      const mockDocument: PptxDocument = {
        filePath: '/path/to/template.pptx',
        slides: [
          {
            index: 0,
            elements: [],
            notes: '',
            background: null
          } as Slide
        ],
        metadata: {},
        zipArchive: null
      }

      mockParser.open.mockResolvedValue(mockDocument)

      const template = await templateEngine.loadTemplate('/path/to/template.pptx')

      expect(template.placeholders).toHaveLength(0)
    })

    it('should throw error if template file cannot be opened', async () => {
      mockParser.open.mockRejectedValue(new Error('File not found'))

      await expect(
        templateEngine.loadTemplate('/path/to/nonexistent.pptx')
      ).rejects.toThrow('Failed to load template: File not found')
    })

    it('should handle malformed placeholders gracefully', async () => {
      // 不完整的占位符语法应该被忽略
      const mockDocument: PptxDocument = {
        filePath: '/path/to/template.pptx',
        slides: [
          {
            index: 0,
            elements: [
              {
                type: 'text',
                content: '{{name}} {incomplete} {{valid}} {{}}',
                style: {},
                position: { x: 0, y: 0 },
                size: { width: 100, height: 50 }
              } as TextElement
            ],
            notes: '',
            background: null
          } as Slide
        ],
        metadata: {},
        zipArchive: null
      }

      mockParser.open.mockResolvedValue(mockDocument)

      const template = await templateEngine.loadTemplate('/path/to/template.pptx')

      // 只应该识别 {{name}} 和 {{valid}}
      expect(template.placeholders).toHaveLength(2)
      const placeholderNames = template.placeholders.map(p => p.name)
      expect(placeholderNames).toContain('name')
      expect(placeholderNames).toContain('valid')
    })
  })

  describe('parseDataSource', () => {
    it('should throw error for non-existent file', async () => {
      await expect(
        templateEngine.parseDataSource('/path/to/nonexistent.xlsx')
      ).rejects.toThrow('Failed to parse data source: Data source file not found')
    })

    it('should throw error for unsupported file format', async () => {
      // 创建一个临时的不支持的文件
      const tempFile = './test-data/unsupported.txt'
      const fs = await import('fs')
      const path = await import('path')
      
      // 确保测试数据目录存在
      const testDataDir = './test-data'
      if (!fs.existsSync(testDataDir)) {
        fs.mkdirSync(testDataDir, { recursive: true })
      }
      
      fs.writeFileSync(tempFile, 'test data')
      
      try {
        await expect(
          templateEngine.parseDataSource(tempFile)
        ).rejects.toThrow('Unsupported data source format: .txt')
      } finally {
        // 清理测试文件
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile)
        }
      }
    })
  })

  describe('generate', () => {
    it('should generate PPT by replacing placeholders with data', async () => {
      // 创建模拟的模板
      const mockTemplate: Template = {
        document: {
          filePath: '/path/to/template.pptx',
          slides: [
            {
              index: 0,
              elements: [
                {
                  type: 'text',
                  content: 'Hello {{name}}, welcome to {{company}}!',
                  style: {},
                  position: { x: 0, y: 0 },
                  size: { width: 100, height: 50 }
                } as TextElement
              ],
              notes: '',
              background: null
            } as Slide
          ],
          metadata: {},
          zipArchive: null
        },
        placeholders: [
          { name: 'name', type: 'text', location: { slideIndex: 0, elementIndex: 0 } },
          { name: 'company', type: 'text', location: { slideIndex: 0, elementIndex: 0 } }
        ]
      }

      const mockData: DataRecord = {
        name: 'John',
        company: 'Acme Corp'
      }

      // Mock parser methods
      const mockDocument: PptxDocument = {
        filePath: '/path/to/template.pptx',
        slides: [
          {
            index: 0,
            elements: [
              {
                type: 'text',
                content: 'Hello {{name}}, welcome to {{company}}!',
                style: {},
                position: { x: 0, y: 0 },
                size: { width: 100, height: 50 }
              } as TextElement
            ],
            notes: '',
            background: null
          } as Slide
        ],
        metadata: {},
        zipArchive: null
      }

      mockParser.open.mockResolvedValue(mockDocument)
      mockParser.replaceText.mockResolvedValue(true)
      mockParser.save.mockResolvedValue(undefined)

      await templateEngine.generate(mockTemplate, mockData, '/path/to/output.pptx')

      // 验证 parser.open 被调用
      expect(mockParser.open).toHaveBeenCalledWith('/path/to/template.pptx')

      // 验证 replaceText 被调用两次（name 和 company）
      expect(mockParser.replaceText).toHaveBeenCalledTimes(2)
      expect(mockParser.replaceText).toHaveBeenCalledWith(
        mockDocument,
        expect.any(Object),
        '{{name}}',
        'John'
      )
      expect(mockParser.replaceText).toHaveBeenCalledWith(
        mockDocument,
        expect.any(Object),
        '{{company}}',
        'Acme Corp'
      )

      // 验证 save 被调用
      expect(mockParser.save).toHaveBeenCalledWith(mockDocument, '/path/to/output.pptx')
    })

    it('should handle missing data fields by replacing with empty string', async () => {
      const mockTemplate: Template = {
        document: {
          filePath: '/path/to/template.pptx',
          slides: [
            {
              index: 0,
              elements: [
                {
                  type: 'text',
                  content: 'Name: {{name}}, Email: {{email}}',
                  style: {},
                  position: { x: 0, y: 0 },
                  size: { width: 100, height: 50 }
                } as TextElement
              ],
              notes: '',
              background: null
            } as Slide
          ],
          metadata: {},
          zipArchive: null
        },
        placeholders: []
      }

      const mockData: DataRecord = {
        name: 'John'
        // email is missing
      }

      const mockDocument: PptxDocument = {
        filePath: '/path/to/template.pptx',
        slides: [
          {
            index: 0,
            elements: [
              {
                type: 'text',
                content: 'Name: {{name}}, Email: {{email}}',
                style: {},
                position: { x: 0, y: 0 },
                size: { width: 100, height: 50 }
              } as TextElement
            ],
            notes: '',
            background: null
          } as Slide
        ],
        metadata: {},
        zipArchive: null
      }

      mockParser.open.mockResolvedValue(mockDocument)
      mockParser.replaceText.mockResolvedValue(true)
      mockParser.save.mockResolvedValue(undefined)

      await templateEngine.generate(mockTemplate, mockData, '/path/to/output.pptx')

      // 验证 email 被替换为空字符串
      expect(mockParser.replaceText).toHaveBeenCalledWith(
        mockDocument,
        expect.any(Object),
        '{{email}}',
        ''
      )
    })

    it('should convert non-string data values to strings', async () => {
      const mockTemplate: Template = {
        document: {
          filePath: '/path/to/template.pptx',
          slides: [
            {
              index: 0,
              elements: [
                {
                  type: 'text',
                  content: 'Age: {{age}}, Active: {{active}}',
                  style: {},
                  position: { x: 0, y: 0 },
                  size: { width: 100, height: 50 }
                } as TextElement
              ],
              notes: '',
              background: null
            } as Slide
          ],
          metadata: {},
          zipArchive: null
        },
        placeholders: []
      }

      const mockData: DataRecord = {
        age: 25,
        active: true
      }

      const mockDocument: PptxDocument = {
        filePath: '/path/to/template.pptx',
        slides: [
          {
            index: 0,
            elements: [
              {
                type: 'text',
                content: 'Age: {{age}}, Active: {{active}}',
                style: {},
                position: { x: 0, y: 0 },
                size: { width: 100, height: 50 }
              } as TextElement
            ],
            notes: '',
            background: null
          } as Slide
        ],
        metadata: {},
        zipArchive: null
      }

      mockParser.open.mockResolvedValue(mockDocument)
      mockParser.replaceText.mockResolvedValue(true)
      mockParser.save.mockResolvedValue(undefined)

      await templateEngine.generate(mockTemplate, mockData, '/path/to/output.pptx')

      // 验证数字和布尔值被转换为字符串
      expect(mockParser.replaceText).toHaveBeenCalledWith(
        mockDocument,
        expect.any(Object),
        '{{age}}',
        '25'
      )
      expect(mockParser.replaceText).toHaveBeenCalledWith(
        mockDocument,
        expect.any(Object),
        '{{active}}',
        'true'
      )
    })

    it('should throw error if template file cannot be opened', async () => {
      const mockTemplate: Template = {
        document: {
          filePath: '/path/to/template.pptx',
          slides: [],
          metadata: {},
          zipArchive: null
        },
        placeholders: []
      }

      mockParser.open.mockRejectedValue(new Error('File not found'))

      await expect(
        templateEngine.generate(mockTemplate, {}, '/path/to/output.pptx')
      ).rejects.toThrow('Failed to generate PPT: File not found')
    })
  })

  describe('batchGenerate', () => {
    it('should generate multiple PPT files from data list', async () => {
      const mockTemplate: Template = {
        document: {
          filePath: '/path/to/template.pptx',
          slides: [
            {
              index: 0,
              elements: [
                {
                  type: 'text',
                  content: 'Name: {{name}}',
                  style: {},
                  position: { x: 0, y: 0 },
                  size: { width: 100, height: 50 }
                } as TextElement
              ],
              notes: '',
              background: null
            } as Slide
          ],
          metadata: {},
          zipArchive: null
        },
        placeholders: [
          { name: 'name', type: 'text', location: { slideIndex: 0, elementIndex: 0 } }
        ]
      }

      const mockDataList: DataRecord[] = [
        { name: 'John' },
        { name: 'Jane' },
        { name: 'Bob' }
      ]

      // 创建临时输出目录
      const fs = await import('fs')
      const path = await import('path')
      const tempDir = './test-data/batch-output'
      
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true })
      }

      try {
        const mockDocument: PptxDocument = {
          filePath: '/path/to/template.pptx',
          slides: [
            {
              index: 0,
              elements: [
                {
                  type: 'text',
                  content: 'Name: {{name}}',
                  style: {},
                  position: { x: 0, y: 0 },
                  size: { width: 100, height: 50 }
                } as TextElement
              ],
              notes: '',
              background: null
            } as Slide
          ],
          metadata: {},
          zipArchive: null
        }

        mockParser.open.mockResolvedValue(mockDocument)
        mockParser.replaceText.mockResolvedValue(true)
        mockParser.save.mockResolvedValue(undefined)

        const result = await templateEngine.batchGenerate(mockTemplate, mockDataList, tempDir)

        // 验证返回的文件路径数组
        expect(result).toHaveLength(3)
        expect(result[0]).toContain('output_001.pptx')
        expect(result[1]).toContain('output_002.pptx')
        expect(result[2]).toContain('output_003.pptx')

        // 验证 generate 被调用了 3 次
        expect(mockParser.open).toHaveBeenCalledTimes(3)
        expect(mockParser.save).toHaveBeenCalledTimes(3)
      } finally {
        // 清理测试目录
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true })
        }
      }
    })

    it('should throw error if output directory does not exist', async () => {
      const mockTemplate: Template = {
        document: {
          filePath: '/path/to/template.pptx',
          slides: [],
          metadata: {},
          zipArchive: null
        },
        placeholders: []
      }

      const mockDataList: DataRecord[] = [{ name: 'John' }]

      await expect(
        templateEngine.batchGenerate(mockTemplate, mockDataList, '/nonexistent/directory')
      ).rejects.toThrow('Output directory does not exist')
    })

    it('should generate files with sequential numbering', async () => {
      const mockTemplate: Template = {
        document: {
          filePath: '/path/to/template.pptx',
          slides: [],
          metadata: {},
          zipArchive: null
        },
        placeholders: []
      }

      const mockDataList: DataRecord[] = Array.from({ length: 15 }, (_, i) => ({ id: i + 1 }))

      // 创建临时输出目录
      const fs = await import('fs')
      const tempDir = './test-data/batch-output-numbering'
      
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true })
      }

      try {
        const mockDocument: PptxDocument = {
          filePath: '/path/to/template.pptx',
          slides: [],
          metadata: {},
          zipArchive: null
        }

        mockParser.open.mockResolvedValue(mockDocument)
        mockParser.replaceText.mockResolvedValue(true)
        mockParser.save.mockResolvedValue(undefined)

        const result = await templateEngine.batchGenerate(mockTemplate, mockDataList, tempDir)

        // 验证文件名格式
        expect(result[0]).toContain('output_001.pptx')
        expect(result[9]).toContain('output_010.pptx')
        expect(result[14]).toContain('output_015.pptx')
      } finally {
        // 清理测试目录
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true })
        }
      }
    })

    it('should handle empty data list', async () => {
      const mockTemplate: Template = {
        document: {
          filePath: '/path/to/template.pptx',
          slides: [],
          metadata: {},
          zipArchive: null
        },
        placeholders: []
      }

      const mockDataList: DataRecord[] = []

      // 创建临时输出目录
      const fs = await import('fs')
      const tempDir = './test-data/batch-output-empty'
      
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true })
      }

      try {
        const result = await templateEngine.batchGenerate(mockTemplate, mockDataList, tempDir)

        // 验证返回空数组
        expect(result).toHaveLength(0)
        
        // 验证 generate 没有被调用
        expect(mockParser.open).not.toHaveBeenCalled()
      } finally {
        // 清理测试目录
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true })
        }
      }
    })
  })
})
