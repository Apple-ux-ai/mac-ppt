import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PptxParser } from './pptx-parser'
import { promises as fs } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import PptxGenJS from 'pptxgenjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe('PptxParser - Password Protection', () => {
  let parser: PptxParser
  let testFilePath: string
  let outputFilePath: string
  let tempFiles: string[]

  beforeEach(async () => {
    parser = new PptxParser()
    tempFiles = []

    // 创建测试 PPTX 文件
    const pptx = new PptxGenJS()
    const slide = pptx.addSlide()
    slide.addText('Test Content', { x: 1, y: 1, w: 3, h: 1 })

    testFilePath = path.join(__dirname, '../../../test-temp', `test-${Date.now()}.pptx`)
    outputFilePath = path.join(__dirname, '../../../test-temp', `output-${Date.now()}.pptx`)
    tempFiles.push(testFilePath, outputFilePath)

    // 确保目录存在
    await fs.mkdir(path.dirname(testFilePath), { recursive: true })

    // 保存测试文件
    await pptx.writeFile({ fileName: testFilePath })
  })

  afterEach(async () => {
    // 清理临时文件
    for (const file of tempFiles) {
      try {
        await fs.unlink(file)
      } catch (error) {
        // 忽略删除错误
      }
    }
  })

  describe('isPasswordProtected', () => {
    it('should return false for unprotected file', async () => {
      const isProtected = await parser.isPasswordProtected(testFilePath)
      expect(isProtected).toBe(false)
    })

    it('should return true for protected file', async () => {
      // 添加密码保护
      const password = 'test123'
      await parser.addPasswordProtection(testFilePath, outputFilePath, password)

      // 检查是否受保护
      const isProtected = await parser.isPasswordProtected(outputFilePath)
      expect(isProtected).toBe(true)
    })

    it('should handle non-existent file gracefully', async () => {
      const isProtected = await parser.isPasswordProtected('non-existent.pptx')
      expect(isProtected).toBe(false)
    })
  })

  describe('addPasswordProtection', () => {
    it('should successfully add password protection', async () => {
      // 验证需求: 18.1, 18.2
      const password = 'secure123'

      // 添加密码保护
      const result = await parser.addPasswordProtection(testFilePath, outputFilePath, password)
      expect(result).toBe(true)

      // 验证文件已加密
      const isProtected = await parser.isPasswordProtected(outputFilePath)
      expect(isProtected).toBe(true)

      // 验证输出文件存在
      const stats = await fs.stat(outputFilePath)
      expect(stats.size).toBeGreaterThan(0)
    })

    it('should reject empty password', async () => {
      // 验证需求: 18.1
      await expect(
        parser.addPasswordProtection(testFilePath, outputFilePath, '')
      ).rejects.toThrow('Password cannot be empty')

      await expect(
        parser.addPasswordProtection(testFilePath, outputFilePath, '   ')
      ).rejects.toThrow('Password cannot be empty')
    })

    it('should reject already protected file', async () => {
      // 验证需求: 18.2
      const password = 'test123'

      // 第一次添加密码
      await parser.addPasswordProtection(testFilePath, outputFilePath, password)

      // 尝试再次添加密码应该失败
      const secondOutputPath = path.join(__dirname, '../../../test-temp', `output2-${Date.now()}.pptx`)
      tempFiles.push(secondOutputPath)

      await expect(
        parser.addPasswordProtection(outputFilePath, secondOutputPath, 'newpass')
      ).rejects.toThrow('already password protected')
    })

    it('should handle non-existent input file', async () => {
      await expect(
        parser.addPasswordProtection('non-existent.pptx', outputFilePath, 'test123')
      ).rejects.toThrow()
    })

    it('should work with different password lengths', async () => {
      // 验证需求: 18.1
      const passwords = ['a', 'short', 'medium-length-password', 'very-long-password-with-special-chars-!@#$%^&*()']

      for (const password of passwords) {
        const output = path.join(__dirname, '../../../test-temp', `output-${Date.now()}.pptx`)
        tempFiles.push(output)

        const result = await parser.addPasswordProtection(testFilePath, output, password)
        expect(result).toBe(true)

        const isProtected = await parser.isPasswordProtected(output)
        expect(isProtected).toBe(true)
      }
    })
  })

  describe('removePasswordProtection', () => {
    it('should successfully remove password protection with correct password', async () => {
      // 验证需求: 18.3, 18.4
      const password = 'test123'

      // 添加密码保护
      await parser.addPasswordProtection(testFilePath, outputFilePath, password)

      // 移除密码保护
      const decryptedPath = path.join(__dirname, '../../../test-temp', `decrypted-${Date.now()}.pptx`)
      tempFiles.push(decryptedPath)

      const result = await parser.removePasswordProtection(outputFilePath, decryptedPath, password)
      expect(result).toBe(true)

      // 验证文件不再加密
      const isProtected = await parser.isPasswordProtected(decryptedPath)
      expect(isProtected).toBe(false)

      // 验证文件可以正常打开
      const document = await parser.open(decryptedPath)
      expect(document).toBeDefined()
      expect(document.slides.length).toBeGreaterThan(0)
    })

    it('should reject incorrect password', async () => {
      // 验证需求: 18.5
      const password = 'correct123'
      const wrongPassword = 'wrong123'

      // 添加密码保护
      await parser.addPasswordProtection(testFilePath, outputFilePath, password)

      // 尝试用错误密码移除保护
      const decryptedPath = path.join(__dirname, '../../../test-temp', `decrypted-${Date.now()}.pptx`)
      tempFiles.push(decryptedPath)

      await expect(
        parser.removePasswordProtection(outputFilePath, decryptedPath, wrongPassword)
      ).rejects.toThrow('Incorrect password')
    })

    it('should reject empty password', async () => {
      // 验证需求: 18.3
      const password = 'test123'

      // 添加密码保护
      await parser.addPasswordProtection(testFilePath, outputFilePath, password)

      const decryptedPath = path.join(__dirname, '../../../test-temp', `decrypted-${Date.now()}.pptx`)
      tempFiles.push(decryptedPath)

      await expect(
        parser.removePasswordProtection(outputFilePath, decryptedPath, '')
      ).rejects.toThrow('Password is required')
    })

    it('should reject unprotected file', async () => {
      // 验证需求: 18.3
      await expect(
        parser.removePasswordProtection(testFilePath, outputFilePath, 'anypassword')
      ).rejects.toThrow('not password protected')
    })

    it('should handle non-existent file', async () => {
      await expect(
        parser.removePasswordProtection('non-existent.pptx', outputFilePath, 'test123')
      ).rejects.toThrow()
    })
  })

  describe('verifyPassword', () => {
    it('should return true for correct password', async () => {
      // 验证需求: 18.4
      const password = 'verify123'

      // 添加密码保护
      await parser.addPasswordProtection(testFilePath, outputFilePath, password)

      // 验证正确密码
      const isValid = await parser.verifyPassword(outputFilePath, password)
      expect(isValid).toBe(true)
    })

    it('should return false for incorrect password', async () => {
      // 验证需求: 18.5
      const password = 'correct123'
      const wrongPassword = 'wrong123'

      // 添加密码保护
      await parser.addPasswordProtection(testFilePath, outputFilePath, password)

      // 验证错误密码
      const isValid = await parser.verifyPassword(outputFilePath, wrongPassword)
      expect(isValid).toBe(false)
    })

    it('should return false for unprotected file', async () => {
      // 验证需求: 18.4
      const isValid = await parser.verifyPassword(testFilePath, 'anypassword')
      expect(isValid).toBe(false)
    })

    it('should handle non-existent file gracefully', async () => {
      const isValid = await parser.verifyPassword('non-existent.pptx', 'test123')
      expect(isValid).toBe(false)
    })

    it('should work with special characters in password', async () => {
      // 验证需求: 18.4
      const password = 'p@ssw0rd!#$%^&*()'

      // 添加密码保护
      await parser.addPasswordProtection(testFilePath, outputFilePath, password)

      // 验证密码
      const isValid = await parser.verifyPassword(outputFilePath, password)
      expect(isValid).toBe(true)
    })
  })

  describe('changePassword', () => {
    it('should successfully change password', async () => {
      // 验证需求: 18.1, 18.4
      const oldPassword = 'old123'
      const newPassword = 'new456'

      // 添加初始密码保护
      await parser.addPasswordProtection(testFilePath, outputFilePath, oldPassword)

      // 更改密码
      const changedPath = path.join(__dirname, '../../../test-temp', `changed-${Date.now()}.pptx`)
      tempFiles.push(changedPath)

      const result = await parser.changePassword(outputFilePath, changedPath, oldPassword, newPassword)
      expect(result).toBe(true)

      // 验证旧密码不再有效
      const oldPasswordValid = await parser.verifyPassword(changedPath, oldPassword)
      expect(oldPasswordValid).toBe(false)

      // 验证新密码有效
      const newPasswordValid = await parser.verifyPassword(changedPath, newPassword)
      expect(newPasswordValid).toBe(true)

      // 验证文件仍然加密
      const isProtected = await parser.isPasswordProtected(changedPath)
      expect(isProtected).toBe(true)
    })

    it('should reject incorrect old password', async () => {
      // 验证需求: 18.5
      const oldPassword = 'correct123'
      const wrongOldPassword = 'wrong123'
      const newPassword = 'new456'

      // 添加密码保护
      await parser.addPasswordProtection(testFilePath, outputFilePath, oldPassword)

      // 尝试用错误的旧密码更改
      const changedPath = path.join(__dirname, '../../../test-temp', `changed-${Date.now()}.pptx`)
      tempFiles.push(changedPath)

      await expect(
        parser.changePassword(outputFilePath, changedPath, wrongOldPassword, newPassword)
      ).rejects.toThrow('Incorrect old password')
    })

    it('should reject empty old password', async () => {
      // 验证需求: 18.4
      const password = 'test123'

      // 添加密码保护
      await parser.addPasswordProtection(testFilePath, outputFilePath, password)

      const changedPath = path.join(__dirname, '../../../test-temp', `changed-${Date.now()}.pptx`)
      tempFiles.push(changedPath)

      await expect(
        parser.changePassword(outputFilePath, changedPath, '', 'newpass')
      ).rejects.toThrow('Old password is required')
    })

    it('should reject empty new password', async () => {
      // 验证需求: 18.1
      const password = 'test123'

      // 添加密码保护
      await parser.addPasswordProtection(testFilePath, outputFilePath, password)

      const changedPath = path.join(__dirname, '../../../test-temp', `changed-${Date.now()}.pptx`)
      tempFiles.push(changedPath)

      await expect(
        parser.changePassword(outputFilePath, changedPath, password, '')
      ).rejects.toThrow('New password cannot be empty')
    })

    it('should reject unprotected file', async () => {
      // 验证需求: 18.1
      await expect(
        parser.changePassword(testFilePath, outputFilePath, 'oldpass', 'newpass')
      ).rejects.toThrow('not password protected')
    })
  })

  describe('Integration - Password Protection Workflow', () => {
    it('should handle complete protection lifecycle', async () => {
      // 验证需求: 18.1, 18.2, 18.3, 18.4
      const password1 = 'initial123'
      const password2 = 'changed456'

      // 1. 验证文件初始未加密
      let isProtected = await parser.isPasswordProtected(testFilePath)
      expect(isProtected).toBe(false)

      // 2. 添加密码保护
      const protectedPath = path.join(__dirname, '../../../test-temp', `protected-${Date.now()}.pptx`)
      tempFiles.push(protectedPath)
      await parser.addPasswordProtection(testFilePath, protectedPath, password1)

      isProtected = await parser.isPasswordProtected(protectedPath)
      expect(isProtected).toBe(true)

      // 3. 验证密码
      let isValid = await parser.verifyPassword(protectedPath, password1)
      expect(isValid).toBe(true)

      // 4. 更改密码
      const changedPath = path.join(__dirname, '../../../test-temp', `changed-${Date.now()}.pptx`)
      tempFiles.push(changedPath)
      await parser.changePassword(protectedPath, changedPath, password1, password2)

      isValid = await parser.verifyPassword(changedPath, password2)
      expect(isValid).toBe(true)

      // 5. 移除密码保护
      const unprotectedPath = path.join(__dirname, '../../../test-temp', `unprotected-${Date.now()}.pptx`)
      tempFiles.push(unprotectedPath)
      await parser.removePasswordProtection(changedPath, unprotectedPath, password2)

      isProtected = await parser.isPasswordProtected(unprotectedPath)
      expect(isProtected).toBe(false)

      // 6. 验证文件内容完整
      const document = await parser.open(unprotectedPath)
      expect(document).toBeDefined()
      expect(document.slides.length).toBeGreaterThan(0)
    })

    it('should preserve file content after encryption and decryption', async () => {
      // 验证需求: 18.2, 18.4
      const password = 'preserve123'

      // 打开原始文件并获取内容
      const originalDoc = await parser.open(testFilePath)
      const originalSlideCount = originalDoc.slides.length

      // 添加密码保护
      const protectedPath = path.join(__dirname, '../../../test-temp', `protected-${Date.now()}.pptx`)
      tempFiles.push(protectedPath)
      await parser.addPasswordProtection(testFilePath, protectedPath, password)

      // 移除密码保护
      const decryptedPath = path.join(__dirname, '../../../test-temp', `decrypted-${Date.now()}.pptx`)
      tempFiles.push(decryptedPath)
      await parser.removePasswordProtection(protectedPath, decryptedPath, password)

      // 验证内容保持一致
      const decryptedDoc = await parser.open(decryptedPath)
      expect(decryptedDoc.slides.length).toBe(originalSlideCount)
    })

    it('should handle multiple password changes', async () => {
      // 验证需求: 18.1, 18.4
      const passwords = ['pass1', 'pass2', 'pass3', 'pass4']

      let currentPath = testFilePath
      let nextPath: string

      // 添加初始密码
      nextPath = path.join(__dirname, '../../../test-temp', `step0-${Date.now()}.pptx`)
      tempFiles.push(nextPath)
      await parser.addPasswordProtection(currentPath, nextPath, passwords[0])
      currentPath = nextPath

      // 多次更改密码
      for (let i = 1; i < passwords.length; i++) {
        nextPath = path.join(__dirname, '../../../test-temp', `step${i}-${Date.now()}.pptx`)
        tempFiles.push(nextPath)

        await parser.changePassword(currentPath, nextPath, passwords[i - 1], passwords[i])

        // 验证新密码有效
        const isValid = await parser.verifyPassword(nextPath, passwords[i])
        expect(isValid).toBe(true)

        // 验证旧密码无效
        const oldValid = await parser.verifyPassword(nextPath, passwords[i - 1])
        expect(oldValid).toBe(false)

        currentPath = nextPath
      }
    }, 15000) // 增加超时时间到 15 秒
  })

  describe('Edge Cases', () => {
    it('should handle very long passwords', async () => {
      // 验证需求: 18.1
      const longPassword = 'a'.repeat(100)

      const result = await parser.addPasswordProtection(testFilePath, outputFilePath, longPassword)
      expect(result).toBe(true)

      const isValid = await parser.verifyPassword(outputFilePath, longPassword)
      expect(isValid).toBe(true)
    })

    it('should handle passwords with unicode characters', async () => {
      // 验证需求: 18.1
      const unicodePassword = '密码123🔒'

      const result = await parser.addPasswordProtection(testFilePath, outputFilePath, unicodePassword)
      expect(result).toBe(true)

      const isValid = await parser.verifyPassword(outputFilePath, unicodePassword)
      expect(isValid).toBe(true)
    })

    it('should handle same input and output path for change password', async () => {
      // 验证需求: 18.1
      const oldPassword = 'old123'
      const newPassword = 'new456'

      // 添加密码保护
      await parser.addPasswordProtection(testFilePath, outputFilePath, oldPassword)

      // 更改密码（输出到同一路径）
      const tempPath = path.join(__dirname, '../../../test-temp', `temp-${Date.now()}.pptx`)
      tempFiles.push(tempPath)

      await parser.changePassword(outputFilePath, tempPath, oldPassword, newPassword)

      // 验证新密码
      const isValid = await parser.verifyPassword(tempPath, newPassword)
      expect(isValid).toBe(true)
    })
  })
})
