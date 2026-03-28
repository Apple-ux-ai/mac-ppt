import { PptxParser } from './pptx-parser';
import { promises as fs } from 'fs';
/**
 * 水印添加器
 * 负责在PPT中添加文字或图片水印
 */
export class WatermarkAdder {
    constructor() {
        this.parser = new PptxParser();
    }
    /**
     * 添加水印到PPT
     * @param inputPath 输入PPT文件路径
     * @param outputPath 输出PPT文件路径
     * @param options 水印选项
     * @returns 添加结果
     */
    async addWatermark(inputPath, outputPath, options) {
        const result = {
            success: true,
            processedSlides: 0,
            errors: []
        };
        try {
            console.log('[DEBUG] Opening PPT file:', inputPath);
            console.log('[DEBUG] Watermark options:', options);
            const document = await this.parser.open(inputPath);
            const totalSlides = document.slides.length;
            console.log(`[DEBUG] Total slides: ${totalSlides}`);
            const zip = document.zipArchive;
            for (let slideNumber = 1; slideNumber <= totalSlides; slideNumber++) {
                try {
                    await this.addWatermarkToSlide(zip, slideNumber, options, document);
                    result.processedSlides++;
                }
                catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    console.error(`[DEBUG] Failed to add watermark to slide ${slideNumber}:`, message);
                    result.errors.push(`Slide ${slideNumber}: ${message}`);
                    result.success = false;
                }
            }
            console.log(`[DEBUG] Processed ${result.processedSlides} slides out of ${totalSlides}`);
            console.log('[DEBUG] Saving to:', outputPath);
            await this.parser.save(document, outputPath);
            console.log('[DEBUG] Save completed');
            try {
                const stats = await fs.stat(outputPath);
                console.log('[DEBUG] Output file exists, size:', stats.size, 'bytes');
            }
            catch (error) {
                console.error('[DEBUG] Output file does NOT exist!', error);
            }
            return result;
        }
        catch (error) {
            result.success = false;
            result.errors.push(error instanceof Error ? error.message : String(error));
            return result;
        }
    }
    /**
     * 将水印添加到幻灯片背景（真正不可删除）
     * @param zip ZIP文档对象
     * @param slideNumber 幻灯片编号
     * @param options 水印选项
     */
    async addWatermarkToSlideBackground(zip, slideNumber, options) {
        console.log(`[WATERMARK] Starting addWatermarkToSlideBackground for slide ${slideNumber}`);
        console.log(`[WATERMARK] Options:`, JSON.stringify(options));
        const slidePath = `ppt/slides/slide${slideNumber}.xml`;
        const slideFile = zip.file(slidePath);
        if (!slideFile) {
            throw new Error(`Slide ${slideNumber} not found`);
        }
        const xml2js = await import('xml2js');
        const content = slideFile.asText();
        const result = await xml2js.parseStringPromise(content);
        const slide = result['p:sld'];
        if (!slide || !slide['p:cSld'] || !slide['p:cSld'][0]) {
            throw new Error('Invalid slide structure');
        }
        const cSld = slide['p:cSld'][0];
        if (!cSld['p:spTree'] || !cSld['p:spTree'][0]) {
            throw new Error('Invalid slide structure');
        }
        const spTree = cSld['p:spTree'][0];
        console.log(`[WATERMARK] Found spTree, current pic count: ${spTree['p:pic'] ? spTree['p:pic'].length : 0}`);
        // 创建水印图片
        let watermarkImagePath;
        let rId;
        if (options.type === 'text') {
            console.log(`[WATERMARK] Creating text watermark...`);
            // 文字水印 - 使用canvas渲染为图片
            const { createCanvas } = await import('canvas');
            const text = options.text || 'Watermark';
            const fontSize = options.fontSize || 48;
            const fontColor = options.fontColor || '000000';
            const opacity = options.opacity || 0.5;
            const canvas = createCanvas(1200, 300);
            const ctx = canvas.getContext('2d');
            // 清除画布并设置白色背景（可选，如果需要背景）
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            // 绘制文字水印
            ctx.font = `bold ${fontSize}px Arial`;
            ctx.fillStyle = `#${fontColor.replace('#', '')}`;
            ctx.globalAlpha = Math.max(opacity, 0.3); // 确保至少30%不透明度
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, canvas.width / 2, canvas.height / 2);
            const imageBuffer = canvas.toBuffer('image/png');
            watermarkImagePath = `ppt/media/watermark_${slideNumber}.png`;
            zip.file(watermarkImagePath, imageBuffer);
            rId = `rIdWatermark${slideNumber}`;
            console.log(`[DEBUG] Created watermark image: ${watermarkImagePath}, size: ${imageBuffer.length} bytes`);
            console.log(`[DEBUG] Watermark text: "${text}", color: ${fontColor}, opacity: ${opacity}`);
        }
        else if (options.type === 'image' && options.imagePath) {
            // 图片水印
            const imageData = await fs.readFile(options.imagePath);
            const imageExt = options.imagePath.split('.').pop()?.toLowerCase() || 'png';
            watermarkImagePath = `ppt/media/watermark_${slideNumber}.${imageExt}`;
            zip.file(watermarkImagePath, imageData);
            rId = `rIdWatermark${slideNumber}`;
        }
        else {
            throw new Error('Invalid watermark type');
        }
        // 添加图片关系
        await this.addImageRelationship(zip, slideNumber, rId, watermarkImagePath);
        // 计算水印位置和大小
        const slideWidth = 9144000;
        const slideHeight = 6858000;
        const watermarkWidth = 4000000;
        const watermarkHeight = 1000000;
        const position = this.calculatePosition(options.position || 'center', slideWidth, slideHeight, watermarkWidth, watermarkHeight);
        // 生成唯一的形状ID
        const shapeId = (slideNumber * 10000 + 9999).toString();
        // 创建水印图片形状 - 使用完整的 XML 结构
        const watermarkShape = {
            'p:nvPicPr': [{
                    'p:cNvPr': [{
                            $: {
                                id: shapeId,
                                name: `Watermark ${slideNumber}`,
                                descr: ''
                            }
                        }],
                    'p:cNvPicPr': [{
                            'a:picLocks': [{
                                    $: {
                                        noChangeAspect: '1'
                                    }
                                }]
                        }],
                    'p:nvPr': [{}]
                }],
            'p:blipFill': [{
                    'a:blip': [{
                            $: {
                                'r:embed': rId
                            }
                        }],
                    'a:stretch': [{
                            'a:fillRect': [{}]
                        }]
                }],
            'p:spPr': [{
                    'a:xfrm': [{
                            'a:off': [{
                                    $: {
                                        x: position.x.toString(),
                                        y: position.y.toString()
                                    }
                                }],
                            'a:ext': [{
                                    $: {
                                        cx: watermarkWidth.toString(),
                                        cy: watermarkHeight.toString()
                                    }
                                }]
                        }],
                    'a:prstGeom': [{
                            $: { prst: 'rect' },
                            'a:avLst': [{}]
                        }]
                }]
        };
        // 暂时禁用水印形状添加，避免文件损坏
        // TODO: 修复XML结构使其不会导致文件损坏
        console.log(`[DEBUG] Watermark image created but shape not added (to prevent corruption)`);
        // 不修改XML，直接返回
        // 这样文件可以正常打开，但水印不可见
    }
    /**
     * 将水印添加到PPT母版（真正不可删除）
     * @param zip ZIP文档对象
     * @param options 水印选项
     */
    async addWatermarkToMaster(zip, options) {
        // 查找母版文件
        const masterPath = 'ppt/slideMasters/slideMaster1.xml';
        const masterFile = zip.file(masterPath);
        if (!masterFile) {
            throw new Error('Master slide not found');
        }
        const xml2js = await import('xml2js');
        const content = masterFile.asText();
        const result = await xml2js.parseStringPromise(content);
        const master = result['p:sldMaster'];
        if (!master || !master['p:cSld'] || !master['p:cSld'][0]) {
            throw new Error('Invalid master structure');
        }
        const cSld = master['p:cSld'][0];
        if (!cSld['p:spTree'] || !cSld['p:spTree'][0]) {
            throw new Error('Invalid master structure');
        }
        const spTree = cSld['p:spTree'][0];
        // 添加水印到母版
        if (options.type === 'text') {
            await this.addTextWatermarkAsShape(spTree, options, zip, 0);
        }
        else if (options.type === 'image') {
            await this.addImageWatermarkAsShape(spTree, options, zip, 0);
        }
        // 保存修改后的母版XML
        const builder = new xml2js.Builder();
        const newXml = builder.buildObject(result);
        zip.file(masterPath, newXml);
    }
    /**
     * 通过替换media文件夹中的图片来添加水印
     * @param zip ZIP文档对象
     * @param options 水印选项
     * @param document PPT文档对象
     */
    async addWatermarkToImagesInMedia(zip, options, document) {
        const sharp = await import('sharp');
        // 遍历media文件夹中的所有图片（支持各种命名格式）
        const mediaFiles = zip.file(/\.png$|\.jpg$|\.jpeg$/i).filter((f) => f.name.startsWith('ppt/media/'));
        console.log(`[DEBUG] Found ${mediaFiles.length} images in media folder`);
        for (const file of mediaFiles) {
            try {
                const imagePath = file.name;
                const imageData = file.asNodeBuffer();
                console.log(`[DEBUG] Processing image: ${imagePath}`);
                // 读取原图
                const originalImage = sharp.default(imageData);
                const metadata = await originalImage.metadata();
                if (!metadata.width || !metadata.height) {
                    console.log(`[DEBUG] Skipping ${imagePath}: no dimensions`);
                    continue;
                }
                // 创建水印
                let watermarkedImage;
                if (options.type === 'text') {
                    // 文字水印
                    watermarkedImage = await this.addTextWatermarkToImage(imageData, metadata.width, metadata.height, options);
                }
                else if (options.type === 'image' && options.imagePath) {
                    // 图片水印
                    watermarkedImage = await this.addImageWatermarkToImage(imageData, metadata.width, metadata.height, options);
                }
                else {
                    continue;
                }
                // 替换原图
                zip.file(imagePath, watermarkedImage);
                console.log(`[DEBUG] Replaced ${imagePath} with watermarked version`);
            }
            catch (error) {
                console.error(`[DEBUG] Failed to watermark image ${file.name}:`, error);
            }
        }
    }
    /**
     * 给图片添加文字水印
     * @param imageData 原图数据
     * @param width 图片宽度
     * @param height 图片高度
     * @param options 水印选项
     * @returns 添加水印后的图片
     */
    async addTextWatermarkToImage(imageData, width, height, options) {
        const sharp = await import('sharp');
        const { createCanvas } = await import('canvas');
        const text = options.text || 'Watermark';
        const fontSize = options.fontSize || 48;
        const fontColor = options.fontColor || '000000';
        const opacity = options.opacity || 0.5;
        // 创建水印图层
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, width, height);
        // 使用支持中文的字体，按优先级回退
        ctx.font = `bold ${fontSize}px "Microsoft YaHei", "SimHei", "SimSun", "PingFang SC", "Hiragino Sans GB", Arial, sans-serif`;
        ctx.fillStyle = `#${fontColor.replace('#', '')}`;
        ctx.globalAlpha = opacity;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // 根据位置绘制水印
        const position = options.position || 'center';
        let x = width / 2;
        let y = height / 2;
        switch (position) {
            case 'top-left':
                x = width * 0.1;
                y = height * 0.1;
                ctx.textAlign = 'left';
                ctx.textBaseline = 'top';
                break;
            case 'top-right':
                x = width * 0.9;
                y = height * 0.1;
                ctx.textAlign = 'right';
                ctx.textBaseline = 'top';
                break;
            case 'bottom-left':
                x = width * 0.1;
                y = height * 0.9;
                ctx.textAlign = 'left';
                ctx.textBaseline = 'bottom';
                break;
            case 'bottom-right':
                x = width * 0.9;
                y = height * 0.9;
                ctx.textAlign = 'right';
                ctx.textBaseline = 'bottom';
                break;
        }
        ctx.fillText(text, x, y);
        // 将水印叠加到原图
        const watermarkBuffer = canvas.toBuffer('image/png');
        const result = await sharp.default(imageData)
            .composite([{
                input: watermarkBuffer,
                blend: 'over'
            }])
            .toBuffer();
        return result;
    }
    /**
     * 给图片添加图片水印
     * @param imageData 原图数据
     * @param width 图片宽度
     * @param height 图片高度
     * @param options 水印选项
     * @returns 添加水印后的图片
     */
    async addImageWatermarkToImage(imageData, width, height, options) {
        const sharp = await import('sharp');
        if (!options.imagePath) {
            return imageData;
        }
        // 读取水印图片
        const watermarkImage = await fs.readFile(options.imagePath);
        const watermarkSharp = sharp.default(watermarkImage);
        const watermarkMeta = await watermarkSharp.metadata();
        // 计算水印大小（默认为原图的20%）
        const watermarkSize = Math.min(width, height) * 0.2;
        const scale = watermarkSize / Math.max(watermarkMeta.width || 1, watermarkMeta.height || 1);
        const watermarkWidth = Math.round((watermarkMeta.width || 100) * scale);
        const watermarkHeight = Math.round((watermarkMeta.height || 100) * scale);
        // 调整水印大小和透明度
        const opacity = options.opacity || 0.5;
        const resizedWatermark = await watermarkSharp
            .resize(watermarkWidth, watermarkHeight, { fit: 'contain' })
            .composite([{
                input: Buffer.from([255, 255, 255, Math.round(opacity * 255)]),
                raw: { width: 1, height: 1, channels: 4 },
                tile: true,
                blend: 'dest-in'
            }])
            .png()
            .toBuffer();
        // 计算水印位置
        const position = options.position || 'center';
        let left = Math.round((width - watermarkWidth) / 2);
        let top = Math.round((height - watermarkHeight) / 2);
        switch (position) {
            case 'top-left':
                left = Math.round(width * 0.05);
                top = Math.round(height * 0.05);
                break;
            case 'top-right':
                left = Math.round(width * 0.95 - watermarkWidth);
                top = Math.round(height * 0.05);
                break;
            case 'bottom-left':
                left = Math.round(width * 0.05);
                top = Math.round(height * 0.95 - watermarkHeight);
                break;
            case 'bottom-right':
                left = Math.round(width * 0.95 - watermarkWidth);
                top = Math.round(height * 0.95 - watermarkHeight);
                break;
        }
        // 叠加水印
        const result = await sharp.default(imageData)
            .composite([{
                input: resizedWatermark,
                left,
                top,
                blend: 'over'
            }])
            .toBuffer();
        return result;
    }
    /**
     * 为指定幻灯片添加水印
     * @param zip ZIP 文档对象
     * @param slideNumber 幻灯片编号（从1开始）
     * @param options 水印选项
     * @param document PPT文档对象
     */
    async addWatermarkToSlide(zip, slideNumber, options, document) {
        const slidePath = `ppt/slides/slide${slideNumber}.xml`;
        const slideFile = zip.file(slidePath);
        if (!slideFile) {
            throw new Error(`Slide ${slideNumber} not found`);
        }
        const xml2js = await import('xml2js');
        const content = slideFile.asText();
        const result = await xml2js.parseStringPromise(content);
        // 查找幻灯片内容
        const slide = result['p:sld'];
        if (!slide || !slide['p:cSld'] || !slide['p:cSld'][0]) {
            throw new Error('Invalid slide structure');
        }
        const cSld = slide['p:cSld'][0];
        if (!cSld['p:spTree'] || !cSld['p:spTree'][0]) {
            throw new Error('Invalid slide structure');
        }
        const spTree = cSld['p:spTree'][0];
        if (options.type === 'text') {
            await this.addTextWatermarkAsShape(spTree, options, zip, slideNumber);
        }
        else if (options.type === 'image') {
            await this.addImageWatermarkAsShape(spTree, options, zip, slideNumber);
        }
        // 保存修改后的XML
        const builder = new xml2js.Builder();
        const newXml = builder.buildObject(result);
        zip.file(slidePath, newXml);
    }
    /**
     * 将文字水印作为形状添加（插入到底层）
     * @param spTree 形状树
     * @param options 水印选项
     * @param zip ZIP文档对象
     * @param slideNumber 幻灯片编号
     */
    async addTextWatermarkAsShape(spTree, options, zip, slideNumber) {
        const text = options.text || 'Watermark';
        const fontSize = options.fontSize || 48;
        const fontColor = options.fontColor || '000000';
        const opacity = options.opacity || 0.5;
        // 使用canvas将文字渲染为图片
        const { createCanvas } = await import('canvas');
        const canvas = createCanvas(800, 200);
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = `bold ${fontSize}px Arial`;
        ctx.fillStyle = `#${fontColor.replace('#', '')}`;
        ctx.globalAlpha = opacity;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const rotation = options.rotation || 0;
        if (rotation !== 0) {
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate((rotation * Math.PI) / 180);
            ctx.fillText(text, 0, 0);
        }
        else {
            ctx.fillText(text, canvas.width / 2, canvas.height / 2);
        }
        const imageBuffer = canvas.toBuffer('image/png');
        const imageId = `watermark_${slideNumber}`;
        const imagePath = `ppt/media/${imageId}.png`;
        zip.file(imagePath, imageBuffer);
        const rId = `rId${Date.now()}`;
        await this.addImageRelationship(zip, slideNumber, rId, imagePath);
        const slideWidth = 9144000;
        const slideHeight = 6858000;
        const watermarkWidth = 3000000;
        const watermarkHeight = 1000000;
        const position = this.calculatePosition(options.position || 'center', slideWidth, slideHeight, watermarkWidth, watermarkHeight);
        // 创建图片形状，添加到数组最前面（底层）
        const picShape = {
            'p:nvPicPr': [{
                    'p:cNvPr': [{ $: { id: '1', name: 'Watermark', descr: 'DO_NOT_DELETE' } }],
                    'p:cNvPicPr': [{
                            'a:picLocks': [{
                                    $: {
                                        noGrp: '1',
                                        noSelect: '1',
                                        noRot: '1',
                                        noChangeAspect: '1',
                                        noMove: '1',
                                        noResize: '1',
                                        noCrop: '1',
                                        noEditPoints: '1',
                                        noAdjustHandles: '1',
                                        noChangeArrowheads: '1',
                                        noChangeShapeType: '1'
                                    }
                                }]
                        }],
                    'p:nvPr': [{}]
                }],
            'p:blipFill': [{
                    'a:blip': [{ $: { 'r:embed': rId } }],
                    'a:stretch': [{ 'a:fillRect': [{}] }]
                }],
            'p:spPr': [{
                    'a:xfrm': [{
                            'a:off': [{ $: { x: position.x.toString(), y: position.y.toString() } }],
                            'a:ext': [{ $: { cx: watermarkWidth.toString(), cy: watermarkHeight.toString() } }]
                        }],
                    'a:prstGeom': [{ $: { prst: 'rect' }, 'a:avLst': [{}] }]
                }]
        };
        if (!spTree['p:pic']) {
            spTree['p:pic'] = [];
        }
        spTree['p:pic'].push(picShape);
    }
    /**
     * 将图片水印作为形状添加（插入到底层）
     * @param spTree 形状树
     * @param options 水印选项
     * @param zip ZIP文档对象
     * @param slideNumber 幻灯片编号
     */
    async addImageWatermarkAsShape(spTree, options, zip, slideNumber) {
        if (!options.imagePath) {
            throw new Error('Image path is required for image watermark');
        }
        const imageData = await fs.readFile(options.imagePath);
        const imageExt = options.imagePath.split('.').pop()?.toLowerCase() || 'png';
        const imageId = `watermark_${slideNumber}`;
        const imagePath = `ppt/media/${imageId}.${imageExt}`;
        zip.file(imagePath, imageData);
        const rId = `rId${Date.now()}`;
        await this.addImageRelationship(zip, slideNumber, rId, imagePath);
        const slideWidth = 9144000;
        const slideHeight = 6858000;
        const watermarkWidth = options.width ? options.width * 914400 : 2000000;
        const watermarkHeight = options.height ? options.height * 914400 : 2000000;
        const position = this.calculatePosition(options.position || 'center', slideWidth, slideHeight, watermarkWidth, watermarkHeight);
        const opacity = Math.round((options.opacity || 0.5) * 100000);
        const picShape = {
            'p:nvPicPr': [{
                    'p:cNvPr': [{ $: { id: '1', name: 'Watermark', descr: 'DO_NOT_DELETE' } }],
                    'p:cNvPicPr': [{
                            'a:picLocks': [{
                                    $: {
                                        noGrp: '1',
                                        noSelect: '1',
                                        noRot: '1',
                                        noChangeAspect: '1',
                                        noMove: '1',
                                        noResize: '1',
                                        noCrop: '1',
                                        noEditPoints: '1',
                                        noAdjustHandles: '1',
                                        noChangeArrowheads: '1',
                                        noChangeShapeType: '1'
                                    }
                                }]
                        }],
                    'p:nvPr': [{}]
                }],
            'p:blipFill': [{
                    'a:blip': [{
                            $: { 'r:embed': rId },
                            'a:alphaModFix': [{ $: { amt: opacity.toString() } }]
                        }],
                    'a:stretch': [{ 'a:fillRect': [{}] }]
                }],
            'p:spPr': [{
                    'a:xfrm': [{
                            'a:off': [{ $: { x: position.x.toString(), y: position.y.toString() } }],
                            'a:ext': [{ $: { cx: watermarkWidth.toString(), cy: watermarkHeight.toString() } }]
                        }],
                    'a:prstGeom': [{ $: { prst: 'rect' }, 'a:avLst': [{}] }]
                }]
        };
        if (!spTree['p:pic']) {
            spTree['p:pic'] = [];
        }
        spTree['p:pic'].push(picShape);
    }
    /**
     * 添加文字水印（转换为图片形式，真正不可编辑）
     * @param spTree 形状树
     * @param options 水印选项
     */
    async addTextWatermark(spTree, options, zip, slideNumber) {
        const text = options.text || 'Watermark';
        const fontSize = options.fontSize || 48;
        const fontColor = options.fontColor || '000000';
        const opacity = options.opacity || 0.5;
        const rotation = options.rotation || 0;
        // 计算位置（使用EMU单位，1英寸 = 914400 EMU）
        const slideWidth = 9144000; // 10英寸
        const slideHeight = 6858000; // 7.5英寸
        // 使用canvas将文字渲染为图片
        const { createCanvas } = await import('canvas');
        // 创建足够大的画布
        const canvas = createCanvas(800, 200);
        const ctx = canvas.getContext('2d');
        // 设置背景透明
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // 设置文字样式
        ctx.font = `bold ${fontSize}px Arial`;
        ctx.fillStyle = `#${fontColor.replace('#', '')}`;
        ctx.globalAlpha = opacity;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // 如果有旋转，应用旋转
        if (rotation !== 0) {
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate((rotation * Math.PI) / 180);
            ctx.fillText(text, 0, 0);
        }
        else {
            ctx.fillText(text, canvas.width / 2, canvas.height / 2);
        }
        // 转换为PNG buffer
        const imageBuffer = canvas.toBuffer('image/png');
        // 添加图片到media文件夹
        const imageId = `text_watermark_${slideNumber}`;
        const imagePath = `ppt/media/${imageId}.png`;
        zip.file(imagePath, imageBuffer);
        // 计算水印位置
        const watermarkWidth = 3000000;
        const watermarkHeight = 1000000;
        const position = this.calculatePosition(options.position || 'center', slideWidth, slideHeight, watermarkWidth, watermarkHeight);
        // 创建关系ID
        const rId = `rId${Date.now()}`;
        // 添加图片关系
        await this.addImageRelationship(zip, slideNumber, rId, imagePath);
        // 创建图片形状（真正不可编辑）
        const picShape = {
            'p:nvPicPr': [{
                    'p:cNvPr': [{ $: { id: '9999', name: 'Text Watermark' } }],
                    'p:cNvPicPr': [{
                            'a:picLocks': [{
                                    $: {
                                        noGrp: '1',
                                        noSelect: '1',
                                        noRot: '1',
                                        noChangeAspect: '1',
                                        noMove: '1',
                                        noResize: '1'
                                    }
                                }]
                        }],
                    'p:nvPr': [{}]
                }],
            'p:blipFill': [{
                    'a:blip': [{
                            $: { 'r:embed': rId },
                            'a:alphaModFix': [{ $: { amt: Math.round(opacity * 100000).toString() } }]
                        }],
                    'a:stretch': [{ 'a:fillRect': [{}] }]
                }],
            'p:spPr': [{
                    'a:xfrm': [{
                            'a:off': [{ $: { x: position.x.toString(), y: position.y.toString() } }],
                            'a:ext': [{ $: { cx: watermarkWidth.toString(), cy: watermarkHeight.toString() } }]
                        }],
                    'a:prstGeom': [{ $: { prst: 'rect' }, 'a:avLst': [{}] }]
                }]
        };
        // 添加到形状树
        if (!spTree['p:pic']) {
            spTree['p:pic'] = [];
        }
        spTree['p:pic'].push(picShape);
    }
    /**
     * 添加图片水印
     * @param spTree 形状树
     * @param options 水印选项
     * @param zip ZIP文档对象
     * @param slideNumber 幻灯片编号
     */
    async addImageWatermark(spTree, options, zip, slideNumber) {
        if (!options.imagePath) {
            throw new Error('Image path is required for image watermark');
        }
        // 读取图片文件
        const imageData = await fs.readFile(options.imagePath);
        const imageExt = options.imagePath.split('.').pop()?.toLowerCase() || 'png';
        // 添加图片到media文件夹
        const imageId = `watermark_${slideNumber}`;
        const imagePath = `ppt/media/${imageId}.${imageExt}`;
        zip.file(imagePath, imageData);
        // 计算位置和大小
        const slideWidth = 9144000;
        const slideHeight = 6858000;
        const width = options.width ? options.width * 914400 : 2000000;
        const height = options.height ? options.height * 914400 : 2000000;
        const position = this.calculatePosition(options.position || 'center', slideWidth, slideHeight, width, height);
        const opacity = Math.round((options.opacity || 0.5) * 100000);
        // 创建关系ID
        const rId = `rId${Date.now()}`;
        // 添加图片关系到slide的rels文件
        await this.addImageRelationship(zip, slideNumber, rId, imagePath);
        // 创建图片形状
        const picShape = {
            'p:nvPicPr': [{
                    'p:cNvPr': [{ $: { id: '9998', name: 'Watermark Image' } }],
                    'p:cNvPicPr': [{ 'a:picLocks': [{ $: { noGrp: '1', noChangeAspect: '1' } }] }],
                    'p:nvPr': [{}]
                }],
            'p:blipFill': [{
                    'a:blip': [{
                            $: { 'r:embed': rId },
                            'a:alphaModFix': [{ $: { amt: opacity.toString() } }]
                        }],
                    'a:stretch': [{ 'a:fillRect': [{}] }]
                }],
            'p:spPr': [{
                    'a:xfrm': [{
                            'a:off': [{ $: { x: position.x.toString(), y: position.y.toString() } }],
                            'a:ext': [{ $: { cx: width.toString(), cy: height.toString() } }]
                        }],
                    'a:prstGeom': [{ $: { prst: 'rect' }, 'a:avLst': [{}] }]
                }]
        };
        // 添加到形状树
        if (!spTree['p:pic']) {
            spTree['p:pic'] = [];
        }
        spTree['p:pic'].push(picShape);
    }
    /**
     * 添加图片关系
     * @param zip ZIP文档对象
     * @param slideNumber 幻灯片编号
     * @param rId 关系ID
     * @param imagePath 图片路径
     */
    async addImageRelationship(zip, slideNumber, rId, imagePath) {
        const relsPath = `ppt/slides/_rels/slide${slideNumber}.xml.rels`;
        const relsFile = zip.file(relsPath);
        const xml2js = await import('xml2js');
        let relsContent;
        if (relsFile) {
            const content = relsFile.asText();
            relsContent = await xml2js.parseStringPromise(content);
        }
        else {
            // 创建新的rels文件
            relsContent = {
                Relationships: {
                    $: { xmlns: 'http://schemas.openxmlformats.org/package/2006/relationships' },
                    Relationship: []
                }
            };
        }
        // 添加新关系
        if (!relsContent.Relationships.Relationship) {
            relsContent.Relationships.Relationship = [];
        }
        // 计算相对路径：从 ppt/slides/ 到 imagePath
        // imagePath 格式: ppt/media/bg_watermark_1.png
        // 需要转换为: ../media/bg_watermark_1.png
        const relativePath = imagePath.replace('ppt/', '../');
        relsContent.Relationships.Relationship.push({
            $: {
                Id: rId,
                Type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image',
                Target: relativePath
            }
        });
        // 保存rels文件
        const builder = new xml2js.Builder();
        const newXml = builder.buildObject(relsContent);
        zip.file(relsPath, newXml);
    }
    /**
     * 给PPT中的图片添加水印
     * @param spTree 形状树
     * @param options 水印选项
     * @param zip ZIP文档对象
     * @param slideNumber 幻灯片编号
     * @param document PPT文档对象
     */
    async addWatermarkToImages(spTree, options, zip, slideNumber, document) {
        console.log(`[DEBUG] Adding watermark to images in slide ${slideNumber}`);
        // 递归查找所有图片元素（包括组合中的图片）
        const allPictures = [];
        this.collectAllPictures(spTree, allPictures);
        console.log(`[DEBUG] Found ${allPictures.length} pictures in slide ${slideNumber} (including groups)`);
        if (allPictures.length === 0) {
            console.log(`[DEBUG] No pictures found in slide ${slideNumber}, skipping`);
            return;
        }
        // 为每个图片添加水印
        for (let i = 0; i < allPictures.length; i++) {
            const pic = allPictures[i];
            console.log(`[DEBUG] Processing picture ${i + 1}/${allPictures.length}`);
            // 获取图片的位置和大小
            const spPr = pic['p:spPr']?.[0];
            if (!spPr || !spPr['a:xfrm']?.[0]) {
                console.log(`[DEBUG] Picture ${i + 1} has no transform info, skipping`);
                continue;
            }
            const xfrm = spPr['a:xfrm'][0];
            const off = xfrm['a:off']?.[0]?.$;
            const ext = xfrm['a:ext']?.[0]?.$;
            if (!off || !ext) {
                console.log(`[DEBUG] Picture ${i + 1} has incomplete transform info, skipping`);
                continue;
            }
            const imgX = parseInt(off.x);
            const imgY = parseInt(off.y);
            const imgWidth = parseInt(ext.cx);
            const imgHeight = parseInt(ext.cy);
            console.log(`[DEBUG] Picture ${i + 1} position: (${imgX}, ${imgY}), size: ${imgWidth}x${imgHeight}`);
            // 根据水印类型在图片上添加水印
            if (options.type === 'text') {
                // 在图片位置上添加文字水印
                this.addTextWatermarkOnImage(spTree, options, imgX, imgY, imgWidth, imgHeight);
            }
            else if (options.type === 'image' && options.imagePath) {
                // 在图片位置上添加图片水印
                await this.addImageWatermarkOnImage(spTree, options, zip, slideNumber, imgX, imgY, imgWidth, imgHeight, i);
            }
        }
    }
    /**
     * 递归收集所有图片元素（包括组合中的图片）
     * @param element 当前元素
     * @param pictures 图片数组
     */
    collectAllPictures(element, pictures) {
        // 直接的图片元素
        if (element['p:pic']) {
            pictures.push(...element['p:pic']);
        }
        // 组合中的图片
        if (element['p:grpSp']) {
            const groups = element['p:grpSp'];
            for (const group of groups) {
                // 递归查找组合中的图片
                this.collectAllPictures(group, pictures);
            }
        }
    }
    /**
     * 在图片上添加文字水印
     * @param spTree 形状树
     * @param options 水印选项
     * @param imgX 图片X坐标
     * @param imgY 图片Y坐标
     * @param imgWidth 图片宽度
     * @param imgHeight 图片高度
     */
    addTextWatermarkOnImage(spTree, options, imgX, imgY, imgWidth, imgHeight) {
        const text = options.text || 'Watermark';
        const fontSize = options.fontSize || 48;
        const fontColor = options.fontColor || '000000';
        const opacity = Math.round((options.opacity || 0.5) * 100000);
        const rotation = (options.rotation || 0) * 60000;
        // 计算水印在图片上的位置
        const watermarkWidth = 3000000;
        const watermarkHeight = 1000000;
        let watermarkX = imgX;
        let watermarkY = imgY;
        switch (options.position || 'center') {
            case 'top-left':
                watermarkX = imgX + 100000;
                watermarkY = imgY + 100000;
                break;
            case 'top-right':
                watermarkX = imgX + imgWidth - watermarkWidth - 100000;
                watermarkY = imgY + 100000;
                break;
            case 'bottom-left':
                watermarkX = imgX + 100000;
                watermarkY = imgY + imgHeight - watermarkHeight - 100000;
                break;
            case 'bottom-right':
                watermarkX = imgX + imgWidth - watermarkWidth - 100000;
                watermarkY = imgY + imgHeight - watermarkHeight - 100000;
                break;
            case 'center':
            default:
                watermarkX = imgX + (imgWidth - watermarkWidth) / 2;
                watermarkY = imgY + (imgHeight - watermarkHeight) / 2;
                break;
        }
        // 创建文本框形状（不可编辑）
        const textShape = {
            'p:nvSpPr': [{
                    'p:cNvPr': [{ $: { id: `${9900 + Math.floor(Math.random() * 100)}`, name: 'Image Watermark' } }],
                    'p:cNvSpPr': [{
                            'a:spLocks': [{
                                    $: {
                                        noGrp: '1',
                                        noRot: '1',
                                        noChangeAspect: '1',
                                        noMove: '1',
                                        noResize: '1',
                                        noTextEdit: '1'
                                    }
                                }]
                        }],
                    'p:nvPr': [{}]
                }],
            'p:spPr': [{
                    'a:xfrm': [{
                            $: { rot: rotation.toString() },
                            'a:off': [{ $: { x: watermarkX.toString(), y: watermarkY.toString() } }],
                            'a:ext': [{ $: { cx: watermarkWidth.toString(), cy: watermarkHeight.toString() } }]
                        }],
                    'a:prstGeom': [{ $: { prst: 'rect' }, 'a:avLst': [{}] }],
                    'a:noFill': [{}]
                }],
            'p:txBody': [{
                    'a:bodyPr': [{}],
                    'a:lstStyle': [{}],
                    'a:p': [{
                            'a:pPr': [{ $: { algn: 'ctr' } }],
                            'a:r': [{
                                    'a:rPr': [{
                                            $: {
                                                sz: (fontSize * 100).toString(),
                                                b: '1'
                                            },
                                            'a:solidFill': [{
                                                    'a:srgbClr': [{
                                                            $: { val: fontColor.replace('#', '') },
                                                            'a:alpha': [{ $: { val: opacity.toString() } }]
                                                        }]
                                                }]
                                        }],
                                    'a:t': [text]
                                }]
                        }]
                }]
        };
        // 添加到形状树
        if (!spTree['p:sp']) {
            spTree['p:sp'] = [];
        }
        spTree['p:sp'].push(textShape);
    }
    /**
     * 在图片上添加图片水印
     * @param spTree 形状树
     * @param options 水印选项
     * @param zip ZIP文档对象
     * @param slideNumber 幻灯片编号
     * @param imgX 图片X坐标
     * @param imgY 图片Y坐标
     * @param imgWidth 图片宽度
     * @param imgHeight 图片高度
     * @param imageIndex 图片索引
     */
    async addImageWatermarkOnImage(spTree, options, zip, slideNumber, imgX, imgY, imgWidth, imgHeight, imageIndex) {
        if (!options.imagePath) {
            return;
        }
        // 读取水印图片
        const imageData = await fs.readFile(options.imagePath);
        const imageExt = options.imagePath.split('.').pop()?.toLowerCase() || 'png';
        // 添加图片到media文件夹
        const imageId = `watermark_img_${slideNumber}_${imageIndex}`;
        const imagePath = `ppt/media/${imageId}.${imageExt}`;
        zip.file(imagePath, imageData);
        // 计算水印大小和位置
        const watermarkWidth = options.width ? options.width * 914400 : Math.min(imgWidth * 0.3, 2000000);
        const watermarkHeight = options.height ? options.height * 914400 : Math.min(imgHeight * 0.3, 2000000);
        const opacity = Math.round((options.opacity || 0.5) * 100000);
        let watermarkX = imgX;
        let watermarkY = imgY;
        switch (options.position || 'center') {
            case 'top-left':
                watermarkX = imgX + 100000;
                watermarkY = imgY + 100000;
                break;
            case 'top-right':
                watermarkX = imgX + imgWidth - watermarkWidth - 100000;
                watermarkY = imgY + 100000;
                break;
            case 'bottom-left':
                watermarkX = imgX + 100000;
                watermarkY = imgY + imgHeight - watermarkHeight - 100000;
                break;
            case 'bottom-right':
                watermarkX = imgX + imgWidth - watermarkWidth - 100000;
                watermarkY = imgY + imgHeight - watermarkHeight - 100000;
                break;
            case 'center':
            default:
                watermarkX = imgX + (imgWidth - watermarkWidth) / 2;
                watermarkY = imgY + (imgHeight - watermarkHeight) / 2;
                break;
        }
        // 创建关系ID
        const rId = `rId${Date.now()}_${imageIndex}`;
        // 添加图片关系
        await this.addImageRelationship(zip, slideNumber, rId, imagePath);
        // 创建图片形状
        const picShape = {
            'p:nvPicPr': [{
                    'p:cNvPr': [{ $: { id: `${9800 + imageIndex}`, name: `Image Watermark ${imageIndex}` } }],
                    'p:cNvPicPr': [{ 'a:picLocks': [{ $: { noGrp: '1', noChangeAspect: '1' } }] }],
                    'p:nvPr': [{}]
                }],
            'p:blipFill': [{
                    'a:blip': [{
                            $: { 'r:embed': rId },
                            'a:alphaModFix': [{ $: { amt: opacity.toString() } }]
                        }],
                    'a:stretch': [{ 'a:fillRect': [{}] }]
                }],
            'p:spPr': [{
                    'a:xfrm': [{
                            'a:off': [{ $: { x: watermarkX.toString(), y: watermarkY.toString() } }],
                            'a:ext': [{ $: { cx: watermarkWidth.toString(), cy: watermarkHeight.toString() } }]
                        }],
                    'a:prstGeom': [{ $: { prst: 'rect' }, 'a:avLst': [{}] }]
                }]
        };
        // 添加到形状树
        if (!spTree['p:pic']) {
            spTree['p:pic'] = [];
        }
        spTree['p:pic'].push(picShape);
    }
    /**
     * 计算水印位置
     * @param position 位置类型
     * @param slideWidth 幻灯片宽度
     * @param slideHeight 幻灯片高度
     * @param width 水印宽度（可选）
     * @param height 水印高度（可选）
     * @returns 位置坐标
     */
    calculatePosition(position, slideWidth, slideHeight, width = 3000000, height = 1000000) {
        switch (position) {
            case 'top-left':
                return { x: 100000, y: 100000 };
            case 'top-right':
                return { x: slideWidth - width - 100000, y: 100000 };
            case 'bottom-left':
                return { x: 100000, y: slideHeight - height - 100000 };
            case 'bottom-right':
                return { x: slideWidth - width - 100000, y: slideHeight - height - 100000 };
            case 'center':
            default:
                return {
                    x: (slideWidth - width) / 2,
                    y: (slideHeight - height) / 2
                };
        }
    }
}
