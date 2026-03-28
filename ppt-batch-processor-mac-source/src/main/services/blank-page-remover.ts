import { PptxParser } from './pptx-parser'
import type { PptxDocument, Slide } from '../../shared/types'

/**
 * 空白页判断选项
 */
export interface BlankPageOptions {
  hasText?: boolean          // 包含文本内容
  hasImages?: boolean        // 包含图片
  hasShapes?: boolean        // 包含形状
  ignoreBackground?: boolean // 忽略背景
}

/**
 * 删除结果
 */
export interface RemoveBlankPagesResult {
  success: boolean
  removedCount: number
  remainingCount: number
  errors: string[]
}

/**
 * 空白页删除器
 * 负责检测和删除PPT中的空白页
 */
export class BlankPageRemover {
  private parser: PptxParser

  constructor() {
    this.parser = new PptxParser()
  }

  /**
   * 删除PPT中的空白页
   * @param inputPath 输入PPT文件路径
   * @param outputPath 输出PPT文件路径
   * @param options 空白页判断选项
   * @returns 删除结果
   */
  async removeBlankPages(
    inputPath: string,
    outputPath: string,
    options: BlankPageOptions
  ): Promise<RemoveBlankPagesResult> {
    const result: RemoveBlankPagesResult = {
      success: true,
      removedCount: 0,
      remainingCount: 0,
      errors: []
    }

    try {
      console.log('[DEBUG] Opening PPT file:', inputPath)
      console.log('[DEBUG] Blank page options:', options)
      
      // 打开PPT文件
      const document = await this.parser.open(inputPath)
      const totalSlides = document.slides.length
      console.log(`[DEBUG] Total slides: ${totalSlides}`)

      // 检测空白页
      const blankSlides: number[] = []
      for (let i = 0; i < document.slides.length; i++) {
        const slide = document.slides[i]
        if (this.isBlankSlide(slide, options)) {
          blankSlides.push(i)
          console.log(`[DEBUG] Slide ${i + 1} is blank`)
        }
      }

      console.log(`[DEBUG] Found ${blankSlides.length} blank slides`)

      // 删除空白页（从后往前删除，避免索引变化）
      for (let i = blankSlides.length - 1; i >= 0; i--) {
        const slideIndex = blankSlides[i]
        try {
          await this.removeSlide(document, slideIndex)
          result.removedCount++
          console.log(`[DEBUG] Removed slide ${slideIndex + 1}`)
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error)
          result.errors.push(`删除第${slideIndex + 1}页失败: ${errorMsg}`)
          console.error(`[DEBUG] Failed to remove slide ${slideIndex + 1}:`, error)
        }
      }

      result.remainingCount = document.slides.length
      console.log(`[DEBUG] Remaining slides: ${result.remainingCount}`)

      // 保存修改后的文件
      await this.parser.save(document, outputPath)
      console.log('[DEBUG] Saved PPT file:', outputPath)

      return result
    } catch (error) {
      result.success = false
      result.errors.push(error instanceof Error ? error.message : String(error))
      return result
    }
  }

  /**
   * 判断幻灯片是否为空白页
   * @param slide 幻灯片对象
   * @param options 判断选项
   * @returns 是否为空白页
   */
  private isBlankSlide(slide: Slide, options: BlankPageOptions): boolean {
    console.log(`[DEBUG] Checking slide ${slide.index + 1}:`, {
      elements: slide.elements.length,
      options
    })

    // 检查是否有文本内容
    const hasTextContent = slide.elements.some(element => {
      if (element.type === 'text') {
        const textElement = element as any
        const content = textElement.content || ''
        return content.trim().length > 0
      }
      return false
    })

    // 检查是否有图片
    const hasImageContent = slide.elements.some(element => element.type === 'image')

    // 检查是否有形状
    const hasShapeContent = slide.elements.some(element => {
      if (element.type === 'text' || element.type === 'image') return false
      const el = element as any
      if (el.placeholder || el.isPlaceholder) return false
      return true
    })

    console.log(`[DEBUG] Slide ${slide.index + 1} content analysis:`, {
      hasText: hasTextContent,
      hasImages: hasImageContent,
      hasShapes: hasShapeContent
    })

    // 新逻辑：只要页面包含任何勾选的内容，就不是空白页
    if (options.hasText && hasTextContent) {
      console.log(`[DEBUG] Slide ${slide.index + 1}: Has text, not blank`)
      return false // 有文本，保留
    }
    if (options.hasImages && hasImageContent) {
      console.log(`[DEBUG] Slide ${slide.index + 1}: Has images, not blank`)
      return false // 有图片，保留
    }
    if (options.hasShapes && hasShapeContent) {
      console.log(`[DEBUG] Slide ${slide.index + 1}: Has shapes, not blank`)
      return false // 有形状，保留
    }

    // 如果页面不包含任何需要保留的内容，则判定为空白页
    console.log(`[DEBUG] Slide ${slide.index + 1}: No required content, is blank`)
    return true
  }

  /**
   * 删除指定的幻灯片
   * @param document PPT文档对象
   * @param slideIndex 幻灯片索引
   */
  private async removeSlide(document: PptxDocument, slideIndex: number): Promise<void> {
    const zip = document.zipArchive as any
    const slideNumber = slideIndex + 1
    
    console.log(`[DEBUG] Removing slide ${slideNumber} from ZIP...`)
    
    // 1. 删除幻灯片 XML 文件
    const slideFile = `ppt/slides/slide${slideNumber}.xml`
    if (zip.file(slideFile)) {
      zip.remove(slideFile)
      console.log(`[DEBUG] Removed ${slideFile}`)
    }
    
    // 2. 删除幻灯片关系文件
    const slideRelsFile = `ppt/slides/_rels/slide${slideNumber}.xml.rels`
    if (zip.file(slideRelsFile)) {
      zip.remove(slideRelsFile)
      console.log(`[DEBUG] Removed ${slideRelsFile}`)
    }
    
    // 3. 更新 presentation.xml.rels 中的引用
    await this.updatePresentationRels(zip, slideIndex)
    
    // 4. 更新 presentation.xml 中的幻灯片列表
    await this.updatePresentationXml(zip, slideIndex)
    
    // 5. 从文档的幻灯片数组中移除
    document.slides.splice(slideIndex, 1)
    
    // 6. 更新剩余幻灯片的索引
    for (let i = slideIndex; i < document.slides.length; i++) {
      document.slides[i].index = i
    }
    
    console.log(`[DEBUG] Successfully removed slide ${slideNumber}`)
  }
  
  /**
   * 更新 presentation.xml.rels 文件
   */
  private async updatePresentationRels(zip: any, slideIndex: number): Promise<void> {
    const relsPath = 'ppt/_rels/presentation.xml.rels'
    const relsFile = zip.file(relsPath)
    
    if (!relsFile) {
      console.log('[DEBUG] presentation.xml.rels not found')
      return
    }
    
    const xml2js = await import('xml2js')
    const content = relsFile.asText()
    const result = await xml2js.parseStringPromise(content)
    
    if (!result.Relationships || !result.Relationships.Relationship) {
      return
    }
    
    // 找到要删除的幻灯片的关系ID
    const slideNumber = slideIndex + 1
    const targetSlide = `slides/slide${slideNumber}.xml`
    
    // 过滤掉要删除的幻灯片关系
    result.Relationships.Relationship = result.Relationships.Relationship.filter((rel: any) => {
      return rel.$.Target !== targetSlide
    })
    
    // 重新生成 XML
    const builder = new xml2js.Builder()
    const newXml = builder.buildObject(result)
    
    // 更新 ZIP 文件
    zip.file(relsPath, newXml)
    console.log('[DEBUG] Updated presentation.xml.rels')
  }
  
  /**
   * 更新 presentation.xml 文件
   */
  private async updatePresentationXml(zip: any, slideIndex: number): Promise<void> {
    const presPath = 'ppt/presentation.xml'
    const presFile = zip.file(presPath)
    
    if (!presFile) {
      console.log('[DEBUG] presentation.xml not found')
      return
    }
    
    const xml2js = await import('xml2js')
    const content = presFile.asText()
    const result = await xml2js.parseStringPromise(content)
    
    // 查找幻灯片列表
    const presentation = result['p:presentation']
    if (!presentation || !presentation['p:sldIdLst'] || !presentation['p:sldIdLst'][0]) {
      return
    }
    
    const sldIdLst = presentation['p:sldIdLst'][0]
    if (!sldIdLst['p:sldId']) {
      return
    }
    
    // 删除指定索引的幻灯片
    sldIdLst['p:sldId'].splice(slideIndex, 1)
    
    // 重新生成 XML
    const builder = new xml2js.Builder()
    const newXml = builder.buildObject(result)
    
    // 更新 ZIP 文件
    zip.file(presPath, newXml)
    console.log('[DEBUG] Updated presentation.xml')
  }
}
