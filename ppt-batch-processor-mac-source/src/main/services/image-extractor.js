import { promises as fs } from 'fs';
import path from 'path';
import PizZip from 'pizzip';
/**
 * 图片提取器
 * 从 PPT 文件中提取所有图片
 */
export class ImageExtractor {
    /**
     * 从 PPT 文件中提取所有图片
     *
     * @param inputPath 输入 PPT 文件路径
     * @param outputDir 输出目录
     * @param format 输出格式：'original' | 'png' | 'jpg'
     * @returns 提取的图片文件路径数组
     */
    async extractImages(inputPath, outputDir, format = 'original') {
        try {
            console.log('=== Extract Images Debug ===');
            console.log('Input file:', inputPath);
            console.log('Output directory:', outputDir);
            console.log('Format:', format);
            // 确保输出目录存在
            await fs.mkdir(outputDir, { recursive: true });
            // 读取 PPT 文件
            const fileData = await fs.readFile(inputPath);
            const zip = new PizZip(fileData);
            // 获取基础文件名
            const baseName = path.basename(inputPath, path.extname(inputPath));
            // 查找所有图片文件
            const imageFiles = [];
            const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tif', '.tiff', '.emf', '.wmf'];
            // 遍历 ZIP 中的所有文件
            Object.keys(zip.files).forEach(fileName => {
                const file = zip.files[fileName];
                // 检查是否是图片文件
                const ext = path.extname(fileName).toLowerCase();
                if (imageExtensions.includes(ext) && !file.dir) {
                    // 通常图片在 ppt/media/ 目录下
                    if (fileName.startsWith('ppt/media/')) {
                        imageFiles.push(fileName);
                    }
                }
            });
            console.log(`Found ${imageFiles.length} images in PPT`);
            // 提取每个图片
            const extractedPaths = [];
            for (let i = 0; i < imageFiles.length; i++) {
                const imageFile = imageFiles[i];
                const file = zip.files[imageFile];
                // 获取原始扩展名
                const originalExt = path.extname(imageFile);
                // 确定输出扩展名
                let outputExt = originalExt;
                if (format === 'png') {
                    outputExt = '.png';
                }
                else if (format === 'jpg') {
                    outputExt = '.jpg';
                }
                // 生成输出文件名
                const outputFileName = `${baseName}_image_${i + 1}${outputExt}`;
                const outputPath = path.join(outputDir, outputFileName);
                // 提取图片数据
                const imageData = file.asNodeBuffer();
                // 如果需要格式转换
                if (format !== 'original' && originalExt !== outputExt) {
                    // 这里需要使用图片处理库进行格式转换
                    // 暂时直接保存原格式
                    console.log(`  Note: Format conversion from ${originalExt} to ${outputExt} not yet implemented, saving as original`);
                    await fs.writeFile(outputPath.replace(outputExt, originalExt), imageData);
                    extractedPaths.push(outputPath.replace(outputExt, originalExt));
                }
                else {
                    // 直接保存
                    await fs.writeFile(outputPath, imageData);
                    extractedPaths.push(outputPath);
                }
                console.log(`  Extracted: ${outputFileName}`);
            }
            console.log('Extract images completed successfully');
            console.log('=== End Extract Images Debug ===');
            return extractedPaths;
        }
        catch (error) {
            if (error instanceof Error) {
                throw new Error(`Failed to extract images: ${error.message}`);
            }
            throw new Error('Failed to extract images: Unknown error');
        }
    }
}
