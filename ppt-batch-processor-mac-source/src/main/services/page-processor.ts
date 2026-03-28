import { PptxParser } from './pptx-parser.js'
import type { PptxDocument, Slide } from '../../shared/types'
import { promises as fs } from 'fs'
import * as path from 'path'

/**
 * 页面处理器
 * 负责 PPT 页面操作：拆分、合并、删除、替换、插入
 */
export class PageProcessor {
  private parser: PptxParser

  constructor() {
    this.parser = new PptxParser()
  }

  /**
   * 拆分 PPT 文件
   * 按指定页数将 PPT 文件拆分为多个小文件
   * 
   * @param inputPath 输入 PPT 文件路径
   * @param outputDir 输出目录
   * @param pagesPerFile 每个文件的页数
   * @param fileNamePattern 文件名模式（可选），例如 "{name}_part{index}"
   * @returns 生成的文件路径数组
   * @throws Error 如果拆分失败
   */
  async splitPpt(
    inputPath: string,
    outputDir: string,
    pagesPerFile: number,
    fileNamePattern?: string
  ): Promise<string[]> {
    if (pagesPerFile <= 0) {
      throw new Error('Pages per file must be greater than 0')
    }

    try {
      const document = await this.parser.open(inputPath)
      const totalSlides = document.slides.length

      if (totalSlides <= pagesPerFile) {
        throw new Error('File has fewer slides than pages per file, no split needed')
      }

      await fs.mkdir(outputDir, { recursive: true })

      const fileCount = Math.ceil(totalSlides / pagesPerFile)
      const outputFiles: string[] = []

      const baseName = path.basename(inputPath, path.extname(inputPath))

      for (let i = 0; i < fileCount; i++) {
        const startIndex = i * pagesPerFile
        const endIndex = Math.min(startIndex + pagesPerFile, totalSlides)
        
        const slidesForFile = document.slides.slice(startIndex, endIndex)
        
        const outputFileName = this.generateFileName(
          baseName,
          i + 1,
          fileCount,
          fileNamePattern
        )
        const outputPath = path.join(outputDir, `${outputFileName}.pptx`)
        
        await this.createDocumentWithSlides(
          document,
          slidesForFile,
          outputPath
        )
        
        outputFiles.push(outputPath)
      }

      return outputFiles
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to split PPT: ${error.message}`)
      }
      throw new Error('Failed to split PPT: Unknown error')
    }
  }

  /**
   * 生成输出文件名
   * 
   * @param baseName 原始文件名（不含扩展名）
   * @param index 当前文件索引（从 1 开始）
   * @param total 总文件数
   * @param pattern 文件名模式（可选）
   * @returns 生成的文件名（不含扩展名）
   */
  private generateFileName(
    baseName: string,
    index: number,
    total: number,
    pattern?: string
  ): string {
    if (pattern) {
      return pattern
        .replace('{name}', baseName)
        .replace('{index}', index.toString())
        .replace('{total}', total.toString())
        .replace('{index:2}', index.toString().padStart(2, '0'))
        .replace('{index:3}', index.toString().padStart(3, '0'))
    }

    const paddedIndex = index.toString().padStart(total.toString().length, '0')
    return `${baseName}_part${paddedIndex}`
  }

  /**
   * 创建包含指定幻灯片的新文档
   * 
   * @param sourceDocument 源文档
   * @param slides 要包含的幻灯片数组
   * @param outputPath 输出文件路径
   */
  private async createDocumentWithSlides(
    sourceDocument: PptxDocument,
    slides: Slide[],
    outputPath: string
  ): Promise<void> {
    try {
      const PizZip = (await import('pizzip')).default
      const { parseString, Builder } = await import('xml2js')
      const { promisify } = await import('util')
      const parseXml = promisify(parseString)
      
      const newZip = new PizZip()
      const sourceZip = sourceDocument.zipArchive as InstanceType<typeof PizZip>
      
      const nonSlideFiles = Object.keys(sourceZip.files).filter(filePath => {
        return !filePath.startsWith('ppt/slides/slide') || !filePath.endsWith('.xml') || filePath.includes('_rels/')
      })
      
      for (const filePath of nonSlideFiles) {
        const file = sourceZip.file(filePath)
        if (file) {
          newZip.file(filePath, file.asNodeBuffer())
        }
      }
      
      const slideMappings: { [oldSlideNum: number]: number } = {}
      
      for (let i = 0; i < slides.length; i++) {
        const slide = slides[i]
        const oldSlideNum = slide.index + 1
        const newSlideNum = i + 1
        
        slideMappings[oldSlideNum] = newSlideNum
        
        const oldSlidePath = `ppt/slides/slide${oldSlideNum}.xml`
        const newSlidePath = `ppt/slides/slide${newSlideNum}.xml`
        const slideFile = sourceZip.file(oldSlidePath)
        
        if (slideFile) {
          newZip.file(newSlidePath, slideFile.asNodeBuffer())
        }
        
        const oldRelsPath = `ppt/slides/_rels/slide${oldSlideNum}.xml.rels`
        const newRelsPath = `ppt/slides/_rels/slide${newSlideNum}.xml.rels`
        const relsFile = sourceZip.file(oldRelsPath)
        
        if (relsFile) {
          newZip.file(newRelsPath, relsFile.asNodeBuffer())
        }
      }
      
      await this.updatePresentationXmlForNewDocument(newZip, slides.length, parseXml)
      await this.updatePresentationRelsForNewDocument(newZip, slides.length, parseXml)
      await this.updateContentTypesForNewDocument(newZip, slides.length, parseXml)
      
      const newDocument: PptxDocument = {
        filePath: outputPath,
        slides: slides.map((slide, index) => ({
          ...slide,
          index
        })),
        metadata: { ...sourceDocument.metadata },
        zipArchive: newZip
      }
      
      console.log(`[DEBUG] Saving document to: ${outputPath}`)
      await this.parser.save(newDocument, outputPath)
      console.log(`[DEBUG] Save completed`)
      
      // 验证文件是否存在
      const fs = await import('fs/promises')
      try {
        const stats = await fs.stat(outputPath)
        console.log(`[DEBUG] Output file exists, size: ${stats.size} bytes`)
      } catch (error) {
        console.error(`[DEBUG] Output file does NOT exist!`, error)
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to create document with slides: ${error.message}`)
      }
      throw new Error('Failed to create document with slides: Unknown error')
    }
  }

  /**
   * 合并多个 PPT 文件
   * 按文件列表顺序合并所有幻灯片
   * 
   * @param inputPaths 输入文件路径数组
   * @param outputPath 输出文件路径
   * @returns 合并后的文件路径
   * @throws Error 如果合并失败
   */
  async mergePpt(
    inputPaths: string[],
    outputPath: string
  ): Promise<string> {
    if (inputPaths.length === 0) {
      throw new Error('No input files provided')
    }

    if (inputPaths.length === 1) {
      throw new Error('At least two files are required for merging')
    }

    try {
      const fs = await import('fs/promises')
      const path = await import('path')
      const os = await import('os')
      const { execFile } = await import('child_process')
      const { promisify } = await import('util')
      const execFileAsync = promisify(execFile)

      console.log(`[DEBUG] Merging PPT files: ${inputPaths.join(', ')}`)
      console.log(`[DEBUG] Output path: ${outputPath}`)

      // 查找 LibreOffice 安装路径
      const libreOfficePaths = [
        'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
        'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
        'C:\\Program Files\\LibreOffice 7\\program\\soffice.exe',
        'C:\\Program Files\\LibreOffice 24.2\\program\\soffice.exe',
        '/usr/bin/libreoffice',
        '/usr/local/bin/libreoffice',
        '/Applications/LibreOffice.app/Contents/MacOS/soffice'
      ]

      let libreOfficePath = ''
      for (const testPath of libreOfficePaths) {
        try {
          await fs.access(testPath)
          libreOfficePath = testPath
          break
        } catch {
          continue
        }
      }

      const PizZip = (await import('pizzip')).default
      const { parseString, Builder } = await import('xml2js')
      const parseXml = promisify(parseString)

      // 打开第一个文件作为基础
      const baseDoc = await this.parser.open(inputPaths[0])
      const baseZip = baseDoc.zipArchive as InstanceType<typeof PizZip>
      
      let totalSlides = baseDoc.slides.length
      const allSlides = [...baseDoc.slides]

      console.log(`[DEBUG] Base file has ${totalSlides} slides`)

      const requiredDirs = [
        'ppt/slides',
        'ppt/slides/_rels',
        'ppt/notesSlides',
        'ppt/notesSlides/_rels',
        'ppt/media',
        'ppt/theme',
        'ppt/slideMasters',
        'ppt/slideLayouts'
      ]
      
      for (const dir of requiredDirs) {
        if (!baseZip.file(dir + '/')) {
          console.log(`[DEBUG] Creating directory: ${dir}`)
          baseZip.file(dir + '/', '')
        }
      }

      // 逐个合并其他文件
      for (let fileIdx = 1; fileIdx < inputPaths.length; fileIdx++) {
        const sourcePath = inputPaths[fileIdx]
        console.log(`[DEBUG] Merging file ${fileIdx + 1}: ${sourcePath}`)
        
        const sourceDoc = await this.parser.open(sourcePath)
        const sourceZip = sourceDoc.zipArchive as InstanceType<typeof PizZip>
        const normalizeTargetPath = (target: string) => {
          let resolved = target
          if (resolved.startsWith('../')) {
            resolved = resolved.replace('../', 'ppt/')
          } else if (!resolved.startsWith('ppt/')) {
            resolved = `ppt/${resolved}`
          }
          return resolved
        }
        const copiedPaths = new Set<string>()
        const copyPartWithRels = async (partPath: string) => {
          if (copiedPaths.has(partPath)) {
            return
          }
          const partFile = sourceZip.file(partPath)
          if (!partFile) {
            return
          }
          if (!baseZip.file(partPath)) {
            baseZip.file(partPath, partFile.asNodeBuffer())
          }
          copiedPaths.add(partPath)

          const relsPath = partPath.replace(/\/([^\/]+)$/, '/_rels/$1.rels')
          if (copiedPaths.has(relsPath)) {
            return
          }
          const relsFile = sourceZip.file(relsPath)
          if (!relsFile) {
            return
          }
          if (!baseZip.file(relsPath)) {
            baseZip.file(relsPath, relsFile.asNodeBuffer())
          }
          copiedPaths.add(relsPath)
          try {
            const relsXml = relsFile.asText()
            const relsData = await parseXml(relsXml as any) as any
            const relationships = relsData.Relationships?.Relationship || []
            for (const rel of relationships) {
              const target = rel.$?.Target
              if (!target) {
                continue
              }
              const targetPath = normalizeTargetPath(target)
              await copyPartWithRels(targetPath)
            }
          } catch (e) {
            console.warn('Failed to copy related parts:', e)
          }
        }
        
        console.log(`[DEBUG] Source file has ${sourceDoc.slides.length} slides`)
        
        for (let slideIdx = 0; slideIdx < sourceDoc.slides.length; slideIdx++) {
          totalSlides++
          const sourceSlideNum = slideIdx + 1
          const targetSlideNum = totalSlides
          
          console.log(`[DEBUG] Processing slide ${sourceSlideNum} -> ${targetSlideNum}`)
          
          // 复制幻灯片文件
          const slidePath = `ppt/slides/slide${sourceSlideNum}.xml`
          const slideFile = sourceZip.file(slidePath)
          if (slideFile) {
            console.log(`[DEBUG] Copying slide file: ${slidePath} -> ppt/slides/slide${targetSlideNum}.xml`)
            baseZip.file(`ppt/slides/slide${targetSlideNum}.xml`, slideFile.asNodeBuffer())
          }
          
          // 复制关系文件
          const relsPath = `ppt/slides/_rels/slide${sourceSlideNum}.xml.rels`
          const relsFile = sourceZip.file(relsPath)
          if (relsFile) {
            console.log(`[DEBUG] Copying rels file: ${relsPath} -> ppt/slides/_rels/slide${targetSlideNum}.xml.rels`)
            baseZip.file(`ppt/slides/_rels/slide${targetSlideNum}.xml.rels`, relsFile.asNodeBuffer())
          }
          
          // 复制备注
          const notesPath = `ppt/notesSlides/notesSlide${sourceSlideNum}.xml`
          const notesFile = sourceZip.file(notesPath)
          if (notesFile) {
            console.log(`[DEBUG] Copying notes file: ${notesPath} -> ppt/notesSlides/notesSlide${targetSlideNum}.xml`)
            baseZip.file(`ppt/notesSlides/notesSlide${targetSlideNum}.xml`, notesFile.asNodeBuffer())
            
            const notesRelsPath = `ppt/notesSlides/_rels/notesSlide${sourceSlideNum}.xml.rels`
            const notesRelsFile = sourceZip.file(notesRelsPath)
            if (notesRelsFile) {
              console.log(`[DEBUG] Copying notes rels file: ${notesRelsPath} -> ppt/notesSlides/_rels/notesSlide${targetSlideNum}.xml.rels`)
              baseZip.file(`ppt/notesSlides/_rels/notesSlide${targetSlideNum}.xml.rels`, notesRelsFile.asNodeBuffer())
            }
          }
          
          // 复制媒体文件
          if (relsFile) {
            try {
              const relsXml = relsFile.asText()
              const relsData = await parseXml(relsXml) as any
              const relationships = relsData.Relationships?.Relationship || []
              
              console.log(`[DEBUG] Found ${relationships.length} relationships in slide rels`)
              
              for (const rel of relationships) {
                const target = rel.$?.Target
                if (target) {
                  const mediaPath = normalizeTargetPath(target)
                  await copyPartWithRels(mediaPath)
                }
              }
            } catch (e) {
              console.warn('Failed to copy media files for slide', targetSlideNum, e)
            }
          }
          
          try {
            const themeFiles = Object.keys(sourceZip.files).filter(filePath => 
              filePath.startsWith('ppt/theme/') && filePath.endsWith('.xml')
            )
            for (const themeFile of themeFiles) {
              if (!baseZip.file(themeFile)) {
                const file = sourceZip.file(themeFile)
                if (file) {
                  console.log(`[DEBUG] Copying theme file: ${themeFile}`)
                  baseZip.file(themeFile, file.asNodeBuffer())
                }
              }
            }
            
            const masterFiles = Object.keys(sourceZip.files).filter(filePath => 
              filePath.startsWith('ppt/slideMasters/') && filePath.endsWith('.xml')
            )
            for (const masterFile of masterFiles) {
              if (!baseZip.file(masterFile)) {
                const file = sourceZip.file(masterFile)
                if (file) {
                  console.log(`[DEBUG] Copying master file: ${masterFile}`)
                  baseZip.file(masterFile, file.asNodeBuffer())
                }
              }
            }
            
            const layoutFiles = Object.keys(sourceZip.files).filter(filePath => 
              filePath.startsWith('ppt/slideLayouts/') && filePath.endsWith('.xml')
            )
            for (const layoutFile of layoutFiles) {
              if (!baseZip.file(layoutFile)) {
                const file = sourceZip.file(layoutFile)
                if (file) {
                  console.log(`[DEBUG] Copying layout file: ${layoutFile}`)
                  baseZip.file(layoutFile, file.asNodeBuffer())
                }
              }
            }

            const relsFiles = Object.keys(sourceZip.files).filter(filePath =>
              (filePath.startsWith('ppt/slideMasters/_rels/') ||
               filePath.startsWith('ppt/slideLayouts/_rels/') ||
               filePath.startsWith('ppt/theme/_rels/')) &&
              filePath.endsWith('.rels')
            )

            for (const relsPath of relsFiles) {
              if (!baseZip.file(relsPath)) {
                const relsFile = sourceZip.file(relsPath)
                if (relsFile) {
                  console.log(`[DEBUG] Copying rels file: ${relsPath}`)
                  baseZip.file(relsPath, relsFile.asNodeBuffer())
                }
              }
              try {
                const sourceRelsFile = sourceZip.file(relsPath)
                if (!sourceRelsFile) {
                  continue
                }
                const relsXml = sourceRelsFile.asText()
                const relsData = await parseXml(relsXml as any) as any
                const relationships = relsData.Relationships?.Relationship || []
                for (const rel of relationships) {
                  const target = rel.$?.Target
                  if (!target) {
                    continue
                  }
                  const mediaPath = normalizeTargetPath(target as string)
                  await copyPartWithRels(mediaPath)
                }
              } catch (e) {
                console.warn('Failed to copy media files for master/layout/theme rels:', e)
              }
            }
          } catch (e) {
            console.warn('Failed to copy theme/master/layout files:', e)
          }
          
          allSlides.push({
            ...sourceDoc.slides[slideIdx],
            index: totalSlides - 1
          })
        }
      }

      baseDoc.slides = allSlides
      console.log(`[DEBUG] Total slides after merge: ${totalSlides}`)

      console.log(`[DEBUG] Rebuilding presentation.xml and rels`)
      await this.rebuildPresentationForMerge(baseZip, parseXml, totalSlides)

      console.log(`[DEBUG] Updating [Content_Types].xml`)
      await this.updateContentTypes(baseZip, parseXml, totalSlides)

      console.log(`[DEBUG] Saving merged file: ${outputPath}`)
      await this.parser.save(baseDoc, outputPath)

      // 使用 LibreOffice 验证和修复文件（如果可用）
      if (libreOfficePath) {
        console.log('Validating with LibreOffice...')
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ppt-merge-'))
        
        try {
          await execFileAsync(libreOfficePath, [
            '--headless',
            '--convert-to', 'pptx',
            '--outdir', tempDir,
            outputPath
          ], { timeout: 30000 })
          
          // 如果验证成功，使用验证后的文件
          const validatedFile = path.join(tempDir, path.basename(outputPath))
          try {
            await fs.access(validatedFile)
            await fs.copyFile(validatedFile, outputPath)
            console.log('File validated and repaired by LibreOffice')
          } catch {
            console.log('Using original merged file')
          }
        } catch (e) {
          console.warn('LibreOffice validation failed, using original file:', e)
        } finally {
          try {
            await fs.rm(tempDir, { recursive: true, force: true })
          } catch (e) {
            console.warn('Failed to clean up temp directory:', e)
          }
        }
      } else {
        console.log('LibreOffice not found, skipping validation')
      }

      try {
        console.log(`[DEBUG] Validating merged file`)
        const mergedDoc = await this.parser.open(outputPath)
        console.log(`[DEBUG] Merged file validated successfully, has ${mergedDoc.slides.length} slides`)
      } catch (error) {
        console.warn('Warning: Merged file validation failed:', error)
      }

      console.log('PPT files merged successfully')
      return outputPath
    } catch (error) {
      console.error('Error merging PPT files:', error)
      if (error instanceof Error) {
        throw new Error(`Failed to merge PPT files: ${error.message}`)
      }
      throw new Error('Failed to merge PPT files: Unknown error')
    }
  }

  /**
   * 重建 presentation.xml 和 rels（用于合并操作）
   * 
   * @param zip ZIP 归档对象
   * @param parseXml XML 解析函数
   * @param totalSlides 总幻灯片数
   */
  private async rebuildPresentationForMerge(
    zip: any,
    parseXml: any,
    totalSlides: number
  ): Promise<void> {
    const Builder = (await import('xml2js')).Builder

    // 先重建 rels 文件，获取正确的 rId 映射
    const rIdMapping = await this.rebuildPresentationRels(zip, parseXml, totalSlides)

    const presentationFile = zip.file('ppt/presentation.xml')
    if (!presentationFile) {
      throw new Error('presentation.xml not found')
    }

    const presentationXml = presentationFile.asText()
    const presentationData = await parseXml(presentationXml)

    const presentation = presentationData['p:presentation']
    if (!presentation) {
      throw new Error('Invalid presentation.xml structure')
    }

    const sldIdLst = presentation['p:sldIdLst']?.[0]
    if (!sldIdLst) {
      throw new Error('Slide ID list not found')
    }

    const newSlideIds = []
    let slideId = 256

    for (let i = 0; i < totalSlides; i++) {
      newSlideIds.push({
        $: {
          id: slideId.toString(),
          'r:id': rIdMapping[i]
        }
      })
      slideId++
    }

    sldIdLst['p:sldId'] = newSlideIds

    const builder = new Builder({
      xmldec: { version: '1.0', encoding: 'UTF-8', standalone: true },
      headless: false,
      renderOpts: {
        pretty: false,
        indent: '',
        newline: ''
      }
    })
    const updatedXml = builder.buildObject(presentationData)
    zip.file('ppt/presentation.xml', updatedXml)
  }

  /**
   * 重建 presentation.xml.rels
   * 
   * @param zip ZIP 归档对象
   * @param parseXml XML 解析函数
   * @param slideCount 幻灯片数量
   * @returns rId 映射数组，用于 presentation.xml 中的引用
   */
  private async rebuildPresentationRels(
    zip: any,
    parseXml: any,
    slideCount: number
  ): Promise<string[]> {
    const Builder = (await import('xml2js')).Builder
    const relsPath = 'ppt/_rels/presentation.xml.rels'

    const relsFile = zip.file(relsPath)
    if (!relsFile) {
      throw new Error('presentation.xml.rels not found')
    }

    const relsXml = relsFile.asText()
    const relsData = await parseXml(relsXml)

    const relationships = relsData.Relationships?.Relationship || []
    const slideRelType = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide'
    const nonSlideRels = relationships.filter((rel: any) => {
      const type = rel.$?.Type || ''
      return type !== slideRelType
    })

    let maxRid = 1
    for (const rel of nonSlideRels) {
      const id = rel.$?.Id || ''
      const match = id.match(/rId(\d+)/)
      if (match) {
        const num = parseInt(match[1])
        if (num > maxRid) {
          maxRid = num
        }
      }
    }

    const newRelationships = [...nonSlideRels]
    const rIdMapping: string[] = []
    let currentRid = maxRid
    
    for (let i = 1; i <= slideCount; i++) {
      currentRid++
      const rId = `rId${currentRid}`
      rIdMapping.push(rId)
      newRelationships.push({
        $: {
          Id: rId,
          Type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide',
          Target: `slides/slide${i}.xml`
        }
      })
    }

    relsData.Relationships.Relationship = newRelationships

    const builder = new Builder({
      xmldec: { version: '1.0', encoding: 'UTF-8', standalone: true },
      headless: false,
      renderOpts: {
        pretty: true,
        indent: '  ',
        newline: '\n'
      }
    })
    const updatedRelsXml = builder.buildObject(relsData)
    zip.file(relsPath, updatedRelsXml)
    
    return rIdMapping
  }

  /**
   * 更新 [Content_Types].xml
   */
  private async updateContentTypes(
    zip: any,
    parseXml: any,
    totalSlides: number
  ): Promise<void> {
    const Builder = (await import('xml2js')).Builder
    const contentTypesPath = '[Content_Types].xml'
    
    const contentTypesFile = zip.file(contentTypesPath)
    if (!contentTypesFile) {
      return
    }

    const contentTypesXml = contentTypesFile.asText()
    const contentTypesData = await parseXml(contentTypesXml)

    const overrides = contentTypesData.Types.Override || []
    
    console.log(`[Content_Types] Original overrides: ${overrides.length}`)
    
    // 移除所有幻灯片和备注相关的旧条目
    const filteredOverrides = overrides.filter((override: any) => {
      const partName = override.$?.PartName || ''
      const isSlide = partName.match(/\/slides?\/slide\d+\.xml$/)
      const isNotes = partName.match(/\/notesSlides\/notesSlide\d+\.xml$/)
      if (isSlide || isNotes) {
        console.log(`[Content_Types] Removing: ${partName}`)
      }
      return !isSlide && !isNotes
    })
    
    console.log(`[Content_Types] After filtering: ${filteredOverrides.length}`)

    const existingPartNames = new Set(
      filteredOverrides.map((override: any) => override.$?.PartName).filter(Boolean)
    )
    const addOverride = (partName: string, contentType: string) => {
      if (existingPartNames.has(partName)) {
        return
      }
      filteredOverrides.push({
        $: {
          PartName: partName,
          ContentType: contentType
        }
      })
      existingPartNames.add(partName)
    }
    
    for (let i = 1; i <= totalSlides; i++) {
      addOverride(
        `/ppt/slides/slide${i}.xml`,
        'application/vnd.openxmlformats-officedocument.presentationml.slide+xml'
      )
      console.log(`[Content_Types] Adding: /ppt/slides/slide${i}.xml`)
      
      // 检查是否存在备注文件，如果存在则添加条目
      const notesPath = `ppt/notesSlides/notesSlide${i}.xml`
      if (zip.file(notesPath)) {
        addOverride(
          `/ppt/notesSlides/notesSlide${i}.xml`,
          'application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml'
        )
        console.log(`[Content_Types] Adding: /ppt/notesSlides/notesSlide${i}.xml`)
      }
    }

    const allFiles = Object.keys(zip.files)
    const slideMasterFiles = allFiles.filter(filePath => /^ppt\/slideMasters\/slideMaster\d+\.xml$/.test(filePath))
    for (const filePath of slideMasterFiles) {
      addOverride(
        `/${filePath}`,
        'application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml'
      )
    }

    const slideLayoutFiles = allFiles.filter(filePath => /^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(filePath))
    for (const filePath of slideLayoutFiles) {
      addOverride(
        `/${filePath}`,
        'application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml'
      )
    }

    const themeFiles = allFiles.filter(filePath => /^ppt\/theme\/theme\d+\.xml$/.test(filePath))
    for (const filePath of themeFiles) {
      addOverride(
        `/${filePath}`,
        'application/vnd.openxmlformats-officedocument.theme+xml'
      )
    }

    const notesMasterFiles = allFiles.filter(filePath => /^ppt\/notesMasters\/notesMaster\d+\.xml$/.test(filePath))
    for (const filePath of notesMasterFiles) {
      addOverride(
        `/${filePath}`,
        'application/vnd.openxmlformats-officedocument.presentationml.notesMaster+xml'
      )
    }

    const handoutMasterFiles = allFiles.filter(filePath => /^ppt\/handoutMasters\/handoutMaster\d+\.xml$/.test(filePath))
    for (const filePath of handoutMasterFiles) {
      addOverride(
        `/${filePath}`,
        'application/vnd.openxmlformats-officedocument.presentationml.handoutMaster+xml'
      )
    }

    console.log(`[Content_Types] Final overrides: ${filteredOverrides.length}`)

    contentTypesData.Types.Override = filteredOverrides

    const builder = new Builder({
      xmldec: { version: '1.0', encoding: 'UTF-8', standalone: true },
      headless: false,
      renderOpts: {
        pretty: true,
        indent: '  ',
        newline: '\n'
      }
    })
    const updatedXml = builder.buildObject(contentTypesData)
    zip.file(contentTypesPath, updatedXml)
  }

  /**
   * 更新 presentation.xml 中的幻灯片引用（用于新文档）
   */
  private async updatePresentationXmlForNewDocument(
    zip: any,
    totalSlides: number,
    parseXml: any
  ): Promise<void> {
    const presentationFile = zip.file('ppt/presentation.xml')
    if (!presentationFile) {
      throw new Error('presentation.xml not found')
    }

    let presentationXml = presentationFile.asText()

    // 获取现有的 rId 最大值
    const relsFile = zip.file('ppt/_rels/presentation.xml.rels')
    let maxRid = 1
    if (relsFile) {
      const relsXml = relsFile.asText()
      const ridMatches = relsXml.matchAll(/rId(\d+)/g)
      for (const match of ridMatches) {
        const num = parseInt(match[1])
        if (num > maxRid) {
          maxRid = num
        }
      }
    }

    // 使用字符串操作替换 sldIdLst 内容，保留所有命名空间和属性
    const sldIdLstMatch = presentationXml.match(/<p:sldIdLst[^>]*>([\s\S]*?)<\/p:sldIdLst>/)
    if (!sldIdLstMatch) {
      throw new Error('Slide ID list not found')
    }

    // 生成新的 slide ID 列表
    let newSlideIdsXml = ''
    let slideId = 256
    for (let i = 0; i < totalSlides; i++) {
      maxRid++
      newSlideIdsXml += `<p:sldId id="${slideId}" r:id="rId${maxRid}"/>`
      slideId++
    }

    // 替换 sldIdLst 内容
    presentationXml = presentationXml.replace(
      /<p:sldIdLst[^>]*>[\s\S]*?<\/p:sldIdLst>/,
      `<p:sldIdLst>${newSlideIdsXml}</p:sldIdLst>`
    )

    zip.file('ppt/presentation.xml', presentationXml)
  }

  /**
   * 更新 presentation.xml.rels 中的幻灯片引用（用于新文档）
   */
  private async updatePresentationRelsForNewDocument(
    zip: any,
    totalSlides: number,
    parseXml: any
  ): Promise<void> {
    const relsPath = 'ppt/_rels/presentation.xml.rels'

    const relsFile = zip.file(relsPath)
    if (!relsFile) {
      throw new Error('presentation.xml.rels not found')
    }

    let relsXml = relsFile.asText()

    // 移除所有 slide 关系
    relsXml = relsXml.replace(/<Relationship[^>]*Type="[^"]*\/slide"[^>]*\/>/g, '')

    // 获取现有的 rId 最大值
    let maxRid = 1
    const ridMatches = relsXml.matchAll(/Id="rId(\d+)"/g)
    for (const match of ridMatches) {
      const num = parseInt(match[1])
      if (num > maxRid) {
        maxRid = num
      }
    }

    // 生成新的 slide 关系
    let newSlideRelsXml = ''
    for (let i = 1; i <= totalSlides; i++) {
      maxRid++
      newSlideRelsXml += `<Relationship Id="rId${maxRid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i}.xml"/>`
    }

    // 在 </Relationships> 之前插入新的 slide 关系
    relsXml = relsXml.replace('</Relationships>', `${newSlideRelsXml}</Relationships>`)

    zip.file(relsPath, relsXml)
  }

  /**
   * 更新 [Content_Types].xml 中的幻灯片引用（用于新文档）
   */
  private async updateContentTypesForNewDocument(
    zip: any,
    totalSlides: number,
    parseXml: any
  ): Promise<void> {
    const contentTypesPath = '[Content_Types].xml'

    const contentTypesFile = zip.file(contentTypesPath)
    if (!contentTypesFile) {
      return
    }

    let contentTypesXml = contentTypesFile.asText()

    // 移除所有 slide 相关的 Override
    contentTypesXml = contentTypesXml.replace(/<Override[^>]*PartName="\/ppt\/slides\/slide\d+\.xml"[^>]*\/>/g, '')

    // 生成新的 slide Override 条目
    let newOverridesXml = ''
    for (let i = 1; i <= totalSlides; i++) {
      newOverridesXml += `<Override PartName="/ppt/slides/slide${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`
    }

    // 在 </Types> 之前插入新的 Override
    contentTypesXml = contentTypesXml.replace('</Types>', `${newOverridesXml}</Types>`)

    zip.file(contentTypesPath, contentTypesXml)
  }

  /**
   * 提取指定范围的幻灯片
   * 
   * @param inputPath 输入 PPT 文件路径
   * @param outputPath 输出 PPT 文件路径
   * @param startPage 起始页码（从 1 开始）
   * @param endPage 结束页码（从 1 开始）
   * @returns 提取的幻灯片数量
   * @throws Error 如果提取失败
   */
  async extractPages(
    inputPath: string,
    outputPath: string,
    startPage: number,
    endPage: number
  ): Promise<number> {
    try {
      const document = await this.parser.open(inputPath)
      const totalSlides = document.slides.length

      if (startPage < 1 || endPage > totalSlides || startPage > endPage) {
        throw new Error(`Invalid page range: ${startPage}-${endPage}. Total slides: ${totalSlides}`)
      }

      const startIndex = startPage - 1
      const endIndex = endPage - 1
      const slidesToExtract = document.slides.slice(startIndex, endIndex + 1)

      await this.createDocumentWithSlides(document, slidesToExtract, outputPath)

      return slidesToExtract.length
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to extract pages: ${error.message}`)
      }
      throw new Error('Failed to extract pages: Unknown error')
    }
  }

  /**
   * 验证 PPT 文件是否有效
   * 
   * @param filePath PPT 文件路径
   * @returns 是否有效
   */
  async isValidPpt(
    filePath: string
  ): Promise<boolean> {
    try {
      const document = await this.parser.open(filePath)
      return document.slides.length > 0
    } catch (error) {
      return false
    }
  }

  /**
   * 获取 PPT 文件的幻灯片数量
   * 
   * @param filePath PPT 文件路径
   * @returns 幻灯片数量
   * @throws Error 如果文件无效
   */
  async getSlideCount(
    filePath: string
  ): Promise<number> {
    try {
      const document = await this.parser.open(filePath)
      return document.slides.length
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to get slide count: ${error.message}`)
      }
      throw new Error('Failed to get slide count: Unknown error')
    }
  }

  /**
   * 修复 PPT 文件
   * 使用 LibreOffice 修复损坏的 PPT 文件
   * 
   * @param inputPath 输入 PPT 文件路径
   * @param outputPath 输出 PPT 文件路径
   * @returns 是否修复成功
   */
  async repairPpt(
    inputPath: string,
    outputPath: string
  ): Promise<boolean> {
    try {
      const { execSync } = await import('child_process')
      
      try {
        execSync('soffice --version', { stdio: 'ignore' })
      } catch (error) {
        console.warn('LibreOffice not found, skipping repair')
        return false
      }

      const command = `soffice --headless --convert-to pptx "${inputPath}" --outdir "${path.dirname(outputPath)}"`
      execSync(command, { stdio: 'ignore' })

      const convertedPath = path.join(path.dirname(outputPath), `${path.basename(inputPath, path.extname(inputPath))}.pptx`)
      if (convertedPath !== outputPath) {
        await fs.copyFile(convertedPath, outputPath)
        await fs.unlink(convertedPath)
      }

      return true
    } catch (error) {
      console.warn('Failed to repair PPT file:', error)
      return false
    }
  }

  /**
   * 删除指定页面
   * 
   * @param inputPath 输入文件路径
   * @param outputPath 输出文件路径
   * @param pageRange 页码范围，例如 "1-3,5,7-9"
   * @returns 删除的页面数量
   * @throws Error 如果删除失败
   */
  async deletePages(
    inputPath: string,
    outputPath: string,
    pageRange: string
  ): Promise<number> {
    try {
      const document = await this.parser.open(inputPath)
      const totalSlides = document.slides.length

      // 解析页码范围
      const pageIndices = this.parsePageRange(pageRange, totalSlides)

      // 过滤掉要删除的页面，保留剩余页面
      const remainingSlides = document.slides.filter((_, index) => !pageIndices.includes(index))
      
      // 创建包含剩余页面的新文档
      await this.createDocumentWithSlides(document, remainingSlides, outputPath)

      return pageIndices.length
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to delete pages: ${error.message}`)
      }
      throw new Error('Failed to delete pages: Unknown error')
    }
  }

  /**
   * 替换指定页面
   * 用源页面的内容替换目标文件中的指定页面
   * 
   * @param targetPath 目标文件路径
   * @param sourcePath 源文件路径（包含要用于替换的页面）
   * @param targetPageRange 目标文件中要替换的页码范围，例如 "1-3,5"
   * @param sourcePageRange 源文件中用于替换的页码范围，例如 "2-4,6"
   * @param outputPath 输出文件路径
   * @returns 替换的页面数量
   * @throws Error 如果替换失败或页码范围不匹配
   */
  async replacePages(
    targetPath: string,
    sourcePath: string,
    targetPageRange: string,
    sourcePageRange: string,
    outputPath: string
  ): Promise<number> {
    try {
      console.log('=== Replace Pages Debug ===')
      console.log('Target file:', targetPath)
      console.log('Source file:', sourcePath)
      console.log('Target page range:', targetPageRange)
      console.log('Source page range:', sourcePageRange)
      console.log('Output file:', outputPath)
      
      // 打开目标文件和源文件
      const targetDoc = await this.parser.open(targetPath)
      const sourceDoc = await this.parser.open(sourcePath)
      
      console.log('Target doc slides:', targetDoc.slides.length)
      console.log('Source doc slides:', sourceDoc.slides.length)

      // 解析页码范围
      const targetIndices = this.parsePageRange(targetPageRange, targetDoc.slides.length)
      const sourceIndices = this.parsePageRange(sourcePageRange, sourceDoc.slides.length)
      
      console.log('Target indices:', targetIndices)
      console.log('Source indices:', sourceIndices)

      // 验证页码范围数量是否匹配
      if (targetIndices.length !== sourceIndices.length) {
        throw new Error(
          `Page range mismatch: target has ${targetIndices.length} pages, source has ${sourceIndices.length} pages`
        )
      }

      // 获取源页面
      const sourceSlides = sourceIndices.map(index => sourceDoc.slides[index])
      console.log('Source slides to copy:', sourceSlides.length)

      // 复制源文件的媒体资源到目标文件
      console.log('Copying media from source...')
      await this.copyMediaFromSource(sourceDoc, targetDoc, sourceSlides)

      // 替换目标页面
      console.log('Replacing target pages...')
      const PizZip = (await import('pizzip')).default
      const sourceZip = sourceDoc.zipArchive as InstanceType<typeof PizZip>
      const targetZip = targetDoc.zipArchive as InstanceType<typeof PizZip>
      
      for (let i = 0; i < targetIndices.length; i++) {
        const targetIndex = targetIndices[i]
        const sourceIndex = sourceIndices[i]
        
        console.log(`Replacing target slide ${targetIndex} with source slide ${sourceIndex}`)
        
        // 替换幻灯片 XML 文件
        const targetSlideNum = targetIndex + 1
        const sourceSlideNum = sourceIndex + 1
        
        const sourceSlideXmlPath = `ppt/slides/slide${sourceSlideNum}.xml`
        const targetSlideXmlPath = `ppt/slides/slide${targetSlideNum}.xml`
        
        console.log(`  Copying ${sourceSlideXmlPath} -> ${targetSlideXmlPath}`)
        
        // 读取源幻灯片 XML
        const sourceSlideXml = sourceZip.file(sourceSlideXmlPath)
        if (sourceSlideXml) {
          targetZip.file(targetSlideXmlPath, sourceSlideXml.asText())
          console.log(`  ✓ Slide XML copied`)
        } else {
          console.log(`  ✗ Source slide XML not found: ${sourceSlideXmlPath}`)
        }
        
        // 替换幻灯片关系文件（rels）
        const sourceSlideRelsPath = `ppt/slides/_rels/slide${sourceSlideNum}.xml.rels`
        const targetSlideRelsPath = `ppt/slides/_rels/slide${targetSlideNum}.xml.rels`
        
        const sourceSlideRels = sourceZip.file(sourceSlideRelsPath)
        if (sourceSlideRels) {
          targetZip.file(targetSlideRelsPath, sourceSlideRels.asText())
          console.log(`  ✓ Slide rels copied`)
        } else {
          console.log(`  ✗ Source slide rels not found (may not exist): ${sourceSlideRelsPath}`)
        }
        
        // 更新内存中的幻灯片对象
        targetDoc.slides[targetIndex] = {
          ...sourceSlides[i],
          index: targetIndex
        }
      }

      // 保存修改后的文件
      console.log('Saving document...')
      await this.parser.save(targetDoc, outputPath)
      
      console.log('Replace pages completed successfully')
      console.log('=== End Replace Pages Debug ===')

      return targetIndices.length
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to replace pages: ${error.message}`)
      }
      throw new Error('Failed to replace pages: Unknown error')
    }
  }

  /**
   * 插入页面
   * 将源PPT文件中的指定页面插入到目标PPT文件的指定位置
   * 
   * @param targetPath 目标PPT文件路径
   * @param sourcePath 源PPT文件路径
   * @param insertPosition 插入位置（0表示开头，1表示第1页后）
   * @param sourcePageRange 源页码范围字符串（例如："1-3,5"）
   * @param outputPath 输出文件路径
   * @returns 插入的页面数量
   */
  async insertPages(
    targetPath: string,
    sourcePath: string,
    insertPosition: number,
    sourcePageRange: string,
    outputPath: string
  ): Promise<number> {
    try {
      console.log('=== Insert Pages Debug ===')
      console.log('Target file:', targetPath)
      console.log('Source file:', sourcePath)
      console.log('Insert position:', insertPosition)
      console.log('Source page range:', sourcePageRange)
      console.log('Output file:', outputPath)
      
      // 打开目标文件和源文件
      const targetDoc = await this.parser.open(targetPath)
      const sourceDoc = await this.parser.open(sourcePath)
      
      console.log('Target doc slides:', targetDoc.slides.length)
      console.log('Source doc slides:', sourceDoc.slides.length)

      // 解析源页码范围
      const sourceIndices = this.parsePageRange(sourcePageRange, sourceDoc.slides.length)
      console.log('Source indices to insert:', sourceIndices)

      // 验证插入位置
      if (insertPosition < 0 || insertPosition > targetDoc.slides.length) {
        throw new Error(`Insert position ${insertPosition} is out of range (0-${targetDoc.slides.length})`)
      }

      // 获取要插入的源页面
      const sourceSlides = sourceIndices.map(index => sourceDoc.slides[index])
      console.log('Source slides to insert:', sourceSlides.length)

      // 复制源文件的媒体资源到目标文件
      console.log('Copying media from source...')
      await this.copyMediaFromSource(sourceDoc, targetDoc, sourceSlides)

      // 执行插入操作
      console.log('Inserting pages into target...')
      const PizZip = (await import('pizzip')).default
      const sourceZip = sourceDoc.zipArchive as InstanceType<typeof PizZip>
      const targetZip = targetDoc.zipArchive as InstanceType<typeof PizZip>
      
      const insertCount = sourceSlides.length
      const targetSlideCount = targetDoc.slides.length
      
      // 步骤1: 将插入位置后的所有幻灯片向后移动
      // insertPosition=0 表示插入到开头，需要移动所有幻灯片 (1,2,3,4 -> 2,3,4,5)
      // insertPosition=1 表示在第1页后插入，需要移动第2页及之后的幻灯片 (2,3,4 -> 3,4,5)
      console.log(`Moving slides after position ${insertPosition}...`)
      for (let i = targetSlideCount - 1; i >= insertPosition; i--) {
        const oldSlideNum = i + 1  // 幻灯片编号从1开始
        const newSlideNum = i + 1 + insertCount  // 正确的新位置
        
        // 移动幻灯片 XML
        const oldSlidePath = `ppt/slides/slide${oldSlideNum}.xml`
        const newSlidePath = `ppt/slides/slide${newSlideNum}.xml`
        const slideFile = targetZip.file(oldSlidePath)
        if (slideFile) {
          targetZip.file(newSlidePath, slideFile.asNodeBuffer())
          targetZip.remove(oldSlidePath)  // 删除旧文件
          console.log(`  Moved ${oldSlidePath} -> ${newSlidePath}`)
        }
        
        // 移动幻灯片关系文件
        const oldRelsPath = `ppt/slides/_rels/slide${oldSlideNum}.xml.rels`
        const newRelsPath = `ppt/slides/_rels/slide${newSlideNum}.xml.rels`
        const relsFile = targetZip.file(oldRelsPath)
        if (relsFile) {
          targetZip.file(newRelsPath, relsFile.asNodeBuffer())
          targetZip.remove(oldRelsPath)  // 删除旧文件
        }
        
        // 移动备注文件（如果存在）
        const oldNotesPath = `ppt/notesSlides/notesSlide${oldSlideNum}.xml`
        const newNotesPath = `ppt/notesSlides/notesSlide${newSlideNum}.xml`
        const notesFile = targetZip.file(oldNotesPath)
        if (notesFile) {
          targetZip.file(newNotesPath, notesFile.asNodeBuffer())
          targetZip.remove(oldNotesPath)
        }
        
        // 移动备注关系文件（如果存在）
        const oldNotesRelsPath = `ppt/notesSlides/_rels/notesSlide${oldSlideNum}.xml.rels`
        const newNotesRelsPath = `ppt/notesSlides/_rels/notesSlide${newSlideNum}.xml.rels`
        const notesRelsFile = targetZip.file(oldNotesRelsPath)
        if (notesRelsFile) {
          targetZip.file(newNotesRelsPath, notesRelsFile.asNodeBuffer())
          targetZip.remove(oldNotesRelsPath)
        }
      }
      
      // 步骤2: 插入源页面
      // insertPosition=0 时，插入到 slide1, slide2, slide3
      // insertPosition=1 时，插入到 slide2, slide3, slide4（在原第1页后）
      console.log('Inserting source pages...')
      for (let i = 0; i < sourceSlides.length; i++) {
        const sourceIndex = sourceIndices[i]
        const targetSlideNum = insertPosition + i + 1  // 插入位置：0->1, 1->2, 2->3
        const sourceSlideNum = sourceIndex + 1
        
        console.log(`  Inserting source slide ${sourceSlideNum} at target position ${targetSlideNum}`)
        
        // 复制幻灯片 XML
        const sourceSlidePath = `ppt/slides/slide${sourceSlideNum}.xml`
        const targetSlidePath = `ppt/slides/slide${targetSlideNum}.xml`
        const sourceSlideXml = sourceZip.file(sourceSlidePath)
        if (sourceSlideXml) {
          const content = sourceSlideXml.asNodeBuffer()
          console.log(`    Source slide size: ${content.length} bytes`)
          targetZip.file(targetSlidePath, content)
          console.log(`    ✓ Slide XML copied to ${targetSlidePath}`)
          
          // 验证是否真的被写入
          const verify = targetZip.file(targetSlidePath)
          if (verify) {
            console.log(`    ✓ Verified: ${targetSlidePath} exists in ZIP`)
          } else {
            console.error(`    ✗ ERROR: ${targetSlidePath} NOT found in ZIP after copy!`)
          }
        } else {
          console.error(`    ✗ ERROR: Source slide ${sourceSlidePath} not found!`)
        }
        
        // 复制幻灯片关系文件
        const sourceRelsPath = `ppt/slides/_rels/slide${sourceSlideNum}.xml.rels`
        const targetRelsPath = `ppt/slides/_rels/slide${targetSlideNum}.xml.rels`
        const sourceRels = sourceZip.file(sourceRelsPath)
        if (sourceRels) {
          targetZip.file(targetRelsPath, sourceRels.asNodeBuffer())
          console.log(`    ✓ Slide rels copied to ${targetRelsPath}`)
        } else {
          console.warn(`    ⚠ Source rels ${sourceRelsPath} not found`)
        }
      }
      
      // 步骤3: 更新内存中的幻灯片数组
      const newSlides = [
        ...targetDoc.slides.slice(0, insertPosition),
        ...sourceSlides,
        ...targetDoc.slides.slice(insertPosition)
      ]
      
      // 更新索引
      newSlides.forEach((slide, index) => {
        slide.index = index
      })
      
      targetDoc.slides = newSlides
      
      // 步骤4: 不手动修改 presentation.xml，让 PptxParser 的 save 方法自动处理
      console.log('Skipping manual presentation.xml modification - will be handled by save()')

      // 调试：列出 ZIP 中所有的幻灯片文件
      console.log('=== Files in ZIP ===')
      const allFiles = Object.keys(targetZip.files)
      const slideFiles = allFiles.filter(f => f.match(/ppt\/slides\/slide\d+\.xml$/)).sort()
      const notesFiles = allFiles.filter(f => f.match(/ppt\/notesSlides\/notesSlide\d+\.xml$/)).sort()
      console.log('Slide files:', slideFiles)
      console.log('Notes files:', notesFiles)
      console.log('=== End Files ===')

      // 保存
      console.log('Saving document...')
      await this.parser.save(targetDoc, outputPath)
      
      // 暂时禁用 LibreOffice 验证，因为它可能会干扰我们的修复
      console.log('Skipping LibreOffice validation (disabled for testing)...')
      // LibreOffice validation disabled
      
      console.log('Insert pages completed successfully')
      console.log('=== End Insert Pages Debug ===')

      return insertCount
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to insert pages: ${error.message}`)
      }
      throw new Error('Failed to insert pages: Unknown error')
    }
  }

  /**
   * 解析页码范围字符串
   * 
   * @param rangeStr 页码范围字符串，例如 "1-3,5,7-9"
   * @param totalPages 总页数
   * @returns 页面索引数组（从 0 开始）
   */
  private parsePageRange(rangeStr: string, totalPages: number): number[] {
    const indices = new Set<number>()

    const parts = rangeStr.split(',').map(s => s.trim())

    for (const part of parts) {
      if (part.includes('-')) {
        // 范围：1-3
        const [start, end] = part.split('-').map(s => parseInt(s.trim()))
        if (isNaN(start) || isNaN(end)) {
          throw new Error(`Invalid page range: ${part}`)
        }
        if (start < 1 || end > totalPages || start > end) {
          throw new Error(`Page range out of bounds: ${part}`)
        }
        for (let i = start; i <= end; i++) {
          indices.add(i - 1) // 转换为 0 索引
        }
      } else {
        // 单个页码：5
        const page = parseInt(part)
        if (isNaN(page)) {
          throw new Error(`Invalid page number: ${part}`)
        }
        if (page < 1 || page > totalPages) {
          throw new Error(`Page number out of bounds: ${page}`)
        }
        indices.add(page - 1) // 转换为 0 索引
      }
    }

    return Array.from(indices).sort((a, b) => a - b)
  }

  /**
   * 从源文档复制媒体资源到目标文档
   * 
   * @param sourceDoc 源文档
   * @param targetDoc 目标文档
   * @param sourceSlides 要复制的源幻灯片数组
   */
  private async copyMediaFromSource(
    sourceDoc: PptxDocument,
    targetDoc: PptxDocument,
    sourceSlides: Slide[]
  ): Promise<void> {
    try {
      const PizZip = (await import('pizzip')).default
      const { parseString } = await import('xml2js')
      const { promisify } = await import('util')
      const parseXml = promisify(parseString)

      const sourceZip = sourceDoc.zipArchive as InstanceType<typeof PizZip>
      const targetZip = targetDoc.zipArchive as InstanceType<typeof PizZip>

      console.log(`[copyMediaFromSource] Processing ${sourceSlides.length} slides`)

      // 遍历源幻灯片
      for (const slide of sourceSlides) {
        const slideNum = slide.index + 1
        const relsPath = `ppt/slides/_rels/slide${slideNum}.xml.rels`
        console.log(`[copyMediaFromSource] Checking rels: ${relsPath}`)
        const relsFile = sourceZip.file(relsPath)

        if (!relsFile) {
          console.log(`[copyMediaFromSource] Rels file not found: ${relsPath}`)
          continue
        }

        const relsXml = relsFile.asText()
        const relsData = await parseXml(relsXml) as any
        const relationships = relsData.Relationships?.Relationship || []
        console.log(`[copyMediaFromSource] Found ${relationships.length} relationships`)

        // 复制所有引用的媒体文件
        for (const rel of relationships) {
          const target = rel.$?.Target
          console.log(`[copyMediaFromSource] Relationship target: ${target}`)
          if (target && (target.includes('../media/') || target.includes('media/'))) {
            let mediaPath = target
            if (mediaPath.startsWith('../')) {
              mediaPath = mediaPath.replace('../', 'ppt/')
            } else if (!mediaPath.startsWith('ppt/')) {
              mediaPath = `ppt/${mediaPath}`
            }
            
            console.log(`[copyMediaFromSource] Media path: ${mediaPath}`)
            const sourceMediaFile = sourceZip.file(mediaPath)

            if (sourceMediaFile) {
              const mediaContent = sourceMediaFile.asNodeBuffer()
              targetZip.file(mediaPath, mediaContent)
              console.log(`[copyMediaFromSource] ✓ Copied media (overwrite): ${mediaPath}`)
            } else {
              console.log(`[copyMediaFromSource] ✗ Media file not found in source: ${mediaPath}`)
            }
          }
        }
      }
    } catch (error) {
      // 媒体复制失败不应该阻止整个操作
      console.warn('Failed to copy media from source:', error)
    }
  }

  /**
   * 更新 presentation.xml 以反映插入的页面
   */
  private async updatePresentationXmlForInsert(
    document: PptxDocument,
    insertPosition: number,
    insertCount: number
  ): Promise<void> {
    try {
      const PizZip = (await import('pizzip')).default
      const { parseString, Builder } = await import('xml2js')
      const { promisify } = await import('util')
      const parseXml = promisify(parseString)
      
      const zip = document.zipArchive as InstanceType<typeof PizZip>
      
      // 读取 presentation.xml
      const presentationFile = zip.file('ppt/presentation.xml')
      if (!presentationFile) {
        throw new Error('presentation.xml not found')
      }
      
      const presentationXml = presentationFile.asText()
      const presentationData = await parseXml(presentationXml)
      
      const presentation = presentationData['p:presentation']
      if (!presentation) {
        throw new Error('Invalid presentation.xml structure')
      }
      
      const sldIdLst = presentation['p:sldIdLst']?.[0]
      if (!sldIdLst) {
        throw new Error('Slide ID list not found')
      }
      
      const allSlideIds = sldIdLst['p:sldId'] || []
      
      // 为新插入的幻灯片创建新的 ID 条目
      const newSlideIds = []
      let maxId = Math.max(...allSlideIds.map((s: any) => parseInt(s.$?.id || '256')), 256)
      
      for (let i = 0; i < insertCount; i++) {
        maxId++
        newSlideIds.push({
          $: {
            id: String(maxId),
            'r:id': `rId${insertPosition + i + 2}`
          }
        })
      }
      
      // 插入新的幻灯片 ID
      const updatedSlideIds = [
        ...allSlideIds.slice(0, insertPosition),
        ...newSlideIds,
        ...allSlideIds.slice(insertPosition)
      ]
      
      sldIdLst['p:sldId'] = updatedSlideIds
      
      // 重新构建 XML
      const builder = new Builder({
        xmldec: { version: '1.0', encoding: 'UTF-8', standalone: true },
        headless: false,
        renderOpts: {
          pretty: false,
          indent: '',
          newline: ''
        }
      })
      const updatedXml = builder.buildObject(presentationData)
      
      // 保存回 ZIP
      zip.file('ppt/presentation.xml', updatedXml)
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to update presentation.xml: ${error.message}`)
      }
      throw new Error('Failed to update presentation.xml: Unknown error')
    }
  }

  /**
   * 重建 presentation.xml 和 rels（用于插入页面操作）
   * 
   * @param zip ZIP 归档对象
   * @param parseXml XML 解析函数
   * @param totalSlides 总幻灯片数
   */
  private async rebuildPresentationForInsert(
    zip: any,
    parseXml: any,
    totalSlides: number
  ): Promise<void> {
    // 先重建 rels 文件，获取正确的 rId 映射
    const rIdMapping = await this.rebuildPresentationRelsForInsert(zip, parseXml, totalSlides)

    const presentationFile = zip.file('ppt/presentation.xml')
    if (!presentationFile) {
      throw new Error('presentation.xml not found')
    }

    let presentationXml = presentationFile.asText()

    console.log(`[INSERT-PRES] Updating sldIdLst for ${totalSlides} slides using string replacement`)

    // 解析原有的 slideId
    const sldIdLstRegex = /(<p:sldIdLst[^>]*>)([\s\S]*?)(<\/p:sldIdLst>)/
    const match = presentationXml.match(sldIdLstRegex)
    
    if (!match) {
      throw new Error('Could not find p:sldIdLst in presentation.xml')
    }

    console.log('[INSERT-PRES] Original sldIdLst content (first 200 chars):')
    console.log(match[2].substring(0, 200))

    // 提取原有的所有 slideId
    const existingSldIds: Array<{id: string, rId: string}> = []
    const sldIdRegex = /<p:sldId id="(\d+)" r:id="(rId\d+)"\/>/g
    let sldMatch
    while ((sldMatch = sldIdRegex.exec(match[2])) !== null) {
      existingSldIds.push({ id: sldMatch[1], rId: sldMatch[2] })
    }

    console.log(`[INSERT-PRES] Found ${existingSldIds.length} existing slideIds`)

    // 找到最大的 slideId
    let maxSlideId = 256
    for (const sld of existingSldIds) {
      const id = parseInt(sld.id)
      if (id > maxSlideId) {
        maxSlideId = id
      }
    }

    console.log(`[INSERT-PRES] Max existing slideId: ${maxSlideId}`)

    // 构建新的 sldId 列表：为新插入的幻灯片生成新 ID
    const newSldIds: string[] = []
    let nextNewId = maxSlideId + 1

    for (let i = 0; i < totalSlides; i++) {
      // 如果这是原有的幻灯片位置，尝试保留原有的 slideId
      if (i < existingSldIds.length) {
        newSldIds.push(`<p:sldId id="${existingSldIds[i].id}" r:id="${rIdMapping[i]}"/>`)
        console.log(`[INSERT-PRES]   Slide ${i + 1}: id=${existingSldIds[i].id} (kept), r:id=${rIdMapping[i]}`)
      } else {
        // 新插入的幻灯片使用新 ID
        newSldIds.push(`<p:sldId id="${nextNewId}" r:id="${rIdMapping[i]}"/>`)
        console.log(`[INSERT-PRES]   Slide ${i + 1}: id=${nextNewId} (new), r:id=${rIdMapping[i]}`)
        nextNewId++
      }
    }

    const newSldIdLst = `${match[1]}${newSldIds.join('')}${match[3]}`
    presentationXml = presentationXml.replace(sldIdLstRegex, newSldIdLst)

    console.log('[INSERT-PRES] New sldIdLst content (first 200 chars):')
    console.log(newSldIds.join('').substring(0, 200))
    console.log('[INSERT-PRES] Updated presentation.xml using string replacement')
    
    zip.file('ppt/presentation.xml', presentationXml)
  }

  /**
   * 重建 presentation.xml.rels（用于插入页面操作）
   * 
   * @param zip ZIP 归档对象
   * @param parseXml XML 解析函数
   * @param slideCount 幻灯片数量
   * @returns rId 映射数组
   */
  private async rebuildPresentationRelsForInsert(
    zip: any,
    parseXml: any,
    slideCount: number
  ): Promise<string[]> {
    const Builder = (await import('xml2js')).Builder
    const relsPath = 'ppt/_rels/presentation.xml.rels'

    const relsFile = zip.file(relsPath)
    if (!relsFile) {
      throw new Error('presentation.xml.rels not found')
    }

    const relsXml = relsFile.asText()
    const relsData = await parseXml(relsXml)

    const relationships = relsData.Relationships?.Relationship || []
    const nonSlideRels = relationships.filter((rel: any) => {
      const type = rel.$?.Type || ''
      return !type.includes('/slide')
    })

    let maxRid = 1
    for (const rel of nonSlideRels) {
      const id = rel.$?.Id || ''
      const match = id.match(/rId(\d+)/)
      if (match) {
        const num = parseInt(match[1])
        if (num > maxRid) {
          maxRid = num
        }
      }
    }

    const newRelationships = [...nonSlideRels]
    const rIdMapping: string[] = []
    let currentRid = maxRid
    
    console.log(`[INSERT] Building rels for ${slideCount} slides, maxRid=${maxRid}`)
    
    for (let i = 1; i <= slideCount; i++) {
      currentRid++
      const rId = `rId${currentRid}`
      rIdMapping.push(rId)
      newRelationships.push({
        $: {
          Id: rId,
          Type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide',
          Target: `slides/slide${i}.xml`
        }
      })
      if (i <= 3 || i > slideCount - 3) {
        console.log(`[INSERT]   ${rId} -> slides/slide${i}.xml`)
      }
    }

    console.log(`[INSERT] Total rels: ${newRelationships.length} (${nonSlideRels.length} non-slide + ${slideCount} slides)`)

    relsData.Relationships.Relationship = newRelationships

    const builder = new Builder({
      xmldec: { version: '1.0', encoding: 'UTF-8', standalone: true },
      headless: false,
      renderOpts: {
        pretty: true,
        indent: '  ',
        newline: '\n'
      }
    })
    const updatedRelsXml = builder.buildObject(relsData)
    zip.file(relsPath, updatedRelsXml)
    
    return rIdMapping
  }
}
