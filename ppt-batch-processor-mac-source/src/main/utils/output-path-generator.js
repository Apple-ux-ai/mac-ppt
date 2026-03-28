import fs from 'fs/promises';
import path from 'path';
/**
 * OutputPathGenerator - 输出路径生成器
 *
 * 负责生成输出文件路径，支持自定义文件名规则和自动冲突解决
 *
 * 验证需求:
 * - 22.4: 支持自定义文件名规则（前缀、后缀、序号）
 * - 22.5: 处理文件名冲突，自动添加序号避免覆盖
 */
export class OutputPathGenerator {
    /**
     * 生成输出路径
     *
     * @param inputPath - 输入文件路径
     * @param outputDir - 输出目录
     * @param pattern - 文件名模式（可选）
     * @returns 输出文件路径
     */
    async generateOutputPath(inputPath, outputDir, pattern) {
        // 解析输入文件信息
        const inputInfo = this.parseInputPath(inputPath);
        // 生成基础文件名
        let fileName;
        if (pattern) {
            fileName = this.applyPattern(pattern, inputInfo);
        }
        else {
            fileName = inputInfo.nameWithExt;
        }
        // 组合输出路径
        let outputPath = path.join(outputDir, fileName);
        // 处理文件名冲突
        outputPath = await this.resolveConflict(outputPath);
        return outputPath;
    }
    /**
     * 批量生成输出路径
     *
     * @param inputPaths - 输入文件路径数组
     * @param outputDir - 输出目录
     * @param pattern - 文件名模式（可选）
     * @returns 输出文件路径数组
     */
    async generateOutputPaths(inputPaths, outputDir, pattern) {
        const outputPaths = [];
        for (let i = 0; i < inputPaths.length; i++) {
            const inputPath = inputPaths[i];
            const inputInfo = this.parseInputPath(inputPath);
            // 生成基础文件名
            let fileName;
            if (pattern) {
                // 为批量处理添加索引信息
                const patternInfo = {
                    ...inputInfo,
                    index: i + 1,
                    total: inputPaths.length
                };
                fileName = this.applyPattern(pattern, patternInfo);
            }
            else {
                fileName = inputInfo.nameWithExt;
            }
            // 组合输出路径
            let outputPath = path.join(outputDir, fileName);
            // 处理文件名冲突（考虑已生成的路径）
            outputPath = await this.resolveConflict(outputPath, outputPaths);
            outputPaths.push(outputPath);
        }
        return outputPaths;
    }
    /**
     * 解析输入文件路径
     *
     * @param inputPath - 输入文件路径
     * @returns 文件信息
     */
    parseInputPath(inputPath) {
        const parsed = path.parse(inputPath);
        return {
            dir: parsed.dir,
            name: parsed.name,
            ext: parsed.ext,
            nameWithExt: parsed.base,
            fullPath: inputPath
        };
    }
    /**
     * 应用文件名模式
     *
     * 支持的占位符:
     * - {name}: 原文件名（不含扩展名）
     * - {ext}: 文件扩展名（含点）
     * - {index}: 文件索引（从 1 开始）
     * - {total}: 文件总数
     * - {date}: 当前日期 (YYYYMMDD)
     * - {time}: 当前时间 (HHMMSS)
     * - {timestamp}: Unix 时间戳
     *
     * 示例:
     * - "{name}_processed{ext}" -> "document_processed.pptx"
     * - "output_{index}_{name}{ext}" -> "output_1_document.pptx"
     * - "{name}_{date}{ext}" -> "document_20240101.pptx"
     *
     * @param pattern - 文件名模式
     * @param info - 文件信息
     * @returns 应用模式后的文件名
     */
    applyPattern(pattern, info) {
        const now = new Date();
        // 格式化日期和时间
        const date = now.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
        const time = now.toTimeString().slice(0, 8).replace(/:/g, ''); // HHMMSS
        const timestamp = now.getTime().toString();
        // 替换占位符
        let result = pattern
            .replace(/\{name\}/g, info.name)
            .replace(/\{ext\}/g, info.ext)
            .replace(/\{date\}/g, date)
            .replace(/\{time\}/g, time)
            .replace(/\{timestamp\}/g, timestamp);
        // 替换索引和总数（如果提供）
        if (info.index !== undefined) {
            result = result.replace(/\{index\}/g, info.index.toString());
        }
        if (info.total !== undefined) {
            result = result.replace(/\{total\}/g, info.total.toString());
        }
        return result;
    }
    /**
     * 解决文件名冲突
     *
     * 如果文件已存在，自动添加序号 (1), (2), (3) 等
     *
     * @param outputPath - 输出路径
     * @param existingPaths - 已存在的路径列表（可选）
     * @returns 不冲突的输出路径
     */
    async resolveConflict(outputPath, existingPaths = []) {
        // 检查文件是否存在或在已生成的路径中
        const exists = await this.pathExists(outputPath) || existingPaths.includes(outputPath);
        if (!exists) {
            return outputPath;
        }
        // 解析路径
        const parsed = path.parse(outputPath);
        const dir = parsed.dir;
        const name = parsed.name;
        const ext = parsed.ext;
        // 尝试添加序号
        let counter = 1;
        let newPath;
        do {
            const newName = `${name} (${counter})${ext}`;
            newPath = path.join(dir, newName);
            counter++;
            // 防止无限循环
            if (counter > 10000) {
                throw new Error(`无法生成唯一文件名: ${outputPath}`);
            }
        } while (await this.pathExists(newPath) || existingPaths.includes(newPath));
        return newPath;
    }
    /**
     * 检查路径是否存在
     *
     * @param filePath - 文件路径
     * @returns 是否存在
     */
    async pathExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * 验证文件名模式
     *
     * @param pattern - 文件名模式
     * @returns 是否有效
     */
    validatePattern(pattern) {
        // 检查是否包含扩展名占位符
        if (!pattern.includes('{ext}')) {
            return {
                valid: false,
                error: '文件名模式必须包含 {ext} 占位符以保留文件扩展名'
            };
        }
        // 检查是否包含非法字符
        const illegalChars = /[<>:"|?*]/;
        const patternWithoutPlaceholders = pattern
            .replace(/\{name\}/g, '')
            .replace(/\{ext\}/g, '')
            .replace(/\{index\}/g, '')
            .replace(/\{total\}/g, '')
            .replace(/\{date\}/g, '')
            .replace(/\{time\}/g, '')
            .replace(/\{timestamp\}/g, '');
        if (illegalChars.test(patternWithoutPlaceholders)) {
            return {
                valid: false,
                error: '文件名模式包含非法字符: < > : " | ? *'
            };
        }
        return { valid: true };
    }
    /**
     * 获取支持的占位符列表
     *
     * @returns 占位符说明
     */
    getSupportedPlaceholders() {
        return [
            {
                placeholder: '{name}',
                description: '原文件名（不含扩展名）',
                example: 'document'
            },
            {
                placeholder: '{ext}',
                description: '文件扩展名（含点）',
                example: '.pptx'
            },
            {
                placeholder: '{index}',
                description: '文件索引（从 1 开始）',
                example: '1'
            },
            {
                placeholder: '{total}',
                description: '文件总数',
                example: '10'
            },
            {
                placeholder: '{date}',
                description: '当前日期 (YYYYMMDD)',
                example: '20240101'
            },
            {
                placeholder: '{time}',
                description: '当前时间 (HHMMSS)',
                example: '143025'
            },
            {
                placeholder: '{timestamp}',
                description: 'Unix 时间戳',
                example: '1704110425000'
            }
        ];
    }
}
// 导出默认实例
export const outputPathGenerator = new OutputPathGenerator();
