import type { PptxDocument, TextElement } from '../../shared/types'
import { PptxParser } from './pptx-parser'
import * as fs from 'fs'
import * as path from 'path'
import csv from 'csv-parser'

/**
 * 占位符信息
 */
export interface Placeholder {
  name: string
  type: 'text' | 'image'
  location: {
    slideIndex: number
    elementIndex: number
  }
}

/**
 * 模板信息
 */
export interface Template {
  document: PptxDocument
  placeholders: Placeholder[]
}

/**
 * 数据记录
 */
export interface DataRecord {
  [key: string]: string | number | boolean
}

/**
 * 模板引擎
 * 负责基于模板生成 PPT
 */
export class TemplateEngine {
  private parser: PptxParser

  constructor() {
    this.parser = new PptxParser()
  }

  /**
   * 加载模板
   * 扫描模板中的 {{placeholder}} 语法并创建占位符映射表
   * @param templatePath 模板文件路径
   * @returns Template 对象，包含文档和占位符映射表
   * @throws Error 如果模板文件无法打开
   */
  async loadTemplate(templatePath: string): Promise<Template> {
    try {
      // 打开模板文件
      const document = await this.parser.open(templatePath)
      
      // 扫描并识别占位符
      const placeholders = this.scanPlaceholders(document)
      
      return {
        document,
        placeholders
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to load template: ${error.message}`)
      }
      throw new Error('Failed to load template: Unknown error')
    }
  }

  /**
   * 扫描模板中的占位符
   * 识别 {{placeholder}} 语法并创建占位符映射表
   * @param document PptxDocument 对象
   * @returns 占位符数组
   */
  private scanPlaceholders(document: PptxDocument): Placeholder[] {
    const placeholders: Placeholder[] = []
    
    // 正则表达式匹配 {{placeholder}} 语法
    // 支持字母、数字、下划线、中文字符
    const placeholderRegex = /\{\{([a-zA-Z0-9_\u4e00-\u9fa5]+)\}\}/g
    
    // 遍历所有幻灯片
    for (let slideIndex = 0; slideIndex < document.slides.length; slideIndex++) {
      const slide = document.slides[slideIndex]
      
      // 遍历幻灯片中的所有元素
      for (let elementIndex = 0; elementIndex < slide.elements.length; elementIndex++) {
        const element = slide.elements[elementIndex]
        
        // 只处理文本元素
        if (element.type === 'text') {
          const textElement = element as TextElement
          
          // 查找文本中的所有占位符
          let match: RegExpExecArray | null
          while ((match = placeholderRegex.exec(textElement.content)) !== null) {
            const placeholderName = match[1]
            
            // 检查是否已经存在相同名称的占位符
            const existingPlaceholder = placeholders.find(p => p.name === placeholderName)
            
            if (!existingPlaceholder) {
              // 添加新的占位符
              placeholders.push({
                name: placeholderName,
                type: 'text',
                location: {
                  slideIndex,
                  elementIndex
                }
              })
            }
          }
        }
        
        // TODO: 支持图片占位符（需求 4.5）
        // 图片占位符可能使用特殊的命名约定，如 "image_placeholder"
      }
    }
    
    return placeholders
  }

  /**
   * 解析数据源
   * 支持 Excel 和 CSV 格式
   * @param dataSourcePath 数据源文件路径
   * @returns 数据记录数组
   * @throws Error 如果数据源格式不支持或解析失败
   */
  async parseDataSource(dataSourcePath: string): Promise<DataRecord[]> {
    try {
      // 检查文件是否存在
      if (!fs.existsSync(dataSourcePath)) {
        throw new Error(`Data source file not found: ${dataSourcePath}`)
      }

      // 根据文件扩展名判断格式
      const ext = path.extname(dataSourcePath).toLowerCase()

      if (ext === '.xlsx' || ext === '.xls') {
        return await this.parseExcel(dataSourcePath)
      } else if (ext === '.csv') {
        return await this.parseCsv(dataSourcePath)
      } else {
        throw new Error(`Unsupported data source format: ${ext}. Only .xlsx, .xls, and .csv are supported.`)
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to parse data source: ${error.message}`)
      }
      throw new Error('Failed to parse data source: Unknown error')
    }
  }

  /**
   * 解析 Excel 文件
   * @param filePath Excel 文件路径
   * @returns 数据记录数组
   */
  private async parseExcel(filePath: string): Promise<DataRecord[]> {
    try {
      const { createRequire } = await import('module')
      const require = createRequire(import.meta.url)
      const XLSX = require('xlsx')

      const workbook = XLSX.readFile(filePath, { cellDates: true })

      // 获取第一个工作表
      const firstSheetName = workbook.SheetNames[0]
      if (!firstSheetName) {
        throw new Error('Excel file has no sheets')
      }

      const worksheet = workbook.Sheets[firstSheetName]

      const rawData = XLSX.utils.sheet_to_json(worksheet, {
        defval: '',
        raw: true
      }) as Record<string, unknown>[]

      const data: DataRecord[] = rawData.map((row: Record<string, unknown>) => {
        const normalized: DataRecord = {}
        for (const key of Object.keys(row)) {
          const value = row[key]

          if (value instanceof Date) {
            const year = value.getFullYear()
            const month = value.getMonth() + 1
            const day = value.getDate()
            normalized[key] = `${year}/${month}/${day}`
          } else if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
            normalized[key] = value
          } else if (value == null) {
            normalized[key] = ''
          } else {
            normalized[key] = String(value)
          }
        }
        return normalized
      })

      // 验证数据
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('Excel file contains no data')
      }

      return data
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to parse Excel file: ${error.message}`)
      }
      throw new Error('Failed to parse Excel file: Unknown error')
    }
  }

  /**
   * 解析 CSV 文件
   * @param filePath CSV 文件路径
   * @returns 数据记录数组
   */
  private async parseCsv(filePath: string): Promise<DataRecord[]> {
    return new Promise((resolve, reject) => {
      const results: DataRecord[] = []

      fs.createReadStream(filePath)
        .pipe(csv({
          // 去除 BOM（字节顺序标记）
          skipLines: 0,
          // 自动去除字段名中的 BOM
          mapHeaders: ({ header }) => header.replace(/^\uFEFF/, '').trim()
        }))
        .on('data', (data: DataRecord) => {
          results.push(data)
        })
        .on('end', () => {
          // 验证数据
          if (results.length === 0) {
            reject(new Error('CSV file contains no data'))
          } else {
            resolve(results)
          }
        })
        .on('error', (error: Error) => {
          reject(new Error(`Failed to parse CSV file: ${error.message}`))
        })
    })
  }

  /**
   * 生成 PPT
   * 使用模板和数据记录生成单个 PPT 文件
   * @param template 模板对象
   * @param data 数据记录
   * @param outputPath 输出文件路径
   * @throws Error 如果生成失败
   */
  async generate(template: Template, data: DataRecord, outputPath: string): Promise<void> {
    try {
      // 创建模板文档的深拷贝
      // 注意：我们需要重新打开模板文件以获得独立的 ZIP 实例
      const document = await this.parser.open(template.document.filePath)
      
      // 遍历所有幻灯片，替换占位符
      for (const slide of document.slides) {
        for (const element of slide.elements) {
          if (element.type === 'text') {
            const textElement = element as TextElement
            
            // 查找并替换所有占位符
            // 使用正则表达式匹配 {{placeholder}} 语法
            const placeholderRegex = /\{\{([a-zA-Z0-9_\u4e00-\u9fa5]+)\}\}/g
            let match: RegExpExecArray | null
            
            // 收集所有需要替换的占位符
            const replacements: Array<{ placeholder: string; value: string }> = []
            
            while ((match = placeholderRegex.exec(textElement.content)) !== null) {
              const placeholderName = match[1]
              
              // 从数据记录中获取对应的值
              const value = data[placeholderName]
              
              // 将值转换为字符串
              const stringValue = value !== undefined && value !== null ? String(value) : ''
              
              replacements.push({
                placeholder: `{{${placeholderName}}}`,
                value: stringValue
              })
            }
            
            // 执行所有替换
            for (const { placeholder, value } of replacements) {
              await this.parser.replaceText(document, textElement, placeholder, value)
            }
          }
          
          // TODO: 支持图片占位符（需求 4.5）
          // 图片占位符可能需要特殊处理，例如通过图片名称或特殊标记识别
        }
      }
      
      // 保存生成的文件
      await this.parser.save(document, outputPath)
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to generate PPT: ${error.message}`)
      }
      throw new Error('Failed to generate PPT: Unknown error')
    }
  }

  /**
   * 批量生成 PPT
   * 为每条数据记录生成一个独立的 PPT 文件
   * @param template 模板对象
   * @param dataList 数据记录数组
   * @param outputDir 输出目录
   * @param outputPattern 输出文件名模式（可选），支持 {{字段名}} 占位符
   * @returns 生成的文件路径数组
   * @throws Error 如果批量生成失败
   */
  async batchGenerate(template: Template, dataList: DataRecord[], outputDir: string, outputPattern?: string): Promise<string[]> {
    try {
      // 验证输出目录
      if (!fs.existsSync(outputDir)) {
        throw new Error(`Output directory does not exist: ${outputDir}`)
      }
      
      const generatedFiles: string[] = []
      
      // 为每条数据记录生成一个 PPT 文件
      for (let i = 0; i < dataList.length; i++) {
        const data = dataList[i]
        
        // 生成文件名
        let fileName: string
        if (outputPattern && outputPattern.trim()) {
          // 使用自定义模式，替换占位符
          fileName = outputPattern
          const placeholderRegex = /\{\{([a-zA-Z0-9_\u4e00-\u9fa5]+)\}\}/g
          fileName = fileName.replace(placeholderRegex, (match, fieldName) => {
            const value = data[fieldName]
            return value !== undefined && value !== null ? String(value) : ''
          })
          
          // 确保文件名有 .pptx 扩展名
          if (!fileName.toLowerCase().endsWith('.pptx')) {
            fileName += '.pptx'
          }
          
          // 清理文件名中的非法字符
          fileName = fileName.replace(/[<>:"/\\|?*]/g, '_')
        } else {
          // 默认格式：output_001.pptx, output_002.pptx, ...
          fileName = `output_${String(i + 1).padStart(3, '0')}.pptx`
        }
        
        const outputPath = path.join(outputDir, fileName)
        
        // 生成单个文件
        await this.generate(template, data, outputPath)
        
        generatedFiles.push(outputPath)
      }
      
      return generatedFiles
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to batch generate PPT: ${error.message}`)
      }
      throw new Error('Failed to batch generate PPT: Unknown error')
    }
  }

  /**
   * 合并生成 PPT
   * 将所有数据记录合并到一个 PPT 文件中，每条数据占用模板的页数
   * @param template 模板对象
   * @param dataList 数据记录数组
   * @param outputPath 输出文件路径
   * @throws Error 如果合并生成失败
   */
  async mergeGenerate(template: Template, dataList: DataRecord[], outputPath: string): Promise<void> {
    try {
      const os = await import('os')
      const tempDir = os.tmpdir()
      const tempFiles: string[] = []
      
      // 为每条数据生成临时 PPT 文件
      for (let i = 0; i < dataList.length; i++) {
        const data = dataList[i]
        const tempFileName = `temp_${Date.now()}_${i}.pptx`
        const tempFilePath = path.join(tempDir, tempFileName)
        
        // 生成单个文件
        await this.generate(template, data, tempFilePath)
        tempFiles.push(tempFilePath)
      }
      
      // 使用 PageProcessor 合并所有临时文件
      const { PageProcessor } = await import('./page-processor')
      const pageProcessor = new PageProcessor()
      
      await pageProcessor.mergePpt(tempFiles, outputPath)
      
      // 清理临时文件
      for (const tempFile of tempFiles) {
        try {
          if (fs.existsSync(tempFile)) {
            fs.unlinkSync(tempFile)
          }
        } catch (error) {
          // 忽略清理错误
          console.warn(`Failed to delete temp file: ${tempFile}`)
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to merge generate PPT: ${error.message}`)
      }
      throw new Error('Failed to merge generate PPT: Unknown error')
    }
  }
}
