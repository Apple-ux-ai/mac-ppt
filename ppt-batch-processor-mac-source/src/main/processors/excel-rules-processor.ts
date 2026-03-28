import { PptxParser } from '../services/pptx-parser'
import { TextProcessor } from './text-processor'
import path from 'path'
import fs from 'fs'
import type {
  FileInfo,
  ProcessResult,
  TaskOptions,
  PptxDocument,
  ExcelRule,
  ExcelRuleType,
  Slide,
  TextElement
} from '../../shared/types'

/**
 * Excel规则处理器
 * 专门处理基于Excel规则的批量内容修改
 * 
 * 功能完整性:
 * 1. 文本替换 (text-replace)
 * 2. 图片替换 (image-replace) - 待实现
 * 3. 删除内容 (delete-content)
 * 4. 支持CSV和Excel文件格式
 * 5. 规则验证和错误处理
 * 6. 详细的处理报告
 */
export class ExcelRulesProcessor {
  private parser: PptxParser
  private textProcessor: TextProcessor

  constructor() {
    this.parser = new PptxParser()
    this.textProcessor = new TextProcessor()
  }

  /**
   * 从Excel/CSV文件解析规则
   * @param rulesPath 规则文件路径
   * @returns 规则数组
   */
  async parseExcelRules(rulesPath: string): Promise<ExcelRule[]> {
    const ext = path.extname(rulesPath).toLowerCase()
    
    if (ext === '.csv') {
      return this.parseCSVRules(rulesPath)
    } else if (ext === '.xlsx' || ext === '.xls') {
      return this.parseXLSXRules(rulesPath)
    } else {
      throw new Error(`Unsupported rule file format: ${ext}. Only .csv, .xlsx, .xls are supported.`)
    }
  }

  /**
   * 解析CSV格式的规则文件
   * @param csvPath CSV文件路径
   * @returns 规则数组
   */
  private async parseCSVRules(csvPath: string): Promise<ExcelRule[]> {
    const content = fs.readFileSync(csvPath, 'utf-8')
    const lines = content.split('\n').filter(line => line.trim())
    
    if (lines.length === 0) {
      throw new Error('CSV file is empty')
    }
    
    // 跳过标题行
    const dataLines = lines.slice(1)
    const rules: ExcelRule[] = []
    
    for (let i = 0; i < dataLines.length; i++) {
      const line = dataLines[i].trim()
      if (!line) continue
      
      // 解析CSV行（支持引号包裹的逗号）
      const columns = this.parseCSVLine(line)
      
      if (columns.length < 1) {
        console.warn(`Line ${i + 2}: Invalid format, skipping`)
        continue
      }
      
      const typeStr = columns[0].trim()
      const type = this.normalizeRuleType(typeStr)
      
      // 验证规则类型
      if (!type) {
        console.warn(`Line ${i + 2}: Unknown rule type "${typeStr}", skipping`)
        continue
      }
      
      const rule = this.createRule(type, columns.slice(1))
      if (rule) {
        rules.push(rule)
      } else {
        console.warn(`Line ${i + 2}: Invalid rule parameters, skipping`)
      }
    }
    
    return rules
  }

  /**
   * 解析CSV行（处理引号包裹的字段）
   * @param line CSV行
   * @returns 列数组
   */
  private parseCSVLine(line: string): string[] {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // 双引号转义
          current += '"'
          i++
        } else {
          // 切换引号状态
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        // 字段分隔符
        result.push(current)
        current = ''
      } else {
        current += char
      }
    }
    
    result.push(current)
    return result
  }

  /**
   * 解析XLSX格式的规则文件
   * @param xlsxPath XLSX文件路径
   * @returns 规则数组
   */
  private async parseXLSXRules(xlsxPath: string): Promise<ExcelRule[]> {
    // 使用 createRequire 确保在各种环境下都能正确加载 xlsx
    const { createRequire } = await import('module')
    const require = createRequire(import.meta.url)
    const XLSX = require('xlsx')
    
    const workbook = XLSX.readFile(xlsxPath)
    const sheetName = workbook.SheetNames[0]
    
    if (!sheetName) {
      throw new Error('Excel file has no sheets')
    }
    
    const worksheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][]
    
    if (data.length <= 1) {
      throw new Error('Excel file has no data rows')
    }
    
    const rules: ExcelRule[] = []
    
    // 跳过标题行
    for (let i = 1; i < data.length; i++) {
      const row = data[i]
      if (!row || row.length === 0) continue
      
      const typeStr = String(row[0] || '').trim()
      const type = this.normalizeRuleType(typeStr)
      
      // 验证规则类型
      if (!type) {
        console.warn(`Row ${i + 1}: Unknown rule type "${typeStr}", skipping`)
        continue
      }
      
      const rule = this.createRule(type, row.slice(1).map(v => String(v || '')))
      if (rule) {
        rules.push(rule)
      } else {
        console.warn(`Row ${i + 1}: Invalid rule parameters, skipping`)
      }
    }
    
    return rules
  }

  /**
   * 将各种可能的规则类型名称转换为标准类型
   * @param typeStr 规则类型字符串（可能是中文或英文）
   * @returns 标准规则类型或null
   */
  private normalizeRuleType(typeStr: string): ExcelRuleType | null {
    const normalized = typeStr.toLowerCase().replace(/[-_\s]/g, '')
    
    // 文本替换
    if (['textreplace', '文本替换', '替换文本', 'text-replace'].includes(normalized)) {
      return 'text-replace'
    }
    
    // 图片替换
    if (['imagereplace', '图片替换', '替换图片', 'image-replace'].includes(normalized)) {
      return 'image-replace'
    }
    
    // 删除内容
    if (['deletecontent', '删除内容', '内容删除', 'delete-content'].includes(normalized)) {
      return 'delete-content'
    }
    
    return null
  }

  /**
   * 创建规则对象
   * @param type 规则类型
   * @param params 参数数组
   * @returns 规则对象或null
   */
  private createRule(type: ExcelRuleType, params: string[]): ExcelRule | null {
    switch (type) {
      case 'text-replace':
        if (params.length >= 2) {
          return {
            type: 'text-replace',
            searchText: params[0],
            replaceText: params[1]
          }
        }
        break
        
      case 'image-replace':
        if (params.length >= 2) {
          return {
            type: 'image-replace',
            sourceImage: params[0],
            targetImage: params[1]
          }
        }
        break
        
      case 'delete-content':
        if (params.length >= 1) {
          return {
            type: 'delete-content',
            deleteContent: params[0]
          }
        }
        break
    }
    
    return null
  }

  /**
   * 应用Excel规则到单个文件
   * @param inputPath 输入文件路径
   * @param outputPath 输出文件路径
   * @param rulesPath 规则文件路径
   * @param options 任务选项
   * @returns 处理结果
   */
  async applyRulesToFile(
    inputPath: string,
    outputPath: string,
    rulesPath: string,
    options?: TaskOptions
  ): Promise<ProcessResult> {
    console.log(`[LOG] applyRulesToFile: inputPath=${inputPath}, outputPath=${outputPath}, rulesPath=${rulesPath}`);
    try {
      console.log(`         📖 读取规则文件: ${rulesPath}`)
      
      // 解析规则
      const rules = await this.parseExcelRules(rulesPath)
      console.log(`[LOG] Parsed ${rules.length} rules from Excel file.`);
      
      if (rules.length === 0) {
        console.log('[LOG] No valid rules found, returning error.');
        return {
          inputFile: inputPath,
          outputFile: outputPath,
          status: 'error',
          error: 'No valid rules found in the rules file'
        }
      }
      
      console.log(`         ✓ 读取到 ${rules.length} 条规则`)
      console.log(`         📖 打开文件: ${inputPath}`)
      
      // 打开文档
      const document = await this.parser.open(inputPath)
      console.log(`         ✓ 文件已打开`)
      
      let totalOperations = 0
      
      // 按顺序应用每条规则
      for (let i = 0; i < rules.length; i++) {
        const rule = rules[i]
        console.log(`         🔄 应用规则 ${i + 1}/${rules.length}: ${rule.type}`)
        
        let operations = 0
        
        // 根据规则类型应用
        if (rule.type === 'text-replace' && rule.searchText !== undefined && rule.replaceText !== undefined) {
          operations = await this.textProcessor.replaceTextInDocument(
            document,
            rule.searchText,
            rule.replaceText,
            options
          )
        } else if (rule.type === 'delete-content' && rule.deleteContent) {
          operations = await this.textProcessor.replaceTextInDocument(
            document,
            rule.deleteContent,
            '',
            options
          )
        } else if (rule.type === 'image-replace') {
          console.warn('           ⚠️ 图片替换功能暂未实现')
          operations = 0
        }
        
        totalOperations += operations
        
        console.log(`            ✓ 完成 ${operations} 次操作`)
      }
      
      console.log(`[LOG] Total operations performed: ${totalOperations}`);
      console.log(`         💾 保存文件: ${outputPath}`)
      
      // 保存文档
      await this.parser.save(document, outputPath)
      
      console.log(`         ✓ 文件已保存，总共执行: ${totalOperations} 次操作`)
      
      const result: ProcessResult = {
        inputFile: inputPath,
        outputFile: outputPath,
        status: 'success',
        metadata: {
          itemsProcessed: totalOperations,
          rulesApplied: rules.length
        }
      };
      console.log('[LOG] applyRulesToFile successful, returning:', result);
      return result;
    } catch (error) {
      console.error('[LOG] Error in applyRulesToFile:', error);
      return {
        inputFile: inputPath,
        outputFile: outputPath,
        status: 'error',
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * 验证规则文件
   * @param rulesPath 规则文件路径
   * @returns 验证结果
   */
  async validateRulesFile(rulesPath: string): Promise<{
    valid: boolean
    errors: string[]
    warnings: string[]
    rulesCount: number
  }> {
    const errors: string[] = []
    const warnings: string[] = []
    
    try {
      // 检查文件是否存在
      if (!fs.existsSync(rulesPath)) {
        errors.push('规则文件不存在')
        return { valid: false, errors, warnings, rulesCount: 0 }
      }
      
      // 解析规则
      const rules = await this.parseExcelRules(rulesPath)
      
      if (rules.length === 0) {
        warnings.push('规则文件中没有有效的规则')
      }
      
      // 验证每条规则
      rules.forEach((rule, index) => {
        if (rule.type === 'text-replace') {
          if (!rule.searchText) {
            warnings.push(`规则 ${index + 1}: 查找文本为空`)
          }
          if (rule.replaceText === undefined) {
            warnings.push(`规则 ${index + 1}: 替换文本未定义`)
          }
        } else if (rule.type === 'image-replace') {
          if (!rule.sourceImage) {
            warnings.push(`规则 ${index + 1}: 源图片路径为空`)
          }
          if (!rule.targetImage) {
            warnings.push(`规则 ${index + 1}: 目标图片路径为空`)
          } else if (!fs.existsSync(rule.targetImage)) {
            errors.push(`规则 ${index + 1}: 目标图片文件不存在: ${rule.targetImage}`)
          }
        } else if (rule.type === 'delete-content') {
          if (!rule.deleteContent) {
            warnings.push(`规则 ${index + 1}: 删除内容为空`)
          }
        }
      })
      
      return {
        valid: errors.length === 0,
        errors,
        warnings,
        rulesCount: rules.length
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error))
      return { valid: false, errors, warnings, rulesCount: 0 }
    }
  }
}
