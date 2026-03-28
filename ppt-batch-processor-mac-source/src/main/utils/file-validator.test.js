import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileValidator } from './file-validator';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import PizZip from 'pizzip';
/**
 * 文件验证器单元测试
 *
 * 测试需求:
 * - 1.3: 检查文件格式（PPTX/PPT）
 * - 21.2: 验证文件完整性
 */
describe('FileValidator', () => {
    let validator;
    let tempDir;
    beforeEach(async () => {
        validator = new FileValidator();
        // 创建临时测试目录
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'file-validator-test-'));
    });
    afterEach(async () => {
        // 清理临时目录
        try {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
        catch (error) {
            // 忽略清理错误
        }
    });
    describe('文件存在性检查', () => {
        it('应该拒绝不存在的文件', async () => {
            const result = await validator.validateFile('/nonexistent/file.pptx');
            expect(result.valid).toBe(false);
            expect(result.format).toBe('unknown');
            expect(result.error).toContain('文件不存在');
        });
    });
    describe('文件格式检查', () => {
        it('应该拒绝非 PPT/PPTX 文件扩展名', async () => {
            const testFile = path.join(tempDir, 'test.txt');
            await fs.writeFile(testFile, 'test content');
            const result = await validator.validateFile(testFile);
            expect(result.valid).toBe(false);
            expect(result.format).toBe('unknown');
            expect(result.error).toContain('不支持的文件格式');
            expect(result.error).toContain('.txt');
        });
        it('应该接受 .pptx 扩展名', async () => {
            const testFile = path.join(tempDir, 'test.pptx');
            // 创建一个有效的 PPTX 文件（最小 ZIP 结构）
            const zip = new PizZip();
            zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>');
            zip.file('_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>');
            zip.folder('ppt');
            const content = zip.generate({ type: 'nodebuffer' });
            await fs.writeFile(testFile, content);
            const result = await validator.validateFile(testFile);
            expect(result.valid).toBe(true);
            expect(result.format).toBe('pptx');
        });
        it('应该接受 .ppt 扩展名', async () => {
            const testFile = path.join(tempDir, 'test.ppt');
            // 创建一个带有 PPT 签名的文件
            const pptSignature = Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]);
            const content = Buffer.concat([pptSignature, Buffer.alloc(100)]);
            await fs.writeFile(testFile, content);
            const result = await validator.validateFile(testFile);
            expect(result.valid).toBe(true);
            expect(result.format).toBe('ppt');
        });
    });
    describe('文件大小检查', () => {
        it('应该拒绝空文件', async () => {
            const testFile = path.join(tempDir, 'empty.pptx');
            await fs.writeFile(testFile, '');
            const result = await validator.validateFile(testFile);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('文件为空');
        });
        it('应该拒绝超过大小限制的文件', async () => {
            const testFile = path.join(tempDir, 'large.pptx');
            // 创建一个 1KB 的文件
            const content = Buffer.alloc(1024);
            await fs.writeFile(testFile, content);
            // 设置最大文件大小为 512 字节
            validator.setMaxFileSize(512);
            const result = await validator.validateFile(testFile);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('超过限制');
        });
        it('应该接受在大小限制内的文件', async () => {
            const testFile = path.join(tempDir, 'small.pptx');
            // 创建一个有效的小 PPTX 文件
            const zip = new PizZip();
            zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>');
            zip.file('_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>');
            zip.folder('ppt');
            const content = zip.generate({ type: 'nodebuffer' });
            await fs.writeFile(testFile, content);
            // 设置最大文件大小为 10MB
            validator.setMaxFileSize(10 * 1024 * 1024);
            const result = await validator.validateFile(testFile);
            expect(result.valid).toBe(true);
        });
    });
    describe('文件签名验证', () => {
        it('应该识别有效的 PPTX 签名（ZIP 格式）', async () => {
            const testFile = path.join(tempDir, 'valid.pptx');
            // PPTX 文件签名：PK\x03\x04
            const zip = new PizZip();
            zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>');
            zip.file('_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>');
            zip.folder('ppt');
            const content = zip.generate({ type: 'nodebuffer' });
            await fs.writeFile(testFile, content);
            const result = await validator.validateFile(testFile);
            expect(result.valid).toBe(true);
            expect(result.format).toBe('pptx');
        });
        it('应该识别有效的 PPT 签名（OLE 格式）', async () => {
            const testFile = path.join(tempDir, 'valid.ppt');
            // PPT 文件签名：\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1
            const pptSignature = Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]);
            const content = Buffer.concat([pptSignature, Buffer.alloc(100)]);
            await fs.writeFile(testFile, content);
            const result = await validator.validateFile(testFile);
            expect(result.valid).toBe(true);
            expect(result.format).toBe('ppt');
        });
        it('应该拒绝无效的文件签名', async () => {
            const testFile = path.join(tempDir, 'invalid.pptx');
            // 写入无效的签名
            const content = Buffer.from('INVALID_SIGNATURE');
            await fs.writeFile(testFile, content);
            const result = await validator.validateFile(testFile);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('文件签名无效');
        });
    });
    describe('PPTX 结构验证', () => {
        it('应该验证 PPTX 文件包含必需的文件', async () => {
            const testFile = path.join(tempDir, 'complete.pptx');
            const zip = new PizZip();
            zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>');
            zip.file('_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>');
            zip.folder('ppt');
            const content = zip.generate({ type: 'nodebuffer' });
            await fs.writeFile(testFile, content);
            const result = await validator.validateFile(testFile);
            expect(result.valid).toBe(true);
            expect(result.format).toBe('pptx');
        });
        it('应该拒绝缺少 [Content_Types].xml 的 PPTX 文件', async () => {
            const testFile = path.join(tempDir, 'incomplete.pptx');
            const zip = new PizZip();
            // 缺少 [Content_Types].xml
            zip.file('_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>');
            zip.folder('ppt');
            const content = zip.generate({ type: 'nodebuffer' });
            await fs.writeFile(testFile, content);
            const result = await validator.validateFile(testFile);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('[Content_Types].xml');
        });
        it('应该拒绝缺少 _rels/.rels 的 PPTX 文件', async () => {
            const testFile = path.join(tempDir, 'incomplete2.pptx');
            const zip = new PizZip();
            zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>');
            // 缺少 _rels/.rels
            zip.folder('ppt');
            const content = zip.generate({ type: 'nodebuffer' });
            await fs.writeFile(testFile, content);
            const result = await validator.validateFile(testFile);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('_rels/.rels');
        });
        it('应该拒绝缺少 ppt 目录的 PPTX 文件', async () => {
            const testFile = path.join(tempDir, 'incomplete3.pptx');
            const zip = new PizZip();
            zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>');
            zip.file('_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>');
            // 缺少 ppt 目录
            const content = zip.generate({ type: 'nodebuffer' });
            await fs.writeFile(testFile, content);
            const result = await validator.validateFile(testFile);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('ppt 目录');
        });
        it('应该拒绝损坏的 ZIP 文件', async () => {
            const testFile = path.join(tempDir, 'corrupted.pptx');
            // 写入 ZIP 签名但内容损坏
            const zipSignature = Buffer.from([0x50, 0x4B, 0x03, 0x04]);
            const corruptedContent = Buffer.concat([zipSignature, Buffer.from('CORRUPTED_DATA')]);
            await fs.writeFile(testFile, corruptedContent);
            const result = await validator.validateFile(testFile);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('无法解压');
        });
    });
    describe('批量验证', () => {
        it('应该批量验证多个文件', async () => {
            // 创建测试文件
            const validFile = path.join(tempDir, 'valid.pptx');
            const zip = new PizZip();
            zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>');
            zip.file('_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>');
            zip.folder('ppt');
            const content = zip.generate({ type: 'nodebuffer' });
            await fs.writeFile(validFile, content);
            const invalidFile = path.join(tempDir, 'invalid.txt');
            await fs.writeFile(invalidFile, 'test');
            const nonexistentFile = path.join(tempDir, 'nonexistent.pptx');
            const results = await validator.validateFiles([validFile, invalidFile, nonexistentFile]);
            expect(results).toHaveLength(3);
            expect(results[0].valid).toBe(true);
            expect(results[1].valid).toBe(false);
            expect(results[2].valid).toBe(false);
        });
    });
    describe('配置管理', () => {
        it('应该允许设置最大文件大小', () => {
            const newSize = 100 * 1024 * 1024; // 100MB
            validator.setMaxFileSize(newSize);
            expect(validator.getMaxFileSize()).toBe(newSize);
        });
        it('应该拒绝设置无效的最大文件大小', () => {
            expect(() => validator.setMaxFileSize(0)).toThrow('最大文件大小必须大于 0');
            expect(() => validator.setMaxFileSize(-100)).toThrow('最大文件大小必须大于 0');
        });
        it('应该使用默认的最大文件大小', () => {
            const defaultValidator = new FileValidator();
            expect(defaultValidator.getMaxFileSize()).toBe(500 * 1024 * 1024); // 500MB
        });
        it('应该允许在构造函数中设置最大文件大小', () => {
            const customSize = 200 * 1024 * 1024; // 200MB
            const customValidator = new FileValidator(customSize);
            expect(customValidator.getMaxFileSize()).toBe(customSize);
        });
    });
    describe('边界情况', () => {
        it('应该处理文件路径中的特殊字符', async () => {
            const specialDir = path.join(tempDir, '特殊 文件夹');
            await fs.mkdir(specialDir, { recursive: true });
            const testFile = path.join(specialDir, '测试文件.pptx');
            const zip = new PizZip();
            zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>');
            zip.file('_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>');
            zip.folder('ppt');
            const content = zip.generate({ type: 'nodebuffer' });
            await fs.writeFile(testFile, content);
            const result = await validator.validateFile(testFile);
            expect(result.valid).toBe(true);
        });
        it('应该处理大小写不敏感的扩展名', async () => {
            const testFile = path.join(tempDir, 'test.PPTX');
            const zip = new PizZip();
            zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>');
            zip.file('_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>');
            zip.folder('ppt');
            const content = zip.generate({ type: 'nodebuffer' });
            await fs.writeFile(testFile, content);
            const result = await validator.validateFile(testFile);
            expect(result.valid).toBe(true);
            expect(result.format).toBe('pptx');
        });
    });
    describe('错误处理', () => {
        it('应该优雅地处理文件读取错误', async () => {
            const testFile = path.join(tempDir, 'test.pptx');
            await fs.writeFile(testFile, 'test');
            // 删除文件后立即验证（模拟并发访问问题）
            await fs.unlink(testFile);
            const result = await validator.validateFile(testFile);
            expect(result.valid).toBe(false);
            expect(result.error).toBeDefined();
        });
    });
});
