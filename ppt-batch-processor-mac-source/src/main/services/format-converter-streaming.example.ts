/**
 * 流式处理和内存监控示例
 * 
 * 本文件演示如何使用 FormatConverter 的流式处理和内存监控功能
 * 
 * 验收标准 7.6: WHEN 转换大文件 THEN THE System SHALL 使用流式处理避免内存溢出
 * 验收标准 24.1: WHEN 处理大文件（>50MB）THEN THE System SHALL 使用流式读写避免内存溢出
 */

import { FormatConverter, MemoryMonitor } from './format-converter'
import { join } from 'path'

/**
 * 示例 1: 转换大文件并监控内存使用
 */
async function example1_convertLargeFileWithMonitoring() {
  console.log('=== 示例 1: 转换大文件并监控内存使用 ===\n')

  const converter = new FormatConverter()
  const monitor = converter.getMemoryMonitor()

  // 假设我们有一个大的 PPTX 文件（>50MB）
  const inputPath = 'path/to/large-presentation.pptx'
  const outputPath = 'path/to/output.pdf'

  try {
    console.log('开始转换大文件...')
    console.log(`输入文件: ${inputPath}`)
    console.log(`输出文件: ${outputPath}\n`)

    // 转换会自动检测大文件并启动内存监控
    await converter.convertToPdf(inputPath, outputPath)

    console.log('转换完成！\n')

    // 获取内存使用统计
    const peakMemory = monitor.getPeakMemory()
    const averageMemory = monitor.getAverageMemory()

    if (peakMemory) {
      console.log('内存使用统计:')
      console.log(`  峰值内存: ${MemoryMonitor.formatBytes(peakMemory.rss)}`)
      console.log(`  峰值堆内存: ${MemoryMonitor.formatBytes(peakMemory.heapUsed)}`)
    }

    if (averageMemory) {
      console.log(`  平均内存: ${MemoryMonitor.formatBytes(averageMemory.rss)}`)
      console.log(`  平均堆内存: ${MemoryMonitor.formatBytes(averageMemory.heapUsed)}`)
    }

  } catch (error) {
    console.error('转换失败:', error)
  }
}

/**
 * 示例 2: 手动使用内存监控器
 */
async function example2_manualMemoryMonitoring() {
  console.log('\n=== 示例 2: 手动使用内存监控器 ===\n')

  const monitor = new MemoryMonitor()

  // 启动监控，每 500ms 采样一次
  monitor.startMonitoring(500)

  console.log('开始执行内存密集型操作...\n')

  // 模拟一些内存密集型操作
  const largeArrays: number[][] = []
  for (let i = 0; i < 10; i++) {
    // 创建大数组
    const array = new Array(1000000).fill(Math.random())
    largeArrays.push(array)

    // 获取当前内存使用
    const current = monitor.getCurrentMemory()
    console.log(`迭代 ${i + 1}: 当前内存 ${MemoryMonitor.formatBytes(current.rss)}`)

    // 等待一段时间
    await new Promise(resolve => setTimeout(resolve, 600))
  }

  // 停止监控
  monitor.stopMonitoring()

  // 获取统计信息
  const peak = monitor.getPeakMemory()
  const average = monitor.getAverageMemory()

  console.log('\n内存使用统计:')
  if (peak) {
    console.log(`  峰值内存: ${MemoryMonitor.formatBytes(peak.rss)}`)
  }
  if (average) {
    console.log(`  平均内存: ${MemoryMonitor.formatBytes(average.rss)}`)
  }

  // 清理
  largeArrays.length = 0
}

/**
 * 示例 3: 批量转换大文件并监控内存
 */
async function example3_batchConvertWithMonitoring() {
  console.log('\n=== 示例 3: 批量转换大文件并监控内存 ===\n')

  const converter = new FormatConverter()
  const monitor = converter.getMemoryMonitor()

  const files = [
    { input: 'file1.pptx', output: 'file1.pdf' },
    { input: 'file2.pptx', output: 'file2.pdf' },
    { input: 'file3.pptx', output: 'file3.pdf' }
  ]

  for (const file of files) {
    console.log(`\n转换文件: ${file.input}`)

    try {
      // 清除之前的监控数据
      monitor.clear()

      // 转换文件
      await converter.convertToPdf(file.input, file.output)

      // 显示此文件的内存使用
      const peak = monitor.getPeakMemory()
      if (peak) {
        console.log(`  峰值内存: ${MemoryMonitor.formatBytes(peak.rss)}`)
      }

      console.log(`  ✓ 转换成功`)

    } catch (error) {
      console.error(`  ✗ 转换失败:`, error)
    }
  }
}

/**
 * 示例 4: 转换为图片并监控内存
 */
async function example4_convertToImagesWithMonitoring() {
  console.log('\n=== 示例 4: 转换为图片并监控内存 ===\n')

  const converter = new FormatConverter()
  const monitor = converter.getMemoryMonitor()

  const inputPath = 'path/to/large-presentation.pptx'
  const outputDir = 'path/to/output-images'

  try {
    console.log('开始转换为图片...')
    console.log(`输入文件: ${inputPath}`)
    console.log(`输出目录: ${outputDir}\n`)

    // 转换为 PNG 图片
    const imageFiles = await converter.convertToImages(inputPath, outputDir, 'png', {
      compressionLevel: 6,
      width: 1920 // 限制宽度以减少内存使用
    })

    console.log(`转换完成！生成了 ${imageFiles.length} 张图片\n`)

    // 显示内存使用统计
    const peak = monitor.getPeakMemory()
    const average = monitor.getAverageMemory()

    if (peak) {
      console.log('内存使用统计:')
      console.log(`  峰值内存: ${MemoryMonitor.formatBytes(peak.rss)}`)
    }

    if (average) {
      console.log(`  平均内存: ${MemoryMonitor.formatBytes(average.rss)}`)
    }

    // 列出生成的图片
    console.log('\n生成的图片:')
    imageFiles.forEach((file, index) => {
      console.log(`  ${index + 1}. ${file}`)
    })

  } catch (error) {
    console.error('转换失败:', error)
  }
}

/**
 * 示例 5: 检测和处理内存压力
 */
async function example5_handleMemoryPressure() {
  console.log('\n=== 示例 5: 检测和处理内存压力 ===\n')

  const converter = new FormatConverter()
  const monitor = converter.getMemoryMonitor()

  // 设置内存阈值（例如 1GB）
  const memoryThreshold = 1024 * 1024 * 1024

  // 启动监控
  monitor.startMonitoring(1000)

  const files = ['file1.pptx', 'file2.pptx', 'file3.pptx', 'file4.pptx']

  for (const file of files) {
    // 检查当前内存使用
    const current = monitor.getCurrentMemory()
    
    if (current.rss > memoryThreshold) {
      console.log(`⚠️  内存使用过高 (${MemoryMonitor.formatBytes(current.rss)})`)
      console.log('   等待垃圾回收...')
      
      // 触发垃圾回收（如果可用）
      if (global.gc) {
        global.gc()
      }
      
      // 等待一段时间
      await new Promise(resolve => setTimeout(resolve, 2000))
    }

    console.log(`\n转换文件: ${file}`)
    console.log(`  当前内存: ${MemoryMonitor.formatBytes(current.rss)}`)

    try {
      await converter.convertToPdf(file, file.replace('.pptx', '.pdf'))
      console.log('  ✓ 转换成功')
    } catch (error) {
      console.error('  ✗ 转换失败:', error)
    }
  }

  monitor.stopMonitoring()

  // 最终统计
  const peak = monitor.getPeakMemory()
  if (peak) {
    console.log(`\n最终统计:`)
    console.log(`  峰值内存: ${MemoryMonitor.formatBytes(peak.rss)}`)
  }
}

/**
 * 示例 6: 实时监控内存使用
 */
async function example6_realtimeMemoryMonitoring() {
  console.log('\n=== 示例 6: 实时监控内存使用 ===\n')

  const monitor = new MemoryMonitor()

  // 启动快速采样
  monitor.startMonitoring(100)

  console.log('开始实时监控（10 秒）...\n')

  // 创建一个定时器显示实时内存使用
  const displayInterval = setInterval(() => {
    const current = monitor.getCurrentMemory()
    const peak = monitor.getPeakMemory()

    process.stdout.write(
      `\r当前: ${MemoryMonitor.formatBytes(current.rss)} | ` +
      `峰值: ${peak ? MemoryMonitor.formatBytes(peak.rss) : 'N/A'} | ` +
      `堆: ${MemoryMonitor.formatBytes(current.heapUsed)}`
    )
  }, 500)

  // 模拟一些操作
  const data: any[] = []
  for (let i = 0; i < 20; i++) {
    data.push(new Array(100000).fill(Math.random()))
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  // 停止显示
  clearInterval(displayInterval)
  monitor.stopMonitoring()

  console.log('\n\n监控完成！')

  // 显示统计
  const average = monitor.getAverageMemory()
  if (average) {
    console.log(`平均内存: ${MemoryMonitor.formatBytes(average.rss)}`)
  }
}

// 主函数
async function main() {
  console.log('FormatConverter 流式处理和内存监控示例\n')
  console.log('=' .repeat(60))

  // 运行示例（取消注释以运行）
  // await example1_convertLargeFileWithMonitoring()
  // await example2_manualMemoryMonitoring()
  // await example3_batchConvertWithMonitoring()
  // await example4_convertToImagesWithMonitoring()
  // await example5_handleMemoryPressure()
  // await example6_realtimeMemoryMonitoring()

  console.log('\n' + '='.repeat(60))
  console.log('\n提示: 取消注释 main() 函数中的示例以运行它们')
}

// 如果直接运行此文件
if (require.main === module) {
  main().catch(console.error)
}

export {
  example1_convertLargeFileWithMonitoring,
  example2_manualMemoryMonitoring,
  example3_batchConvertWithMonitoring,
  example4_convertToImagesWithMonitoring,
  example5_handleMemoryPressure,
  example6_realtimeMemoryMonitoring
}
