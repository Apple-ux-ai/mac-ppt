import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { TemplateEngine } from './template-engine'
import type { DataRecord } from './template-engine'
import * as fs from 'fs'
import * as path from 'path'
import * as XLSX from 'xlsx'
import fc from 'fast-check'
import PptxGenJS from 'pptxgenjs'

/**
 * 属性测试：模板生成数量一致性
 * 
 * **Validates: Requirements 4.3**
 * 
 * 属性 4: 模板生成数量一致性
 * 对于任意模板和数据源，生成的 PPT 文件数量应等于数据源中的记录数量。
 */
describe('Property Test: Template Generation Count Consistency', () => {
  let templateEngine: TemplateEngine
  const testDataDir = './test-data-property-count'
  const outputDir = path.join(testDataDir, 'output')
  let sharedTemplatePath: string

  beforeAll(async () => {
    templateEngine = new TemplateEngine()
    
    // 创建测试数据目录
    if (!fs.existsSync(testDataDir)) {
      fs.mkdirSync(testDataDir, { recursive: true })
    }
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    // 创建一个共享的模板文件（只创建一次以提高性能）
    const pptx = new PptxGenJS()
    const slide = pptx.addSlide()
    slide.addText('{{name}} {{company}} {{email}}', {
      x: 1,
      y: 1,
      w: 8,
      h: 1,
      fontSize: 18
    })
    
    sharedTemplatePath = path.join(testDataDir, 'shared-template.pptx')
    await pptx.writeFile({ fileName: sharedTemplatePath })
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
   * 生成器：生成随机的数据记录数组（使用固定字段名）
   */
  const dataRecordsArbitrary = fc.array(
    fc.record({
      name: fc.oneof(
        fc.string({ maxLength: 20 }),
        fc.integer({ min: 0, max: 1000 })
      ),
      company: fc.oneof(
        fc.string({ maxLength: 20 }),
        fc.integer({ min: 0, max: 1000 })
      ),
      email: fc.oneof(
        fc.string({ maxLength: 20 }),
        fc.integer({ min: 0, max: 1000 })
      )
    }),
    { minLength: 1, maxLength: 10 }
  )

  it('Property: Generated file count equals data record count (Excel)', async () => {
    await fc.assert(
      fc.asyncProperty(
        dataRecordsArbitrary,
        async (dataRecords) => {
          // 创建 Excel 数据源
          const worksheet = XLSX.utils.json_to_sheet(dataRecords)
          const workbook = XLSX.utils.book_new()
          XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1')
          
          const excelPath = path.join(testDataDir, `test-${Date.now()}-${Math.random()}.xlsx`)
          XLSX.writeFile(workbook, excelPath)

          try {
            // 加载共享模板
            const template = await templateEngine.loadTemplate(sharedTemplatePath)
            
            // 解析数据源
            const parsedData = await templateEngine.parseDataSource(excelPath)
            
            // 批量生成 PPT
            const generatedFiles = await templateEngine.batchGenerate(template, parsedData, outputDir)
            
            // 验证：生成的文件数量应等于数据记录数量
            expect(generatedFiles.length).toBe(parsedData.length)
            expect(generatedFiles.length).toBe(dataRecords.length)
            
            // 验证：所有生成的文件都应该存在
            for (const filePath of generatedFiles) {
              expect(fs.existsSync(filePath)).toBe(true)
            }
            
            return true
          } finally {
            // 清理测试文件
            if (fs.existsSync(excelPath)) {
              fs.unlinkSync(excelPath)
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  }, 60000) // 60 second timeout

  it('Property: Generated file count equals data record count (CSV)', async () => {
    await fc.assert(
      fc.asyncProperty(
        dataRecordsArbitrary,
        async (dataRecords) => {
          // 创建 CSV 数据源
          const fieldNames = ['name', 'company', 'email']
          let csvContent = fieldNames.join(',') + '\n'
          for (const record of dataRecords) {
            const values = fieldNames.map(field => {
              const value = record[field as keyof typeof record]
              const stringValue = String(value ?? '')
              if (stringValue.includes(',') || stringValue.includes('"')) {
                return `"${stringValue.replace(/"/g, '""')}"`
              }
              return stringValue
            })
            csvContent += values.join(',') + '\n'
          }
          
          const csvPath = path.join(testDataDir, `test-${Date.now()}-${Math.random()}.csv`)
          fs.writeFileSync(csvPath, csvContent, 'utf-8')

          try {
            // 加载共享模板
            const template = await templateEngine.loadTemplate(sharedTemplatePath)
            
            // 解析数据源
            const parsedData = await templateEngine.parseDataSource(csvPath)
            
            // 批量生成 PPT
            const generatedFiles = await templateEngine.batchGenerate(template, parsedData, outputDir)
            
            // 验证：生成的文件数量应等于数据记录数量
            expect(generatedFiles.length).toBe(parsedData.length)
            expect(generatedFiles.length).toBe(dataRecords.length)
            
            // 验证：所有生成的文件都应该存在
            for (const filePath of generatedFiles) {
              expect(fs.existsSync(filePath)).toBe(true)
            }
            
            return true
          } finally {
            // 清理测试文件
            if (fs.existsSync(csvPath)) {
              fs.unlinkSync(csvPath)
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  }, 60000) // 60 second timeout

  it('Property: Empty data source generates zero files', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(null),
        async () => {
          const fieldNames = ['name', 'company', 'email']
          // 创建空的 Excel 数据源（只有表头）
          const worksheet = XLSX.utils.aoa_to_sheet([fieldNames])
          const workbook = XLSX.utils.book_new()
          XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1')
          
          const excelPath = path.join(testDataDir, `empty-${Date.now()}-${Math.random()}.xlsx`)
          XLSX.writeFile(workbook, excelPath)

          try {
            // 尝试解析空数据源（应该抛出错误）
            await expect(
              templateEngine.parseDataSource(excelPath)
            ).rejects.toThrow('Excel file contains no data')
            
            return true
          } finally {
            // 清理测试文件
            if (fs.existsSync(excelPath)) {
              fs.unlinkSync(excelPath)
            }
          }
        }
      ),
      { numRuns: 50 }
    )
  }, 30000)

  it('Property: Single record generates exactly one file', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          name: fc.string({ maxLength: 20 }),
          company: fc.string({ maxLength: 20 }),
          email: fc.string({ maxLength: 20 })
        }),
        async (singleRecord) => {
          // 创建 Excel 数据源
          const worksheet = XLSX.utils.json_to_sheet([singleRecord])
          const workbook = XLSX.utils.book_new()
          XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1')
          
          const excelPath = path.join(testDataDir, `single-${Date.now()}-${Math.random()}.xlsx`)
          XLSX.writeFile(workbook, excelPath)

          try {
            // 加载共享模板
            const template = await templateEngine.loadTemplate(sharedTemplatePath)
            
            // 解析数据源
            const parsedData = await templateEngine.parseDataSource(excelPath)
            
            // 批量生成 PPT
            const generatedFiles = await templateEngine.batchGenerate(template, parsedData, outputDir)
            
            // 验证：应该生成恰好一个文件
            expect(generatedFiles.length).toBe(1)
            expect(parsedData.length).toBe(1)
            expect(fs.existsSync(generatedFiles[0])).toBe(true)
            
            return true
          } finally {
            // 清理测试文件
            if (fs.existsSync(excelPath)) {
              fs.unlinkSync(excelPath)
            }
          }
        }
      ),
      { numRuns: 50 }
    )
  }, 60000)

  it('Property: File count consistency across different data types', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }),
        async (recordCount) => {
          // 创建包含不同数据类型的记录
          const dataRecords: DataRecord[] = []
          
          for (let i = 0; i < recordCount; i++) {
            dataRecords.push({
              name: `text_${i}`,
              company: i * 10,
              email: i % 2 === 0
            })
          }
          
          // 创建 Excel 数据源
          const worksheet = XLSX.utils.json_to_sheet(dataRecords)
          const workbook = XLSX.utils.book_new()
          XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1')
          
          const excelPath = path.join(testDataDir, `mixed-${Date.now()}-${Math.random()}.xlsx`)
          XLSX.writeFile(workbook, excelPath)

          try {
            // 加载共享模板
            const template = await templateEngine.loadTemplate(sharedTemplatePath)
            
            // 解析数据源
            const parsedData = await templateEngine.parseDataSource(excelPath)
            
            // 批量生成 PPT
            const generatedFiles = await templateEngine.batchGenerate(template, parsedData, outputDir)
            
            // 验证：生成的文件数量应等于记录数量
            expect(generatedFiles.length).toBe(recordCount)
            expect(parsedData.length).toBe(recordCount)
            
            // 验证：所有文件都存在
            for (const filePath of generatedFiles) {
              expect(fs.existsSync(filePath)).toBe(true)
            }
            
            return true
          } finally {
            // 清理测试文件
            if (fs.existsSync(excelPath)) {
              fs.unlinkSync(excelPath)
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  }, 60000)

  it('Property: File naming follows sequential pattern', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }),
        async (recordCount) => {
          // 创建简单的数据记录
          const dataRecords: DataRecord[] = Array.from({ length: recordCount }, (_, i) => ({
            name: `Record_${i + 1}`,
            company: `Company_${i + 1}`,
            email: `email${i + 1}@example.com`
          }))
          
          // 创建 Excel 数据源
          const worksheet = XLSX.utils.json_to_sheet(dataRecords)
          const workbook = XLSX.utils.book_new()
          XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1')
          
          const excelPath = path.join(testDataDir, `seq-${Date.now()}-${Math.random()}.xlsx`)
          XLSX.writeFile(workbook, excelPath)

          try {
            // 加载共享模板
            const template = await templateEngine.loadTemplate(sharedTemplatePath)
            
            // 解析数据源
            const parsedData = await templateEngine.parseDataSource(excelPath)
            
            // 批量生成 PPT
            const generatedFiles = await templateEngine.batchGenerate(template, parsedData, outputDir)
            
            // 验证：文件数量正确
            expect(generatedFiles.length).toBe(recordCount)
            
            // 验证：文件名遵循顺序模式 output_001.pptx, output_002.pptx, ...
            for (let i = 0; i < generatedFiles.length; i++) {
              const expectedFileName = `output_${String(i + 1).padStart(3, '0')}.pptx`
              expect(generatedFiles[i]).toContain(expectedFileName)
              expect(fs.existsSync(generatedFiles[i])).toBe(true)
            }
            
            return true
          } finally {
            // 清理测试文件
            if (fs.existsSync(excelPath)) {
              fs.unlinkSync(excelPath)
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  }, 60000)
})
