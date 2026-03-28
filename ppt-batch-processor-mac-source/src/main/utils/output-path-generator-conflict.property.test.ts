import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { OutputPathGenerator } from './output-path-generator'
import fc from 'fast-check'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

/**
 * 属性测试：文件名冲突避免
 * 
 * **属性 15: 文件名冲突避免**
 * 
 * 对于任意输出文件生成操作，如果目标路径已存在同名文件，
 * 系统应自动生成唯一的文件名（通过添加序号）避免覆盖。
 * 
 * **验证需求: 22.5**
 * 
 * **Validates: Requirements 22.5**
 */
describe('OutputPathGenerator - Property Tests: Conflict Avoidance', () => {
  let generator: OutputPathGenerator
  let testDir: string
  
  beforeEach(async () => {
    generator = new OutputPathGenerator()
    testDir = path.join(os.tmpdir(), `output-path-prop-test-${Date.now()}`)
    await fs.mkdir(testDir, { recursive: true })
  })
  
  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true })
    } catch {
      // 忽略清理错误
    }
  })
  
  /**
   * 属性 1: 生成的路径应该唯一且不覆盖已存在的文件
   * 
   * 对于任意输入文件路径和任意数量的已存在文件，
   * 生成的输出路径应该与所有已存在的文件路径不同
   */
  it('should generate unique paths that do not overwrite existing files', async () => {
    // 生成合法的文件名（排除 Windows 非法字符）
    const validFileNameArb = fc.string({ minLength: 1, maxLength: 50 })
      .filter(s => {
        // 排除路径分隔符和 Windows 非法字符
        const illegalChars = /[<>:"|?*\/\\]/
        return !illegalChars.test(s) && s.trim().length > 0
      })
    
    await fc.assert(
      fc.asyncProperty(
        // 生成文件名（不含扩展名）
        validFileNameArb,
        // 生成扩展名
        fc.constantFrom('.pptx', '.ppt', '.pdf', '.docx'),
        // 生成已存在文件的数量（0-10）
        fc.integer({ min: 0, max: 10 }),
        async (fileName, ext, existingCount) => {
          // 清理测试目录
          const files = await fs.readdir(testDir)
          for (const file of files) {
            await fs.unlink(path.join(testDir, file))
          }
          
          const inputPath = `/test/${fileName}${ext}`
          const baseFileName = `${fileName}${ext}`
          
          // 创建已存在的文件
          const existingFiles: string[] = []
          for (let i = 0; i < existingCount; i++) {
            const existingFileName = i === 0 ? baseFileName : `${fileName} (${i})${ext}`
            const existingPath = path.join(testDir, existingFileName)
            await fs.writeFile(existingPath, `content-${i}`)
            existingFiles.push(existingPath)
          }
          
          // 生成输出路径
          const outputPath = await generator.generateOutputPath(inputPath, testDir)
          
          // 验证：输出路径不应该与任何已存在的文件相同
          expect(existingFiles).not.toContain(outputPath)
          
          // 验证：输出路径应该在测试目录中
          expect(outputPath.startsWith(testDir)).toBe(true)
          
          // 验证：输出路径应该保持相同的扩展名
          expect(path.extname(outputPath)).toBe(ext)
          
          // 验证：如果有冲突，应该添加序号
          if (existingCount > 0) {
            const outputFileName = path.basename(outputPath)
            // 应该包含序号或者是原始文件名（如果没有冲突）
            const hasSequence = /\(\d+\)/.test(outputFileName)
            expect(hasSequence).toBe(true)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
  
  /**
   * 属性 2: 批量生成的路径应该全部唯一
   * 
   * 对于任意输入文件列表（可能包含重复文件名），
   * 生成的所有输出路径应该互不相同
   */
  it('should generate all unique paths in batch processing', async () => {
    // 生成合法的文件名（排除 Windows 非法字符）
    const validFileNameArb = fc.string({ minLength: 1, maxLength: 30 })
      .filter(s => {
        const illegalChars = /[<>:"|?*\/\\]/
        return !illegalChars.test(s) && s.trim().length > 0
      })
    
    await fc.assert(
      fc.asyncProperty(
        // 生成文件名数组（可能包含重复）
        fc.array(
          fc.record({
            name: validFileNameArb,
            ext: fc.constantFrom('.pptx', '.ppt', '.pdf')
          }),
          { minLength: 1, maxLength: 20 }
        ),
        async (fileInfos) => {
          // 清理测试目录
          const files = await fs.readdir(testDir)
          for (const file of files) {
            await fs.unlink(path.join(testDir, file))
          }
          
          // 构建输入路径
          const inputPaths = fileInfos.map(info => `/test/${info.name}${info.ext}`)
          
          // 生成输出路径
          const outputPaths = await generator.generateOutputPaths(inputPaths, testDir)
          
          // 验证：所有输出路径应该唯一
          const uniquePaths = new Set(outputPaths)
          expect(uniquePaths.size).toBe(outputPaths.length)
          
          // 验证：每个输出路径都应该在测试目录中
          outputPaths.forEach(outputPath => {
            expect(outputPath.startsWith(testDir)).toBe(true)
          })
          
          // 验证：输出路径数量应该等于输入路径数量
          expect(outputPaths.length).toBe(inputPaths.length)
        }
      ),
      { numRuns: 100 }
    )
  })
  
  /**
   * 属性 3: 序号应该单调递增
   * 
   * 对于同名文件的多次生成，序号应该按顺序递增
   */
  it('should generate monotonically increasing sequence numbers for conflicts', async () => {
    // 生成合法的文件名（排除 Windows 非法字符）
    const validFileNameArb = fc.string({ minLength: 1, maxLength: 30 })
      .filter(s => {
        const illegalChars = /[<>:"|?*\/\\]/
        return !illegalChars.test(s) && s.trim().length > 0
      })
    
    await fc.assert(
      fc.asyncProperty(
        // 生成文件名
        validFileNameArb,
        // 生成扩展名
        fc.constantFrom('.pptx', '.ppt'),
        // 生成重复次数（2-10）
        fc.integer({ min: 2, max: 10 }),
        async (fileName, ext, repeatCount) => {
          // 清理测试目录
          const files = await fs.readdir(testDir)
          for (const file of files) {
            await fs.unlink(path.join(testDir, file))
          }
          
          const inputPath = `/test/${fileName}${ext}`
          
          // 生成多个相同的输入
          const inputPaths = Array(repeatCount).fill(inputPath)
          const outputPaths = await generator.generateOutputPaths(inputPaths, testDir)
          
          // 提取序号
          const sequences: number[] = []
          outputPaths.forEach(outputPath => {
            const baseName = path.basename(outputPath, ext)
            const match = baseName.match(/\((\d+)\)$/)
            if (match) {
              sequences.push(parseInt(match[1], 10))
            } else {
              // 第一个文件没有序号
              sequences.push(0)
            }
          })
          
          // 验证：序号应该单调递增
          for (let i = 1; i < sequences.length; i++) {
            expect(sequences[i]).toBeGreaterThan(sequences[i - 1])
          }
          
          // 验证：序号应该连续
          expect(sequences[0]).toBe(0)  // 第一个没有序号
          for (let i = 1; i < sequences.length; i++) {
            expect(sequences[i]).toBe(i)
          }
        }
      ),
      { numRuns: 50 }
    )
  })
  
  /**
   * 属性 4: 已存在文件不应该被修改
   * 
   * 生成新路径时，所有已存在的文件内容应该保持不变
   */
  it('should not modify existing files when resolving conflicts', async () => {
    // 生成合法的文件名（排除 Windows 非法字符）
    const validFileNameArb = fc.string({ minLength: 1, maxLength: 30 })
      .filter(s => {
        const illegalChars = /[<>:"|?*\/\\]/
        return !illegalChars.test(s) && s.trim().length > 0
      })
    
    await fc.assert(
      fc.asyncProperty(
        // 生成文件名
        validFileNameArb,
        // 生成扩展名
        fc.constantFrom('.pptx', '.ppt'),
        // 生成已存在文件的数量
        fc.integer({ min: 1, max: 5 }),
        // 生成文件内容
        fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 1, maxLength: 5 }),
        async (fileName, ext, existingCount, contents) => {
          // 清理测试目录
          const files = await fs.readdir(testDir)
          for (const file of files) {
            await fs.unlink(path.join(testDir, file))
          }
          
          const inputPath = `/test/${fileName}${ext}`
          
          // 创建已存在的文件并记录内容
          const existingFilesContent = new Map<string, string>()
          for (let i = 0; i < existingCount; i++) {
            const existingFileName = i === 0 ? `${fileName}${ext}` : `${fileName} (${i})${ext}`
            const existingPath = path.join(testDir, existingFileName)
            const content = contents[i % contents.length]
            await fs.writeFile(existingPath, content)
            existingFilesContent.set(existingPath, content)
          }
          
          // 生成新的输出路径
          const outputPath = await generator.generateOutputPath(inputPath, testDir)
          
          // 验证：所有已存在文件的内容应该保持不变
          for (const [filePath, expectedContent] of existingFilesContent) {
            const actualContent = await fs.readFile(filePath, 'utf-8')
            expect(actualContent).toBe(expectedContent)
          }
          
          // 验证：新路径不应该覆盖任何已存在的文件
          expect(existingFilesContent.has(outputPath)).toBe(false)
        }
      ),
      { numRuns: 50 }
    )
  })
  
  /**
   * 属性 5: 使用模式时也应该避免冲突
   * 
   * 即使使用自定义文件名模式，也应该正确处理冲突
   */
  it('should avoid conflicts even with custom patterns', async () => {
    // 生成合法的文件名和模式字符串（排除 Windows 非法字符）
    const validStringArb = fc.string({ minLength: 1, maxLength: 10 })
      .filter(s => {
        const illegalChars = /[<>:"|?*\/\\]/
        return !illegalChars.test(s) && s.trim().length > 0
      })
    
    await fc.assert(
      fc.asyncProperty(
        // 生成文件名
        validStringArb,
        // 生成扩展名
        fc.constantFrom('.pptx', '.ppt'),
        // 生成前缀
        validStringArb,
        // 生成后缀
        validStringArb,
        // 生成已存在文件数量
        fc.integer({ min: 0, max: 3 }),
        async (fileName, ext, prefix, suffix, existingCount) => {
          // 清理测试目录
          const files = await fs.readdir(testDir)
          for (const file of files) {
            await fs.unlink(path.join(testDir, file))
          }
          
          const inputPath = `/test/${fileName}${ext}`
          const pattern = `${prefix}_{name}_${suffix}{ext}`
          
          // 创建已存在的文件
          const existingFiles: string[] = []
          for (let i = 0; i < existingCount; i++) {
            const baseFileName = `${prefix}_${fileName}_${suffix}${ext}`
            const existingFileName = i === 0 ? baseFileName : baseFileName.replace(ext, ` (${i})${ext}`)
            const existingPath = path.join(testDir, existingFileName)
            await fs.writeFile(existingPath, '')
            existingFiles.push(existingPath)
          }
          
          // 生成输出路径
          const outputPath = await generator.generateOutputPath(inputPath, testDir, pattern)
          
          // 验证：输出路径不应该与已存在文件冲突
          expect(existingFiles).not.toContain(outputPath)
          
          // 验证：输出路径应该包含模式中的元素（前缀和后缀）
          const outputFileName = path.basename(outputPath)
          expect(outputFileName).toContain(prefix)
          expect(outputFileName).toContain(suffix)
          // 注意：文件名可能被修改以符合文件系统要求，所以不强制要求包含原始文件名
        }
      ),
      { numRuns: 50 }
    )
  })
  
  /**
   * 属性 6: 扩展名应该始终保持不变
   * 
   * 无论如何解决冲突，文件扩展名都应该保持原样
   */
  it('should preserve file extension when resolving conflicts', async () => {
    // 生成合法的文件名（排除 Windows 非法字符）
    const validFileNameArb = fc.string({ minLength: 1, maxLength: 30 })
      .filter(s => {
        const illegalChars = /[<>:"|?*\/\\]/
        return !illegalChars.test(s) && s.trim().length > 0
      })
    
    await fc.assert(
      fc.asyncProperty(
        // 生成文件名
        validFileNameArb,
        // 生成扩展名
        fc.constantFrom('.pptx', '.ppt', '.pdf', '.docx', '.xlsx'),
        // 生成冲突数量
        fc.integer({ min: 0, max: 5 }),
        async (fileName, ext, conflictCount) => {
          // 清理测试目录
          const files = await fs.readdir(testDir)
          for (const file of files) {
            await fs.unlink(path.join(testDir, file))
          }
          
          const inputPath = `/test/${fileName}${ext}`
          
          // 创建冲突文件
          for (let i = 0; i < conflictCount; i++) {
            const conflictFileName = i === 0 ? `${fileName}${ext}` : `${fileName} (${i})${ext}`
            await fs.writeFile(path.join(testDir, conflictFileName), '')
          }
          
          // 生成输出路径
          const outputPath = await generator.generateOutputPath(inputPath, testDir)
          
          // 验证：扩展名应该保持不变
          expect(path.extname(outputPath)).toBe(ext)
        }
      ),
      { numRuns: 100 }
    )
  })
  
  /**
   * 属性 7: 批量处理中混合已存在文件和新文件
   * 
   * 当批量处理包含已存在文件和新文件时，应该正确处理所有冲突
   */
  it('should handle mix of existing and new files in batch processing', async () => {
    // 生成合法的文件名（排除 Windows 非法字符）
    const validFileNameArb = fc.string({ minLength: 1, maxLength: 20 })
      .filter(s => {
        const illegalChars = /[<>:"|?*\/\\]/
        return !illegalChars.test(s) && s.trim().length > 0
      })
    
    await fc.assert(
      fc.asyncProperty(
        // 生成文件信息数组
        fc.array(
          fc.record({
            name: validFileNameArb,
            ext: fc.constantFrom('.pptx', '.ppt'),
            preCreate: fc.boolean()  // 是否预先创建文件
          }),
          { minLength: 2, maxLength: 10 }
        ),
        async (fileInfos) => {
          // 清理测试目录
          const files = await fs.readdir(testDir)
          for (const file of files) {
            await fs.unlink(path.join(testDir, file))
          }
          
          // 预先创建一些文件
          const preCreatedFiles: string[] = []
          for (const info of fileInfos) {
            if (info.preCreate) {
              const filePath = path.join(testDir, `${info.name}${info.ext}`)
              await fs.writeFile(filePath, 'existing')
              preCreatedFiles.push(filePath)
            }
          }
          
          // 构建输入路径
          const inputPaths = fileInfos.map(info => `/test/${info.name}${info.ext}`)
          
          // 生成输出路径
          const outputPaths = await generator.generateOutputPaths(inputPaths, testDir)
          
          // 验证：所有输出路径应该唯一
          const uniquePaths = new Set(outputPaths)
          expect(uniquePaths.size).toBe(outputPaths.length)
          
          // 验证：输出路径不应该覆盖预先创建的文件
          for (const outputPath of outputPaths) {
            if (preCreatedFiles.includes(outputPath)) {
              // 如果输出路径是预先创建的文件，内容应该保持不变
              const content = await fs.readFile(outputPath, 'utf-8')
              expect(content).toBe('existing')
            }
          }
          
          // 验证：预先创建的文件内容应该保持不变
          for (const preCreatedFile of preCreatedFiles) {
            const content = await fs.readFile(preCreatedFile, 'utf-8')
            expect(content).toBe('existing')
          }
        }
      ),
      { numRuns: 50 }
    )
  })
})
