import { PptxParser } from './pptx-parser';
/**
 * 宏删除器
 * 负责删除PPT中的VBA宏代码
 *
 * PPT中的宏主要存储在以下位置：
 * 1. vbaProject.bin - VBA项目二进制文件
 * 2. [Content_Types].xml - 需要移除宏相关的内容类型声明
 * 3. _rels/.rels - 需要移除宏相关的关系引用
 */
export class MacroRemover {
    constructor() {
        this.parser = new PptxParser();
    }
    /**
     * 删除PPT中的宏
     * @param inputPath 输入PPT文件路径
     * @param outputPath 输出PPT文件路径
     * @returns 删除结果
     */
    async removeMacros(inputPath, outputPath) {
        const result = {
            success: true,
            hadMacros: false,
            removedFiles: [],
            errors: []
        };
        try {
            console.log('[DEBUG] Opening PPT file:', inputPath);
            // 打开PPT文件
            const document = await this.parser.open(inputPath);
            const zip = document.zipArchive;
            // 检查是否包含宏
            const hasMacros = this.checkForMacros(zip);
            result.hadMacros = hasMacros;
            if (!hasMacros) {
                console.log('[DEBUG] No macros found in the file');
                // 即使没有宏，也保存文件（复制到输出路径）
                await this.parser.save(document, outputPath);
                return result;
            }
            console.log('[DEBUG] Macros detected, removing...');
            // 1. 删除 vbaProject.bin 文件
            await this.removeVbaProjectFile(zip, result);
            // 2. 更新 [Content_Types].xml
            await this.updateContentTypes(zip, result);
            // 3. 更新 _rels/.rels
            await this.updateRootRels(zip, result);
            // 保存修改后的文件
            await this.parser.save(document, outputPath);
            console.log('[DEBUG] Saved PPT file without macros:', outputPath);
            return result;
        }
        catch (error) {
            result.success = false;
            result.errors.push(error instanceof Error ? error.message : String(error));
            console.error('[DEBUG] Failed to remove macros:', error);
            return result;
        }
    }
    /**
     * 检查PPT是否包含宏
     * @param zip ZIP 文档对象
     * @returns 是否包含宏
     */
    checkForMacros(zip) {
        // 检查是否存在 vbaProject.bin 文件
        const vbaFile = zip.file('ppt/vbaProject.bin');
        if (vbaFile) {
            console.log('[DEBUG] Found vbaProject.bin');
            return true;
        }
        // 检查 [Content_Types].xml 中是否有宏相关的声明
        const contentTypesFile = zip.file('[Content_Types].xml');
        if (contentTypesFile) {
            const content = contentTypesFile.asText();
            if (content.includes('vbaProject') || content.includes('application/vnd.ms-office.vbaProject')) {
                console.log('[DEBUG] Found macro references in Content_Types');
                return true;
            }
        }
        return false;
    }
    /**
     * 删除 vbaProject.bin 文件
     * @param zip ZIP 文档对象
     * @param result 结果对象
     */
    async removeVbaProjectFile(zip, result) {
        const vbaPath = 'ppt/vbaProject.bin';
        const vbaFile = zip.file(vbaPath);
        if (vbaFile) {
            zip.remove(vbaPath);
            result.removedFiles.push(vbaPath);
            console.log('[DEBUG] Removed vbaProject.bin');
        }
    }
    /**
     * 更新 [Content_Types].xml，移除宏相关的内容类型声明
     * @param zip ZIP 文档对象
     * @param result 结果对象
     */
    async updateContentTypes(zip, result) {
        const contentTypesPath = '[Content_Types].xml';
        const contentTypesFile = zip.file(contentTypesPath);
        if (!contentTypesFile) {
            console.log('[DEBUG] Content_Types.xml not found');
            return;
        }
        try {
            const xml2js = await import('xml2js');
            const content = contentTypesFile.asText();
            const parsed = await xml2js.parseStringPromise(content);
            let modified = false;
            // 移除 vbaProject 相关的 Override 元素
            if (parsed.Types && parsed.Types.Override) {
                const originalLength = parsed.Types.Override.length;
                parsed.Types.Override = parsed.Types.Override.filter((override) => {
                    const partName = override.$?.PartName || '';
                    const contentType = override.$?.ContentType || '';
                    // 移除 vbaProject 相关的声明
                    if (partName.includes('vbaProject') ||
                        contentType.includes('vbaProject') ||
                        contentType.includes('application/vnd.ms-office.vbaProject')) {
                        console.log('[DEBUG] Removing Override:', partName, contentType);
                        return false;
                    }
                    return true;
                });
                if (parsed.Types.Override.length < originalLength) {
                    modified = true;
                }
            }
            // 移除 vbaProject 相关的 Default 元素
            if (parsed.Types && parsed.Types.Default) {
                const originalLength = parsed.Types.Default.length;
                parsed.Types.Default = parsed.Types.Default.filter((def) => {
                    const extension = def.$?.Extension || '';
                    const contentType = def.$?.ContentType || '';
                    // 移除 .bin 扩展名的宏相关声明
                    if ((extension === 'bin' && contentType.includes('vbaProject')) ||
                        contentType.includes('application/vnd.ms-office.vbaProject')) {
                        console.log('[DEBUG] Removing Default:', extension, contentType);
                        return false;
                    }
                    return true;
                });
                if (parsed.Types.Default.length < originalLength) {
                    modified = true;
                }
            }
            if (modified) {
                // 重新生成 XML
                const builder = new xml2js.Builder();
                const newXml = builder.buildObject(parsed);
                zip.file(contentTypesPath, newXml);
                console.log('[DEBUG] Updated Content_Types.xml');
            }
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            result.errors.push(`更新 Content_Types.xml 失败: ${errorMsg}`);
            console.error('[DEBUG] Failed to update Content_Types.xml:', error);
        }
    }
    /**
     * 更新 _rels/.rels，移除宏相关的关系引用
     * @param zip ZIP 文档对象
     * @param result 结果对象
     */
    async updateRootRels(zip, result) {
        const relsPath = '_rels/.rels';
        const relsFile = zip.file(relsPath);
        if (!relsFile) {
            console.log('[DEBUG] _rels/.rels not found');
            return;
        }
        try {
            const xml2js = await import('xml2js');
            const content = relsFile.asText();
            const parsed = await xml2js.parseStringPromise(content);
            let modified = false;
            // 移除 vbaProject 相关的 Relationship 元素
            if (parsed.Relationships && parsed.Relationships.Relationship) {
                const originalLength = parsed.Relationships.Relationship.length;
                parsed.Relationships.Relationship = parsed.Relationships.Relationship.filter((rel) => {
                    const target = rel.$?.Target || '';
                    const type = rel.$?.Type || '';
                    // 移除 vbaProject 相关的关系
                    if (target.includes('vbaProject') ||
                        type.includes('vbaProject') ||
                        type.includes('http://schemas.microsoft.com/office/2006/relationships/vbaProject')) {
                        console.log('[DEBUG] Removing Relationship:', target, type);
                        return false;
                    }
                    return true;
                });
                if (parsed.Relationships.Relationship.length < originalLength) {
                    modified = true;
                }
            }
            if (modified) {
                // 重新生成 XML
                const builder = new xml2js.Builder();
                const newXml = builder.buildObject(parsed);
                zip.file(relsPath, newXml);
                console.log('[DEBUG] Updated _rels/.rels');
            }
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            result.errors.push(`更新 _rels/.rels 失败: ${errorMsg}`);
            console.error('[DEBUG] Failed to update _rels/.rels:', error);
        }
    }
}
