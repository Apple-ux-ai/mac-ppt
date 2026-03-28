import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { TemplateEngine } from './template-engine'
import type { DataRecord } from './template-engine'
import * as fs from 'fs'
import * as path from 'path'
import * as XLSX from 'xlsx'
import fc from 'fast-check'
import PptxGenJS from 'pptxgenjs'
import { PptxParser } from './pptx-parser'

/**
 * 属性测试：占位符完全替换
 * 
 * **Validates: Requirements 4.4**
 * 
 * 属性 5: 占位符完全替换
 * 对于任意模板 PPT 和数据记录，生成的 PPT 中不应包含任何未替换的占位符。
 */
describe('Property Test: Complete Placeholder Replacement', () => {
  let templateEngine: TemplateEngine
  let pptxParser: PptxParser
  const testDataDir = './test-data-property-placeholder'
  const outputDir = path.join(testDataDir, 'output')

  beforeAll(async () => {
    templateEngine = new TemplateEngine()
    pptxParser = new PptxParser()
    
    // 创建测试数据目录
    if (!fs.existsSync(testDataDir)) {
      fs.mkdirSync(testDataDir, { recursive: true })
    }
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }
  })

  beforeEach(() => {
    // 清理输出目录
    if (fs.existsSync(outputDir)) {
      const files = fs.readdirSync(outputDir)
      for (const file of files) {
        fs.unlinkSync(path.join(outputDir, file))
      }
    }
  })

  afterAll(() => {
    // 清理测试数据目录
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true })
    }
  })

  /**
   * 生成器：生成有效的占位符名称
   * 支持字母、数字、下划线、中文字符
   */
  const placeholderNameArbitrary = fc.oneof(
    // 英文占位符
    fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_]{0,15}$/),
    // 中文占位符
    fc.constant('姓名'),
    fc.constant('公司'),
    fc.constant('邮箱'),
    fc.constant('地址')
  )

  /**
   * 生成器：生成占位符集合（1-5个不重复的占位符）
   */
  const placeholdersArbitrary = fc.uniqueArray(
    placeholderNameArbitrary,
    { minLength: 1, maxLength: 5 }
  )

  /**
   * 生成器：生成数据值（字符串、数字或布尔值）
   */
  const dataValueArbitrary = fc.oneof(
    fc.string({ maxLength: 50 }),
    fc.integer({ min: -1000, max: 1000 }),
    fc.boolean()
  )

  /**
   * 辅助函数：创建包含指定占位符的模板 PPT
   */
  async function createTemplateWithPlaceholders(placeholders: string[]): Promise<string> {
    const pptx = new PptxGenJS()
    
    // 创建多个幻灯片，每个幻灯片包含一些占位符
    const slidesCount = Math.min(placeholders.length, 3)
    
    for (let i = 0; i < slidesCount; i++) {
      const slide = pptx.addSlide()
      
      // 在每个幻灯片上添加包含占位符的文本
      const placeholdersForSlide = placeholders.slice(
        i * Math.ceil(placeholders.length / slidesCount),
        (i + 1) * Math.ceil(placeholders.length / slidesCount)
      )
      
      const text = placeholdersForSlide.map(p => `{{${p}}}`).join(' ')
      
      slide.addText(text, {
        x: 1,
        y: 1,
        w: 8,
        h: 1,
        fontSize: 18
      })
      
      // 添加一些额外的文本，包含占位符
      if (placeholdersForSlide.length > 0) {
        slide.addText(`Title: {{${placeholdersForSlide[0]}}}`, {
          x: 1,
          y: 2.5,
          w: 8,
          h: 0.5,
          fontSize: 14
        })
      }
    }
    
    const templatePath = path.join(testDataDir, `template-${Date.now()}-${Math.random()}.pptx`)
    await pptx.writeFile({ fileName: templatePath })
    
    return templatePath
  }

  /**
   * 辅助函数：检查生成的 PPT 中是否包含未替换的占位符
   * 返回找到的未替换占位符列表
   */
  async function findUnreplacedPlaceholders(filePath: string): Promise<string[]> {
    const document = await pptxParser.open(filePath)
    const unreplacedPlaceholders: string[] = []
    
    // 正则表达式匹配 {{placeholder}} 语法
    const placeholderRegex = /\{\{([a-zA-Z0-9_\u4e00-\u9fa5]+)\}\}/g
    
    // 遍历所有幻灯片和文本元素
    for (const slide of document.slides) {
      for (const element of slide.elements) {
        if (element.type === 'text') {
          const textElement = element as any
          const content = textElement.content || ''
          
          let match: RegExpExecArray | null
          while ((match = placeholderRegex.exec(content)) !== null) {
            const placeholderName = match[1]
            if (!unreplacedPlaceholders.includes(placeholderName)) {
              unreplacedPlaceholders.push(placeholderName)
            }
          }
        }
      }
    }
    
    return unreplacedPlaceholders
  }

  it('Property: No unreplaced placeholders when all data fields are provided', async () => {
    await fc.assert(
      fc.asyncProperty(
        placeholdersArbitrary,
        async (placeholders) => {
          // 创建包含这些占位符的模板
          const templatePath = await createTemplateWithPlaceholders(placeholders)
          
          try {
            // 加载模板
            const template = await templateEngine.loadTemplate(templatePath)
            
            // 创建数据记录，为每个占位符提供值
            const dataRecord: DataRecord = {}
            for (const placeholder of placeholders) {
              // 使用占位符名称作为值（确保非空）
              dataRecord[placeholder] = `value_for_${placeholder}`
            }
            
            // 生成 PPT
            const outputPath = path.join(outputDir, `output-${Date.now()}-${Math.random()}.pptx`)
            await templateEngine.generate(template, dataRecord, outputPath)
            
            // 验证：生成的 PPT 中不应包含任何未替换的占位符
            const unreplacedPlaceholders = await findUnreplacedPlaceholders(outputPath)
            
            expect(unreplacedPlaceholders).toHaveLength(0)
            
            return true
          } finally {
            // 清理测试文件
            if (fs.existsSync(templatePath)) {
              fs.unlinkSync(templatePath)
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  }, 120000) // 120 second timeout

  it('Property: Placeholders replaced with correct values', async () => {
    await fc.assert(
      fc.asyncProperty(
        placeholdersArbitrary,
        fc.array(dataValueArbitrary, { minLength: 1, maxLength: 5 }),
        async (placeholders, values) => {
          // 创建包含这些占位符的模板
          const templatePath = await createTemplateWithPlaceholders(placeholders)
          
          try {
            // 加载模板
            const template = await templateEngine.loadTemplate(templatePath)
            
            // 创建数据记录，为每个占位符提供值
            const dataRecord: DataRecord = {}
            for (let i = 0; i < placeholders.length; i++) {
              dataRecord[placeholders[i]] = values[i % values.length]
            }
            
            // 生成 PPT
            const outputPath = path.join(outputDir, `output-${Date.now()}-${Math.random()}.pptx`)
            await templateEngine.generate(template, dataRecord, outputPath)
            
            // 验证：生成的 PPT 中不应包含任何未替换的占位符
            const unreplacedPlaceholders = await findUnreplacedPlaceholders(outputPath)
            
            expect(unreplacedPlaceholders).toHaveLength(0)
            
            // 验证：生成的 PPT 中应包含替换后的值
            const document = await pptxParser.open(outputPath)
            let foundValues = 0
            
            for (const slide of document.slides) {
              for (const element of slide.elements) {
                if (element.type === 'text') {
                  const textElement = element as any
                  const content = textElement.content || ''
                  
                  // 检查是否包含替换后的值
                  for (const placeholder of placeholders) {
                    const expectedValue = String(dataRecord[placeholder])
                    if (content.includes(expectedValue)) {
                      foundValues++
                    }
                  }
                }
              }
            }
            
            // 至少应该找到一些替换后的值
            expect(foundValues).toBeGreaterThan(0)
            
            return true
          } finally {
            // 清理测试文件
            if (fs.existsSync(templatePath)) {
              fs.unlinkSync(templatePath)
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  }, 120000)

  it('Property: Missing data fields replaced with empty string', async () => {
    await fc.assert(
      fc.asyncProperty(
        placeholdersArbitrary,
        async (placeholders) => {
          // 确保至少有2个占位符
          if (placeholders.length < 2) {
            placeholders = [...placeholders, 'extra_placeholder']
          }
          
          // 创建包含这些占位符的模板
          const templatePath = await createTemplateWithPlaceholders(placeholders)
          
          try {
            // 加载模板
            const template = await templateEngine.loadTemplate(templatePath)
            
            // 创建数据记录，只为部分占位符提供值
            const dataRecord: DataRecord = {}
            const providedPlaceholders = placeholders.slice(0, Math.floor(placeholders.length / 2))
            
            for (const placeholder of providedPlaceholders) {
              dataRecord[placeholder] = `value_for_${placeholder}`
            }
            
            // 生成 PPT
            const outputPath = path.join(outputDir, `output-${Date.now()}-${Math.random()}.pptx`)
            await templateEngine.generate(template, dataRecord, outputPath)
            
            // 验证：生成的 PPT 中不应包含任何未替换的占位符
            // 即使某些字段缺失，占位符也应该被替换为空字符串
            const unreplacedPlaceholders = await findUnreplacedPlaceholders(outputPath)
            
            expect(unreplacedPlaceholders).toHaveLength(0)
            
            return true
          } finally {
            // 清理测试文件
            if (fs.existsSync(templatePath)) {
              fs.unlinkSync(templatePath)
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  }, 120000)

  it('Property: Multiple occurrences of same placeholder all replaced', async () => {
    await fc.assert(
      fc.asyncProperty(
        placeholderNameArbitrary,
        dataValueArbitrary,
        async (placeholderName, value) => {
          // 创建包含同一占位符多次出现的模板
          const pptx = new PptxGenJS()
          const slide = pptx.addSlide()
          
          // 在同一幻灯片上多次使用同一占位符
          slide.addText(`First: {{${placeholderName}}}`, {
            x: 1,
            y: 1,
            w: 8,
            h: 0.5,
            fontSize: 18
          })
          
          slide.addText(`Second: {{${placeholderName}}}`, {
            x: 1,
            y: 2,
            w: 8,
            h: 0.5,
            fontSize: 18
          })
          
          slide.addText(`Third: {{${placeholderName}}}`, {
            x: 1,
            y: 3,
            w: 8,
            h: 0.5,
            fontSize: 18
          })
          
          const templatePath = path.join(testDataDir, `template-${Date.now()}-${Math.random()}.pptx`)
          await pptx.writeFile({ fileName: templatePath })
          
          try {
            // 加载模板
            const template = await templateEngine.loadTemplate(templatePath)
            
            // 创建数据记录
            const dataRecord: DataRecord = {
              [placeholderName]: value
            }
            
            // 生成 PPT
            const outputPath = path.join(outputDir, `output-${Date.now()}-${Math.random()}.pptx`)
            await templateEngine.generate(template, dataRecord, outputPath)
            
            // 验证：生成的 PPT 中不应包含任何未替换的占位符
            const unreplacedPlaceholders = await findUnreplacedPlaceholders(outputPath)
            
            expect(unreplacedPlaceholders).toHaveLength(0)
            
            // 验证：占位符被替换（不验证具体出现次数，因为空白字符可能被处理）
            // 主要验证占位符本身不再存在
            const document = await pptxParser.open(outputPath)
            let hasPlaceholder = false
            
            for (const slide of document.slides) {
              for (const element of slide.elements) {
                if (element.type === 'text') {
                  const textElement = element as any
                  const content = textElement.content || ''
                  
                  // 检查是否还包含占位符语法
                  if (content.includes(`{{${placeholderName}}}`)) {
                    hasPlaceholder = true
                  }
                }
              }
            }
            
            // 不应该再包含占位符
            expect(hasPlaceholder).toBe(false)
            
            return true
          } finally {
            // 清理测试文件
            if (fs.existsSync(templatePath)) {
              fs.unlinkSync(templatePath)
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  }, 120000)

  it('Property: Placeholders across multiple slides all replaced', async () => {
    await fc.assert(
      fc.asyncProperty(
        placeholdersArbitrary,
        async (placeholders) => {
          // 创建包含多个幻灯片的模板，每个幻灯片包含不同的占位符
          const pptx = new PptxGenJS()
          
          for (const placeholder of placeholders) {
            const slide = pptx.addSlide()
            slide.addText(`Placeholder: {{${placeholder}}}`, {
              x: 1,
              y: 1,
              w: 8,
              h: 1,
              fontSize: 18
            })
          }
          
          const templatePath = path.join(testDataDir, `template-${Date.now()}-${Math.random()}.pptx`)
          await pptx.writeFile({ fileName: templatePath })
          
          try {
            // 加载模板
            const template = await templateEngine.loadTemplate(templatePath)
            
            // 创建数据记录，为每个占位符提供值
            const dataRecord: DataRecord = {}
            for (const placeholder of placeholders) {
              dataRecord[placeholder] = `value_for_${placeholder}`
            }
            
            // 生成 PPT
            const outputPath = path.join(outputDir, `output-${Date.now()}-${Math.random()}.pptx`)
            await templateEngine.generate(template, dataRecord, outputPath)
            
            // 验证：生成的 PPT 中不应包含任何未替换的占位符
            const unreplacedPlaceholders = await findUnreplacedPlaceholders(outputPath)
            
            expect(unreplacedPlaceholders).toHaveLength(0)
            
            return true
          } finally {
            // 清理测试文件
            if (fs.existsSync(templatePath)) {
              fs.unlinkSync(templatePath)
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  }, 120000)

  it('Property: Chinese placeholders completely replaced', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('姓名', '公司', '邮箱', '地址', '电话'),
        fc.string({ maxLength: 20 }),
        async (chinesePlaceholder, value) => {
          // 创建包含中文占位符的模板
          const pptx = new PptxGenJS()
          const slide = pptx.addSlide()
          
          slide.addText(`{{${chinesePlaceholder}}}`, {
            x: 1,
            y: 1,
            w: 8,
            h: 1,
            fontSize: 18
          })
          
          const templatePath = path.join(testDataDir, `template-${Date.now()}-${Math.random()}.pptx`)
          await pptx.writeFile({ fileName: templatePath })
          
          try {
            // 加载模板
            const template = await templateEngine.loadTemplate(templatePath)
            
            // 创建数据记录
            const dataRecord: DataRecord = {
              [chinesePlaceholder]: value
            }
            
            // 生成 PPT
            const outputPath = path.join(outputDir, `output-${Date.now()}-${Math.random()}.pptx`)
            await templateEngine.generate(template, dataRecord, outputPath)
            
            // 验证：生成的 PPT 中不应包含任何未替换的占位符
            const unreplacedPlaceholders = await findUnreplacedPlaceholders(outputPath)
            
            expect(unreplacedPlaceholders).toHaveLength(0)
            
            return true
          } finally {
            // 清理测试文件
            if (fs.existsSync(templatePath)) {
              fs.unlinkSync(templatePath)
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  }, 120000)

  it('Property: Batch generation replaces all placeholders in all files', async () => {
    await fc.assert(
      fc.asyncProperty(
        placeholdersArbitrary,
        fc.integer({ min: 1, max: 5 }),
        async (placeholders, recordCount) => {
          // 创建包含这些占位符的模板
          const templatePath = await createTemplateWithPlaceholders(placeholders)
          
          try {
            // 加载模板
            const template = await templateEngine.loadTemplate(templatePath)
            
            // 创建多条数据记录
            const dataRecords: DataRecord[] = []
            for (let i = 0; i < recordCount; i++) {
              const record: DataRecord = {}
              for (const placeholder of placeholders) {
                record[placeholder] = `value_${i}_${placeholder}`
              }
              dataRecords.push(record)
            }
            
            // 批量生成 PPT
            const generatedFiles = await templateEngine.batchGenerate(template, dataRecords, outputDir)
            
            // 验证：每个生成的文件都不应包含未替换的占位符
            for (const filePath of generatedFiles) {
              const unreplacedPlaceholders = await findUnreplacedPlaceholders(filePath)
              expect(unreplacedPlaceholders).toHaveLength(0)
            }
            
            return true
          } finally {
            // 清理测试文件
            if (fs.existsSync(templatePath)) {
              fs.unlinkSync(templatePath)
            }
          }
        }
      ),
      { numRuns: 50 }
    )
  }, 180000) // 180 second timeout for batch operations
})
