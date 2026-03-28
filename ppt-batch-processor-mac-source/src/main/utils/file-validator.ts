import * as fs from 'fs'
import * as path from 'path'
import { createHash } from 'crypto'
import PizZip from 'pizzip'
import { ErrorCode, AppError } from './error-codes'

type MessageParams = Record<string, string | number>

export interface FileValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
  info: FileInfo
}

export interface ValidationError {
  code: ErrorCode
  message: string
  messageKey?: string
  messageParams?: MessageParams
  details?: string
}

export interface ValidationWarning {
  code: string
  message: string
  messageKey?: string
  messageParams?: MessageParams
  details?: string
}

export interface FileInfo {
  path: string
  name: string
  extension: string
  size: number
  sizeFormatted: string
  created: Date
  modified: Date
  accessed: Date
  isReadOnly: boolean
  isHidden: boolean
  hash?: string
  slideCount?: number
  hasMacros?: boolean
  hasPassword?: boolean
  author?: string
  lastModifiedBy?: string
}

export interface ValidationOptions {
  checkExists?: boolean
  checkAccess?: boolean
  checkLocked?: boolean
  checkSize?: boolean
  maxSizeMB?: number
  checkFormat?: boolean
  checkIntegrity?: boolean
  checkPassword?: boolean
  checkMacros?: boolean
  computeHash?: boolean
  extractMetadata?: boolean
}

const DEFAULT_OPTIONS: Required<ValidationOptions> = {
  checkExists: true,
  checkAccess: true,
  checkLocked: true,
  checkSize: true,
  maxSizeMB: 500,
  checkFormat: true,
  checkIntegrity: true,
  checkPassword: true,
  checkMacros: false,
  computeHash: false,
  extractMetadata: true,
}

const MAX_FILE_SIZE = 500 * 1024 * 1024
const MIN_FILE_SIZE = 1024
const VALID_EXTENSIONS = ['.pptx', '.ppt', '.pptm']

class FileValidator {
  private lockedFilesCache: Map<string, { locked: boolean; timestamp: number }> = new Map()
  private cacheTimeout = 5000

  async validateFile(filePath: string, options?: ValidationOptions): Promise<FileValidationResult> {
    const opts = { ...DEFAULT_OPTIONS, ...options }
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []
    let info: FileInfo | null = null

    try {
      if (opts.checkExists) {
        const exists = await this.checkExists(filePath)
        if (!exists) {
          errors.push({
            code: ErrorCode.FILE_NOT_FOUND,
            message: '文件不存在',
            messageKey: 'main.validation.fileNotFound',
            messageParams: { path: filePath },
            details: `路径: ${filePath}`,
          })
          return { valid: false, errors, warnings, info: this.createEmptyInfo(filePath) }
        }
      }

      const stats = await fs.promises.stat(filePath)
      info = await this.extractBasicInfo(filePath, stats)

      if (opts.checkAccess) {
        const accessError = await this.checkAccess(filePath)
        if (accessError) {
          errors.push(accessError)
        }
      }

      if (opts.checkLocked && errors.length === 0) {
        const lockedError = await this.checkLocked(filePath)
        if (lockedError) {
          errors.push(lockedError)
        }
      }

      if (opts.checkSize) {
        const sizeError = this.checkSize(info.size, opts.maxSizeMB)
        if (sizeError) {
          errors.push(sizeError)
        }
      }

      if (opts.checkFormat) {
        const formatError = this.checkFormat(info.extension)
        if (formatError) {
          errors.push(formatError)
        }
      }

      if (opts.checkIntegrity && errors.length === 0) {
        const integrityResult = await this.checkIntegrity(filePath)
        if (integrityResult.error) {
          errors.push(integrityResult.error)
        }
        warnings.push(...integrityResult.warnings)
        if (integrityResult.slideCount) {
          info.slideCount = integrityResult.slideCount
        }
      }

      if (opts.checkPassword && errors.length === 0) {
        const passwordInfo = await this.checkPassword(filePath)
        info.hasPassword = passwordInfo.hasPassword
        if (passwordInfo.hasPassword) {
          warnings.push({
            code: 'FILE_ENCRYPTED',
            message: '文件已加密',
            messageKey: 'main.validation.fileEncrypted',
            details: '需要密码才能处理此文件',
          })
        }
      }

      if (opts.checkMacros && errors.length === 0) {
        const macroInfo = await this.checkMacros(filePath)
        info.hasMacros = macroInfo.hasMacros
        if (macroInfo.hasMacros) {
          warnings.push({
            code: 'FILE_HAS_MACROS',
            message: '文件包含宏',
            messageKey: 'main.validation.fileHasMacros',
            details: '处理时宏将被移除',
          })
        }
      }

      if (opts.computeHash) {
        info.hash = await this.computeFileHash(filePath)
      }

      if (opts.extractMetadata && errors.length === 0) {
        const metadata = await this.extractMetadata(filePath)
        info.author = metadata.author
        info.lastModifiedBy = metadata.lastModifiedBy
      }
    } catch (error) {
      if (error instanceof AppError) {
        errors.push({
          code: error.code,
          message: error.userMessage,
          messageKey: 'main.validation.appError',
          messageParams: { message: error.userMessage },
          details: error.message,
        })
      } else {
        errors.push({
          code: ErrorCode.UNKNOWN_ERROR,
          message: '验证过程中发生错误',
          messageKey: 'main.validation.validationFailed',
          details: error instanceof Error ? error.message : String(error),
        })
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      info: info || this.createEmptyInfo(filePath),
    }
  }

  async validateFiles(
    filePaths: string[],
    options?: ValidationOptions
  ): Promise<Map<string, FileValidationResult>> {
    const results = new Map<string, FileValidationResult>()

    await Promise.all(
      filePaths.map(async (filePath) => {
        const result = await this.validateFile(filePath, options)
        results.set(filePath, result)
      })
    )

    return results
  }

  async quickValidate(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath, fs.constants.R_OK)
      const stats = await fs.promises.stat(filePath)
      return stats.isFile() && stats.size > 0
    } catch {
      return false
    }
  }

  async isFileLocked(filePath: string): Promise<boolean> {
    const cached = this.lockedFilesCache.get(filePath)
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.locked
    }

    try {
      const fd = await fs.promises.open(filePath, 'r+')
      await fd.close()
      this.lockedFilesCache.set(filePath, { locked: false, timestamp: Date.now() })
      return false
    } catch (error) {
      const err = error as NodeJS.ErrnoException
      if (err.code === 'EBUSY' || err.code === 'EPERM' || err.code === 'EACCES') {
        this.lockedFilesCache.set(filePath, { locked: true, timestamp: Date.now() })
        return true
      }
      return false
    }
  }

  private async checkExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath, fs.constants.F_OK)
      return true
    } catch {
      return false
    }
  }

  private async checkAccess(filePath: string): Promise<ValidationError | null> {
    try {
      await fs.promises.access(filePath, fs.constants.R_OK)
      return null
    } catch {
      return {
        code: ErrorCode.FILE_ACCESS_DENIED,
        message: '没有文件读取权限',
        messageKey: 'main.validation.fileReadPermissionDenied',
        messageParams: { path: filePath },
        details: `路径: ${filePath}`,
      }
    }
  }

  private async checkLocked(filePath: string): Promise<ValidationError | null> {
    const isLocked = await this.isFileLocked(filePath)
    if (isLocked) {
      return {
        code: ErrorCode.FILE_LOCKED,
        message: '文件被其他程序占用',
        messageKey: 'main.validation.fileLocked',
        details: '请关闭 PowerPoint 或其他正在使用该文件的程序',
      }
    }
    return null
  }

  private checkSize(size: number, maxSizeMB?: number): ValidationError | null {
    const maxSize = (maxSizeMB || 500) * 1024 * 1024

    if (size === 0) {
      return {
        code: ErrorCode.FILE_CORRUPTED,
        message: '文件为空',
        messageKey: 'main.validation.fileEmpty',
        details: '文件大小为 0 字节',
      }
    }

    if (size > maxSize) {
      return {
        code: ErrorCode.FILE_TOO_LARGE,
        message: '文件大小超过限制',
        messageKey: 'main.validation.fileTooLarge',
        messageParams: {
          size: this.formatSize(size),
          maxSize: this.formatSize(maxSize),
        },
        details: `文件大小: ${this.formatSize(size)}, 最大允许: ${this.formatSize(maxSize)}`,
      }
    }

    return null
  }

  private checkFormat(extension: string): ValidationError | null {
    const ext = extension.toLowerCase()
    if (!VALID_EXTENSIONS.includes(ext)) {
      return {
        code: ErrorCode.FILE_INVALID_FORMAT,
        message: '文件格式无效',
        messageKey: 'main.validation.invalidFileFormat',
        messageParams: { formats: VALID_EXTENSIONS.join(', ') },
        details: `支持的格式: ${VALID_EXTENSIONS.join(', ')}`,
      }
    }
    return null
  }

  private async checkIntegrity(filePath: string): Promise<{
    error: ValidationError | null
    warnings: ValidationWarning[]
    slideCount?: number
  }> {
    const warnings: ValidationWarning[] = []

    try {
      const ext = path.extname(filePath).toLowerCase()

      if (ext === '.pptx' || ext === '.pptm') {
        const content = await fs.promises.readFile(filePath)
        const zip = new PizZip(content)
        const entries = Object.keys(zip.files)

        const hasContentTypes = entries.includes('[Content_Types].xml')
        if (!hasContentTypes) {
          return {
            error: {
              code: ErrorCode.FILE_CORRUPTED,
              message: 'PPTX 文件结构损坏',
              messageKey: 'main.validation.pptxStructureCorrupted',
              messageParams: { file: '[Content_Types].xml' },
              details: '缺少 [Content_Types].xml',
            },
            warnings,
          }
        }

        const slideEntries = entries.filter((e) => e.match(/ppt\/slides\/slide\d+\.xml/))
        const slideCount = slideEntries.length

        if (slideCount === 0) {
          warnings.push({
            code: 'NO_SLIDES',
            message: '文件没有幻灯片',
            messageKey: 'main.validation.fileHasNoSlides',
            details: 'PPTX 文件不包含任何幻灯片',
          })
        }

        const hasPresentation = entries.includes('ppt/presentation.xml')
        if (!hasPresentation) {
          return {
            error: {
              code: ErrorCode.FILE_CORRUPTED,
              message: 'PPTX 文件结构损坏',
              messageKey: 'main.validation.pptxStructureCorrupted',
              messageParams: { file: 'presentation.xml' },
              details: '缺少 presentation.xml',
            },
            warnings,
          }
        }

        return { error: null, warnings, slideCount }
      }

      if (ext === '.ppt') {
        return { error: null, warnings }
      }

      return { error: null, warnings }
    } catch (error) {
      return {
        error: {
          code: ErrorCode.FILE_CORRUPTED,
          message: '文件完整性检查失败',
          messageKey: 'main.validation.fileIntegrityCheckFailed',
          details: error instanceof Error ? error.message : String(error),
        },
        warnings,
      }
    }
  }

  private async checkPassword(filePath: string): Promise<{ hasPassword: boolean }> {
    try {
      const ext = path.extname(filePath).toLowerCase()

      if (ext === '.pptx' || ext === '.pptm') {
        const content = await fs.promises.readFile(filePath)
        try {
          const zip = new PizZip(content)
          if (zip.files['EncryptedPackage']) {
            return { hasPassword: true }
          }
        } catch (e: any) {
          if (e.message && e.message.includes('encrypted')) {
            return { hasPassword: true }
          }
        }
      }

      return { hasPassword: false }
    } catch {
      return { hasPassword: false }
    }
  }

  private async checkMacros(filePath: string): Promise<{ hasMacros: boolean }> {
    try {
      const ext = path.extname(filePath).toLowerCase()

      if (ext === '.pptm') {
        return { hasMacros: true }
      }

      if (ext === '.pptx') {
        const content = await fs.promises.readFile(filePath)
        const zip = new PizZip(content)
        const entries = Object.keys(zip.files)

        const hasVba = entries.some((e) => e.includes('vba') || e.includes('vbaProject'))

        return { hasMacros: hasVba }
      }

      return { hasMacros: false }
    } catch {
      return { hasMacros: false }
    }
  }

  private async extractBasicInfo(filePath: string, stats: fs.Stats): Promise<FileInfo> {
    return {
      path: filePath,
      name: path.basename(filePath),
      extension: path.extname(filePath),
      size: stats.size,
      sizeFormatted: this.formatSize(stats.size),
      created: stats.birthtime,
      modified: stats.mtime,
      accessed: stats.atime,
      isReadOnly: (stats.mode & 0o200) === 0,
      isHidden: path.basename(filePath).startsWith('.'),
    }
  }

  private async extractMetadata(filePath: string): Promise<{
    author?: string
    lastModifiedBy?: string
  }> {
    try {
      const ext = path.extname(filePath).toLowerCase()

      if (ext === '.pptx' || ext === '.pptm') {
        const content = await fs.promises.readFile(filePath)
        const zip = new PizZip(content)
        const corePropsFile = zip.files['docProps/core.xml']

        if (corePropsFile) {
          const xmlContent = corePropsFile.asText()
          const authorMatch = xmlContent.match(/<dc:creator>([^<]*)<\/dc:creator>/)
          const modifiedByMatch = xmlContent.match(
            /<cp:lastModifiedBy>([^<]*)<\/cp:lastModifiedBy>/
          )

          return {
            author: authorMatch ? authorMatch[1] : undefined,
            lastModifiedBy: modifiedByMatch ? modifiedByMatch[1] : undefined,
          }
        }
      }

      return {}
    } catch {
      return {}
    }
  }

  private async computeFileHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = createHash('sha256')
      const stream = fs.createReadStream(filePath)

      stream.on('data', (chunk) => hash.update(chunk))
      stream.on('end', () => resolve(hash.digest('hex')))
      stream.on('error', reject)
    })
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
  }

  private createEmptyInfo(filePath: string): FileInfo {
    return {
      path: filePath,
      name: path.basename(filePath),
      extension: path.extname(filePath),
      size: 0,
      sizeFormatted: '0 B',
      created: new Date(),
      modified: new Date(),
      accessed: new Date(),
      isReadOnly: false,
      isHidden: false,
    }
  }
}

export { FileValidator }
export const fileValidator = new FileValidator()
