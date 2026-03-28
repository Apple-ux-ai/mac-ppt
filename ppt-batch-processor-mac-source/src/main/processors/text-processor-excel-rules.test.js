import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TextProcessor } from './text-processor';
import { PptxParser } from '../services/pptx-parser';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import * as XLSX from 'xlsx';
import PizZip from 'pizzip';
/**
 * 测试 Excel 规则解析功能
 *
 * 验证需求: 3.1, 3.2, 3.3, 3.4
 */
describe('TextProcessor - Excel Rules', () => {
    let processor;
    let parser;
    let testDir;
    let testFiles = [];
    beforeEach(async () => {
        processor = new TextProcessor();
        parser = new PptxParser();
        // 创建临时测试目录
        testDir = join(tmpdir(), `excel-rules-test-${Date.now()}`);
        await fs.mkdir(testDir, { recursive: true });
    });
    afterEach(async () => {
        // 清理测试文件
        for (const file of testFiles) {
            try {
                await fs.unlink(file);
            }
            catch (error) {
                // 忽略删除错误
            }
        }
        testFiles = [];
        // 清理测试目录
        try {
            await fs.rmdir(testDir);
        }
        catch (error) {
            // 忽略删除错误
        }
    });
    /**
     * 创建测试用的 Excel 文件
     */
    async function createTestExcel(fileName, data) {
        const filePath = join(testDir, fileName);
        const worksheet = XLSX.utils.aoa_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Rules');
        XLSX.writeFile(workbook, filePath);
        testFiles.push(filePath);
        return filePath;
    }
    /**
     * 创建测试用的 PPTX 文件
     */
    async function createTestPptx(fileName, textContent) {
        const filePath = join(testDir, fileName);
        const zip = new PizZip();
        // [Content_Types].xml
        zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`);
        // _rels/.rels
        zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`);
        // ppt/presentation.xml
        zip.file('ppt/presentation.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:sldIdLst>
    <p:sldId id="256" r:id="rId1"/>
  </p:sldIdLst>
</p:presentation>`);
        // ppt/_rels/presentation.xml.rels
        zip.file('ppt/_rels/presentation.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
</Relationships>`);
        // ppt/slides/slide1.xml with text content
        zip.file('ppt/slides/slide1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr/>
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="2" name="TextBox"/>
          <p:cNvSpPr txBox="1"/>
          <p:nvPr/>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm>
            <a:off x="914400" y="914400"/>
            <a:ext cx="7315200" cy="914400"/>
          </a:xfrm>
        </p:spPr>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p>
            <a:r>
              <a:rPr lang="en-US" sz="1800" b="1">
                <a:solidFill>
                  <a:srgbClr val="363636"/>
                </a:solidFill>
                <a:latin typeface="Arial"/>
              </a:rPr>
              <a:t>${textContent}</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`);
        // docProps/core.xml
        zip.file('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Test</dc:title>
  <dc:creator>Test</dc:creator>
  <dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:modified>
</cp:coreProperties>`);
        // docProps/app.xml
        zip.file('docProps/app.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
  <Company>Test</Company>
</Properties>`);
        const content = zip.generate({
            type: 'nodebuffer',
            compression: 'DEFLATE'
        });
        await fs.writeFile(filePath, content);
        testFiles.push(filePath);
        return filePath;
    }
    describe('parseExcelRules', () => {
        it('should parse valid Excel file with Chinese headers', async () => {
            // 创建有效的 Excel 文件（中文表头）
            const excelPath = await createTestExcel('valid-chinese.xlsx', [
                ['类型', '查找内容', '替换内容'],
                ['文本替换', 'Hello', 'Hi'],
                ['文本替换', 'World', 'Universe']
            ]);
            const rules = await processor.parseExcelRules(excelPath);
            expect(rules).toHaveLength(2);
            expect(rules[0].type).toBe('text-replace');
            expect(rules[0].searchText).toBe('Hello');
            expect(rules[0].replaceText).toBe('Hi');
            expect(rules[1].type).toBe('text-replace');
            expect(rules[1].searchText).toBe('World');
            expect(rules[1].replaceText).toBe('Universe');
        });
        it('should parse valid Excel file with English headers', async () => {
            // 创建有效的 Excel 文件（英文表头）
            const excelPath = await createTestExcel('valid-english.xlsx', [
                ['Type', 'Search', 'Replace'],
                ['text-replace', 'old', 'new'],
                ['delete-content', 'remove this', '']
            ]);
            const rules = await processor.parseExcelRules(excelPath);
            expect(rules).toHaveLength(2);
            expect(rules[0].type).toBe('text-replace');
            expect(rules[0].searchText).toBe('old');
            expect(rules[0].replaceText).toBe('new');
            expect(rules[1].type).toBe('delete-content');
            expect(rules[1].deleteContent).toBe('remove this');
        });
        it('should support multiple rule types', async () => {
            // 测试所有规则类型
            const excelPath = await createTestExcel('all-types.xlsx', [
                ['类型', '查找内容', '替换内容'],
                ['文本替换', 'text1', 'text2'],
                ['图片替换', 'old.png', 'new.png'],
                ['删除内容', 'delete me', '']
            ]);
            const rules = await processor.parseExcelRules(excelPath);
            expect(rules).toHaveLength(3);
            expect(rules[0].type).toBe('text-replace');
            expect(rules[1].type).toBe('image-replace');
            expect(rules[2].type).toBe('delete-content');
        });
        it('should skip empty rows', async () => {
            const excelPath = await createTestExcel('with-empty-rows.xlsx', [
                ['类型', '查找内容', '替换内容'],
                ['文本替换', 'test1', 'result1'],
                ['', '', ''], // 空行
                ['文本替换', 'test2', 'result2'],
                [null, null, null] // 空行
            ]);
            const rules = await processor.parseExcelRules(excelPath);
            expect(rules).toHaveLength(2);
            expect(rules[0].searchText).toBe('test1');
            expect(rules[1].searchText).toBe('test2');
        });
        it('should throw error for empty Excel file', async () => {
            const excelPath = await createTestExcel('empty.xlsx', []);
            await expect(processor.parseExcelRules(excelPath)).rejects.toThrow('at least a header row');
        });
        it('should throw error for invalid headers', async () => {
            const excelPath = await createTestExcel('invalid-headers.xlsx', [
                ['Wrong', 'Headers', 'Here'],
                ['data', 'data', 'data']
            ]);
            await expect(processor.parseExcelRules(excelPath)).rejects.toThrow('Invalid Excel format');
        });
        it('should throw error for invalid rule type', async () => {
            const excelPath = await createTestExcel('invalid-type.xlsx', [
                ['类型', '查找内容', '替换内容'],
                ['invalid-type', 'test', 'result']
            ]);
            await expect(processor.parseExcelRules(excelPath)).rejects.toThrow('Invalid rule type');
        });
        it('should throw error for text-replace without search text', async () => {
            const excelPath = await createTestExcel('missing-search.xlsx', [
                ['类型', '查找内容', '替换内容'],
                ['文本替换', '', 'result']
            ]);
            await expect(processor.parseExcelRules(excelPath)).rejects.toThrow('Search text is required');
        });
        it('should throw error for image-replace without paths', async () => {
            const excelPath = await createTestExcel('missing-image-paths.xlsx', [
                ['类型', '查找内容', '替换内容'],
                ['图片替换', 'old.png', '']
            ]);
            await expect(processor.parseExcelRules(excelPath)).rejects.toThrow('Both source and target image paths are required');
        });
        it('should throw error for delete-content without content', async () => {
            const excelPath = await createTestExcel('missing-delete-content.xlsx', [
                ['类型', '查找内容', '替换内容'],
                ['删除内容', '', '']
            ]);
            await expect(processor.parseExcelRules(excelPath)).rejects.toThrow('Content to delete is required');
        });
        it('should throw error when no valid rules found', async () => {
            const excelPath = await createTestExcel('no-valid-rules.xlsx', [
                ['类型', '查找内容', '替换内容'],
                ['', '', '']
            ]);
            await expect(processor.parseExcelRules(excelPath)).rejects.toThrow('No valid rules found');
        });
        it('should handle file not found error', async () => {
            await expect(processor.parseExcelRules('/nonexistent/file.xlsx')).rejects.toThrow();
        });
    });
    describe('applyExcelRules', () => {
        it('should apply multiple text replacement rules in order', async () => {
            // 创建测试 PPTX 文件
            const pptxPath = await createTestPptx('test.pptx', 'Hello World');
            const stats = await fs.stat(pptxPath);
            const fileInfo = {
                name: 'test.pptx',
                path: pptxPath,
                size: stats.size,
                format: 'pptx'
            };
            // 定义规则：先替换 Hello，再替换 World
            const rules = [
                { type: 'text-replace', searchText: 'Hello', replaceText: 'Hi' },
                { type: 'text-replace', searchText: 'World', replaceText: 'Universe' }
            ];
            const options = {
                overwriteOriginal: false,
                fileNamePattern: '{name}_rules'
            };
            const result = await processor.applyExcelRules(fileInfo, rules, options);
            expect(result.status).toBe('success');
            expect(result.metadata?.itemsProcessed).toBe(2);
            testFiles.push(result.outputFile);
            // 验证结果
            const outputDoc = await parser.open(result.outputFile);
            const slides = parser.getSlides(outputDoc);
            const textElements = slides[0].elements.filter(e => e.type === 'text');
            const content = textElements.map(e => e.content).join(' ');
            expect(content).toContain('Hi');
            expect(content).toContain('Universe');
            expect(content).not.toContain('Hello');
            expect(content).not.toContain('World');
        });
        it('should apply rules in the specified order', async () => {
            // 测试规则顺序很重要的情况
            const pptxPath = await createTestPptx('order-test.pptx', 'AAA');
            const stats = await fs.stat(pptxPath);
            const fileInfo = {
                name: 'order-test.pptx',
                path: pptxPath,
                size: stats.size,
                format: 'pptx'
            };
            // 规则顺序：AAA -> BBB -> CCC
            const rules = [
                { type: 'text-replace', searchText: 'AAA', replaceText: 'BBB' },
                { type: 'text-replace', searchText: 'BBB', replaceText: 'CCC' }
            ];
            const options = {
                overwriteOriginal: false
            };
            const result = await processor.applyExcelRules(fileInfo, rules, options);
            expect(result.status).toBe('success');
            testFiles.push(result.outputFile);
            // 验证最终结果应该是 CCC（因为规则按顺序应用）
            const outputDoc = await parser.open(result.outputFile);
            const slides = parser.getSlides(outputDoc);
            const textElements = slides[0].elements.filter(e => e.type === 'text');
            const content = textElements.map(e => e.content).join(' ');
            expect(content).toContain('CCC');
            expect(content).not.toContain('AAA');
            expect(content).not.toContain('BBB');
        });
        it('should handle delete-content rules', async () => {
            const pptxPath = await createTestPptx('delete-test.pptx', 'Keep this, delete that');
            const stats = await fs.stat(pptxPath);
            const fileInfo = {
                name: 'delete-test.pptx',
                path: pptxPath,
                size: stats.size,
                format: 'pptx'
            };
            const rules = [
                { type: 'delete-content', deleteContent: 'delete that' }
            ];
            const options = {
                overwriteOriginal: false
            };
            const result = await processor.applyExcelRules(fileInfo, rules, options);
            expect(result.status).toBe('success');
            testFiles.push(result.outputFile);
            const outputDoc = await parser.open(result.outputFile);
            const slides = parser.getSlides(outputDoc);
            const textElements = slides[0].elements.filter(e => e.type === 'text');
            const content = textElements.map(e => e.content).join(' ');
            expect(content).toContain('Keep this');
            expect(content).not.toContain('delete that');
        });
        it('should handle empty rules array', async () => {
            const pptxPath = await createTestPptx('empty-rules.pptx', 'Test');
            const stats = await fs.stat(pptxPath);
            const fileInfo = {
                name: 'empty-rules.pptx',
                path: pptxPath,
                size: stats.size,
                format: 'pptx'
            };
            const rules = [];
            const options = {
                overwriteOriginal: false
            };
            const result = await processor.applyExcelRules(fileInfo, rules, options);
            expect(result.status).toBe('success');
            expect(result.metadata?.itemsProcessed).toBe(0);
            testFiles.push(result.outputFile);
        });
    });
    describe('processFileWithExcelRules', () => {
        it('should process file using Excel rules from file path', async () => {
            // 创建 Excel 规则文件
            const excelPath = await createTestExcel('rules.xlsx', [
                ['类型', '查找内容', '替换内容'],
                ['文本替换', 'old', 'new']
            ]);
            // 创建 PPTX 文件
            const pptxPath = await createTestPptx('process-test.pptx', 'old text');
            const stats = await fs.stat(pptxPath);
            const fileInfo = {
                name: 'process-test.pptx',
                path: pptxPath,
                size: stats.size,
                format: 'pptx'
            };
            const options = {
                excelRulesPath: excelPath,
                overwriteOriginal: false
            };
            const result = await processor.processFileWithExcelRules(fileInfo, options);
            expect(result.status).toBe('success');
            expect(result.metadata?.itemsProcessed).toBeGreaterThan(0);
            testFiles.push(result.outputFile);
        });
        it('should process file using provided rules array', async () => {
            const pptxPath = await createTestPptx('array-test.pptx', 'test content');
            const stats = await fs.stat(pptxPath);
            const fileInfo = {
                name: 'array-test.pptx',
                path: pptxPath,
                size: stats.size,
                format: 'pptx'
            };
            const rules = [
                { type: 'text-replace', searchText: 'test', replaceText: 'demo' }
            ];
            const options = {
                excelRules: rules,
                overwriteOriginal: false
            };
            const result = await processor.processFileWithExcelRules(fileInfo, options);
            expect(result.status).toBe('success');
            testFiles.push(result.outputFile);
        });
        it('should return error when no rules provided', async () => {
            const pptxPath = await createTestPptx('no-rules.pptx', 'test');
            const stats = await fs.stat(pptxPath);
            const fileInfo = {
                name: 'no-rules.pptx',
                path: pptxPath,
                size: stats.size,
                format: 'pptx'
            };
            const options = {
                overwriteOriginal: false
            };
            const result = await processor.processFileWithExcelRules(fileInfo, options);
            expect(result.status).toBe('error');
            expect(result.error).toContain('required');
        });
        it('should return error when Excel file is invalid', async () => {
            const pptxPath = await createTestPptx('invalid-excel.pptx', 'test');
            const stats = await fs.stat(pptxPath);
            const fileInfo = {
                name: 'invalid-excel.pptx',
                path: pptxPath,
                size: stats.size,
                format: 'pptx'
            };
            const options = {
                excelRulesPath: '/nonexistent/rules.xlsx',
                overwriteOriginal: false
            };
            const result = await processor.processFileWithExcelRules(fileInfo, options);
            expect(result.status).toBe('error');
        });
    });
    describe('generateRulesReport', () => {
        it('should generate formatted rules report', () => {
            const rules = [
                { type: 'text-replace', searchText: 'old', replaceText: 'new' },
                { type: 'delete-content', deleteContent: 'remove' }
            ];
            const results = [
                {
                    inputFile: '/path/file1.pptx',
                    outputFile: '/path/file1_out.pptx',
                    status: 'success',
                    metadata: { itemsProcessed: 5 }
                },
                {
                    inputFile: '/path/file2.pptx',
                    outputFile: '',
                    status: 'error',
                    error: 'File not found'
                }
            ];
            const report = processor.generateRulesReport(rules, results);
            expect(report).toContain('Excel 规则应用报告');
            expect(report).toContain('规则总数: 2');
            expect(report).toContain('文本替换: "old" → "new"');
            expect(report).toContain('删除内容: "remove"');
            expect(report).toContain('成功: 1');
            expect(report).toContain('失败: 1');
            expect(report).toContain('file1.pptx: 5 次操作');
            expect(report).toContain('file2.pptx: File not found');
        });
        it('should handle empty results', () => {
            const rules = [
                { type: 'text-replace', searchText: 'test', replaceText: 'demo' }
            ];
            const results = [];
            const report = processor.generateRulesReport(rules, results);
            expect(report).toContain('规则总数: 1');
            expect(report).toContain('成功: 0');
            expect(report).toContain('失败: 0');
        });
    });
});
