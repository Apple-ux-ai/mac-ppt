import { promises as fs } from 'fs'
import PizZip from 'pizzip'
import sharp from 'sharp'
import path from 'path'

/**
 * 文件优化器
 * 优化和压缩 PPT 文件，减小文件大小
 */
export class FileOptimizer {
  /**
   * 优化文件
   * 
   * @param inputPath 输入文件路径
   * @param outputPath 输出文件路径
   * @param options 优化选项
   */
  async optimize(
    inputPath: string,
    outputPath: string,
    options: {
      level: 'low' | 'medium' | 'high'
      compressImages: boolean
      removeEmbeddedFonts: boolean
    }
  ): Promise<void> {
    try {
      console.log('=== Optimize File Debug ===')
      console.log('Input file:', inputPath)
      console.log('Output file:', outputPath)
      console.log('Options:', options)

      // 读取文件
      const fileData = await fs.readFile(inputPath)
      const zip = new PizZip(fileData)

      // 压缩图片
      if (options.compressImages) {
        await this.compressImages(zip, options.level)
      }

      // 移除嵌入字体
      if (options.removeEmbeddedFonts) {
        this.removeEmbeddedFonts(zip)
      }

      // 根据压缩级别设置压缩选项
      const compressionLevel = this.getCompressionLevel(options.level)

      // 生成优化后的 ZIP 文件
      const content = zip.generate({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: {
          level: compressionLevel as any
        }
      } as any)

      // 写入文件
      await fs.writeFile(outputPath, content)

      const inputStats = await fs.stat(inputPath)
      const outputStats = await fs.stat(outputPath)
      const reduction = ((inputStats.size - outputStats.size) / inputStats.size * 100).toFixed(2)

      console.log(`Original size: ${(inputStats.size / 1024).toFixed(2)} KB`)
      console.log(`Optimized size: ${(outputStats.size / 1024).toFixed(2)} KB`)
      console.log(`Size reduction: ${reduction}%`)
      console.log('=== End Optimize File Debug ===')
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to optimize file: ${error.message}`)
      }
      throw new Error('Failed to optimize file: Unknown error')
    }
  }

  /**
   * 压缩图片
   */
  private async compressImages(zip: any, level: 'low' | 'medium' | 'high'): Promise<void> {
    const imageFiles: string[] = []
    
    // 查找所有图片文件
    Object.keys(zip.files).forEach(fileName => {
      if (fileName.startsWith('ppt/media/') && 
          (fileName.endsWith('.png') || fileName.endsWith('.jpg') || fileName.endsWith('.jpeg'))) {
        imageFiles.push(fileName)
      }
    })

    console.log(`Found ${imageFiles.length} images to compress`)

    // 根据压缩级别设置质量
    const quality = level === 'high' ? 60 : level === 'medium' ? 75 : 85

    // 压缩每个图片
    for (const fileName of imageFiles) {
      try {
        const file = zip.files[fileName]
        if (file && !file.dir) {
          const imageData = file.asNodeBuffer()
          
          // 使用 sharp 压缩图片
          const compressed = await sharp(imageData)
            .jpeg({ quality })
            .toBuffer()

          // 更新 ZIP 中的文件
          zip.file(fileName, compressed)
          
          console.log(`  Compressed: ${fileName}`)
        }
      } catch (error) {
        console.warn(`  Failed to compress ${fileName}:`, error)
        // 继续处理其他图片
      }
    }
  }

  /**
   * 移除嵌入字体
   */
  private removeEmbeddedFonts(zip: any): void {
    const fontFiles: string[] = []
    
    // 查找所有字体文件
    Object.keys(zip.files).forEach(fileName => {
      if (fileName.startsWith('ppt/fonts/') || 
          fileName.startsWith('ppt/embeddings/')) {
        fontFiles.push(fileName)
      }
    })

    console.log(`Found ${fontFiles.length} embedded fonts to remove`)

    // 删除字体文件
    fontFiles.forEach(fileName => {
      zip.remove(fileName)
      console.log(`  Removed: ${fileName}`)
    })
  }

  /**
   * 获取压缩级别
   */
  private getCompressionLevel(level: 'low' | 'medium' | 'high'): number {
    switch (level) {
      case 'low':
        return 6
      case 'medium':
        return 7
      case 'high':
        return 9
      default:
        return 7
    }
  }

  /**
   * 优化文件（别名方法，与optimize相同）
   * @param inputPath 输入文件路径
   * @param outputPath 输出文件路径
   * @param options 优化选项
   */
  async optimizeFile(
    inputPath: string,
    outputPath: string,
    options: {
      compressLevel?: 'low' | 'medium' | 'high'
      compressImages?: boolean
      removeEmbeddedFonts?: boolean
    }
  ): Promise<void> {
    return this.optimize(inputPath, outputPath, {
      level: options.compressLevel || 'medium',
      compressImages: options.compressImages !== false,
      removeEmbeddedFonts: options.removeEmbeddedFonts || false
    })
  }
}
