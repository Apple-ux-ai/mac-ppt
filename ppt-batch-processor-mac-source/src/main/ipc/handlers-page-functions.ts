/**
 * 删除页面处理
 */
export async function processDeletePages(inputPath: string, outputPath: string, options: any): Promise<void> {
  console.log('    Delete pages options:', {
    deleteMode: options.deletePageMode,
    pageRange: options.pageRange
  })

  const { PageProcessor } = await import('../services/page-processor')
  const processor = new PageProcessor()

  // 验证必需参数
  if (!options.pageRange) {
    throw new Error('Page range is required for delete-pages operation')
  }

  console.log(`    Deleting pages: ${options.pageRange}`)

  // 执行删除
  const deletedCount = await processor.deletePages(
    inputPath,
    outputPath,
    options.pageRange
  )

  console.log(`    Deleted ${deletedCount} page(s)`)
}

/**
 * 替换页面处理
 */
export async function processReplacePages(inputPath: string, outputPath: string, options: any): Promise<string> {
  console.log('    Replace pages options:', {
    targetFile: options.replaceTargetFile,
    targetPage: options.replacePageNumber,
    sourceFile: options.replaceSourceFile,
    sourcePage: options.replaceSourcePageNumber
  })

  const path = await import('path')
  const { PageProcessor } = await import('../services/page-processor')
  const processor = new PageProcessor()

  // 验证必需参数
  if (!options.replaceTargetFile) {
    throw new Error('Target file is required for replace-pages operation')
  }
  if (!options.replaceSourceFile) {
    throw new Error('Source file is required for replace-pages operation')
  }
  if (!options.replacePageNumber) {
    throw new Error('Target page number is required for replace-pages operation')
  }
  if (!options.replaceSourcePageNumber) {
    throw new Error('Source page number is required for replace-pages operation')
  }

  console.log(`    Replacing page ${options.replacePageNumber} with source page ${options.replaceSourcePageNumber}`)

  // 使用目标文件路径生成正确的输出路径
  const targetFileName = path.basename(options.replaceTargetFile, path.extname(options.replaceTargetFile))
  const targetExt = path.extname(options.replaceTargetFile)
  const outputDir = path.dirname(outputPath).trim()
  const correctOutputPath = path.join(outputDir, `${targetFileName}_processed${targetExt}`)

  console.log(`    Corrected output path: ${correctOutputPath}`)

  // 执行替换
  const replacedCount = await processor.replacePages(
    options.replaceTargetFile,
    options.replaceSourceFile,
    String(options.replacePageNumber),
    String(options.replaceSourcePageNumber),
    correctOutputPath
  )

  console.log(`    Replaced ${replacedCount} page(s)`)
  return correctOutputPath
}

/**
 * 插入页面处理
 */
export async function processInsertPages(inputPath: string, outputPath: string, options: any): Promise<string> {
  console.log('    Insert pages options:', {
    targetFile: options.insertTargetFile,
    position: options.insertPosition,
    sourceFile: options.insertSourceFile,
    sourcePageRange: options.insertSourcePageRange
  })

  const path = await import('path')
  const { PageProcessor } = await import('../services/page-processor')
  const processor = new PageProcessor()

  // 验证必需参数
  if (!options.insertTargetFile) {
    throw new Error('Target file is required for insert-pages operation')
  }
  if (!options.insertSourceFile) {
    throw new Error('Source file is required for insert-pages operation')
  }
  if (options.insertPosition === undefined || options.insertPosition === null) {
    throw new Error('Insert position is required for insert-pages operation')
  }
  if (!options.insertSourcePageRange) {
    throw new Error('Source page range is required for insert-pages operation')
  }

  console.log(`    Inserting pages from source at position ${options.insertPosition}`)

  // 使用目标文件路径生成正确的输出路径
  const targetFileName = path.basename(options.insertTargetFile, path.extname(options.insertTargetFile))
  const targetExt = path.extname(options.insertTargetFile)
  const outputDir = path.dirname(outputPath).trim()
  const correctOutputPath = path.join(outputDir, `${targetFileName}_processed${targetExt}`)

  console.log(`    Corrected output path: ${correctOutputPath}`)

  // 执行插入
  const insertedCount = await processor.insertPages(
    options.insertTargetFile,
    options.insertSourceFile,
    options.insertPosition,
    options.insertSourcePageRange,
    correctOutputPath
  )

  console.log(`    Inserted ${insertedCount} page(s)`)
  return correctOutputPath
}
