import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { FormatConverter } from './format-converter'
import { existsSync } from 'fs'
import { mkdir, rename, readdir, unlink, rmdir } from 'fs/promises'

// 创建一个包装对象来避免初始化顺序问题
const mockExecAsyncWrapper = {
  fn: vi.fn()
}

// Mock 模块
vi.mock('child_process', () => ({
  exec: vi.fn()
}))
vi.mock('fs')
vi.mock('fs/promises')

// Mock sharp - 使用工厂函数避免初始化顺序问题
vi.mock('sharp', () => {
  const mockSharpInstance = {
    resize: vi.fn().mockReturnThis(),
    png: vi.fn().mockReturnThis(),
    jpeg: vi.fn().mockReturnThis(),
    toFile: vi.fn().mockResolvedValue(undefined)
  }
  
  const mockSharpFn = vi.fn(() => mockSharpInstance)
  
  return {
    default: mockSharpFn,
    __mockSharpInstance: mockSharpInstance,
    __mockSharpFn: mockSharpFn
  }
})

// Mock util.promisify 来返回我们的 mock 函数
vi.mock('util', () => ({
  promisify: vi.fn(() => (...args: any[]) => mockExecAsyncWrapper.fn(...args))
}))

describe('FormatConverter', () => {
  let converter: FormatConverter
  let mockSharpFn: any
  let mockSharpInstance: any

  beforeEach(async () => {
    // 获取 mock 实例
    const sharpModule = await import('sharp')
    mockSharpFn = (sharpModule as any).__mockSharpFn
    mockSharpInstance = (sharpModule as any).__mockSharpInstance
    
    // 重置 mock
    mockExecAsyncWrapper.fn = vi.fn()
    mockSharpFn.mockClear()
    mockSharpInstance.resize.mockClear().mockReturnThis()
    mockSharpInstance.png.mockClear().mockReturnThis()
    mockSharpInstance.jpeg.mockClear().mockReturnThis()
    mockSharpInstance.toFile.mockClear().mockResolvedValue(undefined)
    converter = new FormatConverter()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('checkAvailability', () => {
    it('应该检测到系统 PATH 中的 LibreOffice', async () => {
      // 模拟成功的 LibreOffice 版本检查
      mockExecAsyncWrapper.fn.mockResolvedValue({ stdout: 'LibreOffice 7.0.0.0', stderr: '' })

      const available = await converter.checkAvailability()
      expect(available).toBe(true)
    })

    it('应该在 LibreOffice 未安装时返回 false', async () => {
      // 模拟所有路径都失败
      mockExecAsyncWrapper.fn.mockRejectedValue(new Error('Command not found'))

      const available = await converter.checkAvailability()
      expect(available).toBe(false)
    })

    it('应该尝试多个常见的 LibreOffice 安装路径', async () => {
      let callCount = 0
      mockExecAsyncWrapper.fn.mockImplementation(() => {
        callCount++
        if (callCount === 3) {
          // 第三次调用成功
          return Promise.resolve({ stdout: 'LibreOffice 7.0.0.0', stderr: '' })
        } else {
          return Promise.reject(new Error('Not found'))
        }
      })

      const available = await converter.checkAvailability()
      expect(available).toBe(true)
      expect(callCount).toBeGreaterThanOrEqual(3)
    })
  })

  describe('convertToPdf', () => {
    beforeEach(() => {
      // 模拟 LibreOffice 可用
      mockExecAsyncWrapper.fn.mockImplementation((cmd: string) => {
        if (cmd.includes('--version')) {
          return Promise.resolve({ stdout: 'LibreOffice 7.0.0.0', stderr: '' })
        } else if (cmd.includes('--convert-to pdf')) {
          return Promise.resolve({ stdout: 'convert completed', stderr: '' })
        } else {
          return Promise.reject(new Error('Unknown command'))
        }
      })
    })

    it('应该成功转换 PPTX 为 PDF', async () => {
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(mkdir).mockResolvedValue(undefined)
      vi.mocked(rename).mockResolvedValue(undefined)

      await converter.convertToPdf('/input/test.pptx', '/output/test.pdf')

      // 验证调用了正确的命令
      expect(mockExecAsyncWrapper.fn).toHaveBeenCalled()
      const calls = mockExecAsyncWrapper.fn.mock.calls
      const convertCall = calls.find((call: any) => call[0].includes('--convert-to pdf'))
      expect(convertCall).toBeDefined()
      if (convertCall) {
        expect(convertCall[0]).toContain('--headless')
        expect(convertCall[0]).toContain('test.pptx')
      }
    })

    it('应该在输入文件不存在时抛出错误', async () => {
      vi.mocked(existsSync).mockReturnValue(false)

      await expect(
        converter.convertToPdf('/nonexistent/test.pptx', '/output/test.pdf')
      ).rejects.toThrow('输入文件不存在')
    })

    it('应该在 LibreOffice 未安装时抛出错误', async () => {
      vi.mocked(existsSync).mockReturnValue(true)
      
      // 模拟 LibreOffice 不可用
      mockExecAsyncWrapper.fn.mockRejectedValue(new Error('Command not found'))

      await expect(
        converter.convertToPdf('/input/test.pptx', '/output/test.pdf')
      ).rejects.toThrow('LibreOffice 未安装或不可用')
    })

    it('应该处理转换超时', async () => {
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(mkdir).mockResolvedValue(undefined)

      // 模拟超时错误
      mockExecAsyncWrapper.fn.mockImplementation((cmd: string) => {
        if (cmd.includes('--version')) {
          return Promise.resolve({ stdout: 'LibreOffice 7.0.0.0', stderr: '' })
        } else if (cmd.includes('--convert-to pdf')) {
          const error: any = new Error('Timeout')
          error.killed = true
          error.signal = 'SIGTERM'
          return Promise.reject(error)
        }
      })

      await expect(
        converter.convertToPdf('/input/test.pptx', '/output/test.pdf')
      ).rejects.toThrow('PDF 转换超时')
    })

    it('应该创建输出目录如果不存在', async () => {
      let existsCallCount = 0
      vi.mocked(existsSync).mockImplementation(() => {
        existsCallCount++
        // 第一次调用（检查输入文件）返回 true
        // 第二次调用（检查输出目录）返回 false
        // 第三次调用（检查生成的文件）返回 true
        if (existsCallCount === 1) return true
        if (existsCallCount === 2) return false
        return true
      })
      vi.mocked(mkdir).mockResolvedValue(undefined)
      vi.mocked(rename).mockResolvedValue(undefined)

      await converter.convertToPdf('/input/test.pptx', '/output/test.pdf')

      expect(mkdir).toHaveBeenCalledWith(expect.any(String), { recursive: true })
    })

    it('应该处理转换失败的情况', async () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        // 输入文件存在，但生成的 PDF 不存在
        return path.toString().includes('input')
      })
      vi.mocked(mkdir).mockResolvedValue(undefined)

      mockExecAsyncWrapper.fn.mockImplementation((cmd: string) => {
        if (cmd.includes('--version')) {
          return Promise.resolve({ stdout: 'LibreOffice 7.0.0.0', stderr: '' })
        } else if (cmd.includes('--convert-to pdf')) {
          return Promise.resolve({ stdout: '', stderr: 'Conversion error' })
        }
      })

      await expect(
        converter.convertToPdf('/input/test.pptx', '/output/test.pdf')
      ).rejects.toThrow('PDF 转换失败')
    })
  })

  describe('convertToImages', () => {
    beforeEach(() => {
      mockExecAsyncWrapper.fn.mockImplementation((cmd: string) => {
        if (cmd.includes('--version')) {
          return Promise.resolve({ stdout: 'LibreOffice 7.0.0.0', stderr: '' })
        } else if (cmd.includes('--convert-to')) {
          return Promise.resolve({ stdout: 'convert completed', stderr: '' })
        } else {
          return Promise.reject(new Error('Unknown command'))
        }
      })
    })

    it('应该使用 sharp 成功转换 PPTX 为 PNG 图片', async () => {
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(mkdir).mockResolvedValue(undefined)
      vi.mocked(readdir).mockResolvedValue(['test_1.png', 'test_2.png'] as any)
      vi.mocked(unlink).mockResolvedValue(undefined)
      vi.mocked(rmdir).mockResolvedValue(undefined)

      const images = await converter.convertToImages('/input/test.pptx', '/output', 'png')

      // 验证生成了正确数量的图片
      expect(images).toHaveLength(2)
      expect(images[0]).toContain('test_slide_1.png')
      expect(images[1]).toContain('test_slide_2.png')

      // 验证 sharp 被调用
      expect(mockSharpFn).toHaveBeenCalledTimes(2)
      expect(mockSharpInstance.png).toHaveBeenCalledTimes(2)
      expect(mockSharpInstance.toFile).toHaveBeenCalledTimes(2)
    })

    it('应该使用 sharp 支持 JPG 格式', async () => {
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(mkdir).mockResolvedValue(undefined)
      vi.mocked(readdir).mockResolvedValue(['test_1.png'] as any)
      vi.mocked(unlink).mockResolvedValue(undefined)
      vi.mocked(rmdir).mockResolvedValue(undefined)

      const images = await converter.convertToImages('/input/test.pptx', '/output', 'jpg')

      expect(images).toHaveLength(1)
      expect(images[0]).toContain('test_slide_1.jpg')
      
      // 验证使用了 JPEG 格式
      expect(mockSharpInstance.jpeg).toHaveBeenCalledWith({
        quality: 90,
        mozjpeg: true
      })
      expect(mockSharpInstance.toFile).toHaveBeenCalled()
    })

    it('应该支持自定义 JPG 质量', async () => {
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(mkdir).mockResolvedValue(undefined)
      vi.mocked(readdir).mockResolvedValue(['test_1.png'] as any)
      vi.mocked(unlink).mockResolvedValue(undefined)
      vi.mocked(rmdir).mockResolvedValue(undefined)

      await converter.convertToImages('/input/test.pptx', '/output', 'jpg', { quality: 80 })

      expect(mockSharpInstance.jpeg).toHaveBeenCalledWith({
        quality: 80,
        mozjpeg: true
      })
    })

    it('应该支持自定义 PNG 压缩级别', async () => {
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(mkdir).mockResolvedValue(undefined)
      vi.mocked(readdir).mockResolvedValue(['test_1.png'] as any)
      vi.mocked(unlink).mockResolvedValue(undefined)
      vi.mocked(rmdir).mockResolvedValue(undefined)

      await converter.convertToImages('/input/test.pptx', '/output', 'png', { compressionLevel: 9 })

      expect(mockSharpInstance.png).toHaveBeenCalledWith({
        compressionLevel: 9,
        quality: 100
      })
    })

    it('应该支持调整图片大小', async () => {
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(mkdir).mockResolvedValue(undefined)
      vi.mocked(readdir).mockResolvedValue(['test_1.png'] as any)
      vi.mocked(unlink).mockResolvedValue(undefined)
      vi.mocked(rmdir).mockResolvedValue(undefined)

      await converter.convertToImages('/input/test.pptx', '/output', 'png', { 
        width: 1920, 
        height: 1080 
      })

      expect(mockSharpInstance.resize).toHaveBeenCalledWith(1920, 1080, {
        fit: 'inside',
        withoutEnlargement: true
      })
    })

    it('应该为每个幻灯片生成独立的图片文件', async () => {
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(mkdir).mockResolvedValue(undefined)
      vi.mocked(readdir).mockResolvedValue(['test_1.png', 'test_2.png', 'test_3.png'] as any)
      vi.mocked(unlink).mockResolvedValue(undefined)
      vi.mocked(rmdir).mockResolvedValue(undefined)

      const images = await converter.convertToImages('/input/test.pptx', '/output', 'png')

      // 验证生成了 3 个独立的图片文件
      expect(images).toHaveLength(3)
      expect(images[0]).toMatch(/test_slide_1\.png$/)
      expect(images[1]).toMatch(/test_slide_2\.png$/)
      expect(images[2]).toMatch(/test_slide_3\.png$/)

      // 验证每个图片都通过 sharp 处理
      expect(mockSharpFn).toHaveBeenCalledTimes(3)
      expect(mockSharpInstance.toFile).toHaveBeenCalledTimes(3)
    })

    it('应该清理临时文件', async () => {
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(mkdir).mockResolvedValue(undefined)
      vi.mocked(readdir).mockResolvedValue(['test_1.png'] as any)
      vi.mocked(unlink).mockResolvedValue(undefined)
      vi.mocked(rmdir).mockResolvedValue(undefined)

      await converter.convertToImages('/input/test.pptx', '/output', 'png')

      // 验证临时文件被删除
      expect(unlink).toHaveBeenCalled()
      expect(rmdir).toHaveBeenCalled()
    })

    it('应该在未生成图片时抛出错误', async () => {
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(mkdir).mockResolvedValue(undefined)
      vi.mocked(readdir).mockResolvedValue([] as any)

      await expect(
        converter.convertToImages('/input/test.pptx', '/output', 'png')
      ).rejects.toThrow('未生成图片文件')
    })

    it('应该在输入文件不存在时抛出错误', async () => {
      vi.mocked(existsSync).mockReturnValue(false)

      await expect(
        converter.convertToImages('/nonexistent/test.pptx', '/output', 'png')
      ).rejects.toThrow('输入文件不存在')
    })

    it('应该在转换失败时清理临时文件', async () => {
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(mkdir).mockResolvedValue(undefined)
      vi.mocked(readdir).mockResolvedValue(['test_1.png'] as any)
      vi.mocked(unlink).mockResolvedValue(undefined)
      vi.mocked(rmdir).mockResolvedValue(undefined)

      // 模拟 sharp 处理失败
      mockSharpInstance.toFile.mockRejectedValueOnce(new Error('Sharp processing failed'))

      await expect(
        converter.convertToImages('/input/test.pptx', '/output', 'png')
      ).rejects.toThrow('图片转换失败')

      // 验证临时文件被清理
      expect(unlink).toHaveBeenCalled()
      expect(rmdir).toHaveBeenCalled()
    })
  })

  describe('convertToHtml', () => {
    beforeEach(() => {
      mockExecAsyncWrapper.fn.mockImplementation((cmd: string) => {
        if (cmd.includes('--version')) {
          return Promise.resolve({ stdout: 'LibreOffice 7.0.0.0', stderr: '' })
        } else if (cmd.includes('--convert-to html')) {
          return Promise.resolve({ stdout: 'convert completed', stderr: '' })
        } else {
          return Promise.reject(new Error('Unknown command'))
        }
      })
    })

    it('应该成功转换 PPTX 为 HTML', async () => {
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(mkdir).mockResolvedValue(undefined)
      vi.mocked(rename).mockResolvedValue(undefined)

      await converter.convertToHtml('/input/test.pptx', '/output/test.html')

      const calls = mockExecAsyncWrapper.fn.mock.calls
      const convertCall = calls.find((call: any) => call[0].includes('--convert-to html'))
      expect(convertCall).toBeDefined()
    })

    it('应该在输入文件不存在时抛出错误', async () => {
      vi.mocked(existsSync).mockReturnValue(false)

      await expect(
        converter.convertToHtml('/nonexistent/test.pptx', '/output/test.html')
      ).rejects.toThrow('输入文件不存在')
    })
  })

  describe('convertFormat', () => {
    beforeEach(() => {
      mockExecAsyncWrapper.fn.mockImplementation((cmd: string) => {
        if (cmd.includes('--version')) {
          return Promise.resolve({ stdout: 'LibreOffice 7.0.0.0', stderr: '' })
        } else if (cmd.includes('--convert-to')) {
          return Promise.resolve({ stdout: 'convert completed', stderr: '' })
        } else {
          return Promise.reject(new Error('Unknown command'))
        }
      })
    })

    it('应该成功转换 PPT 为 PPTX', async () => {
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(mkdir).mockResolvedValue(undefined)
      vi.mocked(rename).mockResolvedValue(undefined)

      await converter.convertFormat('/input/test.ppt', '/output/test.pptx', 'pptx')

      const calls = mockExecAsyncWrapper.fn.mock.calls
      const convertCall = calls.find((call: any) => call[0].includes('--convert-to pptx'))
      expect(convertCall).toBeDefined()
      if (convertCall) {
        expect(convertCall[0]).toContain('--convert-to pptx')
      }
    })

    it('应该成功转换 PPTX 为 PPT', async () => {
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(mkdir).mockResolvedValue(undefined)
      vi.mocked(rename).mockResolvedValue(undefined)

      await converter.convertFormat('/input/test.pptx', '/output/test.ppt', 'ppt')

      const calls = mockExecAsyncWrapper.fn.mock.calls
      const convertCall = calls.find((call: any) => call[0].includes('--convert-to ppt'))
      expect(convertCall).toBeDefined()
      if (convertCall) {
        expect(convertCall[0]).toContain('--convert-to ppt')
      }
    })

    it('应该在输入文件不存在时抛出错误', async () => {
      vi.mocked(existsSync).mockReturnValue(false)

      await expect(
        converter.convertFormat('/nonexistent/test.ppt', '/output/test.pptx', 'pptx')
      ).rejects.toThrow('输入文件不存在')
    })
  })

  describe('setTimeout and getTimeout', () => {
    it('应该允许设置超时时间', () => {
      converter.setTimeout(60000)
      expect(converter.getTimeout()).toBe(60000)
    })

    it('应该在超时时间小于等于 0 时抛出错误', () => {
      expect(() => converter.setTimeout(0)).toThrow('超时时间必须大于 0')
      expect(() => converter.setTimeout(-1000)).toThrow('超时时间必须大于 0')
    })

    it('应该有默认的超时时间', () => {
      const defaultTimeout = converter.getTimeout()
      expect(defaultTimeout).toBe(120000) // 2 分钟
    })
  })

  describe('错误处理', () => {
    it('应该处理 LibreOffice 命令执行错误', async () => {
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(mkdir).mockResolvedValue(undefined)

      mockExecAsyncWrapper.fn.mockImplementation((cmd: string) => {
        if (cmd.includes('--version')) {
          return Promise.resolve({ stdout: 'LibreOffice 7.0.0.0', stderr: '' })
        } else if (cmd.includes('--convert-to')) {
          return Promise.reject(new Error('Conversion failed'))
        }
      })

      await expect(
        converter.convertToPdf('/input/test.pptx', '/output/test.pdf')
      ).rejects.toThrow('PDF 转换失败')
    })

    it('应该在所有转换方法中验证 LibreOffice 可用性', async () => {
      vi.mocked(existsSync).mockReturnValue(true)
      
      // 模拟 LibreOffice 不可用
      mockExecAsyncWrapper.fn.mockRejectedValue(new Error('Command not found'))

      await expect(converter.convertToPdf('/input/test.pptx', '/output/test.pdf'))
        .rejects.toThrow('LibreOffice 未安装或不可用')
      
      await expect(converter.convertToImages('/input/test.pptx', '/output', 'png'))
        .rejects.toThrow('LibreOffice 未安装或不可用')
      
      await expect(converter.convertToHtml('/input/test.pptx', '/output/test.html'))
        .rejects.toThrow('LibreOffice 未安装或不可用')
      
      await expect(converter.convertFormat('/input/test.ppt', '/output/test.pptx', 'pptx'))
        .rejects.toThrow('LibreOffice 未安装或不可用')
    })
  })
})

