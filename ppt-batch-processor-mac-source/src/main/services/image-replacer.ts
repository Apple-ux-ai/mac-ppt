import { PptxParser } from './pptx-parser'
import type { PptxDocument, ImageElement } from '../../shared/types'
import * as fs from 'fs'
import * as path from 'path'

/**
 * 图片替换规则
 */
export interface ImageReplaceRule {
  // 匹配方式
  matchType: 'page' | 'all'
  // 匹配值（页码，从1开始）
  matchValue?: number
  // 新图片路径
  newImagePath: string
  // 是否保持原图片尺寸
  keepOriginalSize?: boolean
  // 是否同时替换所有相同图片
  replaceAllSameImages?: boolean
}

/**
 * 图片替换结果
 */
export interface ImageReplaceResult {
  success: boolean
  replacedCount: number
  errors: string[]
}

/**
 * 图片替换引擎
 * 负责在 PPT 中替换图片
 */
export class ImageReplacer {
  private parser: PptxParser

  constructor() {
    this.parser = new PptxParser()
  }

  /**
   * 替换 PPT 中的图片
   * @param inputPath 输入 PPT 文件路径
   * @param outputPath 输出 PPT 文件路径
   * @param rules 替换规则数组
   * @returns 替换结果
   */
  async replaceImages(
    inputPath: string,
    outputPath: string,
    rules: ImageReplaceRule[]
  ): Promise<ImageReplaceResult> {
    const result: ImageReplaceResult = {
      success: true,
      replacedCount: 0,
      errors: []
    }

    try {
      // 打开 PPT 文件
      const document = await this.parser.open(inputPath)

      // 应用每条替换规则
      for (const rule of rules) {
        try {
          const count = await this.applyRule(document, rule)
          result.replacedCount += count
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error)
          result.errors.push(`规则应用失败: ${errorMsg}`)
          result.success = false
        }
      }

      // 保存修改后的文件
      await this.parser.save(document, outputPath)

      return result
    } catch (error) {
      result.success = false
      result.errors.push(error instanceof Error ? error.message : String(error))
      return result
    }
  }

  /**
   * 应用单条替换规则
   * @param document PPT 文档对象
   * @param rule 替换规则
   * @returns 替换的图片数量
   */
  private async applyRule(document: PptxDocument, rule: ImageReplaceRule): Promise<number> {
    let replacedCount = 0

    console.log(`[DEBUG] Applying rule:`, {
      matchType: rule.matchType,
      matchValue: rule.matchValue,
      newImagePath: rule.newImagePath
    })

    // 验证新图片文件是否存在
    if (!fs.existsSync(rule.newImagePath)) {
      throw new Error(`图片文件不存在: ${rule.newImagePath}`)
    }

    // 读取新图片数据
    const newImageData = fs.readFileSync(rule.newImagePath)
    const newImageExt = path.extname(rule.newImagePath).toLowerCase()

    console.log(`[DEBUG] Document has ${document.slides.length} slides`)

    // 根据匹配类型决定要处理的幻灯片
    let slidesToProcess: number[] = []
    
    if (rule.matchType === 'all') {
      // 处理所有幻灯片
      slidesToProcess = Array.from({ length: document.slides.length }, (_, i) => i)
    } else if (rule.matchType === 'page' && rule.matchValue !== undefined) {
      // 处理指定页（matchValue是从1开始的页码，需要转换为从0开始的索引）
      const pageIndex = rule.matchValue - 1
      if (pageIndex >= 0 && pageIndex < document.slides.length) {
        slidesToProcess = [pageIndex]
      } else {
        console.log(`[DEBUG] Page ${rule.matchValue} is out of range (total: ${document.slides.length})`)
        return 0
      }
    }

    console.log(`[DEBUG] Will process ${slidesToProcess.length} slide(s): ${slidesToProcess.map(i => i + 1).join(', ')}`)

    // 遍历要处理的幻灯片
    for (const slideIndex of slidesToProcess) {
      const slide = document.slides[slideIndex]
      console.log(`[DEBUG] Slide ${slideIndex + 1}: ${slide.elements.length} elements`)
      
      // 遍历幻灯片中的所有元素
      for (let i = 0; i < slide.elements.length; i++) {
        const element = slide.elements[i]
        console.log(`[DEBUG]   Element ${i}: type=${element.type}`)

        // 只处理图片元素
        if (element.type === 'image') {
          const imageElement = element as ImageElement
          console.log(`[DEBUG]   Image found: ${imageElement.name}`)
          console.log(`[DEBUG]   ✓ Replacing...`)
          
          // 替换图片
          await this.replaceImage(
            document,
            slideIndex,
            imageElement,
            newImageData,
            newImageExt,
            rule.keepOriginalSize,
            rule.replaceAllSameImages
          )
          replacedCount++
          console.log(`[DEBUG]   ✓ Replaced successfully`)
        }
      }
    }

    console.log(`[DEBUG] Total replaced: ${replacedCount}`)
    return replacedCount
  }

  /**
   * 替换单个图片
   * @param document PPT 文档对象
   * @param slideIndex 幻灯片索引
   * @param imageElement 图片元素
   * @param newImageData 新图片数据
   * @param newImageExt 新图片扩展名
   * @param keepOriginalSize 是否保持原图片尺寸
   * @param replaceAllSameImages 是否同时替换所有相同图片
   */
  private async replaceImage(
    document: PptxDocument,
    slideIndex: number,
    imageElement: ImageElement,
    newImageData: Buffer,
    newImageExt: string,
    keepOriginalSize: boolean = true,
    replaceAllSameImages: boolean = false
  ): Promise<void> {
    // 使用 parser 的图片替换功能
    await this.parser.replaceImage(
      document,
      slideIndex,
      imageElement,
      newImageData,
      newImageExt,
      keepOriginalSize,
      replaceAllSameImages
    )
  }

  /**
   * 获取 PPT 中的所有图片信息
   * @param filePath PPT 文件路径
   * @returns 图片信息数组
   */
  async getImageList(filePath: string): Promise<Array<{
    slideIndex: number
    elementIndex: number
    name: string
    width: number
    height: number
  }>> {
    const document = await this.parser.open(filePath)
    const images: Array<{
      slideIndex: number
      elementIndex: number
      name: string
      width: number
      height: number
    }> = []

    document.slides.forEach((slide, slideIndex) => {
      slide.elements.forEach((element, elementIndex) => {
        if (element.type === 'image') {
          const imageElement = element as ImageElement
          images.push({
            slideIndex,
            elementIndex,
            name: imageElement.name || `图片${elementIndex + 1}`,
            width: imageElement.width || 0,
            height: imageElement.height || 0
          })
        }
      })
    })

    return images
  }
}
