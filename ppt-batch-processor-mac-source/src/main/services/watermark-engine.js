import { parseString, Builder } from 'xml2js';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import path from 'path';
import sharp from 'sharp';
const parseXml = promisify(parseString);
/**
 * 水印引擎
 * 负责添加文字和图片水印到 PPT 幻灯片
 */
export class WatermarkEngine {
    /**
     * 添加文字水印到幻灯片
     * 在幻灯片 XML 中添加文本框元素，设置位置、字体、颜色、透明度和图层顺序
     *
     * @param document PptxDocument 对象
     * @param slide 幻灯片对象
     * @param options 文字水印选项
     * @returns 是否成功添加水印
     *
     * 需求: 9.1 - 允许设置水印文本、字体、颜色、大小和透明度
     * 需求: 9.3 - 允许用户选择水印位置
     * 需求: 9.4 - 在每个幻灯片上添加水印
     */
    async addTextWatermark(document, slide, options) {
        if (options.type !== 'text') {
            throw new Error('Invalid watermark type: expected "text"');
        }
        try {
            const zip = document.zipArchive;
            // 查找幻灯片索引
            const slideIndex = document.slides.indexOf(slide);
            if (slideIndex === -1) {
                return false;
            }
            // 获取幻灯片文件路径
            const slidePath = await this.getSlidePath(zip, slideIndex);
            if (!slidePath) {
                return false;
            }
            // 读取幻灯片 XML
            const slideFile = zip.file(slidePath);
            if (!slideFile) {
                return false;
            }
            const slideXml = slideFile.asText();
            const slideData = await parseXml(slideXml);
            // 计算水印位置
            const position = this.calculateWatermarkPosition(options.position);
            // 创建文本框元素
            const textBoxElement = this.createTextBoxElement(options.content, position, options.fontSize || 36, options.fontColor || '#000000', options.opacity);
            // 将文本框添加到幻灯片的形状树中（最上层）
            const added = this.addElementToSlide(slideData, textBoxElement);
            if (added) {
                // 保存更新后的 XML
                const builder = new Builder({
                    xmldec: { version: '1.0', encoding: 'UTF-8', standalone: true }
                });
                const updatedXml = builder.buildObject(slideData);
                zip.file(slidePath, updatedXml);
                return true;
            }
            return false;
        }
        catch (error) {
            console.warn('Failed to add text watermark:', error);
            return false;
        }
    }
    /**
     * 添加图片水印到幻灯片
     * 在幻灯片 XML 中添加图片元素，设置位置、大小、透明度
     *
     * @param document PptxDocument 对象
     * @param slide 幻灯片对象
     * @param options 图片水印选项
     * @returns 是否成功添加水印
     *
     * 需求: 9.2 - 允许上传水印图片并设置透明度和大小
     * 需求: 9.3 - 允许用户选择水印位置
     * 需求: 9.4 - 在每个幻灯片上添加水印
     */
    async addImageWatermark(document, slide, options) {
        if (options.type !== 'image') {
            throw new Error('Invalid watermark type: expected "image"');
        }
        try {
            const zip = document.zipArchive;
            // 查找幻灯片索引
            const slideIndex = document.slides.indexOf(slide);
            if (slideIndex === -1) {
                return false;
            }
            // 获取幻灯片文件路径
            const slidePath = await this.getSlidePath(zip, slideIndex);
            if (!slidePath) {
                return false;
            }
            // 读取水印图片文件
            const imageBuffer = await fs.readFile(options.content);
            // 确定图片格式
            const imageExt = path.extname(options.content).toLowerCase();
            const imageFormat = imageExt === '.png' ? 'png' : imageExt === '.jpg' || imageExt === '.jpeg' ? 'jpeg' : 'png';
            // 生成图片 ID 和关系 ID
            const imageId = Date.now() % 1000000;
            const rId = `rId${imageId}`;
            // 将图片添加到 PPTX 包中
            const imagePath = `ppt/media/watermark_${imageId}.${imageFormat === 'jpeg' ? 'jpg' : imageFormat}`;
            zip.file(imagePath, imageBuffer);
            // 更新幻灯片关系文件
            const slideRelsPath = slidePath.replace('.xml', '.xml.rels');
            await this.addImageRelationship(zip, slideRelsPath, rId, `../media/watermark_${imageId}.${imageFormat === 'jpeg' ? 'jpg' : imageFormat}`);
            // 读取幻灯片 XML
            const slideFile = zip.file(slidePath);
            if (!slideFile) {
                return false;
            }
            const slideXml = slideFile.asText();
            const slideData = await parseXml(slideXml);
            // 计算水印位置和尺寸
            const position = this.calculateImageWatermarkPosition(options.position, options.size);
            // 创建图片元素
            const imageElement = this.createImageElement(rId, position, options.opacity, imageId);
            // 将图片添加到幻灯片的形状树中（最上层）
            const added = this.addElementToSlide(slideData, imageElement);
            if (added) {
                // 保存更新后的 XML
                const builder = new Builder({
                    xmldec: { version: '1.0', encoding: 'UTF-8', standalone: true }
                });
                const updatedXml = builder.buildObject(slideData);
                zip.file(slidePath, updatedXml);
                return true;
            }
            return false;
        }
        catch (error) {
            console.warn('Failed to add image watermark:', error);
            return false;
        }
    }
    /**
     * 计算水印位置坐标
     * 根据位置选项返回 EMU (English Metric Units) 坐标
     *
     * PPTX 使用 EMU 作为单位：1 英寸 = 914400 EMU
     * 标准幻灯片尺寸：10 英寸 x 7.5 英寸 = 9144000 x 6858000 EMU
     */
    calculateWatermarkPosition(position) {
        // 标准幻灯片尺寸（EMU）
        const slideWidth = 9144000;
        const slideHeight = 6858000;
        // 水印文本框默认尺寸
        const watermarkWidth = 3048000; // 约 3.33 英寸
        const watermarkHeight = 914400; // 约 1 英寸
        // 边距
        const margin = 228600; // 约 0.25 英寸
        let x;
        let y;
        switch (position) {
            case 'top-left':
                x = margin;
                y = margin;
                break;
            case 'top-right':
                x = slideWidth - watermarkWidth - margin;
                y = margin;
                break;
            case 'center':
                x = (slideWidth - watermarkWidth) / 2;
                y = (slideHeight - watermarkHeight) / 2;
                break;
            case 'bottom-left':
                x = margin;
                y = slideHeight - watermarkHeight - margin;
                break;
            case 'bottom-right':
                x = slideWidth - watermarkWidth - margin;
                y = slideHeight - watermarkHeight - margin;
                break;
            default:
                // 默认右下角
                x = slideWidth - watermarkWidth - margin;
                y = slideHeight - watermarkHeight - margin;
        }
        return {
            x: Math.round(x),
            y: Math.round(y),
            width: watermarkWidth,
            height: watermarkHeight
        };
    }
    /**
     * 计算图片水印位置坐标
     * 根据位置选项和自定义尺寸返回 EMU 坐标
     *
     * @param position 位置选项
     * @param size 自定义尺寸（可选）
     * @returns 位置和尺寸信息
     */
    calculateImageWatermarkPosition(position, size) {
        // 标准幻灯片尺寸（EMU）
        const slideWidth = 9144000;
        const slideHeight = 6858000;
        // 图片水印默认尺寸（如果未指定）
        // 默认为 2 英寸 x 2 英寸
        const defaultWidth = 1828800; // 约 2 英寸
        const defaultHeight = 1828800; // 约 2 英寸
        // 使用自定义尺寸或默认尺寸
        // 如果提供了尺寸，假设单位是像素，转换为 EMU（96 DPI）
        // 1 像素 = 9525 EMU (at 96 DPI)
        const watermarkWidth = size ? size.width * 9525 : defaultWidth;
        const watermarkHeight = size ? size.height * 9525 : defaultHeight;
        // 边距
        const margin = 228600; // 约 0.25 英寸
        let x;
        let y;
        switch (position) {
            case 'top-left':
                x = margin;
                y = margin;
                break;
            case 'top-right':
                x = slideWidth - watermarkWidth - margin;
                y = margin;
                break;
            case 'center':
                x = (slideWidth - watermarkWidth) / 2;
                y = (slideHeight - watermarkHeight) / 2;
                break;
            case 'bottom-left':
                x = margin;
                y = slideHeight - watermarkHeight - margin;
                break;
            case 'bottom-right':
                x = slideWidth - watermarkWidth - margin;
                y = slideHeight - watermarkHeight - margin;
                break;
            default:
                // 默认右下角
                x = slideWidth - watermarkWidth - margin;
                y = slideHeight - watermarkHeight - margin;
        }
        return {
            x: Math.round(x),
            y: Math.round(y),
            width: Math.round(watermarkWidth),
            height: Math.round(watermarkHeight)
        };
    }
    /**
     * 创建文本框元素的 XML 结构
     *
     * @param text 水印文本
     * @param position 位置和尺寸
     * @param fontSize 字体大小（点数）
     * @param fontColor 字体颜色（十六进制，如 #FF0000）
     * @param opacity 透明度（0-1）
     * @returns 文本框元素的 XML 对象
     */
    createTextBoxElement(text, position, fontSize, fontColor, opacity) {
        // 移除颜色前缀的 #
        const color = fontColor.startsWith('#') ? fontColor.substring(1) : fontColor;
        // 转换透明度为百分比（0-100000）
        const alphaPercent = Math.round((1 - opacity) * 100000);
        // 字体大小转换为 EMU（点数 * 100）
        const fontSizeEmu = fontSize * 100;
        // 生成唯一 ID（使用时间戳）
        const shapeId = Date.now() % 1000000;
        // 创建文本框形状元素
        return {
            'p:sp': {
                'p:nvSpPr': [{
                        'p:cNvPr': [{
                                $: {
                                    id: shapeId.toString(),
                                    name: `Watermark ${shapeId}`
                                }
                            }],
                        'p:cNvSpPr': [{
                                'a:spLocks': [{
                                        $: {
                                            noGrp: '1'
                                        }
                                    }]
                            }],
                        'p:nvPr': [{}]
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
                                            cx: position.width.toString(),
                                            cy: position.height.toString()
                                        }
                                    }]
                            }],
                        'a:prstGeom': [{
                                $: {
                                    prst: 'rect'
                                },
                                'a:avLst': [{}]
                            }],
                        'a:noFill': [{}]
                    }],
                'p:txBody': [{
                        'a:bodyPr': [{
                                $: {
                                    wrap: 'none',
                                    rtlCol: '0'
                                },
                                'a:spAutoFit': [{}]
                            }],
                        'a:lstStyle': [{}],
                        'a:p': [{
                                'a:pPr': [{
                                        $: {
                                            algn: 'ctr'
                                        }
                                    }],
                                'a:r': [{
                                        'a:rPr': [{
                                                $: {
                                                    lang: 'zh-CN',
                                                    sz: fontSizeEmu.toString(),
                                                    b: '0',
                                                    i: '0'
                                                },
                                                'a:solidFill': [{
                                                        'a:srgbClr': [{
                                                                $: {
                                                                    val: color
                                                                },
                                                                'a:alpha': [{
                                                                        $: {
                                                                            val: (100000 - alphaPercent).toString()
                                                                        }
                                                                    }]
                                                            }]
                                                    }],
                                                'a:latin': [{
                                                        $: {
                                                            typeface: 'Arial'
                                                        }
                                                    }],
                                                'a:ea': [{
                                                        $: {
                                                            typeface: '微软雅黑'
                                                        }
                                                    }]
                                            }],
                                        'a:t': [text]
                                    }]
                            }]
                    }]
            }
        };
    }
    /**
     * 创建图片元素的 XML 结构
     *
     * @param rId 关系 ID
     * @param position 位置和尺寸
     * @param opacity 透明度（0-1）
     * @param imageId 图片 ID
     * @returns 图片元素的 XML 对象
     */
    createImageElement(rId, position, opacity, imageId) {
        // 转换透明度为百分比（0-100000）
        const alphaPercent = Math.round(opacity * 100000);
        // 创建图片形状元素
        return {
            'p:pic': {
                'p:nvPicPr': [{
                        'p:cNvPr': [{
                                $: {
                                    id: imageId.toString(),
                                    name: `Watermark Image ${imageId}`
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
                                },
                                'a:alphaModFix': [{
                                        $: {
                                            amt: alphaPercent.toString()
                                        }
                                    }]
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
                                            cx: position.width.toString(),
                                            cy: position.height.toString()
                                        }
                                    }]
                            }],
                        'a:prstGeom': [{
                                $: {
                                    prst: 'rect'
                                },
                                'a:avLst': [{}]
                            }]
                    }]
            }
        };
    }
    /**
     * 将元素添加到幻灯片的形状树中
     * 添加到最后以确保水印在最上层
     *
     * @param slideData 幻灯片 XML 数据
     * @param element 要添加的元素
     * @returns 是否成功添加
     */
    addElementToSlide(slideData, element) {
        try {
            const slide = slideData['p:sld'];
            if (!slide)
                return false;
            const cSld = slide['p:cSld']?.[0];
            if (!cSld)
                return false;
            const spTree = cSld['p:spTree']?.[0];
            if (!spTree)
                return false;
            // 检查是文本框还是图片
            if (element['p:sp']) {
                // 文本框元素
                if (!spTree['p:sp']) {
                    spTree['p:sp'] = [];
                }
                spTree['p:sp'].push(element['p:sp']);
            }
            else if (element['p:pic']) {
                // 图片元素
                if (!spTree['p:pic']) {
                    spTree['p:pic'] = [];
                }
                spTree['p:pic'].push(element['p:pic']);
            }
            else {
                return false;
            }
            return true;
        }
        catch (error) {
            console.warn('Failed to add element to slide:', error);
            return false;
        }
    }
    /**
     * 添加图片关系到幻灯片关系文件
     *
     * @param zip PizZip 实例
     * @param relsPath 关系文件路径
     * @param rId 关系 ID
     * @param target 目标路径
     */
    async addImageRelationship(zip, relsPath, rId, target) {
        try {
            let relsFile = zip.file(relsPath);
            let relsData;
            if (relsFile) {
                // 关系文件已存在，读取并解析
                const relsXml = relsFile.asText();
                relsData = await parseXml(relsXml);
            }
            else {
                // 关系文件不存在，创建新的
                relsData = {
                    'Relationships': {
                        $: {
                            xmlns: 'http://schemas.openxmlformats.org/package/2006/relationships'
                        },
                        'Relationship': []
                    }
                };
            }
            // 确保 Relationship 数组存在
            if (!relsData['Relationships']['Relationship']) {
                relsData['Relationships']['Relationship'] = [];
            }
            // 添加新的关系
            relsData['Relationships']['Relationship'].push({
                $: {
                    Id: rId,
                    Type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image',
                    Target: target
                }
            });
            // 保存更新后的关系文件
            const builder = new Builder({
                xmldec: { version: '1.0', encoding: 'UTF-8', standalone: true }
            });
            const updatedRelsXml = builder.buildObject(relsData);
            zip.file(relsPath, updatedRelsXml);
        }
        catch (error) {
            console.warn('Failed to add image relationship:', error);
            throw error;
        }
    }
    /**
     * 获取幻灯片文件路径
     *
     * @param zip PizZip 实例
     * @param slideIndex 幻灯片索引
     * @returns 幻灯片文件路径，如果失败返回 null
     */
    async getSlidePath(zip, slideIndex) {
        try {
            const presentationFile = zip.file('ppt/presentation.xml');
            if (!presentationFile)
                return null;
            const presentationXml = presentationFile.asText();
            const presentationData = await parseXml(presentationXml);
            const slideIdList = presentationData['p:presentation']?.['p:sldIdLst']?.[0]?.['p:sldId'];
            if (!slideIdList || !Array.isArray(slideIdList) || slideIndex >= slideIdList.length) {
                return null;
            }
            const slideId = slideIdList[slideIndex];
            const rId = slideId.$?.['r:id'];
            if (!rId)
                return null;
            const relsFile = zip.file('ppt/_rels/presentation.xml.rels');
            if (!relsFile)
                return null;
            const relsXml = relsFile.asText();
            const relsData = await parseXml(relsXml);
            const relationships = relsData['Relationships']?.['Relationship'];
            if (!relationships || !Array.isArray(relationships))
                return null;
            const rel = relationships.find((r) => r.$?.Id === rId);
            if (!rel)
                return null;
            return `ppt/${rel.$.Target}`;
        }
        catch (error) {
            console.warn('Failed to get slide path:', error);
            return null;
        }
    }
    /**
     * 添加水印到图片元素
     * 使用 sharp 库合成水印到图片上，支持透明度和位置控制
     *
     * @param imageElement 图片元素
     * @param options 水印选项
     * @returns 处理后的图片数据
     *
     * 需求: 9.5 - 给图片加水印，在 PPT 内的每张图片上添加水印
     */
    async addWatermarkToImage(imageElement, options) {
        try {
            // 获取原始图片数据
            const originalImage = sharp(imageElement.imageData);
            const metadata = await originalImage.metadata();
            if (!metadata.width || !metadata.height) {
                throw new Error('Unable to get image dimensions');
            }
            let watermarkBuffer;
            if (options.type === 'text') {
                // 创建文字水印
                watermarkBuffer = await this.createTextWatermarkImage(options.content, metadata.width, metadata.height, options.fontSize || 36, options.fontColor || '#FFFFFF', options.opacity, options.position);
            }
            else if (options.type === 'image') {
                // 加载图片水印
                const watermarkImage = sharp(await fs.readFile(options.content));
                const watermarkMetadata = await watermarkImage.metadata();
                // 计算水印尺寸和位置
                const watermarkSize = this.calculateImageWatermarkSize(metadata.width, metadata.height, options.size, watermarkMetadata.width, watermarkMetadata.height);
                const watermarkPosition = this.calculateImageWatermarkPositionOnImage(metadata.width, metadata.height, watermarkSize.width, watermarkSize.height, options.position);
                // 调整水印大小并设置透明度
                watermarkBuffer = await watermarkImage
                    .resize(watermarkSize.width, watermarkSize.height, {
                    fit: 'contain',
                    background: { r: 0, g: 0, b: 0, alpha: 0 }
                })
                    .composite([{
                        input: Buffer.from([255, 255, 255, Math.round(options.opacity * 255)]),
                        raw: {
                            width: 1,
                            height: 1,
                            channels: 4
                        },
                        tile: true,
                        blend: 'dest-in'
                    }])
                    .png()
                    .toBuffer();
            }
            else {
                throw new Error(`Unsupported watermark type: ${options.type}`);
            }
            // 合成水印到原图
            const result = await originalImage
                .composite([{
                    input: watermarkBuffer,
                    gravity: this.getSharpGravity(options.position)
                }])
                .toBuffer();
            return result;
        }
        catch (error) {
            console.warn('Failed to add watermark to image:', error);
            throw error;
        }
    }
    /**
     * 创建文字水印图片
     * 使用 SVG 创建文字水印，然后转换为 PNG
     *
     * @param text 水印文本
     * @param imageWidth 图片宽度
     * @param imageHeight 图片高度
     * @param fontSize 字体大小
     * @param fontColor 字体颜色
     * @param opacity 透明度
     * @param position 位置
     * @returns 水印图片 Buffer
     */
    async createTextWatermarkImage(text, imageWidth, imageHeight, fontSize, fontColor, opacity, position) {
        // 移除颜色前缀的 #
        const color = fontColor.startsWith('#') ? fontColor.substring(1) : fontColor;
        // 解析 RGB 颜色
        const r = parseInt(color.substring(0, 2), 16);
        const g = parseInt(color.substring(2, 4), 16);
        const b = parseInt(color.substring(4, 6), 16);
        // 计算文字水印的大小（估算）
        const textWidth = text.length * fontSize * 0.6;
        const textHeight = fontSize * 1.2;
        // 计算文字位置
        const textPosition = this.calculateTextPositionOnImage(imageWidth, imageHeight, textWidth, textHeight, position);
        // 创建 SVG 文字水印
        const svg = `
      <svg width="${imageWidth}" height="${imageHeight}">
        <text
          x="${textPosition.x}"
          y="${textPosition.y}"
          font-family="Arial, sans-serif"
          font-size="${fontSize}"
          fill="rgb(${r}, ${g}, ${b})"
          fill-opacity="${opacity}"
          text-anchor="start"
          dominant-baseline="hanging"
        >${text}</text>
      </svg>
    `;
        // 将 SVG 转换为 PNG
        const watermarkBuffer = await sharp(Buffer.from(svg))
            .png()
            .toBuffer();
        return watermarkBuffer;
    }
    /**
     * 计算图片水印在图片上的尺寸
     *
     * @param imageWidth 原图宽度
     * @param imageHeight 原图高度
     * @param customSize 自定义尺寸
     * @param watermarkWidth 水印原始宽度
     * @param watermarkHeight 水印原始高度
     * @returns 水印尺寸
     */
    calculateImageWatermarkSize(imageWidth, imageHeight, customSize, watermarkWidth, watermarkHeight) {
        if (customSize) {
            // 确保自定义尺寸不超过原图尺寸
            return {
                width: Math.min(customSize.width, imageWidth),
                height: Math.min(customSize.height, imageHeight)
            };
        }
        // 默认水印大小为图片的 20%，但至少为 1 像素
        const defaultSize = Math.max(1, Math.min(imageWidth, imageHeight) * 0.2);
        if (watermarkWidth && watermarkHeight) {
            // 保持水印宽高比，缩放到默认大小
            const scale = defaultSize / Math.max(watermarkWidth, watermarkHeight);
            return {
                width: Math.max(1, Math.round(watermarkWidth * scale)),
                height: Math.max(1, Math.round(watermarkHeight * scale))
            };
        }
        return {
            width: Math.max(1, Math.round(defaultSize)),
            height: Math.max(1, Math.round(defaultSize))
        };
    }
    /**
     * 计算图片水印在图片上的位置
     *
     * @param imageWidth 原图宽度
     * @param imageHeight 原图高度
     * @param watermarkWidth 水印宽度
     * @param watermarkHeight 水印高度
     * @param position 位置选项
     * @returns 水印位置坐标
     */
    calculateImageWatermarkPositionOnImage(imageWidth, imageHeight, watermarkWidth, watermarkHeight, position) {
        const margin = Math.min(imageWidth, imageHeight) * 0.05; // 5% 边距
        let x;
        let y;
        switch (position) {
            case 'top-left':
                x = margin;
                y = margin;
                break;
            case 'top-right':
                x = imageWidth - watermarkWidth - margin;
                y = margin;
                break;
            case 'center':
                x = (imageWidth - watermarkWidth) / 2;
                y = (imageHeight - watermarkHeight) / 2;
                break;
            case 'bottom-left':
                x = margin;
                y = imageHeight - watermarkHeight - margin;
                break;
            case 'bottom-right':
                x = imageWidth - watermarkWidth - margin;
                y = imageHeight - watermarkHeight - margin;
                break;
            default:
                // 默认右下角
                x = imageWidth - watermarkWidth - margin;
                y = imageHeight - watermarkHeight - margin;
        }
        return {
            x: Math.round(Math.max(0, x)),
            y: Math.round(Math.max(0, y))
        };
    }
    /**
     * 计算文字在图片上的位置
     *
     * @param imageWidth 原图宽度
     * @param imageHeight 原图高度
     * @param textWidth 文字宽度（估算）
     * @param textHeight 文字高度（估算）
     * @param position 位置选项
     * @returns 文字位置坐标
     */
    calculateTextPositionOnImage(imageWidth, imageHeight, textWidth, textHeight, position) {
        const margin = Math.min(imageWidth, imageHeight) * 0.05; // 5% 边距
        let x;
        let y;
        switch (position) {
            case 'top-left':
                x = margin;
                y = margin;
                break;
            case 'top-right':
                x = imageWidth - textWidth - margin;
                y = margin;
                break;
            case 'center':
                x = (imageWidth - textWidth) / 2;
                y = (imageHeight - textHeight) / 2;
                break;
            case 'bottom-left':
                x = margin;
                y = imageHeight - textHeight - margin;
                break;
            case 'bottom-right':
                x = imageWidth - textWidth - margin;
                y = imageHeight - textHeight - margin;
                break;
            default:
                // 默认右下角
                x = imageWidth - textWidth - margin;
                y = imageHeight - textHeight - margin;
        }
        return {
            x: Math.round(Math.max(0, x)),
            y: Math.round(Math.max(0, y))
        };
    }
    /**
     * 将位置选项转换为 sharp 的 gravity 参数
     *
     * @param position 位置选项
     * @returns sharp gravity 值
     */
    getSharpGravity(position) {
        switch (position) {
            case 'top-left':
                return 'northwest';
            case 'top-right':
                return 'northeast';
            case 'center':
                return 'center';
            case 'bottom-left':
                return 'southwest';
            case 'bottom-right':
                return 'southeast';
            default:
                return 'southeast'; // 默认右下角
        }
    }
}
