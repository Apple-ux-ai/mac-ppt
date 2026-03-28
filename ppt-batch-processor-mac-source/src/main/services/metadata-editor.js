import { PptxParser } from './pptx-parser';
/**
 * 元数据编辑器
 * 负责管理 PPT 元数据
 */
export class MetadataEditor {
    constructor() {
        this.parser = new PptxParser();
    }
    /**
     * 读取元数据
     * @param filePath PPTX 文件路径
     * @returns 元数据对象
     * @throws Error 如果文件读取失败
     */
    async read(filePath) {
        const document = await this.parser.open(filePath);
        return this.parser.getMetadata(document);
    }
    /**
     * 写入元数据
     * @param filePath PPTX 文件路径
     * @param metadata 要设置的元数据
     * @throws Error 如果文件读取或保存失败
     */
    async write(filePath, metadata) {
        const document = await this.parser.open(filePath);
        this.parser.setMetadata(document, metadata);
        await this.parser.save(document, filePath);
    }
    /**
     * 清空元数据
     * 删除所有敏感元数据字段（作者、公司、标题、主题、关键词）
     * 保留创建和修改日期
     * @param filePath PPTX 文件路径
     * @throws Error 如果文件读取或保存失败
     */
    async clear(filePath) {
        const document = await this.parser.open(filePath);
        // 清空敏感元数据字段
        const clearedMetadata = {
            title: '',
            author: '',
            subject: '',
            keywords: '',
            company: '',
            // 保留创建和修改日期
            created: document.metadata.created,
            modified: document.metadata.modified
        };
        this.parser.setMetadata(document, clearedMetadata);
        await this.parser.save(document, filePath);
    }
    /**
     * 批量修改元数据
     * @param filePaths PPTX 文件路径数组
     * @param metadata 要设置的元数据（支持部分更新）
     * @returns 成功处理的文件数量
     */
    async batchUpdate(filePaths, metadata) {
        let successCount = 0;
        for (const filePath of filePaths) {
            try {
                const document = await this.parser.open(filePath);
                this.parser.setMetadata(document, metadata);
                await this.parser.save(document, filePath);
                successCount++;
            }
            catch (error) {
                // 记录错误但继续处理其他文件
                console.error(`Failed to update metadata for ${filePath}:`, error);
            }
        }
        return successCount;
    }
    /**
     * 编辑元数据
     * 从输入文件读取，更新元数据，保存到输出文件
     * @param inputPath 输入文件路径
     * @param outputPath 输出文件路径
     * @param metadata 要更新的元数据（支持部分更新）
     */
    async editMetadata(inputPath, outputPath, metadata) {
        try {
            console.log('=== Edit Metadata Debug ===');
            console.log('Input file:', inputPath);
            console.log('Output file:', outputPath);
            console.log('Metadata to update:', metadata);
            // 打开文档
            const document = await this.parser.open(inputPath);
            // 获取当前元数据
            const currentMetadata = this.parser.getMetadata(document);
            console.log('Current metadata:', currentMetadata);
            // 合并元数据（只更新提供的字段）
            const updatedMetadata = {
                ...currentMetadata,
                ...metadata
            };
            console.log('Updated metadata:', updatedMetadata);
            // 设置新的元数据
            this.parser.setMetadata(document, updatedMetadata);
            // 保存到输出文件
            await this.parser.save(document, outputPath);
            console.log('Metadata edited successfully');
            console.log('=== End Edit Metadata Debug ===');
        }
        catch (error) {
            if (error instanceof Error) {
                throw new Error(`Failed to edit metadata: ${error.message}`);
            }
            throw new Error('Failed to edit metadata: Unknown error');
        }
    }
    /**
     * 清空元数据并保存到输出文件
     * @param inputPath 输入文件路径
     * @param outputPath 输出文件路径
     */
    async clearMetadata(inputPath, outputPath) {
        try {
            const document = await this.parser.open(inputPath);
            // 清空敏感元数据字段
            const clearedMetadata = {
                title: '',
                author: '',
                subject: '',
                keywords: '',
                company: '',
                // 保留创建和修改日期
                created: document.metadata.created,
                modified: document.metadata.modified
            };
            this.parser.setMetadata(document, clearedMetadata);
            await this.parser.save(document, outputPath);
        }
        catch (error) {
            if (error instanceof Error) {
                throw new Error(`Failed to clear metadata: ${error.message}`);
            }
            throw new Error('Failed to clear metadata: Unknown error');
        }
    }
}
