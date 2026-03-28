import { PptxParser } from './pptx-parser';
/**
 * 备注删除器
 * 负责删除PPT中所有幻灯片的备注内容
 */
export class NotesRemover {
    constructor() {
        this.parser = new PptxParser();
    }
    /**
     * 删除PPT中所有幻灯片的备注
     * @param inputPath 输入PPT文件路径
     * @param outputPath 输出PPT文件路径
     * @returns 删除结果
     */
    async removeNotes(inputPath, outputPath) {
        const result = {
            success: true,
            processedSlides: 0,
            errors: []
        };
        try {
            console.log('[DEBUG] Opening PPT file:', inputPath);
            // 打开PPT文件
            const document = await this.parser.open(inputPath);
            const totalSlides = document.slides.length;
            console.log(`[DEBUG] Total slides: ${totalSlides}`);
            const zip = document.zipArchive;
            // 处理每一页的备注
            for (let i = 0; i < totalSlides; i++) {
                const slideNumber = i + 1;
                try {
                    await this.removeSlideNotes(zip, slideNumber);
                    result.processedSlides++;
                    console.log(`[DEBUG] Removed notes from slide ${slideNumber}`);
                }
                catch (error) {
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    result.errors.push(`删除第${slideNumber}页备注失败: ${errorMsg}`);
                    console.error(`[DEBUG] Failed to remove notes from slide ${slideNumber}:`, error);
                }
            }
            console.log(`[DEBUG] Processed ${result.processedSlides} slides`);
            // 保存修改后的文件
            await this.parser.save(document, outputPath);
            console.log('[DEBUG] Saved PPT file:', outputPath);
            return result;
        }
        catch (error) {
            result.success = false;
            result.errors.push(error instanceof Error ? error.message : String(error));
            return result;
        }
    }
    /**
     * 删除指定幻灯片的备注
     * @param zip ZIP 文档对象
     * @param slideNumber 幻灯片编号（从1开始）
     */
    async removeSlideNotes(zip, slideNumber) {
        const notesPath = `ppt/notesSlides/notesSlide${slideNumber}.xml`;
        const notesFile = zip.file(notesPath);
        if (!notesFile) {
            console.log(`[DEBUG] No notes file found for slide ${slideNumber}`);
            return;
        }
        console.log(`[DEBUG] Processing notes for slide ${slideNumber}`);
        const xml2js = await import('xml2js');
        const content = notesFile.asText();
        const result = await xml2js.parseStringPromise(content);
        // 查找备注内容
        const notes = result['p:notes'];
        if (!notes || !notes['p:cSld'] || !notes['p:cSld'][0]) {
            console.log(`[DEBUG] No notes content found for slide ${slideNumber}`);
            return;
        }
        const cSld = notes['p:cSld'][0];
        if (!cSld['p:spTree'] || !cSld['p:spTree'][0]) {
            return;
        }
        const spTree = cSld['p:spTree'][0];
        if (!spTree['p:sp']) {
            return;
        }
        // 清空所有文本框的内容
        let clearedCount = 0;
        for (const shape of spTree['p:sp']) {
            if (shape['p:txBody'] && shape['p:txBody'][0]) {
                const txBody = shape['p:txBody'][0];
                // 清空段落内容
                if (txBody['a:p']) {
                    for (const paragraph of txBody['a:p']) {
                        // 删除所有文本运行
                        if (paragraph['a:r']) {
                            delete paragraph['a:r'];
                        }
                        // 删除字段
                        if (paragraph['a:fld']) {
                            delete paragraph['a:fld'];
                        }
                        // 删除换行符
                        if (paragraph['a:br']) {
                            delete paragraph['a:br'];
                        }
                        // 删除结束段落运行
                        if (paragraph['a:endParaRPr']) {
                            delete paragraph['a:endParaRPr'];
                        }
                        // 确保有空段落属性
                        if (!paragraph['a:pPr']) {
                            paragraph['a:pPr'] = [{}];
                        }
                    }
                    clearedCount++;
                }
            }
        }
        if (clearedCount > 0) {
            // 重新生成 XML
            const builder = new xml2js.Builder();
            const newXml = builder.buildObject(result);
            // 更新 ZIP 文件
            zip.file(notesPath, newXml);
            console.log(`[DEBUG] Cleared ${clearedCount} text boxes in notes for slide ${slideNumber}`);
        }
        else {
            console.log(`[DEBUG] No text content found in notes for slide ${slideNumber}`);
        }
    }
}
