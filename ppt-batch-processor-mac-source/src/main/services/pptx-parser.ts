import PizZip from 'pizzip'
import { promises as fs } from 'fs'
import * as path from 'path'
import { parseString, Builder } from 'xml2js'
import { promisify } from 'util'
import * as officeCrypto from 'officecrypto-tool'
import type { PptxDocument, Slide, Metadata, Element, TextElement, ImageElement, TextStyle } from '../../shared/types'

const parseXml = promisify(parseString)

/**
 * PPTX 解析器
 * 负责解析和操作 PPTX 文件内容
 */
export class PptxParser {
  private escapeRegExp(input: string): string {
    return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  private replaceInTextNodes(xml: string, searchText: string, replaceText: string, useRegex: boolean): { xml: string; count: number } {
    let totalCount = 0

    // 匹配所有包含文本体的形状 <p:sp>...<p:txBody>...</p:txBody>...</p:sp>
    const shapeRegex = /<p:sp>([\s\S]*?<p:txBody>[\s\S]*?<\/p:txBody>[\s\S]*?)<\/p:sp>/g

    const newXml = xml.replace(shapeRegex, (shape) => {
      const { xml: newShapeXml, count } = this.replaceTextInShape(shape, searchText, replaceText, useRegex)
      if (count > 0) {
        totalCount += count
      }
      return newShapeXml
    })

    return { xml: newXml, count: totalCount }
  }

  private replaceTextInShape(shapeXml: string, searchText: string, replaceText: string, useRegex: boolean): { xml: string, count: number } {
    const txBodyMatch = shapeXml.match(/<p:txBody>([\s\S]*)<\/p:txBody>/)
    if (!txBodyMatch) return { xml: shapeXml, count: 0 }

    const txBodyInner = txBodyMatch[1]

    // 1. 智能解构为带格式的对象数组
    const runs: Array<{ text: string, rPr: string, pPr: string, type: 'text' | 'br' }> = []
    const pRegex = /<a:p>([\s\S]*?)<\/a:p>/g
    let pMatch
    while ((pMatch = pRegex.exec(txBodyInner)) !== null) {
      const pInner = pMatch[1]
      const pPrMatch = pInner.match(/<a:pPr[^>]*>[\s\S]*?<\/a:pPr>/)
      const pPr = pPrMatch ? pPrMatch[0] : ''

      const rRegex = /<a:r>([\s\S]*?)<\/a:r>/g
      let rMatch
      while ((rMatch = rRegex.exec(pInner)) !== null) {
        const rInner = rMatch[1]
        const rPrMatch = rInner.match(/<a:rPr[^>]*>[\s\S]*?<\/a:rPr>/)
        const rPr = rPrMatch ? rPrMatch[0] : ''

        if (rInner.includes('<a:br/>')) {
          runs.push({ text: '\n', rPr, pPr, type: 'br' })
        } else {
          const tMatch = rInner.match(/<a:t>([\s\S]*)<\/a:t>/)
          if (tMatch) {
            runs.push({ text: tMatch[1], rPr, pPr, type: 'text' })
          }
        }
      }
      // 段落末尾添加硬换行符
      runs.push({ text: '\n', rPr: '', pPr, type: 'br' })
    }
    if (runs.length > 0) runs.pop() // 移除最后一个多余的硬换行

    const originalText = runs.map(r => r.text).join('')

    // 2. 可靠替换
    let newText = originalText
    let matchCount = 0
    try {
      const searchRe = new RegExp(useRegex ? searchText : this.escapeRegExp(searchText), 'g')
      const matches = originalText.match(searchRe)
      if (matches) {
        matchCount = matches.length
        newText = originalText.replace(searchRe, replaceText)
      }
    } catch (e) {
      return { xml: shapeXml, count: 0 } // 正则无效
    }

    if (matchCount === 0) return { xml: shapeXml, count: 0 }

    // 3. 非破坏性重构
    const newRuns: Array<{ text: string, rPr: string, pPr: string, type: 'text' | 'br' }> = []
    let textCursor = 0
    for (const run of runs) {
      if (run.type === 'text' && run.text.length > 0) {
        const originalLength = run.text.length
        const newContent = newText.substring(textCursor, textCursor + originalLength)
        if (newContent) {
          newRuns.push({ ...run, text: newContent })
        }
        textCursor += originalLength
      } else {
        newRuns.push(run) // 保留换行符
      }
    }
    // 如果替换后文本变长，将多余部分追加到最后
    if (textCursor < newText.length) {
      const lastRun = runs[runs.length - 1]
      newRuns.push({ 
        text: newText.substring(textCursor), 
        rPr: lastRun?.rPr || '', 
        pPr: lastRun?.pPr || '', 
        type: 'text' 
      })
    }

    // 4. 生成最终 XML
    let newTxBodyInner = ''
    let currentParagraph = ''
    let currentPPr = newRuns.length > 0 ? newRuns[0].pPr : ''

    newRuns.forEach((run, i) => {
      const isHardBreak = run.type === 'br' && (i === 0 || newRuns[i-1].pPr !== run.pPr)
      if (isHardBreak) {
        newTxBodyInner += `<a:p>${currentPPr}${currentParagraph}<\/a:p>`
        currentParagraph = ''
        currentPPr = run.pPr
      } else if (run.type === 'br') { // Soft break
        currentParagraph += `<a:r>${run.rPr}<a:br\/><\/a:r>`
      } else { // Text run
        currentParagraph += `<a:r>${run.rPr}<a:t>${run.text}<\/a:t><\/a:r>`
      }
    })
    newTxBodyInner += `<a:p>${currentPPr}${currentParagraph}<\/a:p>`

    const finalShapeXml = shapeXml.replace(txBodyMatch[0], `<p:txBody>${newTxBodyInner}<\/p:txBody>`)

    return { xml: finalShapeXml, count: matchCount }
  }

  async replaceTextInSlide(
    document: PptxDocument,
    slideIndex: number,
    searchText: string,
    replaceText: string
  ): Promise<number> {
    const zip = document.zipArchive as any
    const slidePath = await this.getSlidePath(zip, slideIndex)
    if (!slidePath) return 0

    const slideFile = zip.file(slidePath)
    if (!slideFile) return 0

    const slideXml = slideFile.asText()
    const { xml: updatedXml, count } = this.replaceInTextNodes(slideXml, searchText, replaceText, false)
    if (count > 0 && updatedXml !== slideXml) {
      zip.file(slidePath, updatedXml)
    }

    return count
  }

  /**
   * 打开 PPTX 文件
   * @param filePath PPTX 文件路径
   * @returns PptxDocument 对象
   * @throws Error 如果文件不存在、格式错误或读取失败
   */
  async open(filePath: string): Promise<PptxDocument> {
    try {
      // 读取文件内容
      const data = await fs.readFile(filePath)
      
      // 使用 pizzip 解压 PPTX 文件（本质是 ZIP 格式）
      const zip = new PizZip(data)
      
      // 验证是否为有效的 PPTX 文件
      if (!this.isValidPptx(zip)) {
        throw new Error('Invalid PPTX file format')
      }
      
      // 解析元数据
      const metadata = await this.parseMetadata(zip)
      
      // 解析幻灯片
      const slides = await this.parseSlides(zip)
      
      return {
        filePath,
        slides,
        metadata,
        zipArchive: zip
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('ENOENT')) {
          throw new Error(`File not found: ${filePath}`)
        } else if (error.message.includes('Invalid PPTX')) {
          throw error
        } else {
          throw new Error(`Failed to open PPTX file: ${error.message}`)
        }
      }
      throw new Error('Failed to open PPTX file: Unknown error')
    }
  }

  /**
   * 保存 PPTX 文件
   * @param document PptxDocument 对象
   * @param outputPath 输出文件路径
   * @throws Error 如果保存失败
   */
  async save(document: PptxDocument, outputPath: string): Promise<void> {
    try {
      const zip = document.zipArchive as any
      
      // 更新元数据
      await this.updateMetadata(zip, document.metadata)
      
      // 生成 ZIP 文件内容
      const content = zip.generate({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: {
          level: 9
        }
      })
      
      // 先写入临时文件，再重命名（确保原子性和完整性）
      const tempPath = `${outputPath}.tmp`
      await fs.writeFile(tempPath, content, { flag: 'w' })
      
      // 确保临时文件完全写入磁盘
      const fileHandle = await fs.open(tempPath, 'r+')
      await fileHandle.sync()
      await fileHandle.close()
      
      // 重命名（原子操作）
      await fs.rename(tempPath, outputPath)
    } catch (error) {
      if (error instanceof Error) {
        // 文件被占用（通常是文件在其他程序中打开）
        if (error.message.includes('EBUSY') || error.message.includes('resource busy')) {
          const fileName = path.basename(outputPath)
          throw new Error(
            `文件被占用：${fileName}\n\n` +
            `可能的原因：\n` +
            `• 文件在PowerPoint中打开\n` +
            `• 文件在其他程序中使用\n` +
            `• 文件被系统锁定\n\n` +
            `解决方法：\n` +
            `1. 关闭所有打开该文件的程序\n` +
            `2. 如果覆盖原文件，请先关闭PowerPoint\n` +
            `3. 或者选择保存到新文件`
          )
        }
        // 权限不足
        else if (error.message.includes('EACCES') || error.message.includes('permission denied')) {
          throw new Error(`没有权限保存文件：${outputPath}\n请检查文件夹权限或以管理员身份运行`)
        }
        // 磁盘空间不足
        else if (error.message.includes('ENOSPC')) {
          throw new Error('磁盘空间不足，无法保存文件\n请清理磁盘空间后重试')
        }
        // 路径不存在
        else if (error.message.includes('ENOENT')) {
          throw new Error(`保存路径不存在：${outputPath}\n请检查输出目录是否存在`)
        }
        // 其他错误
        else {
          throw new Error(`保存文件失败：${error.message}`)
        }
      }
      throw new Error('保存文件失败：未知错误')
    }
  }

  /**
   * 获取幻灯片列表
   * @param document PptxDocument 对象
   * @returns 幻灯片数组
   */
  getSlides(document: PptxDocument): Slide[] {
    return document.slides
  }

  /**
   * 获取元数据
   * @param document PptxDocument 对象
   * @returns 元数据对象
   */
  getMetadata(document: PptxDocument): Metadata {
    return document.metadata
  }

  /**
   * 设置元数据
   * @param document PptxDocument 对象
   * @param metadata 要设置的元数据（支持部分更新）
   */
  setMetadata(document: PptxDocument, metadata: Partial<Metadata>): void {
    // 合并元数据，保留未指定的字段
    document.metadata = {
      ...document.metadata,
      ...metadata
    }
  }

  /**
   * 在幻灯片中查找文本
   * @param slide 幻灯片对象
   * @param searchText 要查找的文本
   * @returns 包含匹配文本的文本元素数组
   */
  findText(slide: Slide, searchText: string): TextElement[] {
    const matchedElements: TextElement[] = []
    
    // 遍历幻灯片中的所有元素
    for (const element of slide.elements) {
      // 只处理文本元素
      if (element.type === 'text') {
        const textElement = element as TextElement
        // 检查文本内容是否包含搜索文本
        if (textElement.content.includes(searchText)) {
          matchedElements.push(textElement)
        }
      }
    }
    
    return matchedElements
  }

  /**
   * 从幻灯片中提取所有图片元素
   * @param slide 幻灯片对象
   * @returns 图片元素数组，包含位置、大小和格式信息
   */
  getImages(slide: Slide): ImageElement[] {
    const imageElements: ImageElement[] = []
    
    // 遍历幻灯片中的所有元素
    for (const element of slide.elements) {
      // 只处理图片元素
      if (element.type === 'image') {
        const imageElement = element as ImageElement
        imageElements.push(imageElement)
      }
    }
    
    return imageElements
  }

  /**
   * 获取幻灯片中的图片并加载图片数据
   * @param document PptxDocument 对象
   * @param slide 幻灯片对象
   * @param slideIndex 幻灯片索引
   * @returns 包含图片数据的图片元素数组
   */
  async getImagesWithData(document: PptxDocument, slide: Slide, slideIndex: number): Promise<ImageElement[]> {
    const zip = document.zipArchive as any
    const imageElements: ImageElement[] = []
    
    // 遍历幻灯片中的所有图片元素
    for (const element of slide.elements) {
      if (element.type === 'image') {
        const imageElement = element as ImageElement
        
        // 加载图片数据
        if (imageElement.relationshipId) {
          const imagePath = this.findImagePath(zip, slideIndex, imageElement.relationshipId)
          
          if (imagePath) {
            const imageFile = zip.file(imagePath)
            if (imageFile) {
              // 加载图片数据为 Buffer
              const imageData = imageFile.asUint8Array()
              imageElement.imageData = Buffer.from(imageData)
              
              // 确定图片格式
              if (!imageElement.format) {
                const ext = imagePath.split('.').pop()?.toLowerCase()
                imageElement.format = (ext === 'jpg' || ext === 'png' || ext === 'gif') ? ext : 'png'
              }
            }
          }
        }
        
        imageElements.push(imageElement)
      }
    }
    
    return imageElements
  }

  /**
   * 删除元素
   * 支持删除指定图片和所有图片
   * @param document PptxDocument 对象
   * @param slide 幻灯片对象
   * @param element 要删除的元素（可选，如果不提供则删除所有图片）
   * @returns 删除的元素数量
   */
  async deleteElement(
    document: PptxDocument,
    slide: Slide,
    element?: Element
  ): Promise<number> {
    try {
      const zip = document.zipArchive as any
      
      // 查找幻灯片索引
      const slideIndex = document.slides.indexOf(slide)
      if (slideIndex === -1) {
        return 0
      }
      
      // 获取幻灯片文件路径
      const slidePath = await this.getSlidePath(zip, slideIndex)
      if (!slidePath) {
        return 0
      }
      
      // 读取幻灯片 XML
      const slideFile = zip.file(slidePath)
      if (!slideFile) {
        return 0
      }
      
      const slideXml = slideFile.asText()
      const slideData = await parseXml(slideXml)
      
      let deletedCount = 0
      
      // 如果指定了元素，删除该元素
      if (element) {
        if (element.type === 'image') {
          const deleted = await this.deleteImageElement(slideData, element as ImageElement)
          if (deleted) {
            deletedCount = 1
            // 从幻灯片的元素列表中移除
            const index = slide.elements.indexOf(element)
            if (index !== -1) {
              slide.elements.splice(index, 1)
            }
          }
        }
      } else {
        // 删除所有图片元素
        const imageElements = slide.elements.filter(e => e.type === 'image') as ImageElement[]
        for (const imgElement of imageElements) {
          const deleted = await this.deleteImageElement(slideData, imgElement)
          if (deleted) {
            deletedCount++
            // 从幻灯片的元素列表中移除
            const index = slide.elements.indexOf(imgElement)
            if (index !== -1) {
              slide.elements.splice(index, 1)
            }
          }
        }
      }
      
      // 如果有删除操作，保存更新后的 XML
      if (deletedCount > 0) {
        const builder = new Builder({
          xmldec: { version: '1.0', encoding: 'UTF-8', standalone: true }
        })
        const updatedXml = builder.buildObject(slideData)
        zip.file(slidePath, updatedXml)
      }
      
      return deletedCount
    } catch (error) {
      console.warn('Failed to delete element:', error)
      return 0
    }
  }

  /**
   * 从幻灯片 XML 中删除图片元素
   */
  private async deleteImageElement(slideData: any, element: ImageElement): Promise<boolean> {
    try {
      const slide = slideData['p:sld']
      if (!slide) return false
      
      const cSld = slide['p:cSld']?.[0]
      if (!cSld) return false
      
      const spTree = cSld['p:spTree']?.[0]
      if (!spTree) return false
      
      // 在主形状树中查找并删除图片
      const pics = spTree['p:pic'] || []
      for (let i = pics.length - 1; i >= 0; i--) {
        const pic = pics[i]
        if (this.isMatchingImageElement(pic, element)) {
          pics.splice(i, 1)
          return true
        }
      }
      
      // 在组合形状中查找并删除图片
      const grpSps = spTree['p:grpSp'] || []
      for (const grpSp of grpSps) {
        if (await this.deleteImageFromGroup(grpSp, element)) {
          return true
        }
      }
      
      return false
    } catch (error) {
      console.warn('Failed to delete image element from XML:', error)
      return false
    }
  }

  /**
   * 从组合形状中删除图片元素
   */
  private async deleteImageFromGroup(grpSp: any, element: ImageElement): Promise<boolean> {
    try {
      // 在组合中查找并删除图片
      const pics = grpSp['p:pic'] || []
      for (let i = pics.length - 1; i >= 0; i--) {
        const pic = pics[i]
        if (this.isMatchingImageElement(pic, element)) {
          pics.splice(i, 1)
          return true
        }
      }
      
      // 递归搜索嵌套的组合
      const nestedGrpSps = grpSp['p:grpSp'] || []
      for (const nestedGrpSp of nestedGrpSps) {
        if (await this.deleteImageFromGroup(nestedGrpSp, element)) {
          return true
        }
      }
      
      return false
    } catch (error) {
      console.warn('Failed to delete image from group:', error)
      return false
    }
  }

  /**
   * 检查 XML 中的图片元素是否与给定的图片元素匹配
   */
  private isMatchingImageElement(pic: any, element: ImageElement): boolean {
    try {
      const spPr = pic['p:spPr']?.[0]
      const xfrm = spPr?.['a:xfrm']?.[0]
      const off = xfrm?.['a:off']?.[0]
      const ext = xfrm?.['a:ext']?.[0]
      
      const position = {
        x: off?.$?.x ? parseInt(off.$.x) : 0,
        y: off?.$?.y ? parseInt(off.$.y) : 0
      }
      
      const size = {
        width: ext?.$?.cx ? parseInt(ext.$.cx) : 0,
        height: ext?.$?.cy ? parseInt(ext.$.cy) : 0
      }
      
      // 匹配位置和大小
      return position.x === element.position.x && 
             position.y === element.position.y &&
             size.width === element.size.width && 
             size.height === element.size.height
    } catch (error) {
      return false
    }
  }

  /**
   * 替换图片
   * @param document PPT 文档对象
   * @param imageElement 要替换的图片元素
   * @param newImageData 新图片数据
   * @param newImageExt 新图片扩展名
   * @param keepOriginalSize 是否保持原图片尺寸
   */

  /**
   * 验证是否为有效的 PPTX 文件
   */
  private isValidPptx(zip: any): boolean {
    try {
      // 检查必需的文件是否存在
      const requiredFiles = [
        '[Content_Types].xml',
        'ppt/presentation.xml'
      ]
      
      for (const file of requiredFiles) {
        if (!zip.file(file)) {
          return false
        }
      }
      
      return true
    } catch (error) {
      return false
    }
  }

  /**
   * 解析元数据
   */
  private async parseMetadata(zip: any): Promise<Metadata> {
    try {
      const corePropsFile = zip.file('docProps/core.xml')
      if (!corePropsFile) {
        return {}
      }
      
      const corePropsXml = corePropsFile.asText()
      const corePropsData = await parseXml(corePropsXml)
      
      const metadata: Metadata = {}
      
      // 提取常见元数据
      const props = corePropsData['cp:coreProperties']
      if (props) {
        if (props['dc:title']) metadata.title = props['dc:title'][0]
        if (props['dc:subject']) metadata.subject = props['dc:subject'][0]
        if (props['dc:creator']) metadata.author = props['dc:creator'][0]
        if (props['dc:description']) metadata.description = props['dc:description'][0]
        if (props['cp:keywords']) metadata.keywords = props['cp:keywords'][0]
        if (props['cp:lastModifiedBy']) metadata.lastModifiedBy = props['cp:lastModifiedBy'][0]
      }
      
      return metadata
    } catch (error) {
      console.warn('Failed to parse metadata:', error)
      return {}
    }
  }

  /**
   * 解析幻灯片
   */
  private async parseSlides(zip: any): Promise<Slide[]> {
    const slides: Slide[] = []
    
    try {
      // 获取所有幻灯片文件
      const slideFiles = Object.keys(zip.files).filter(name => 
        name.startsWith('ppt/slides/slide') && name.endsWith('.xml') && !name.includes('_rels')
      )
      
      // 按编号排序
      slideFiles.sort((a, b) => {
        const numA = parseInt(a.match(/slide(\d+)\.xml/)?.[1] || '0')
        const numB = parseInt(b.match(/slide(\d+)\.xml/)?.[1] || '0')
        return numA - numB
      })
      
      // 解析每个幻灯片
      for (const slideFile of slideFiles) {
        const slide = await this.parseSlide(zip, slideFile)
        if (slide) {
          slides.push(slide)
        }
      }
    } catch (error) {
      console.warn('Failed to parse slides:', error)
    }
    
    return slides
  }

  /**
   * 解析单个幻灯片
   */
  private async parseSlide(zip: any, slidePath: string): Promise<Slide | null> {
    try {
      console.log(`[DEBUG] Parsing slide: ${slidePath}`)
      const slideFile = zip.file(slidePath)
      if (!slideFile) {
        console.log(`[DEBUG] Slide file not found: ${slidePath}`)
        return null
      }
      
      const slideXml = slideFile.asText()
      const slideData = await parseXml(slideXml)
      
      const elements: Element[] = []
      
      // 从路径中提取索引
      const match = slidePath.match(/slide(\d+)\.xml/)
      const index = match ? parseInt(match[1]) - 1 : 0
      
      // 解析图片元素
      const slide = slideData['p:sld']
      if (slide) {
        console.log(`[DEBUG] Found p:sld element`)
        const cSld = slide['p:cSld']?.[0]
        if (cSld) {
          console.log(`[DEBUG] Found p:cSld element`)
          const spTree = cSld['p:spTree']?.[0]
          if (spTree) {
            console.log(`[DEBUG] Found p:spTree element`)
            
            // 解析形状（包含文本框）
            const shapes = spTree['p:sp'] || []
            console.log(`[DEBUG] Found ${shapes.length} shapes in main shape tree`)
            for (const shape of shapes) {
              const shapeElement = this.parseShapeElement(shape)
              if (shapeElement) {
                elements.push(shapeElement)
              }
            }
            
            // 解析主形状树中的图片
            const pics = spTree['p:pic'] || []
            console.log(`[DEBUG] Found ${pics.length} pictures in main shape tree`)
            for (const pic of pics) {
              const imageElement = this.parseImageElement(pic)
              if (imageElement) {
                console.log(`[DEBUG] Parsed image: ${imageElement.name}`)
                elements.push(imageElement)
              }
            }
            
            // 解析组合形状中的图片
            const grpSps = spTree['p:grpSp'] || []
            console.log(`[DEBUG] Found ${grpSps.length} group shapes`)
            for (const grpSp of grpSps) {
              const groupImages = this.parseImagesFromGroup(grpSp)
              console.log(`[DEBUG] Found ${groupImages.length} images in group`)
              elements.push(...groupImages)
            }
          } else {
            console.log(`[DEBUG] No p:spTree found`)
          }
        } else {
          console.log(`[DEBUG] No p:cSld found`)
        }
      } else {
        console.log(`[DEBUG] No p:sld found`)
      }
      
      console.log(`[DEBUG] Slide ${index}: Total ${elements.length} elements parsed`)
      const imageCount = elements.filter(e => e.type === 'image').length
      console.log(`[DEBUG] Slide ${index}: ${imageCount} images found`)
      
      return {
        index,
        elements,
        notes: '',
        background: undefined
      }
    } catch (error) {
      console.warn(`Failed to parse slide ${slidePath}:`, error)
      return null
    }
  }

  /**
   * 从 XML 中解析图片元素
   */
  private parseImageElement(pic: any): ImageElement | null {
    try {
      console.log(`[DEBUG] parseImageElement called`)
      
      // 获取图片位置和尺寸
      const spPr = pic['p:spPr']?.[0]
      const xfrm = spPr?.['a:xfrm']?.[0]
      const off = xfrm?.['a:off']?.[0]
      const ext = xfrm?.['a:ext']?.[0]
      
      const position = {
        x: off?.$?.x ? parseInt(off.$.x) : 0,
        y: off?.$?.y ? parseInt(off.$.y) : 0
      }
      
      const size = {
        width: ext?.$?.cx ? parseInt(ext.$.cx) : 0,
        height: ext?.$?.cy ? parseInt(ext.$.cy) : 0
      }
      
      // 获取图片关系 ID
      const blipFill = pic['p:blipFill']?.[0]
      const blip = blipFill?.['a:blip']?.[0]
      const relationshipId = blip?.$?.['r:embed'] || blip?.$?.['r:link']
      
      // 获取图片名称
      const nvPicPr = pic['p:nvPicPr']?.[0]
      const cNvPr = nvPicPr?.['p:cNvPr']?.[0]
      const name = cNvPr?.$?.name || 'Image'
      
      console.log(`[DEBUG] Parsed image element:`, {
        name,
        position,
        size,
        relationshipId
      })
      
      return {
        type: 'image',
        position,
        size,
        imageData: new Uint8Array(0), // 暂时为空，实际使用时会从 ZIP 中读取
        format: 'png', // 默认格式
        name,
        width: size.width,
        height: size.height,
        relationshipId
      }
    } catch (error) {
      console.warn('[DEBUG] Failed to parse image element:', error)
      return null
    }
  }

  /**
   * 从 XML 中解析形状元素（包含文本框和其他形状）
   */
  private parseShapeElement(shape: any): Element | null {
    try {
      // 获取形状的非可视属性
      const nvSpPr = shape['p:nvSpPr']?.[0]
      const cNvPr = nvSpPr?.['p:cNvPr']?.[0]
      const name = cNvPr?.$?.name || 'Shape'
      
      // 检查是否是占位符
      const nvPr = nvSpPr?.['p:nvPr']?.[0]
      const ph = nvPr?.['p:ph']?.[0]
      const isPlaceholder = !!ph
      
      // 获取文本内容
      const txBody = shape['p:txBody']?.[0]
      let textContent = ''
      
      if (txBody) {
        const paragraphs = txBody['a:p'] || []
        for (const para of paragraphs) {
          const runs = para['a:r'] || []
          for (const run of runs) {
            const text = run['a:t']?.[0]
            if (text) {
              textContent += text
            }
          }
        }
      }
      
      // 如果有文本内容，返回文本元素
      if (textContent.trim().length > 0) {
        return {
          type: 'text',
          content: textContent,
          name,
          placeholder: isPlaceholder
        } as any
      }
      
      // 如果没有文本但不是占位符，返回形状元素
      if (!isPlaceholder) {
        return {
          type: 'shape',
          name,
          placeholder: false
        } as any
      }
      
      // 占位符且没有内容，不算作元素
      return null
    } catch (error) {
      console.warn('[DEBUG] Failed to parse shape element:', error)
      return null
    }
  }

  /**
   * 从组合形状中解析图片
   */
  private parseImagesFromGroup(grpSp: any): ImageElement[] {
    const images: ImageElement[] = []
    
    try {
      // 解析组合中的图片
      const pics = grpSp['p:pic'] || []
      for (const pic of pics) {
        const imageElement = this.parseImageElement(pic)
        if (imageElement) {
          images.push(imageElement)
        }
      }
      
      // 递归解析嵌套的组合
      const nestedGrpSps = grpSp['p:grpSp'] || []
      for (const nestedGrpSp of nestedGrpSps) {
        const nestedImages = this.parseImagesFromGroup(nestedGrpSp)
        images.push(...nestedImages)
      }
    } catch (error) {
      console.warn('Failed to parse images from group:', error)
    }
    
    return images
  }

  /**
   * 更新元数据
   */
  private async updateMetadata(zip: any, metadata: Metadata): Promise<void> {
    try {
      const corePropsFile = zip.file('docProps/core.xml')
      if (!corePropsFile) return
      
      const corePropsXml = corePropsFile.asText()
      const corePropsData = await parseXml(corePropsXml)
      
      const props = corePropsData['cp:coreProperties']
      if (!props) return
      
      // 更新元数据
      if (metadata.title !== undefined) props['dc:title'] = [metadata.title]
      if (metadata.subject !== undefined) props['dc:subject'] = [metadata.subject]
      if (metadata.author !== undefined) props['dc:creator'] = [metadata.author]
      if (metadata.description !== undefined) props['dc:description'] = [metadata.description]
      if (metadata.keywords !== undefined) props['cp:keywords'] = [metadata.keywords]
      if (metadata.comments !== undefined) props['dc:description'] = [metadata.comments]
      
      // 构建新的 XML
      const builder = new Builder({
        xmldec: { version: '1.0', encoding: 'UTF-8', standalone: true }
      })
      const updatedXml = builder.buildObject(corePropsData)
      
      // 更新文件
      zip.file('docProps/core.xml', updatedXml)
    } catch (error) {
      console.warn('Failed to update metadata:', error)
    }
  }

  /**
   * 替换文本
   */
  async replaceText(
    document: PptxDocument,
    element: TextElement,
    searchText: string,
    replaceText: string
  ): Promise<boolean> {
    try {
      const slideIndex = (element as any)?.slideIndex
      if (typeof slideIndex === 'number') {
        const count = await this.replaceTextInSlide(document, slideIndex, searchText, replaceText)
        if (count > 0) {
          element.content = element.content.replace(new RegExp(this.escapeRegExp(searchText), 'g'), replaceText)
          return true
        }
        return false
      }

      // 没有 slideIndex 时，尝试对所有幻灯片执行替换
      let total = 0
      for (let i = 0; i < document.slides.length; i++) {
        total += await this.replaceTextInSlide(document, i, searchText, replaceText)
      }
      if (total > 0) {
        element.content = element.content.replace(new RegExp(this.escapeRegExp(searchText), 'g'), replaceText)
      }
      return total > 0
    } catch (error) {
      console.warn('Failed to replace text:', error)
      return false
    }
  }

  /**
   * 获取幻灯片路径
   */
  private async getSlidePath(zip: any, slideIndex: number): Promise<string | null> {
    const slidePath = `ppt/slides/slide${slideIndex + 1}.xml`
    return zip.file(slidePath) ? slidePath : null
  }

  async replaceImage(
    document: PptxDocument,
    slideIndex: number,
    imageElement: ImageElement,
    newImageData: Buffer,
    newImageExt: string,
    keepOriginalSize: boolean = true,
    replaceAllSameImages: boolean = false
  ): Promise<void> {
    console.log(`[DEBUG] replaceImage called for: ${imageElement.name} on slide ${slideIndex + 1}`)
    console.log(`[DEBUG] replaceAllSameImages: ${replaceAllSameImages}`)
    const zip = document.zipArchive as any
    
    // 获取图片的关系 ID
    const imageRid = imageElement.relationshipId
    console.log(`[DEBUG] Relationship ID: ${imageRid}`)
    
    if (!imageRid) {
      throw new Error('Image element does not have a relationship ID')
    }

    // 查找图片在 ZIP 中的路径（指定幻灯片索引）
    const imagePath = this.findImagePath(zip, slideIndex, imageRid)
    console.log(`[DEBUG] Image path in ZIP: ${imagePath}`)
    
    if (!imagePath) {
      throw new Error(`Image not found for relationship ID: ${imageRid}`)
    }

    // 验证路径是否为图片文件
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tif', '.tiff', '.svg', '.webp', '.emf', '.wmf']
    const isImageFile = imageExtensions.some(ext => imagePath.toLowerCase().endsWith(ext))
    
    if (!isImageFile) {
      console.log(`[DEBUG] ⚠️ Path is not an image file: ${imagePath}, skipping replacement`)
      return // 跳过非图片文件
    }

    if (replaceAllSameImages) {
      // 直接替换图片文件（所有引用该文件的图片都会被替换）
      console.log(`[DEBUG] Replacing image data (all same images), size: ${newImageData.length} bytes`)
      zip.file(imagePath, newImageData)
      console.log(`[DEBUG] Image data replaced successfully`)
    } else {
      // 创建新的图片文件，只替换当前页的图片
      console.log(`[DEBUG] Creating new image file (only this page)`)
      
      // 生成新的图片文件名
      const originalExt = path.extname(imagePath)
      const originalBasename = path.basename(imagePath, originalExt)
      const newImageName = `${originalBasename}_slide${slideIndex + 1}_${Date.now()}${originalExt}`
      const newImagePath = path.join(path.dirname(imagePath), newImageName).replace(/\\/g, '/')
      
      console.log(`[DEBUG] New image path: ${newImagePath}`)
      
      // 添加新图片到 ZIP
      zip.file(newImagePath, newImageData)
      
      // 更新关系文件，让当前幻灯片的图片指向新文件
      await this.updateImageRelationship(zip, slideIndex, imageRid, newImageName)
      
      console.log(`[DEBUG] Image replaced with new file successfully`)
    }

    // 如果不保持原尺寸，需要更新图片尺寸信息
    if (!keepOriginalSize) {
      // 这里可以使用 sharp 库获取新图片的尺寸
      // 暂时保持原尺寸
    }
  }

  /**
   * 更新图片关系，让幻灯片指向新的图片文件
   * @param zip ZIP 对象
   * @param slideIndex 幻灯片索引
   * @param relationshipId 关系 ID
   * @param newImageName 新图片文件名
   */
  private async updateImageRelationship(
    zip: any,
    slideIndex: number,
    relationshipId: string,
    newImageName: string
  ): Promise<void> {
    const slideRelsFile = `ppt/slides/_rels/slide${slideIndex + 1}.xml.rels`
    console.log(`[DEBUG] Updating relationship in ${slideRelsFile}`)
    
    const relsContent = zip.file(slideRelsFile)?.asText()
    if (!relsContent) {
      throw new Error(`Relationship file not found: ${slideRelsFile}`)
    }
    
    // 替换关系文件中的 Target 属性
    // 查找当前关系ID的Target，替换为新的图片文件名
    const relationshipRegex = new RegExp(
      `(<Relationship[^>]*Id="${relationshipId}"[^>]*Target=")([^"]+)("[^>]*/>)`,
      'i'
    )
    
    const newRelsContent = relsContent.replace(relationshipRegex, (match, prefix, oldTarget, suffix) => {
      console.log(`[DEBUG] Old target: ${oldTarget}`)
      // 保持相对路径结构，只替换文件名
      const newTarget = `../media/${newImageName}`
      console.log(`[DEBUG] New target: ${newTarget}`)
      return `${prefix}${newTarget}${suffix}`
    })
    
    // 更新关系文件
    zip.file(slideRelsFile, newRelsContent)
    console.log(`[DEBUG] Relationship updated successfully`)
  }

  /**
   * 查找图片在 ZIP 中的路径
   * @param zip ZIP 对象
   * @param relationshipId 关系 ID
   * @returns 图片路径
   * @version 2.0 - Fixed to only search slide relationship files
   */
  private findImagePath(zip: any, slideIndex: number, relationshipId: string): string | null {
    console.log(`[DEBUG] findImagePath: Looking for relationship ID: ${relationshipId} in slide ${slideIndex + 1}`)
    
    // 构建特定幻灯片的关系文件路径
    const slideRelsFile = `ppt/slides/_rels/slide${slideIndex + 1}.xml.rels`
    console.log(`[DEBUG] findImagePath: Checking ${slideRelsFile}`)
    
    try {
      const relsContent = zip.file(slideRelsFile)?.asText()
      if (!relsContent) {
        console.log(`[DEBUG] findImagePath: Relationship file not found: ${slideRelsFile}`)
        return null
      }
      
      // 解析关系文件，查找对应的图片路径
      const relationshipRegex = new RegExp(
        `<Relationship[^>]*Id="${relationshipId}"[^>]*Type="[^"]*image"[^>]*Target="([^"]+)"[^>]*/>`,
        'i'
      )
      let match = relationshipRegex.exec(relsContent)
      
      // 如果没有找到带 Type="image" 的，尝试不限制类型但检查扩展名
      if (!match) {
        const anyRelRegex = new RegExp(
          `<Relationship[^>]*Id="${relationshipId}"[^>]*Target="([^"]+)"[^>]*/>`,
          'i'
        )
        match = anyRelRegex.exec(relsContent)
        
        if (match && match[1]) {
          const target = match[1]
          const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tif', '.tiff', '.svg', '.webp']
          const hasImageExt = imageExtensions.some(ext => target.toLowerCase().endsWith(ext))
          
          if (!hasImageExt) {
            console.log(`[DEBUG] findImagePath: Target ${target} is not an image file, skipping`)
            return null
          }
        }
      }
      
      if (match && match[1]) {
        const target = match[1]
        console.log(`[DEBUG] findImagePath: Found target: ${target}`)
        
        const slideDir = path.dirname(slideRelsFile).replace('/_rels', '')
        let fullPath = path.join(slideDir, target).replace(/\\/g, '/')
        fullPath = path.normalize(fullPath).replace(/\\/g, '/')
        
        console.log(`[DEBUG] findImagePath: Full path: ${fullPath}`)
        
        if (zip.file(fullPath)) {
          console.log(`[DEBUG] findImagePath: File exists in ZIP`)
          return fullPath
        } else {
          console.log(`[DEBUG] findImagePath: File does not exist in ZIP: ${fullPath}`)
        }
      }
    } catch (error) {
      console.log(`[DEBUG] findImagePath: Error processing ${slideRelsFile}:`, error)
    }
    
    console.log(`[DEBUG] findImagePath: No match found for ${relationshipId} in slide ${slideIndex + 1}`)
    return null
  }
}
