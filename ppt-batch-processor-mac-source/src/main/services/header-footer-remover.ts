import { PptxParser } from './pptx-parser'
import type { PptxDocument } from '../../shared/types'

/**
 * 删除结果
 */
export interface RemoveHeaderFooterResult {
  success: boolean
  processedSlides: number
  removedCount: number
  errors: string[]
}

/**
 * 页眉页脚删除器
 * 负责删除PPT中的页眉、页脚、页码、日期时间等内容
 */
export class HeaderFooterRemover {
  private parser: PptxParser

  constructor() {
    this.parser = new PptxParser()
  }

  /**
   * 删除PPT中的页眉页脚
   * @param inputPath 输入PPT文件路径
   * @param outputPath 输出PPT文件路径
   * @param options 删除选项
   * @returns 删除结果
   */
  async removeHeaderFooter(
    inputPath: string,
    outputPath: string,
    options?: {
      removeHeader?: boolean
      removeFooter?: boolean
      removeSlideNumber?: boolean
      removeDateTime?: boolean
    }
  ): Promise<RemoveHeaderFooterResult> {
    const result: RemoveHeaderFooterResult = {
      success: true,
      processedSlides: 0,
      removedCount: 0,
      errors: []
    }

    // 默认删除所有类型
    const opts = {
      removeHeader: options?.removeHeader !== false,
      removeFooter: options?.removeFooter !== false,
      removeSlideNumber: options?.removeSlideNumber !== false,
      removeDateTime: options?.removeDateTime !== false
    }

    try {
      console.log('[DEBUG] Opening PPT file:', inputPath)
      console.log('[DEBUG] Remove options:', opts)
      
      // 打开PPT文件
      const document = await this.parser.open(inputPath)
      const totalSlides = document.slides.length
      console.log(`[DEBUG] Total slides: ${totalSlides}`)

      const zip = document.zipArchive as any

      // 处理每一页的页眉页脚
      for (let i = 0; i < totalSlides; i++) {
        const slideNumber = i + 1
        try {
          const removed = await this.removeSlideHeaderFooter(zip, slideNumber, opts)
          result.removedCount += removed
          result.processedSlides++
          if (removed > 0) {
            console.log(`[DEBUG] Removed ${removed} header/footer elements from slide ${slideNumber}`)
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error)
          result.errors.push(`删除第${slideNumber}页页眉页脚失败: ${errorMsg}`)
          console.error(`[DEBUG] Failed to remove header/footer from slide ${slideNumber}:`, error)
        }
      }

      // 处理版式与母版中的页眉页脚（很多文件的页眉页脚实际定义在这里）
      try {
        const layoutRemoved = await this.removeHeaderFooterFromMatchingParts(zip, /^ppt\/slideLayouts\/slideLayout\d+\.xml$/i, opts)
        result.removedCount += layoutRemoved
        if (layoutRemoved > 0) {
          console.log(`[DEBUG] Removed ${layoutRemoved} header/footer elements from slideLayouts`)
        }
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e)
        result.errors.push(`删除版式页眉页脚失败: ${errorMsg}`)
      }

      try {
        const masterRemoved = await this.removeHeaderFooterFromMatchingParts(zip, /^ppt\/slideMasters\/slideMaster\d+\.xml$/i, opts)
        result.removedCount += masterRemoved
        if (masterRemoved > 0) {
          console.log(`[DEBUG] Removed ${masterRemoved} header/footer elements from slideMasters`)
        }
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e)
        result.errors.push(`删除母版页眉页脚失败: ${errorMsg}`)
      }

      console.log(`[DEBUG] Processed ${result.processedSlides} slides, removed ${result.removedCount} elements`)

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
   * 删除指定幻灯片的页眉页脚
   * @param zip ZIP 文档对象
   * @param slideNumber 幻灯片编号（从1开始）
   * @param options 删除选项
   * @returns 删除的元素数量
   */
  private async removeSlideHeaderFooter(
    zip: any,
    slideNumber: number,
    options: {
      removeHeader: boolean
      removeFooter: boolean
      removeSlideNumber: boolean
      removeDateTime: boolean
    }
  ): Promise<number> {
    const slidePath = `ppt/slides/slide${slideNumber}.xml`
    const slideFile = zip.file(slidePath)

    if (!slideFile) {
      console.log(`[DEBUG] No slide file found for slide ${slideNumber}`)
      return 0
    }

    const xml2js = await import('xml2js')
    const content = slideFile.asText()
    const result = await xml2js.parseStringPromise(content)

    // 查找幻灯片内容
    const slide = result['p:sld']
    if (!slide || !slide['p:cSld'] || !slide['p:cSld'][0]) {
      return 0
    }

    const cSld = slide['p:cSld'][0]
    if (!cSld['p:spTree'] || !cSld['p:spTree'][0]) {
      return 0
    }

    const spTree = cSld['p:spTree'][0]
    if (!spTree['p:sp']) {
      return 0
    }

    const removedCount = this.removeHeaderFooterFromSpTree(spTree, options)

    if (removedCount > 0) {
      const builder = new xml2js.Builder()
      const newXml = builder.buildObject(result)
      zip.file(slidePath, newXml)
    }

    return removedCount
  }

  private removeHeaderFooterFromSpTree(
    spTree: any,
    options: {
      removeHeader: boolean
      removeFooter: boolean
      removeSlideNumber: boolean
      removeDateTime: boolean
    }
  ): number {
    let removedCount = 0

    const filterShapes = (node: any) => {
      if (!node) return

      if (Array.isArray(node['p:sp'])) {
        const kept: any[] = []
        for (const shape of node['p:sp']) {
          const shouldRemove = this.isHeaderFooterShape(shape, options)
          const shouldRemoveByText = !shouldRemove && this.isLikelyHeaderFooterTextShape(shape, options)
          if (shouldRemove || shouldRemoveByText) {
            removedCount++
          } else {
            kept.push(shape)
          }
        }
        node['p:sp'] = kept
      }

      if (Array.isArray(node['p:grpSp'])) {
        for (const grp of node['p:grpSp']) {
          filterShapes(grp)
        }
      }
    }

    filterShapes(spTree)
    return removedCount
  }

  private extractShapeText(shape: any): string {
    try {
      const txBody = shape?.['p:txBody']?.[0]
      const paras = txBody?.['a:p']
      if (!Array.isArray(paras)) return ''

      const texts: string[] = []
      for (const p of paras) {
        const runs = p?.['a:r']
        if (!Array.isArray(runs)) continue
        for (const r of runs) {
          const t = r?.['a:t']?.[0]
          if (typeof t === 'string') texts.push(t)
        }
      }
      return texts.join('')
    } catch {
      return ''
    }
  }

  private getShapeY(shape: any): number | null {
    try {
      const xfrm = shape?.['p:spPr']?.[0]?.['a:xfrm']?.[0]
      const off = xfrm?.['a:off']?.[0]?.$?.y
      if (off === undefined) return null
      const y = Number(off)
      return Number.isFinite(y) ? y : null
    } catch {
      return null
    }
  }

  private isLikelyHeaderFooterTextShape(
    shape: any,
    options: {
      removeHeader: boolean
      removeFooter: boolean
      removeSlideNumber: boolean
      removeDateTime: boolean
    }
  ): boolean {
    const text = this.extractShapeText(shape)
    if (!text) return false

    // 位置兜底：只删除靠近底部的文本框，避免误删正文
    const y = this.getShapeY(shape)
    // y 单位是 EMU：常见 7.5in 高的幻灯片约 6858000 EMU，底部区域取 > 70%
    if (y !== null && y < 4800000) {
      return false
    }

    const normalized = text.replace(/\s+/g, '')

    if (options.removeSlideNumber) {
      // 例："1"、"第1页"、"1/10" 等
      if (/^\d+(\/\d+)?$/.test(normalized) || /第\d+页/.test(normalized) || /\d+\s*\/\s*\d+/.test(text)) {
        return true
      }
      if (normalized.includes('页') && /\d/.test(normalized)) {
        return true
      }
    }

    if (options.removeDateTime) {
      // 日期/时间常见格式
      if (/\d{4}[-/.年]\d{1,2}[-/.月]\d{1,2}日?/.test(text) || /\d{1,2}:\d{2}/.test(text)) {
        return true
      }
      if (normalized.includes('日期') || normalized.includes('时间')) {
        return true
      }
    }

    if (options.removeFooter) {
      if (normalized.includes('页脚') || normalized.includes('footer')) {
        return true
      }
    }

    if (options.removeHeader) {
      // 头部一般不在底部，这里保守不按文本兜底删除 header
    }

    return false
  }

  private async removeHeaderFooterFromMatchingParts(
    zip: any,
    pathPattern: RegExp,
    options: {
      removeHeader: boolean
      removeFooter: boolean
      removeSlideNumber: boolean
      removeDateTime: boolean
    }
  ): Promise<number> {
    const files = zip.file(/.*/)
    const matched = files
      .map((f: any) => f.name)
      .filter((name: string) => pathPattern.test(name))

    let totalRemoved = 0
    for (const partPath of matched) {
      const removed = await this.removeHeaderFooterFromPart(zip, partPath, options)
      totalRemoved += removed
    }
    return totalRemoved
  }

  private async removeHeaderFooterFromPart(
    zip: any,
    partPath: string,
    options: {
      removeHeader: boolean
      removeFooter: boolean
      removeSlideNumber: boolean
      removeDateTime: boolean
    }
  ): Promise<number> {
    const partFile = zip.file(partPath)
    if (!partFile) return 0

    const xml2js = await import('xml2js')
    const content = partFile.asText()
    const parsed = await xml2js.parseStringPromise(content)

    const rootKey = Object.keys(parsed)[0]
    const root = parsed[rootKey]
    const cSld = root?.['p:cSld']?.[0]
    const spTree = cSld?.['p:spTree']?.[0]
    if (!spTree) return 0

    const removed = this.removeHeaderFooterFromSpTree(spTree, options)
    if (removed > 0) {
      console.log(`[DEBUG] Removed ${removed} header/footer elements from part: ${partPath}`)
      const builder = new xml2js.Builder()
      const newXml = builder.buildObject(parsed)
      zip.file(partPath, newXml)
    }
    return removed
  }

  /**
   * 判断形状是否是页眉页脚元素
   * @param shape 形状对象
   * @param options 删除选项
   * @returns 是否应该删除
   */
  private isHeaderFooterShape(
    shape: any,
    options: {
      removeHeader: boolean
      removeFooter: boolean
      removeSlideNumber: boolean
      removeDateTime: boolean
    }
  ): boolean {
    try {
      // 检查占位符类型
      const nvSpPr = shape['p:nvSpPr']?.[0]
      if (!nvSpPr) return false

      const nvPr = nvSpPr['p:nvPr']?.[0]
      if (!nvPr) return false

      const ph = nvPr['p:ph']?.[0]
      if (!ph || !ph.$) return false

      const phType = ph.$.type

      // 根据占位符类型判断
      if (phType === 'hdr' && options.removeHeader) {
        return true
      }
      if (phType === 'ftr' && options.removeFooter) {
        return true
      }
      if (phType === 'sldNum' && options.removeSlideNumber) {
        return true
      }
      if (phType === 'dt' && options.removeDateTime) {
        return true
      }

      // 检查形状名称
      const cNvPr = nvSpPr['p:cNvPr']?.[0]
      if (cNvPr && cNvPr.$?.name) {
        const name = cNvPr.$.name.toLowerCase()
        
        if (options.removeHeader && (name.includes('header') || name.includes('页眉'))) {
          return true
        }
        if (options.removeFooter && (name.includes('footer') || name.includes('页脚'))) {
          return true
        }
        if (options.removeSlideNumber && (name.includes('slide number') || name.includes('页码'))) {
          return true
        }
        if (options.removeDateTime && (name.includes('date') || name.includes('time') || name.includes('日期') || name.includes('时间'))) {
          return true
        }
      }

      return false
    } catch (error) {
      console.error('[DEBUG] Error checking header/footer shape:', error)
      return false
    }
  }
}
