import { PptxParser } from './pptx-parser'
import type { PptxDocument } from '../../shared/types'

/**
 * 删除背景选项
 */
export interface RemoveBackgroundOptions {
  removeImages?: boolean    // 删除背景图片
  removeColors?: boolean    // 删除背景色
  applyToMaster?: boolean   // 应用到母版
}

/**
 * 删除结果
 */
export interface RemoveBackgroundResult {
  success: boolean
  processedSlides: number
  processedMasters: number
  errors: string[]
}

/**
 * 背景删除器
 * 负责删除PPT中幻灯片的背景图片和背景色
 */
export class BackgroundRemover {
  private parser: PptxParser

  constructor() {
    this.parser = new PptxParser()
  }

  /**
   * 删除PPT中的背景
   * @param inputPath 输入PPT文件路径
   * @param outputPath 输出PPT文件路径
   * @param options 删除选项
   * @returns 删除结果
   */
  async removeBackground(
    inputPath: string,
    outputPath: string,
    options: RemoveBackgroundOptions
  ): Promise<RemoveBackgroundResult> {
    const result: RemoveBackgroundResult = {
      success: true,
      processedSlides: 0,
      processedMasters: 0,
      errors: []
    }

    try {
      console.log('[DEBUG] Opening PPT file:', inputPath)
      console.log('[DEBUG] Remove background options:', options)
      
      // 打开PPT文件
      const document = await this.parser.open(inputPath)
      const totalSlides = document.slides.length
      console.log(`[DEBUG] Total slides: ${totalSlides}`)

      const zip = document.zipArchive as any

      // 处理每一页的背景
      for (let i = 0; i < totalSlides; i++) {
        const slideNumber = i + 1
        try {
          await this.removeSlideBackground(zip, slideNumber, options)
          result.processedSlides++
          console.log(`[DEBUG] Removed background from slide ${slideNumber}`)
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error)
          result.errors.push(`删除第${slideNumber}页背景失败: ${errorMsg}`)
          console.error(`[DEBUG] Failed to remove background from slide ${slideNumber}:`, error)
        }
      }

      // 如果需要应用到母版
      if (options.applyToMaster) {
        try {
          await this.removeMasterBackgrounds(zip, options)
          console.log('[DEBUG] Removed backgrounds from masters')
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error)
          result.errors.push(`删除母版背景失败: ${errorMsg}`)
          console.error('[DEBUG] Failed to remove master backgrounds:', error)
        }
      }

      console.log(`[DEBUG] Processed ${result.processedSlides} slides`)

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
   * 删除指定幻灯片的背景
   * @param zip ZIP 文档对象
   * @param slideNumber 幻灯片编号（从1开始）
   * @param options 删除选项
   */
  private async removeSlideBackground(
    zip: any,
    slideNumber: number,
    options: RemoveBackgroundOptions
  ): Promise<void> {
    const slidePath = `ppt/slides/slide${slideNumber}.xml`
    const slideFile = zip.file(slidePath)

    if (!slideFile) {
      console.log(`[DEBUG] Slide file not found: ${slidePath}`)
      return
    }

    console.log(`[DEBUG] Processing background for slide ${slideNumber}`)

    const xml2js = await import('xml2js')
    const content = slideFile.asText()
    const result = await xml2js.parseStringPromise(content)

    let modified = false

    // 查找幻灯片内容
    const slide = result['p:sld']
    if (!slide || !slide['p:cSld'] || !slide['p:cSld'][0]) {
      return
    }

    const cSld = slide['p:cSld'][0]

    // 删除背景属性
    if (cSld['p:bg']) {
      const bg = cSld['p:bg'][0]
      if (bg['p:bgPr'] && bg['p:bgPr'][0]) {
        const bgPr = bg['p:bgPr'][0]

        // 删除背景图片填充
        if (options.removeImages && bgPr['a:blipFill']) {
          delete bgPr['a:blipFill']
          modified = true
          console.log(`[DEBUG] Removed background image from slide ${slideNumber}`)
        }
        
        // 删除背景色填充
        if (options.removeColors) {
          if (bgPr['a:solidFill']) {
            delete bgPr['a:solidFill']
            modified = true
            console.log(`[DEBUG] Removed background color from slide ${slideNumber}`)
          }
          if (bgPr['a:gradFill']) {
            delete bgPr['a:gradFill']
            modified = true
            console.log(`[DEBUG] Removed gradient fill from slide ${slideNumber}`)
          }
          if (bgPr['a:pattFill']) {
            delete bgPr['a:pattFill']
            modified = true
            console.log(`[DEBUG] Removed pattern fill from slide ${slideNumber}`)
          }
        }
        
        // 如果背景属性为空，删除整个背景元素
        const hasContent = bgPr['a:blipFill'] || bgPr['a:solidFill'] || 
                          bgPr['a:gradFill'] || bgPr['a:pattFill']
        if (!hasContent) {
          delete cSld['p:bg']
          modified = true
        }
      }
    }

    if (modified) {
      // 重新生成 XML
      const builder = new xml2js.Builder()
      const newXml = builder.buildObject(result)

      // 更新 ZIP 文件
      zip.file(slidePath, newXml)
      console.log(`[DEBUG] Updated slide ${slideNumber}`)
    } else {
      console.log(`[DEBUG] No background found in slide ${slideNumber}`)
    }
  }

  /**
   * 删除母版的背景
   * @param zip ZIP 文档对象
   * @param options 删除选项
   */
  private async removeMasterBackgrounds(
    zip: any,
    options: RemoveBackgroundOptions
  ): Promise<void> {
    console.log('[DEBUG] Processing master backgrounds')

    // 获取所有母版文件
    const masterFiles: string[] = []
    const files = zip.files || zip
    
    // 遍历所有文件
    for (const relativePath in files) {
      if (relativePath.startsWith('ppt/slideMasters/') && relativePath.endsWith('.xml')) {
        masterFiles.push(relativePath)
      }
    }

    console.log(`[DEBUG] Found ${masterFiles.length} master files`)

    // 处理每个母版
    for (const masterPath of masterFiles) {
      try {
        await this.removeMasterBackground(zip, masterPath, options)
      } catch (error) {
        console.error(`[DEBUG] Failed to process master ${masterPath}:`, error)
      }
    }
  }

  /**
   * 删除单个母版的背景
   * @param zip ZIP 文档对象
   * @param masterPath 母版文件路径
   * @param options 删除选项
   */
  private async removeMasterBackground(
    zip: any,
    masterPath: string,
    options: RemoveBackgroundOptions
  ): Promise<void> {
    const masterFile = zip.file(masterPath)
    if (!masterFile) {
      return
    }

    console.log(`[DEBUG] Processing master: ${masterPath}`)

    const xml2js = await import('xml2js')
    const content = masterFile.asText()
    const result = await xml2js.parseStringPromise(content)

    let modified = false

    // 查找母版内容
    const master = result['p:sldMaster']
    if (!master || !master['p:cSld'] || !master['p:cSld'][0]) {
      return
    }

    const cSld = master['p:cSld'][0]

    // 删除背景属性（与幻灯片相同的逻辑）
    if (cSld['p:bg']) {
      const bg = cSld['p:bg'][0]
      if (bg['p:bgPr'] && bg['p:bgPr'][0]) {
        const bgPr = bg['p:bgPr'][0]

        if (options.removeImages && bgPr['a:blipFill']) {
          delete bgPr['a:blipFill']
          modified = true
        }
        
        if (options.removeColors) {
          if (bgPr['a:solidFill']) {
            delete bgPr['a:solidFill']
            modified = true
          }
          if (bgPr['a:gradFill']) {
            delete bgPr['a:gradFill']
            modified = true
          }
          if (bgPr['a:pattFill']) {
            delete bgPr['a:pattFill']
            modified = true
          }
        }
        
        const hasContent = bgPr['a:blipFill'] || bgPr['a:solidFill'] || 
                          bgPr['a:gradFill'] || bgPr['a:pattFill']
        if (!hasContent) {
          delete cSld['p:bg']
          modified = true
        }
      }
    }

    if (modified) {
      const builder = new xml2js.Builder()
      const newXml = builder.buildObject(result)
      zip.file(masterPath, newXml)
      console.log(`[DEBUG] Updated master: ${masterPath}`)
    }
  }
}
