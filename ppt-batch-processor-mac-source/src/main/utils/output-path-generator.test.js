import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { OutputPathGenerator } from './output-path-generator';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
describe('OutputPathGenerator', () => {
    let generator;
    let testDir;
    beforeEach(async () => {
        generator = new OutputPathGenerator();
        // 创建测试目录
        testDir = path.join(os.tmpdir(), `output-path-test-${Date.now()}`);
        await fs.mkdir(testDir, { recursive: true });
    });
    afterEach(async () => {
        // 清理测试目录
        try {
            await fs.rm(testDir, { recursive: true, force: true });
        }
        catch {
            // 忽略清理错误
        }
    });
    describe('generateOutputPath', () => {
        it('should generate output path without pattern', async () => {
            const inputPath = '/path/to/document.pptx';
            const outputPath = await generator.generateOutputPath(inputPath, testDir);
            expect(outputPath).toBe(path.join(testDir, 'document.pptx'));
        });
        it('should apply simple pattern', async () => {
            const inputPath = '/path/to/document.pptx';
            const pattern = '{name}_processed{ext}';
            const outputPath = await generator.generateOutputPath(inputPath, testDir, pattern);
            expect(outputPath).toBe(path.join(testDir, 'document_processed.pptx'));
        });
        it('should apply pattern with date', async () => {
            const inputPath = '/path/to/document.pptx';
            const pattern = '{name}_{date}{ext}';
            const outputPath = await generator.generateOutputPath(inputPath, testDir, pattern);
            const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            expect(outputPath).toBe(path.join(testDir, `document_${date}.pptx`));
        });
        it('should apply pattern with timestamp', async () => {
            const inputPath = '/path/to/document.pptx';
            const pattern = '{name}_{timestamp}{ext}';
            const outputPath = await generator.generateOutputPath(inputPath, testDir, pattern);
            expect(outputPath).toMatch(/document_\d+\.pptx$/);
        });
        it('should handle file name conflict by adding sequence number', async () => {
            const inputPath = '/path/to/document.pptx';
            // 创建已存在的文件
            const existingFile = path.join(testDir, 'document.pptx');
            await fs.writeFile(existingFile, '');
            const outputPath = await generator.generateOutputPath(inputPath, testDir);
            expect(outputPath).toBe(path.join(testDir, 'document (1).pptx'));
        });
        it('should handle multiple file name conflicts', async () => {
            const inputPath = '/path/to/document.pptx';
            // 创建多个已存在的文件
            await fs.writeFile(path.join(testDir, 'document.pptx'), '');
            await fs.writeFile(path.join(testDir, 'document (1).pptx'), '');
            await fs.writeFile(path.join(testDir, 'document (2).pptx'), '');
            const outputPath = await generator.generateOutputPath(inputPath, testDir);
            expect(outputPath).toBe(path.join(testDir, 'document (3).pptx'));
        });
        it('should handle conflict with pattern', async () => {
            const inputPath = '/path/to/document.pptx';
            const pattern = '{name}_processed{ext}';
            // 创建已存在的文件
            await fs.writeFile(path.join(testDir, 'document_processed.pptx'), '');
            const outputPath = await generator.generateOutputPath(inputPath, testDir, pattern);
            expect(outputPath).toBe(path.join(testDir, 'document_processed (1).pptx'));
        });
        it('should preserve file extension', async () => {
            const inputPath = '/path/to/document.ppt';
            const pattern = '{name}_output{ext}';
            const outputPath = await generator.generateOutputPath(inputPath, testDir, pattern);
            expect(outputPath).toBe(path.join(testDir, 'document_output.ppt'));
        });
        it('should handle files with multiple dots in name', async () => {
            const inputPath = '/path/to/my.document.v2.pptx';
            const pattern = '{name}_final{ext}';
            const outputPath = await generator.generateOutputPath(inputPath, testDir, pattern);
            expect(outputPath).toBe(path.join(testDir, 'my.document.v2_final.pptx'));
        });
    });
    describe('generateOutputPaths', () => {
        it('should generate multiple output paths without pattern', async () => {
            const inputPaths = [
                '/path/to/doc1.pptx',
                '/path/to/doc2.pptx',
                '/path/to/doc3.pptx'
            ];
            const outputPaths = await generator.generateOutputPaths(inputPaths, testDir);
            expect(outputPaths).toEqual([
                path.join(testDir, 'doc1.pptx'),
                path.join(testDir, 'doc2.pptx'),
                path.join(testDir, 'doc3.pptx')
            ]);
        });
        it('should apply pattern with index', async () => {
            const inputPaths = [
                '/path/to/doc1.pptx',
                '/path/to/doc2.pptx',
                '/path/to/doc3.pptx'
            ];
            const pattern = 'output_{index}_{name}{ext}';
            const outputPaths = await generator.generateOutputPaths(inputPaths, testDir, pattern);
            expect(outputPaths).toEqual([
                path.join(testDir, 'output_1_doc1.pptx'),
                path.join(testDir, 'output_2_doc2.pptx'),
                path.join(testDir, 'output_3_doc3.pptx')
            ]);
        });
        it('should apply pattern with total', async () => {
            const inputPaths = [
                '/path/to/doc1.pptx',
                '/path/to/doc2.pptx'
            ];
            const pattern = '{name}_{index}_of_{total}{ext}';
            const outputPaths = await generator.generateOutputPaths(inputPaths, testDir, pattern);
            expect(outputPaths).toEqual([
                path.join(testDir, 'doc1_1_of_2.pptx'),
                path.join(testDir, 'doc2_2_of_2.pptx')
            ]);
        });
        it('should handle conflicts in batch generation', async () => {
            const inputPaths = [
                '/path/to/document.pptx',
                '/path/to/document.pptx', // 同名文件
                '/path/to/document.pptx' // 同名文件
            ];
            const outputPaths = await generator.generateOutputPaths(inputPaths, testDir);
            expect(outputPaths).toEqual([
                path.join(testDir, 'document.pptx'),
                path.join(testDir, 'document (1).pptx'),
                path.join(testDir, 'document (2).pptx')
            ]);
        });
        it('should handle conflicts with existing files in batch', async () => {
            const inputPaths = [
                '/path/to/doc1.pptx',
                '/path/to/doc2.pptx'
            ];
            // 创建已存在的文件
            await fs.writeFile(path.join(testDir, 'doc1.pptx'), '');
            const outputPaths = await generator.generateOutputPaths(inputPaths, testDir);
            expect(outputPaths).toEqual([
                path.join(testDir, 'doc1 (1).pptx'),
                path.join(testDir, 'doc2.pptx')
            ]);
        });
        it('should handle empty input array', async () => {
            const outputPaths = await generator.generateOutputPaths([], testDir);
            expect(outputPaths).toEqual([]);
        });
        it('should handle single file in batch', async () => {
            const inputPaths = ['/path/to/document.pptx'];
            const pattern = '{name}_{index}{ext}';
            const outputPaths = await generator.generateOutputPaths(inputPaths, testDir, pattern);
            expect(outputPaths).toEqual([
                path.join(testDir, 'document_1.pptx')
            ]);
        });
    });
    describe('validatePattern', () => {
        it('should validate valid pattern', () => {
            const result = generator.validatePattern('{name}_processed{ext}');
            expect(result.valid).toBe(true);
            expect(result.error).toBeUndefined();
        });
        it('should reject pattern without {ext}', () => {
            const result = generator.validatePattern('{name}_processed');
            expect(result.valid).toBe(false);
            expect(result.error).toContain('{ext}');
        });
        it('should reject pattern with illegal characters', () => {
            const patterns = [
                '{name}<test>{ext}',
                '{name}>test{ext}',
                '{name}:test{ext}',
                '{name}"test{ext}',
                '{name}|test{ext}',
                '{name}?test{ext}',
                '{name}*test{ext}'
            ];
            patterns.forEach(pattern => {
                const result = generator.validatePattern(pattern);
                expect(result.valid).toBe(false);
                expect(result.error).toContain('非法字符');
            });
        });
        it('should accept pattern with all placeholders', () => {
            const pattern = '{name}_{index}_{total}_{date}_{time}_{timestamp}{ext}';
            const result = generator.validatePattern(pattern);
            expect(result.valid).toBe(true);
        });
        it('should accept pattern with special characters in allowed range', () => {
            const patterns = [
                '{name}_-_{ext}',
                '{name} (copy){ext}',
                '{name}[1]{ext}',
                '{name}@version{ext}'
            ];
            patterns.forEach(pattern => {
                const result = generator.validatePattern(pattern);
                expect(result.valid).toBe(true);
            });
        });
    });
    describe('getSupportedPlaceholders', () => {
        it('should return list of supported placeholders', () => {
            const placeholders = generator.getSupportedPlaceholders();
            expect(placeholders).toHaveLength(7);
            expect(placeholders.map(p => p.placeholder)).toEqual([
                '{name}',
                '{ext}',
                '{index}',
                '{total}',
                '{date}',
                '{time}',
                '{timestamp}'
            ]);
        });
        it('should include descriptions and examples', () => {
            const placeholders = generator.getSupportedPlaceholders();
            placeholders.forEach(placeholder => {
                expect(placeholder.description).toBeTruthy();
                expect(placeholder.example).toBeTruthy();
            });
        });
    });
    describe('edge cases', () => {
        it('should handle very long file names', async () => {
            const longName = 'a'.repeat(200);
            const inputPath = `/path/to/${longName}.pptx`;
            const outputPath = await generator.generateOutputPath(inputPath, testDir);
            expect(outputPath).toBe(path.join(testDir, `${longName}.pptx`));
        });
        it('should handle file names with special characters', async () => {
            const inputPath = '/path/to/文档-测试_v1.0.pptx';
            const pattern = '{name}_output{ext}';
            const outputPath = await generator.generateOutputPath(inputPath, testDir, pattern);
            expect(outputPath).toBe(path.join(testDir, '文档-测试_v1.0_output.pptx'));
        });
        it('should handle pattern with only {ext}', async () => {
            const inputPath = '/path/to/document.pptx';
            const pattern = 'output{ext}';
            const outputPath = await generator.generateOutputPath(inputPath, testDir, pattern);
            expect(outputPath).toBe(path.join(testDir, 'output.pptx'));
        });
        it('should handle multiple consecutive conflicts', async () => {
            const inputPath = '/path/to/document.pptx';
            // 创建大量冲突文件
            for (let i = 0; i < 10; i++) {
                const fileName = i === 0 ? 'document.pptx' : `document (${i}).pptx`;
                await fs.writeFile(path.join(testDir, fileName), '');
            }
            const outputPath = await generator.generateOutputPath(inputPath, testDir);
            expect(outputPath).toBe(path.join(testDir, 'document (10).pptx'));
        });
        it('should handle pattern with repeated placeholders', async () => {
            const inputPath = '/path/to/document.pptx';
            const pattern = '{name}_{name}_{name}{ext}';
            const outputPath = await generator.generateOutputPath(inputPath, testDir, pattern);
            expect(outputPath).toBe(path.join(testDir, 'document_document_document.pptx'));
        });
    });
    describe('pattern application', () => {
        it('should apply date pattern correctly', async () => {
            const inputPath = '/path/to/document.pptx';
            const pattern = '{date}_{name}{ext}';
            const outputPath = await generator.generateOutputPath(inputPath, testDir, pattern);
            const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            expect(outputPath).toBe(path.join(testDir, `${date}_document.pptx`));
        });
        it('should apply time pattern correctly', async () => {
            const inputPath = '/path/to/document.pptx';
            const pattern = '{time}_{name}{ext}';
            const outputPath = await generator.generateOutputPath(inputPath, testDir, pattern);
            // 时间格式应该是 HHMMSS
            expect(outputPath).toMatch(/\d{6}_document\.pptx$/);
        });
        it('should combine multiple placeholders', async () => {
            const inputPath = '/path/to/document.pptx';
            const pattern = '{date}_{time}_{name}{ext}';
            const outputPath = await generator.generateOutputPath(inputPath, testDir, pattern);
            const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            expect(outputPath).toMatch(new RegExp(`${date}_\\d{6}_document\\.pptx$`));
        });
    });
    describe('conflict resolution', () => {
        it('should resolve conflict with pattern-generated name', async () => {
            const inputPath = '/path/to/document.pptx';
            const pattern = 'output_{index}{ext}';
            // 在批量生成中创建冲突
            const inputPaths = [inputPath, inputPath];
            const outputPaths = await generator.generateOutputPaths(inputPaths, testDir, pattern);
            expect(outputPaths).toEqual([
                path.join(testDir, 'output_1.pptx'),
                path.join(testDir, 'output_2.pptx')
            ]);
        });
        it('should handle conflict when file exists and in batch', async () => {
            const inputPaths = [
                '/path/to/doc.pptx',
                '/path/to/doc.pptx'
            ];
            // 创建已存在的文件
            await fs.writeFile(path.join(testDir, 'doc.pptx'), '');
            const outputPaths = await generator.generateOutputPaths(inputPaths, testDir);
            expect(outputPaths).toEqual([
                path.join(testDir, 'doc (1).pptx'),
                path.join(testDir, 'doc (2).pptx')
            ]);
        });
    });
    describe('requirements validation', () => {
        it('should support custom file name rules (Requirement 22.4)', async () => {
            const inputPath = '/path/to/document.pptx';
            // 测试前缀
            let pattern = 'prefix_{name}{ext}';
            let outputPath = await generator.generateOutputPath(inputPath, testDir, pattern);
            expect(outputPath).toBe(path.join(testDir, 'prefix_document.pptx'));
            // 测试后缀
            pattern = '{name}_suffix{ext}';
            outputPath = await generator.generateOutputPath(inputPath, testDir, pattern);
            expect(outputPath).toBe(path.join(testDir, 'document_suffix.pptx'));
            // 测试序号
            const inputPaths = [inputPath, inputPath];
            pattern = '{name}_{index}{ext}';
            const outputPaths = await generator.generateOutputPaths(inputPaths, testDir, pattern);
            expect(outputPaths[0]).toBe(path.join(testDir, 'document_1.pptx'));
            expect(outputPaths[1]).toBe(path.join(testDir, 'document_2.pptx'));
        });
        it('should handle file name conflicts automatically (Requirement 22.5)', async () => {
            const inputPath = '/path/to/document.pptx';
            // 创建已存在的文件
            await fs.writeFile(path.join(testDir, 'document.pptx'), '');
            // 应该自动添加序号
            const outputPath = await generator.generateOutputPath(inputPath, testDir);
            expect(outputPath).toBe(path.join(testDir, 'document (1).pptx'));
            // 验证文件不会被覆盖
            const existingContent = await fs.readFile(path.join(testDir, 'document.pptx'), 'utf-8');
            expect(existingContent).toBe(''); // 原文件内容未改变
        });
        it('should automatically add sequence numbers (Requirement 22.5)', async () => {
            const inputPath = '/path/to/document.pptx';
            // 创建多个冲突
            await fs.writeFile(path.join(testDir, 'document.pptx'), 'original');
            await fs.writeFile(path.join(testDir, 'document (1).pptx'), 'first');
            await fs.writeFile(path.join(testDir, 'document (2).pptx'), 'second');
            const outputPath = await generator.generateOutputPath(inputPath, testDir);
            expect(outputPath).toBe(path.join(testDir, 'document (3).pptx'));
            // 验证所有已存在文件未被修改
            expect(await fs.readFile(path.join(testDir, 'document.pptx'), 'utf-8')).toBe('original');
            expect(await fs.readFile(path.join(testDir, 'document (1).pptx'), 'utf-8')).toBe('first');
            expect(await fs.readFile(path.join(testDir, 'document (2).pptx'), 'utf-8')).toBe('second');
        });
    });
});
