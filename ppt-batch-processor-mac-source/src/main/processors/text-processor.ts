import { PptxParser } from '../services/pptx-parser'
// XLSX 将在 parseExcelRules 方法中动态加载
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
 * 文本替换统计信息
 */
export interface TextReplacementStats {
  totalReplacements: number
  replacementsPerFile: Map<string, number>
  filesProcessed: number
  filesWithReplacements: number
}

/**
 * TextProcessor 类
 * 负责批量文本查找和替换处理
 * 
 * 功能:
 * - 批量文本查找和替换
 * - 保持原文本格式不变
 * - 生成替换统计报告
 * - 支持多个查找/替换对
 * 
 * 验证需求: 2.1, 2.4
 */
export class TextProcessor {
  private parser: PptxParser

  constructor() {
    this.parser = new PptxParser()
  }

  /**
   * 文本替换（公共方法）
   * @param inputPath 输入文件路径
   * @param outputPath 输出文件路径
   * @param options 任务选项（包含searchText和replaceText）
   */
  async replaceText(
    inputPath: string,
    outputPath: string,
    options: TaskOptions
  ): Promise<number> {
    console.log(`         📖 打开文件: ${inputPath}`)
    
    // 验证选项
    if (!options.searchText || options.replaceText === undefined) {
      throw new Error('Search text and replace text are required in options')
    }
    
    // 打开 PPTX 文件
    const document = await this.parser.open(inputPath)
    console.log(`         ✓ 文件已打开`)

    // 执行文本替换
    const replacementCount = await this.replaceTextInDocument(
      document,
      options.searchText,
      options.replaceText,
      options
    )

    console.log(`         💾 保存文件: ${outputPath}`)
    // 保存文件
    await this.parser.save(document, outputPath)
    console.log(`         ✓ 文件已保存，总共替换: ${replacementCount} 处`)

    return replacementCount
  }



  /**
   * 处理单个文件的文本替换
   * @param file 文件信息
   * @param options 任务选项
   * @returns 处理结果
   */
  async processFile(file: FileInfo, options: TaskOptions): Promise<ProcessResult> {
    try {
      // 验证选项
      if (!options.searchText || options.replaceText === undefined) {
        throw new Error('Search text and replace text are required')
      }

      // 打开 PPTX 文件
      const document = await this.parser.open(file.path)

      // 执行文本替换并统计
      const replacementCount = await this.replaceTextInDocument(
        document,
        options.searchText,
        options.replaceText,
        options
      )

      // 确定输出路径
      const outputPath = options.overwriteOriginal 
        ? file.path 
        : this.generateOutputPath(file.path, options.fileNamePattern)

      // 保存文件
      await this.parser.save(document, outputPath)

      return {
        inputFile: file.path,
        outputFile: outputPath,
        status: 'success',
        metadata: {
          originalSize: file.size,
          itemsProcessed: replacementCount
        }
      }
    } catch (error) {
      return {
        inputFile: file.path,
        outputFile: '',
        status: 'error',
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * 批量处理多个文件的文本替换
   * @param files 文件列表
   * @param options 任务选项
   * @returns 处理结果数组和统计信息
   */
  async processBatch(
    files: FileInfo[],
    options: TaskOptions
  ): Promise<{ results: ProcessResult[]; stats: TextReplacementStats }> {
    const results: ProcessResult[] = []
    const stats: TextReplacementStats = {
      totalReplacements: 0,
      replacementsPerFile: new Map(),
      filesProcessed: 0,
      filesWithReplacements: 0
    }

    for (const file of files) {
      const result = await this.processFile(file, options)
      results.push(result)

      if (result.status === 'success') {
        stats.filesProcessed++
        const replacements = result.metadata?.itemsProcessed || 0
        stats.totalReplacements += replacements
        stats.replacementsPerFile.set(file.name, replacements)
        
        if (replacements > 0) {
          stats.filesWithReplacements++
        }
      }
    }

    return { results, stats }
  }

  /**
   * 在文档中执行文本替换（公开方法供其他处理器使用）
   * @param document PPTX 文档
   * @param searchText 要查找的文本
   * @param replaceText 替换后的文本
   * @param options 替换选项
   * @returns 替换的总次数
   */
  async replaceTextInDocument(
    document: PptxDocument,
    searchText: string,
    replaceText: string,
    options?: TaskOptions
  ): Promise<number> {
    let totalReplacements = 0
    
    console.log(`         🔍 开始在文档中查找和替换...`)
    console.log(`         📄 总幻灯片数: ${document.slides.length}`)
    console.log(`         🔍 搜索文本: "${searchText}"`)
    console.log(`         🔍 使用正则: ${options?.useRegex || false}`)

    // 遍历所有幻灯片
    for (const slide of document.slides) {
      console.log(`         📄 幻灯片 ${slide.index + 1}: 包含 ${slide.elements.length} 个元素`)

      // 使用新的支持正则表达式的替换方法
      const slideReplacements = await this.replaceTextInSlideWithOptions(
        document,
        slide.index,
        searchText,
        replaceText,
        options
      )

      if (slideReplacements > 0) {
        totalReplacements += slideReplacements
        console.log(`         📍 幻灯片 ${slide.index + 1}: 替换了 ${slideReplacements} 处`)
      }
      
      // 如果启用了替换备注选项，处理备注
      if (options?.replaceInNotes && slide.notes) {
        const noteReplacements = this.replaceInString(slide.notes, searchText, replaceText, options)
        if (noteReplacements.replaced) {
          slide.notes = noteReplacements.result
          totalReplacements += noteReplacements.count
          console.log(`         📝 备注: 替换了 ${noteReplacements.count} 处`)
        }
      }
    }

    console.log(`         ✅文档处理完成，总共替换: ${totalReplacements} 处`)
    return totalReplacements
  }

  /**
   * 根据选项在幻灯片中替换文本（支持正则表达式）
   * @param document 文档
   * @param slideIndex 幻灯片索引
   * @param searchText 搜索文本
   * @param replaceText 替换文本
   * @param options 选项
   * @returns 替换次数
   */
  private async replaceTextInSlideWithOptions(
    document: PptxDocument,
    slideIndex: number,
    searchText: string,
    replaceText: string,
    options?: TaskOptions
  ): Promise<number> {
    console.log(`         📄 [replaceTextInSlideWithOptions] 幻灯片 ${slideIndex + 1}`)
    console.log(`         📄 [replaceTextInSlideWithOptions] 搜索: "${searchText}", 替换: "${replaceText}"`)
    console.log(`         📄 [replaceTextInSlideWithOptions] useRegex: ${options?.useRegex}`)
    
    const zip = document.zipArchive as any
    const slidePath = `ppt/slides/slide${slideIndex + 1}.xml`
    const slideFile = zip.file(slidePath)
    
    if (!slideFile) {
      console.log(`         ❌ [replaceTextInSlideWithOptions] 幻灯片文件不存在`)
      return 0
    }
    
    let slideXml = slideFile.asText()
    let totalReplacements = 0
    
    if (options?.useRegex && searchText === '[\\r\\n]+') {
      const txBodyRegex = /<p:txBody>([\s\S]*?)<\/p:txBody>/g
      let anyReplaced = 0
      slideXml = slideXml.replace(txBodyRegex, (_m, bodyInner) => {
        const paragraphs: string[] = []
        const pRegex = /<a:p>([\s\S]*?)<\/a:p>/g
        let pMatch: RegExpExecArray | null
        while ((pMatch = pRegex.exec(bodyInner)) !== null) {
          paragraphs.push(pMatch[1])
        }
        if (paragraphs.length <= 1) {
          return _m
        }
        const texts: string[] = []
        for (const pInner of paragraphs) {
          let textContent = ''
          const tRegex = /<a:t[^>]*>([\s\S]*?)<\/a:t>/g
          let tMatch: RegExpExecArray | null
          while ((tMatch = tRegex.exec(pInner)) !== null) {
            textContent += tMatch[1]
          }
          texts.push(textContent)
        }
        const fullText = texts.join('\n')
        const replacement = this.replaceInString(fullText, searchText, replaceText, options)
        if (!replacement.replaced) {
          return _m
        }
        anyReplaced += replacement.count
        const escaped = this.escapeXml(replacement.result)
        const firstP = paragraphs[0]
        const pPrMatch = firstP.match(/<a:pPr[^>]*>[\s\S]*?<\/a:pPr>/)
        const pPr = pPrMatch ? pPrMatch[0] : ''
        const newBodyInner = `<a:p>${pPr}<a:r><a:t>${escaped}</a:t></a:r></a:p>`
        return `<p:txBody>${newBodyInner}</p:txBody>`
      })
      if (anyReplaced > 0) {
        totalReplacements += anyReplaced
        zip.file(slidePath, slideXml)
      }
      return totalReplacements
    }
    
    if (options?.useRegex && (searchText === '\\n' || searchText === '\\r\\n' || searchText === '\\r')) {
      const brRegex = /<a:br\s*\/?>/gi
      const matches = slideXml.match(brRegex)
      const count = matches ? matches.length : 0
      if (count > 0) {
        let processedReplaceText = replaceText
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '\r')
          .replace(/\\t/g, '\t')
        slideXml = slideXml.replace(brRegex, processedReplaceText)
        totalReplacements = count
        zip.file(slidePath, slideXml)
      }
      return totalReplacements
    }
    
    // 提取所有文本节点并进行替换
    const textNodeRegex = /(<a:t[^>]*>)([\s\S]*?)(<\/a:t>)/g
    let match: RegExpExecArray | null
    const replacements: Array<{ fullMatch: string; newContent: string }> = []
    let nodeCount = 0
    
    while ((match = textNodeRegex.exec(slideXml)) !== null) {
      nodeCount++
      const originalContent = match[2]
      
      // 输出前几个文本节点的内容用于调试
      if (nodeCount <= 3) {
        console.log(`         📝 [节点 ${nodeCount}] 内容: "${originalContent}"`)
      }
      
      const replacement = this.replaceInString(originalContent, searchText, replaceText, options)
      
      if (replacement.replaced) {
        totalReplacements += replacement.count
        const newNode = `${match[1]}${replacement.result}${match[3]}`
        console.log(`         ✅ [节点 ${nodeCount}] 替换成功: "${originalContent}" → "${replacement.result}"`)
        replacements.push({
          fullMatch: match[0],
          newContent: newNode
        })
      }
    }
    
    console.log(`         📄 [replaceTextInSlideWithOptions] 文本节点总数: ${nodeCount}`)
    console.log(`         📄 [replaceTextInSlideWithOptions] 需要替换的节点数: ${replacements.length}`)
    console.log(`         📄 [replaceTextInSlideWithOptions] 总替换次数: ${totalReplacements}`)

    if (replacements.length > 0) {
      for (const rep of replacements) {
        slideXml = slideXml.replace(rep.fullMatch, rep.newContent)
      }
      zip.file(slidePath, slideXml)
      return totalReplacements
    }

    if (options?.useRegex) {
      const txBodyRegexFallback = /<p:txBody>([\s\S]*?)<\/p:txBody>/g
      let extraReplacements = 0
      slideXml = slideXml.replace(txBodyRegexFallback, (_m, bodyInner) => {
        // 将 txBody 内的每个段落视为一行，用 \n 连接
        const pRegex = /<a:p>([\s\S]*?)<\/a:p>/g
        let pMatch: RegExpExecArray | null
        const lines: string[] = []

        while ((pMatch = pRegex.exec(bodyInner)) !== null) {
          const pInner = pMatch[1]
          let lineText = ''
          const tRegex = /<a:t[^>]*>([\s\S]*?)<\/a:t>/g
          let tMatch: RegExpExecArray | null
          while ((tMatch = tRegex.exec(pInner)) !== null) {
            lineText += tMatch[1]
          }
          lines.push(lineText)
        }

        const plain = lines.join('\n')
          .replace(/\r\n/g, '\n')
          .replace(/\r/g, '\n')

        if (!plain) {
          return _m
        }

        const replacement = this.replaceInString(plain, searchText, replaceText, options)
        if (!replacement.replaced) {
          return _m
        }

        extraReplacements += replacement.count
        const escaped = this.escapeXml(replacement.result)
        const newBodyInner = `<a:p><a:r><a:t>${escaped}</a:t></a:r></a:p>`
        return `<p:txBody>${newBodyInner}</p:txBody>`
      })
      if (extraReplacements > 0) {
        totalReplacements += extraReplacements
        zip.file(slidePath, slideXml)
      }
    }

    return totalReplacements
  }

  /**
   * 根据选项查找文本
   * @param slide 幻灯片
   * @param searchText 搜索文本
   * @param options 选项
   * @returns 匹配的文本元素
   */
  private findTextWithOptions(
    slide: Slide,
    searchText: string,
    options?: TaskOptions
  ): TextElement[] {
    // 注意：这里简化实现，实际应该在PptxParser中实现正则查找
    // 目前先使用普通文本查找
    return this.parser.findText(slide, searchText)
  }

  /**
   * 根据选项替换文本
   * @param document 文档
   * @param element 文本元素
   * @param searchText 搜索文本
   * @param replaceText 替换文本
   * @param options 选项
   * @returns 是否成功
   */
  private async replaceTextWithOptions(
    document: PptxDocument,
    element: TextElement,
    searchText: string,
    replaceText: string,
    options?: TaskOptions
  ): Promise<boolean> {
    const replacement = this.replaceInString(element.content, searchText, replaceText, options)
    
    if (replacement.replaced) {
      // 更新元素内容
      element.content = replacement.result
      return await this.parser.replaceText(document, element, searchText, replaceText)
    }
    
    return false
  }

  /**
   * 在字符串中执行替换
   * @param text 原始文本
   * @param searchText 搜索文本
   * @param replaceText 替换文本
   * @param options 选项
   * @returns 替换结果
   */
  private replaceInString(
    text: string,
    searchText: string,
    replaceText: string,
    options?: TaskOptions
  ): { result: string; replaced: boolean; count: number } {
    let result = text
    let replaced = false
    let count = 0

    console.log(`         🔍 [replaceInString] 原始搜索文本: "${searchText}"`)
    console.log(`         🔍 [replaceInString] 原始替换文本: "${replaceText}"`)
    console.log(`         🔍 [replaceInString] 使用正则: ${options?.useRegex}`)
    console.log(`         🔍 [replaceInString] 文本内容长度: ${text.length}`)

    if (options?.useRegex) {
      // 使用正则表达式替换
      try {
        const processedReplaceText = replaceText
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '\r')
          .replace(/\\t/g, '\t')
        let flags = options.caseSensitive ? 'g' : 'gi'
        if (searchText.includes('^') || searchText.includes('$')) {
          flags += 'm'
        }
        const regex = new RegExp(searchText, flags)
        console.log(`         🔍 [replaceInString] 正则表达式: ${regex}`)
        const matches = text.match(regex)
        count = matches ? matches.length : 0
        console.log(`         🔍 [replaceInString] 匹配次数: ${count}`)
        if (matches) {
          console.log(`         🔍 [replaceInString] 匹配内容: ${JSON.stringify(matches.slice(0, 3))}...`)
        }
        result = text.replace(regex, processedReplaceText)
        replaced = count > 0
      } catch (error) {
        console.error('         ❌ [replaceInString] 正则表达式错误:', error)
      }
    } else if (options?.wholeWord) {
      // 全词匹配 - 使用自定义边界检查，支持中文
      const processedSearchText = searchText
      const processedReplaceText = replaceText
      const searchFor = options.caseSensitive ? processedSearchText : processedSearchText.toLowerCase()
      const textToSearch = options.caseSensitive ? text : text.toLowerCase()
      
      let position = 0
      const parts: string[] = []
      let lastIndex = 0
      
      while ((position = textToSearch.indexOf(searchFor, position)) !== -1) {
        // 检查前后是否为单词边界
        const before = position > 0 ? text[position - 1] : ' '
        const after = position + processedSearchText.length < text.length ? text[position + processedSearchText.length] : ' '
        
        // 单词边界：空格、标点符号、字符串开始/结束
        const isWordBoundary = (char: string) => {
          return /[\s\p{P}\p{Z}]/u.test(char) || char === ' '
        }
        
        if (isWordBoundary(before) && isWordBoundary(after)) {
          parts.push(text.substring(lastIndex, position))
          parts.push(processedReplaceText)
          lastIndex = position + processedSearchText.length
          count++
          replaced = true
        }
        
        position += processedSearchText.length
      }
      
      if (replaced) {
        parts.push(text.substring(lastIndex))
        result = parts.join('')
      }
    } else {
      // 普通替换
      const processedSearchText = searchText
      const processedReplaceText = replaceText
      const searchFor = options?.caseSensitive ? processedSearchText : processedSearchText.toLowerCase()
      const textToSearch = options?.caseSensitive ? text : text.toLowerCase()
      
      let position = 0
      const parts: string[] = []
      let lastIndex = 0
      
      while ((position = textToSearch.indexOf(searchFor, position)) !== -1) {
        parts.push(text.substring(lastIndex, position))
        parts.push(processedReplaceText)
        position += processedSearchText.length
        lastIndex = position
        count++
        replaced = true
      }
      
      if (replaced) {
        parts.push(text.substring(lastIndex))
        result = parts.join('')
      }
    }

    return { result, replaced, count }
  }

  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  }

  /**
   * 根据选项计算出现次数
   * @param text 文本内容
   * @param searchText 要搜索的文本
   * @param options 选项
   * @returns 出现次数
   */
  private countOccurrencesWithOptions(
    text: string,
    searchText: string,
    options?: TaskOptions
  ): number {
    if (!searchText) return 0
    
    if (options?.useRegex) {
      try {
        const flags = options.caseSensitive ? 'g' : 'gi'
        const regex = new RegExp(searchText, flags)
        const matches = text.match(regex)
        return matches ? matches.length : 0
      } catch (error) {
        return 0
      }
    } else if (options?.wholeWord) {
      const flags = options.caseSensitive ? 'g' : 'gi'
      const escapedSearch = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(`\\b${escapedSearch}\\b`, flags)
      const matches = text.match(regex)
      return matches ? matches.length : 0
    } else {
      const searchFor = options?.caseSensitive ? searchText : searchText.toLowerCase()
      const textToSearch = options?.caseSensitive ? text : text.toLowerCase()
      
      let count = 0
      let position = 0
      
      while ((position = textToSearch.indexOf(searchFor, position)) !== -1) {
        count++
        position += searchText.length
      }
      
      return count
    }
  }

  /**
   * 生成输出文件路径
   * @param inputPath 输入文件路径
   * @param pattern 文件名模式
   * @returns 输出文件路径
   */
  private generateOutputPath(inputPath: string, pattern?: string): string {
    const lastSlash = inputPath.lastIndexOf('/')
    const lastBackslash = inputPath.lastIndexOf('\\')
    const lastSeparator = Math.max(lastSlash, lastBackslash)
    
    const directory = lastSeparator !== -1 ? inputPath.substring(0, lastSeparator) : '.'
    const fileName = lastSeparator !== -1 ? inputPath.substring(lastSeparator + 1) : inputPath
    
    const lastDot = fileName.lastIndexOf('.')
    const baseName = lastDot !== -1 ? fileName.substring(0, lastDot) : fileName
    const extension = lastDot !== -1 ? fileName.substring(lastDot) : ''
    
    // 使用模式或默认后缀
    const outputPattern = pattern || '{name}_replaced'
    const outputBaseName = outputPattern.replace('{name}', baseName)
    
    return `${directory}/${outputBaseName}${extension}`
  }

  /**
   * 生成替换统计报告
   * @param stats 统计信息
   * @returns 格式化的报告字符串
   */
  generateStatsReport(stats: TextReplacementStats): string {
    const lines: string[] = []
    
    lines.push('=== 文本替换统计报告 ===')
    lines.push('')
    lines.push(`处理文件总数: ${stats.filesProcessed}`)
    lines.push(`有替换的文件数: ${stats.filesWithReplacements}`)
    lines.push(`替换总次数: ${stats.totalReplacements}`)
    lines.push('')
    lines.push('每个文件的替换次数:')
    
    // 按文件名排序
    const sortedFiles = Array.from(stats.replacementsPerFile.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
    
    for (const [fileName, count] of sortedFiles) {
      lines.push(`  ${fileName}: ${count} 次`)
    }
    
    return lines.join('\n')
  }
}
