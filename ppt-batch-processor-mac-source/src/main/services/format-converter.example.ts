/**
 * FormatConverter 使用示例
 * 
 * 本文件展示如何使用 FormatConverter 的图片转换功能
 */

import { FormatConverter } from './format-converter'

async function exampleUsage() {
  const converter = new FormatConverter()

  // 检查 LibreOffice 是否可用
  const available = await converter.checkAvailability()
  if (!available) {
    console.error('LibreOffice 未安装，请先安装 LibreOffice')
    return
  }

  // 示例 1: 基本的 PNG 转换
  const pngImages = await converter.convertToImages(
    '/path/to/presentation.pptx',
    '/path/to/output',
    'png'
  )
  console.log('生成的 PNG 图片:', pngImages)

  // 示例 2: 高质量 JPG 转换
  const jpgImages = await converter.convertToImages(
    '/path/to/presentation.pptx',
    '/path/to/output',
    'jpg',
    {
      quality: 95  // 高质量 JPG (1-100)
    }
  )
  console.log('生成的 JPG 图片:', jpgImages)

  // 示例 3: 调整图片大小
  const resizedImages = await converter.convertToImages(
    '/path/to/presentation.pptx',
    '/path/to/output',
    'png',
    {
      width: 1920,   // 最大宽度
      height: 1080,  // 最大高度
      // 图片会按比例缩放以适应这些尺寸
    }
  )
  console.log('生成的调整大小后的图片:', resizedImages)

  // 示例 4: 高压缩 PNG（减小文件大小）
  const compressedImages = await converter.convertToImages(
    '/path/to/presentation.pptx',
    '/path/to/output',
    'png',
    {
      compressionLevel: 9  // 最高压缩级别 (0-9)
    }
  )
  console.log('生成的压缩 PNG 图片:', compressedImages)

  // 示例 5: 组合选项 - 调整大小 + 高质量 JPG
  const optimizedImages = await converter.convertToImages(
    '/path/to/presentation.pptx',
    '/path/to/output',
    'jpg',
    {
      width: 1280,
      height: 720,
      quality: 85
    }
  )
  console.log('生成的优化图片:', optimizedImages)
}

// 错误处理示例
async function exampleWithErrorHandling() {
  const converter = new FormatConverter()

  try {
    const images = await converter.convertToImages(
      '/path/to/presentation.pptx',
      '/path/to/output',
      'png'
    )
    console.log('转换成功:', images)
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('LibreOffice')) {
        console.error('LibreOffice 相关错误:', error.message)
      } else if (error.message.includes('输入文件不存在')) {
        console.error('文件不存在:', error.message)
      } else if (error.message.includes('超时')) {
        console.error('转换超时:', error.message)
      } else {
        console.error('转换失败:', error.message)
      }
    }
  }
}

// 批量转换示例
async function batchConversionExample() {
  const converter = new FormatConverter()
  const files = [
    '/path/to/presentation1.pptx',
    '/path/to/presentation2.pptx',
    '/path/to/presentation3.pptx'
  ]

  for (const file of files) {
    try {
      const images = await converter.convertToImages(
        file,
        '/path/to/output',
        'png',
        { quality: 90 }
      )
      console.log(`${file} 转换成功，生成 ${images.length} 张图片`)
    } catch (error) {
      console.error(`${file} 转换失败:`, error)
      // 继续处理下一个文件
    }
  }
}

export { exampleUsage, exampleWithErrorHandling, batchConversionExample }
