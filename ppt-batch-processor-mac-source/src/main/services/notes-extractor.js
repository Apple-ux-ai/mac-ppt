import { promises as fs } from 'fs';
import PizZip from 'pizzip';
import { parseString } from 'xml2js';
import { promisify } from 'util';
const parseXml = promisify(parseString);
/**
 * 备注提取器
 * 从 PPT 文件中提取所有幻灯片的备注内容
 */
export class NotesExtractor {
    /**
     * 从 PPT 文件中提取所有备注
     *
     * @param inputPath 输入 PPT 文件路径
     * @param outputPath 输出文件路径
     * @param format 输出格式：'txt' | 'md'
     * @returns 提取的备注数量
     */
    async extractNotes(inputPath, outputPath, format = 'txt') {
        try {
            console.log('=== Extract Notes Debug ===');
            console.log('Input file:', inputPath);
            console.log('Output file:', outputPath);
            console.log('Format:', format);
            // 读取 PPT 文件
            const fileData = await fs.readFile(inputPath);
            const zip = new PizZip(fileData);
            // 获取所有备注文件
            const notesFiles = [];
            Object.keys(zip.files).forEach(fileName => {
                // 备注文件通常在 ppt/notesSlides/ 目录下
                if (fileName.startsWith('ppt/notesSlides/notesSlide') && fileName.endsWith('.xml')) {
                    notesFiles.push(fileName);
                }
            });
            console.log(`Found ${notesFiles.length} notes files`);
            // 按编号排序
            notesFiles.sort((a, b) => {
                const numA = parseInt(a.match(/notesSlide(\d+)\.xml/)?.[1] || '0');
                const numB = parseInt(b.match(/notesSlide(\d+)\.xml/)?.[1] || '0');
                return numA - numB;
            });
            // 提取每个备注
            const notes = [];
            for (const notesFile of notesFiles) {
                const slideNumber = parseInt(notesFile.match(/notesSlide(\d+)\.xml/)?.[1] || '0');
                const file = zip.files[notesFile];
                if (file && !file.dir) {
                    const xmlContent = file.asText();
                    const noteText = await this.extractNoteText(xmlContent);
                    notes.push({
                        slideNumber,
                        content: noteText || '[无备注]'
                    });
                    console.log(`  Slide ${slideNumber}: ${noteText ? noteText.substring(0, 50) + '...' : '[无备注]'}`);
                }
            }
            // 生成输出内容
            let outputContent = '';
            if (format === 'md') {
                outputContent = this.generateMarkdown(notes);
            }
            else {
                outputContent = this.generateText(notes);
            }
            // 保存到文件
            await fs.writeFile(outputPath, outputContent, 'utf-8');
            console.log('Extract notes completed successfully');
            console.log('=== End Extract Notes Debug ===');
            return notes.length;
        }
        catch (error) {
            if (error instanceof Error) {
                throw new Error(`Failed to extract notes: ${error.message}`);
            }
            throw new Error('Failed to extract notes: Unknown error');
        }
    }
    /**
     * 从备注 XML 中提取文本内容
     */
    async extractNoteText(xmlContent) {
        try {
            const result = await parseXml(xmlContent);
            // 备注内容在 p:notes -> p:cSld -> p:spTree -> p:sp -> p:txBody -> a:p -> a:r -> a:t
            const notes = result['p:notes'];
            if (!notes)
                return '';
            const cSld = notes['p:cSld'];
            if (!cSld || !cSld[0])
                return '';
            const spTree = cSld[0]['p:spTree'];
            if (!spTree || !spTree[0])
                return '';
            const shapes = spTree[0]['p:sp'];
            if (!shapes || shapes.length === 0)
                return '';
            const texts = [];
            // 遍历所有形状，提取文本
            for (const shape of shapes) {
                const txBody = shape['p:txBody'];
                if (!txBody || !txBody[0])
                    continue;
                const paragraphs = txBody[0]['a:p'];
                if (!paragraphs)
                    continue;
                for (const paragraph of paragraphs) {
                    const runs = paragraph['a:r'];
                    if (!runs)
                        continue;
                    for (const run of runs) {
                        const textElements = run['a:t'];
                        if (textElements && textElements[0]) {
                            texts.push(textElements[0]);
                        }
                    }
                }
            }
            return texts.join(' ').trim();
        }
        catch (error) {
            console.error('Error extracting note text:', error);
            return '';
        }
    }
    /**
     * 生成纯文本格式
     */
    generateText(notes) {
        const lines = [];
        lines.push('='.repeat(60));
        lines.push('PPT 备注提取');
        lines.push('='.repeat(60));
        lines.push('');
        for (const note of notes) {
            lines.push(`幻灯片 ${note.slideNumber}:`);
            lines.push('-'.repeat(60));
            lines.push(note.content);
            lines.push('');
        }
        lines.push('='.repeat(60));
        lines.push(`总计: ${notes.length} 张幻灯片`);
        lines.push('='.repeat(60));
        return lines.join('\n');
    }
    /**
     * 生成 Markdown 格式
     */
    generateMarkdown(notes) {
        const lines = [];
        lines.push('# PPT 备注提取');
        lines.push('');
        for (const note of notes) {
            lines.push(`## 幻灯片 ${note.slideNumber}`);
            lines.push('');
            lines.push(note.content);
            lines.push('');
        }
        lines.push('---');
        lines.push(`**总计**: ${notes.length} 张幻灯片`);
        return lines.join('\n');
    }
}
