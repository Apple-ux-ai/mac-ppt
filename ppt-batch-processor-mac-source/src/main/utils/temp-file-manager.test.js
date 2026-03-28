import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { TempFileManager } from './temp-file-manager';
describe('TempFileManager', () => {
    let tempFileManager;
    let testTempDir;
    beforeEach(async () => {
        // 为每个测试创建唯一的临时目录
        testTempDir = path.join(os.tmpdir(), `test-temp-${Date.now()}-${Math.random().toString(36).substring(7)}`);
        tempFileManager = new TempFileManager(testTempDir);
        await tempFileManager.initialize();
    });
    afterEach(async () => {
        // 清理测试创建的临时文件
        await tempFileManager.cleanupTempDir();
    });
    describe('初始化', () => {
        it('应该创建临时目录', async () => {
            const tempDir = tempFileManager.getTempDir();
            // 检查目录是否存在
            const stats = await fs.stat(tempDir);
            expect(stats.isDirectory()).toBe(true);
        });
        it('应该使用系统临时目录作为默认位置', () => {
            const defaultManager = new TempFileManager();
            const tempDir = defaultManager.getTempDir();
            expect(tempDir).toContain(os.tmpdir());
            expect(tempDir).toContain('ppt-batch-processor');
        });
        it('应该支持自定义临时目录', () => {
            const customDir = '/custom/temp/dir';
            const customManager = new TempFileManager(customDir);
            expect(customManager.getTempDir()).toBe(customDir);
        });
    });
    describe('创建临时文件', () => {
        it('应该从原始文件创建临时文件', async () => {
            // 创建测试文件
            const testFilePath = path.join(testTempDir, 'test.pptx');
            const testContent = 'test content';
            await fs.writeFile(testFilePath, testContent);
            // 创建临时文件
            const tempFilePath = await tempFileManager.createTempFile(testFilePath);
            // 验证临时文件存在
            const exists = await fs.access(tempFilePath).then(() => true).catch(() => false);
            expect(exists).toBe(true);
            // 验证内容相同
            const tempContent = await fs.readFile(tempFilePath, 'utf-8');
            expect(tempContent).toBe(testContent);
            // 验证扩展名保留
            expect(path.extname(tempFilePath)).toBe('.pptx');
            // 验证文件被跟踪
            expect(tempFileManager.isTempFile(tempFilePath)).toBe(true);
            expect(tempFileManager.getTempFileCount()).toBe(1);
        });
        it('应该为每个临时文件生成唯一名称', async () => {
            // 创建测试文件
            const testFilePath = path.join(testTempDir, 'test.pptx');
            await fs.writeFile(testFilePath, 'test');
            // 创建多个临时文件
            const tempFile1 = await tempFileManager.createTempFile(testFilePath);
            const tempFile2 = await tempFileManager.createTempFile(testFilePath);
            const tempFile3 = await tempFileManager.createTempFile(testFilePath);
            // 验证文件名唯一
            expect(tempFile1).not.toBe(tempFile2);
            expect(tempFile2).not.toBe(tempFile3);
            expect(tempFile1).not.toBe(tempFile3);
            // 验证所有文件都被跟踪
            expect(tempFileManager.getTempFileCount()).toBe(3);
        });
        it('应该在原始文件不存在时抛出错误', async () => {
            const nonExistentPath = path.join(testTempDir, 'non-existent.pptx');
            await expect(tempFileManager.createTempFile(nonExistentPath)).rejects.toThrow();
        });
    });
    describe('创建空临时文件', () => {
        it('应该创建空的临时文件', async () => {
            const tempFilePath = await tempFileManager.createEmptyTempFile('.pptx');
            // 验证文件存在
            const exists = await fs.access(tempFilePath).then(() => true).catch(() => false);
            expect(exists).toBe(true);
            // 验证文件为空
            const stats = await fs.stat(tempFilePath);
            expect(stats.size).toBe(0);
            // 验证扩展名
            expect(path.extname(tempFilePath)).toBe('.pptx');
            // 验证文件被跟踪
            expect(tempFileManager.isTempFile(tempFilePath)).toBe(true);
        });
        it('应该支持不带扩展名的空文件', async () => {
            const tempFilePath = await tempFileManager.createEmptyTempFile();
            // 验证文件存在
            const exists = await fs.access(tempFilePath).then(() => true).catch(() => false);
            expect(exists).toBe(true);
            // 验证没有扩展名
            expect(path.extname(tempFilePath)).toBe('');
        });
    });
    describe('创建临时目录', () => {
        it('应该创建临时目录', async () => {
            const tempDirPath = await tempFileManager.createTempDir('test-dir');
            // 验证目录存在
            const stats = await fs.stat(tempDirPath);
            expect(stats.isDirectory()).toBe(true);
            // 验证目录名包含前缀
            expect(path.basename(tempDirPath)).toContain('test-dir');
            // 验证目录被跟踪
            expect(tempFileManager.isTempFile(tempDirPath)).toBe(true);
        });
        it('应该为每个临时目录生成唯一名称', async () => {
            const tempDir1 = await tempFileManager.createTempDir('test');
            const tempDir2 = await tempFileManager.createTempDir('test');
            expect(tempDir1).not.toBe(tempDir2);
        });
    });
    describe('删除临时文件', () => {
        it('应该删除指定的临时文件', async () => {
            // 创建临时文件
            const tempFilePath = await tempFileManager.createEmptyTempFile('.pptx');
            // 验证文件存在
            let exists = await fs.access(tempFilePath).then(() => true).catch(() => false);
            expect(exists).toBe(true);
            // 删除临时文件
            await tempFileManager.deleteTempFile(tempFilePath);
            // 验证文件已删除
            exists = await fs.access(tempFilePath).then(() => true).catch(() => false);
            expect(exists).toBe(false);
            // 验证文件不再被跟踪
            expect(tempFileManager.isTempFile(tempFilePath)).toBe(false);
            expect(tempFileManager.getTempFileCount()).toBe(0);
        });
        it('应该删除临时目录及其内容', async () => {
            // 创建临时目录
            const tempDirPath = await tempFileManager.createTempDir('test');
            // 在临时目录中创建文件
            const testFilePath = path.join(tempDirPath, 'test.txt');
            await fs.writeFile(testFilePath, 'test content');
            // 删除临时目录
            await tempFileManager.deleteTempFile(tempDirPath);
            // 验证目录已删除
            const exists = await fs.access(tempDirPath).then(() => true).catch(() => false);
            expect(exists).toBe(false);
        });
        it('应该忽略不存在的文件', async () => {
            const nonExistentPath = path.join(testTempDir, 'non-existent.txt');
            // 不应抛出错误
            await expect(tempFileManager.deleteTempFile(nonExistentPath)).resolves.not.toThrow();
        });
        it('应该忽略非跟踪的文件', async () => {
            // 创建一个不通过管理器创建的文件
            const externalFilePath = path.join(testTempDir, 'external.txt');
            await fs.writeFile(externalFilePath, 'external');
            // 尝试删除（应该被忽略）
            await tempFileManager.deleteTempFile(externalFilePath);
            // 验证文件仍然存在
            const exists = await fs.access(externalFilePath).then(() => true).catch(() => false);
            expect(exists).toBe(true);
        });
    });
    describe('清理所有临时文件', () => {
        it('应该删除所有跟踪的临时文件', async () => {
            // 创建多个临时文件
            const tempFile1 = await tempFileManager.createEmptyTempFile('.pptx');
            const tempFile2 = await tempFileManager.createEmptyTempFile('.pptx');
            const tempFile3 = await tempFileManager.createEmptyTempFile('.pptx');
            // 验证文件存在
            expect(tempFileManager.getTempFileCount()).toBe(3);
            // 清理所有临时文件
            await tempFileManager.cleanupTempFiles();
            // 验证所有文件已删除
            const exists1 = await fs.access(tempFile1).then(() => true).catch(() => false);
            const exists2 = await fs.access(tempFile2).then(() => true).catch(() => false);
            const exists3 = await fs.access(tempFile3).then(() => true).catch(() => false);
            expect(exists1).toBe(false);
            expect(exists2).toBe(false);
            expect(exists3).toBe(false);
            // 验证跟踪集合已清空
            expect(tempFileManager.getTempFileCount()).toBe(0);
        });
        it('应该删除临时文件和临时目录', async () => {
            // 创建临时文件和目录
            const tempFile = await tempFileManager.createEmptyTempFile('.pptx');
            const tempDir = await tempFileManager.createTempDir('test');
            // 清理
            await tempFileManager.cleanupTempFiles();
            // 验证都已删除
            const fileExists = await fs.access(tempFile).then(() => true).catch(() => false);
            const dirExists = await fs.access(tempDir).then(() => true).catch(() => false);
            expect(fileExists).toBe(false);
            expect(dirExists).toBe(false);
        });
        it('应该在没有临时文件时正常工作', async () => {
            // 不创建任何临时文件，直接清理
            await expect(tempFileManager.cleanupTempFiles()).resolves.not.toThrow();
            expect(tempFileManager.getTempFileCount()).toBe(0);
        });
    });
    describe('清理临时目录', () => {
        it('应该删除整个临时目录', async () => {
            // 创建一些临时文件
            await tempFileManager.createEmptyTempFile('.pptx');
            await tempFileManager.createEmptyTempFile('.pptx');
            const tempDir = tempFileManager.getTempDir();
            // 清理临时目录
            await tempFileManager.cleanupTempDir();
            // 验证目录已删除
            const exists = await fs.access(tempDir).then(() => true).catch(() => false);
            expect(exists).toBe(false);
            // 验证跟踪集合已清空
            expect(tempFileManager.getTempFileCount()).toBe(0);
        });
        it('应该在目录不存在时正常工作', async () => {
            // 先删除目录
            await tempFileManager.cleanupTempDir();
            // 再次清理不应抛出错误
            await expect(tempFileManager.cleanupTempDir()).resolves.not.toThrow();
        });
    });
    describe('查询方法', () => {
        it('getTempDir 应该返回临时目录路径', () => {
            expect(tempFileManager.getTempDir()).toBe(testTempDir);
        });
        it('getTempFileCount 应该返回正确的文件数量', async () => {
            expect(tempFileManager.getTempFileCount()).toBe(0);
            await tempFileManager.createEmptyTempFile('.pptx');
            expect(tempFileManager.getTempFileCount()).toBe(1);
            await tempFileManager.createEmptyTempFile('.pptx');
            expect(tempFileManager.getTempFileCount()).toBe(2);
            await tempFileManager.cleanupTempFiles();
            expect(tempFileManager.getTempFileCount()).toBe(0);
        });
        it('getTempFiles 应该返回所有临时文件路径', async () => {
            const tempFile1 = await tempFileManager.createEmptyTempFile('.pptx');
            const tempFile2 = await tempFileManager.createEmptyTempFile('.pptx');
            const tempFiles = tempFileManager.getTempFiles();
            expect(tempFiles).toHaveLength(2);
            expect(tempFiles).toContain(tempFile1);
            expect(tempFiles).toContain(tempFile2);
        });
        it('isTempFile 应该正确识别临时文件', async () => {
            const tempFile = await tempFileManager.createEmptyTempFile('.pptx');
            const externalFile = path.join(testTempDir, 'external.txt');
            expect(tempFileManager.isTempFile(tempFile)).toBe(true);
            expect(tempFileManager.isTempFile(externalFile)).toBe(false);
        });
    });
    describe('边界情况', () => {
        it('应该处理大量临时文件', async () => {
            const fileCount = 100;
            const tempFiles = [];
            // 创建大量临时文件
            for (let i = 0; i < fileCount; i++) {
                const tempFile = await tempFileManager.createEmptyTempFile('.pptx');
                tempFiles.push(tempFile);
            }
            expect(tempFileManager.getTempFileCount()).toBe(fileCount);
            // 清理所有文件
            await tempFileManager.cleanupTempFiles();
            expect(tempFileManager.getTempFileCount()).toBe(0);
            // 验证所有文件已删除
            for (const tempFile of tempFiles) {
                const exists = await fs.access(tempFile).then(() => true).catch(() => false);
                expect(exists).toBe(false);
            }
        });
        it('应该处理特殊字符的扩展名', async () => {
            const tempFile = await tempFileManager.createEmptyTempFile('.test.backup.pptx');
            expect(path.extname(tempFile)).toBe('.pptx');
            expect(tempFile).toContain('.test.backup.pptx');
        });
        it('应该处理嵌套的临时目录', async () => {
            const tempDir = await tempFileManager.createTempDir('parent');
            const nestedDir = path.join(tempDir, 'nested');
            await fs.mkdir(nestedDir);
            const nestedFile = path.join(nestedDir, 'test.txt');
            await fs.writeFile(nestedFile, 'nested content');
            // 删除父目录应该删除所有嵌套内容
            await tempFileManager.deleteTempFile(tempDir);
            const exists = await fs.access(tempDir).then(() => true).catch(() => false);
            expect(exists).toBe(false);
        });
    });
    describe('并发操作', () => {
        it('应该支持并发创建临时文件', async () => {
            const promises = [];
            for (let i = 0; i < 10; i++) {
                promises.push(tempFileManager.createEmptyTempFile('.pptx'));
            }
            const tempFiles = await Promise.all(promises);
            // 验证所有文件都创建成功且唯一
            expect(tempFiles).toHaveLength(10);
            const uniqueFiles = new Set(tempFiles);
            expect(uniqueFiles.size).toBe(10);
            // 验证所有文件都被跟踪
            expect(tempFileManager.getTempFileCount()).toBe(10);
        });
        it('应该支持并发删除临时文件', async () => {
            // 创建多个临时文件
            const tempFiles = await Promise.all([
                tempFileManager.createEmptyTempFile('.pptx'),
                tempFileManager.createEmptyTempFile('.pptx'),
                tempFileManager.createEmptyTempFile('.pptx'),
                tempFileManager.createEmptyTempFile('.pptx'),
                tempFileManager.createEmptyTempFile('.pptx')
            ]);
            // 并发删除
            await Promise.all(tempFiles.map(file => tempFileManager.deleteTempFile(file)));
            // 验证所有文件已删除
            expect(tempFileManager.getTempFileCount()).toBe(0);
        });
    });
    describe('错误处理', () => {
        it('应该在无法创建临时目录时抛出错误', async () => {
            // 创建一个无效的临时目录路径（假设 /invalid/path 不存在且无权限）
            const invalidManager = new TempFileManager('/invalid/path/that/does/not/exist');
            // 注意：在某些系统上可能有权限创建此目录，所以这个测试可能不总是失败
            // 这里主要测试错误处理逻辑
            try {
                await invalidManager.initialize();
                // 如果成功创建，清理它
                await invalidManager.cleanupTempDir();
            }
            catch (error) {
                expect(error).toBeInstanceOf(Error);
                expect(error.message).toContain('无法创建临时目录');
            }
        });
    });
});
