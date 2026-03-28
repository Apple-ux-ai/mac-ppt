import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, createReadStream, createWriteStream } from 'fs';
import * as fs from 'fs';
import { join, dirname, basename, extname } from 'path';
import { mkdir, unlink, stat } from 'fs/promises';
import { pipeline } from 'stream/promises';
import sharp from 'sharp';
const execAsync = promisify(exec);
class MemoryMonitor {
    constructor() {
        this.samples = [];
        this.maxSamples = 100;
        this.monitoringInterval = null;
    }
    /**
     * 开始监控内存使用
     * @param intervalMs - 采样间隔（毫秒）
     */
    startMonitoring(intervalMs = 1000) {
        if (this.monitoringInterval) {
            return; // 已经在监控中
        }
        this.samples = [];
        this.monitoringInterval = setInterval(() => {
            this.recordSample();
        }, intervalMs);
    }
    /**
     * 停止监控内存使用
     */
    stopMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
    }
    /**
     * 记录一次内存采样
     */
    recordSample() {
        const memUsage = process.memoryUsage();
        const sample = {
            heapUsed: memUsage.heapUsed,
            heapTotal: memUsage.heapTotal,
            external: memUsage.external,
            rss: memUsage.rss,
            timestamp: Date.now(),
        };
        this.samples.push(sample);
        // 限制样本数量
        if (this.samples.length > this.maxSamples) {
            this.samples.shift();
        }
    }
    /**
     * 获取当前内存使用情况
     */
    getCurrentMemory() {
        const memUsage = process.memoryUsage();
        return {
            heapUsed: memUsage.heapUsed,
            heapTotal: memUsage.heapTotal,
            external: memUsage.external,
            rss: memUsage.rss,
            timestamp: Date.now(),
        };
    }
    /**
     * 获取峰值内存使用
     */
    getPeakMemory() {
        if (this.samples.length === 0) {
            return null;
        }
        return this.samples.reduce((peak, current) => {
            return current.rss > peak.rss ? current : peak;
        });
    }
    /**
     * 获取平均内存使用
     */
    getAverageMemory() {
        if (this.samples.length === 0) {
            return null;
        }
        const sum = this.samples.reduce((acc, sample) => ({
            heapUsed: acc.heapUsed + sample.heapUsed,
            heapTotal: acc.heapTotal + sample.heapTotal,
            external: acc.external + sample.external,
            rss: acc.rss + sample.rss,
            timestamp: 0,
        }), { heapUsed: 0, heapTotal: 0, external: 0, rss: 0, timestamp: 0 });
        const count = this.samples.length;
        return {
            heapUsed: sum.heapUsed / count,
            heapTotal: sum.heapTotal / count,
            external: sum.external / count,
            rss: sum.rss / count,
            timestamp: Date.now(),
        };
    }
    /**
     * 清除所有采样数据
     */
    clear() {
        this.samples = [];
    }
    /**
     * 格式化内存大小为可读字符串
     */
    static formatBytes(bytes) {
        if (bytes === 0)
            return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
    }
}
/**
 * FormatConverter - 负责 PPT 格式转换
 *
 * 支持的转换格式：
 * - PDF
 * - 图片 (PNG, JPG)
 * - HTML
 * - PPT ↔ PPTX
 *
 * 验收标准 7.6: WHEN 转换大文件 THEN THE System SHALL 使用流式处理避免内存溢出
 * 验收标准 24.1: WHEN 处理大文件（>50MB）THEN THE System SHALL 使用流式读写避免内存溢出
 */
export class FormatConverter {
    constructor() {
        this.libreOfficePath = null;
        this.imageMagickPath = null;
        this.ghostscriptPath = null;
        this.timeout = 300000; // 5分钟超时
        this.memoryMonitor = new MemoryMonitor();
        this.largeFileThreshold = 50 * 1024 * 1024; // 50MB
    }
    getBundledLibreOfficePath() {
        try {
            const isWindows = process.platform === 'win32';
            const executableNames = isWindows ? ['soffice.exe', 'soffice.com'] : ['soffice'];
            const candidates = [];
            const resourcesPath = process.resourcesPath;
            if (resourcesPath) {
                for (const executableName of executableNames) {
                    candidates.push(join(resourcesPath, 'LibreOffice', 'program', executableName), join(resourcesPath, 'libreoffice', 'program', executableName));
                }
            }
            const cwd = process.cwd();
            for (const executableName of executableNames) {
                candidates.push(join(cwd, 'resources', 'LibreOffice', 'program', executableName), join(cwd, 'resources', 'libreoffice', 'program', executableName));
            }
            const distRoot = join(cwd, 'dist-electron');
            for (const executableName of executableNames) {
                candidates.push(join(distRoot, 'resources', 'LibreOffice', 'program', executableName), join(distRoot, 'resources', 'libreoffice', 'program', executableName));
            }
            for (const p of candidates) {
                try {
                    if (existsSync(p))
                        return p;
                }
                catch {
                    continue;
                }
            }
            return null;
        }
        catch {
            return null;
        }
    }
    buildLibreOfficeNotFoundMessage(featureName) {
        const bundledPath = this.getBundledLibreOfficePath();
        const baseMessage = `LibreOffice 未安装或不可用。${featureName}需要 LibreOffice。`;
        if (bundledPath) {
            return `${baseMessage}\n检测到内置路径: ${bundledPath}\n请尝试重新安装应用。`;
        }
        return `${baseMessage}\n应用已内置 LibreOffice，如果此错误持续出现，请联系技术支持。`;
    }
    /**
     * 获取内存监控器实例
     */
    getMemoryMonitor() {
        return this.memoryMonitor;
    }
    /**
     * 检查文件是否为大文件（>50MB）
     *
     * 验收标准 24.1: WHEN 处理大文件（>50MB）THEN THE System SHALL 使用流式读写避免内存溢出
     */
    async isLargeFile(filePath) {
        try {
            const stats = await stat(filePath);
            return stats.size > this.largeFileThreshold;
        }
        catch {
            return false;
        }
    }
    /**
     * 使用流式方式复制文件
     *
     * 验收标准 7.6: WHEN 转换大文件 THEN THE System SHALL 使用流式处理避免内存溢出
     *
     * @param sourcePath - 源文件路径
     * @param destPath - 目标文件路径
     * @param options - 流处理选项
     */
    async streamCopyFile(sourcePath, destPath, options) {
        const readStream = createReadStream(sourcePath, {
            highWaterMark: options?.highWaterMark || 16 * 1024, // 16KB
        });
        const writeStream = createWriteStream(destPath, {
            highWaterMark: options?.highWaterMark || 16 * 1024,
        });
        await pipeline(readStream, writeStream);
    }
    /**
     * 检查 LibreOffice 是否可用
     *
     * 验收标准 7.1: 检测 LibreOffice 是否安装
     */
    async checkAvailability() {
        try {
            const resourcesPath = process.resourcesPath;
            const isWindows = process.platform === 'win32';
            // 【优先级 1】首先检查打包的 LibreOffice 便携版（最高优先级）
            const bundledLibreOffice = this.getBundledLibreOfficePath();
            if (bundledLibreOffice && existsSync(bundledLibreOffice)) {
                this.libreOfficePath = bundledLibreOffice;
                console.log(`[DEBUG] ✅ Using bundled LibreOffice portable: ${bundledLibreOffice}`);
                return true;
            }
            // 【优先级 2】检查 resourcesPath 下的其他可能路径
            if (resourcesPath) {
                const bundledExecutableNames = isWindows ? ['soffice.exe', 'soffice.com'] : ['soffice'];
                const bundledPaths = bundledExecutableNames.flatMap((executableName) => [
                    join(resourcesPath, 'LibreOffice', 'program', executableName),
                    join(resourcesPath, 'libreoffice', 'program', executableName),
                ]);
                for (const path of bundledPaths) {
                    if (existsSync(path)) {
                        this.libreOfficePath = path;
                        console.log(`[DEBUG] ✅ Found bundled LibreOffice at: ${path}`);
                        return true;
                    }
                }
            }
            // 【优先级 3】Windows: 使用 where 命令查找系统安装的 LibreOffice
            if (isWindows) {
                for (const cmd of ['where soffice.exe', 'where soffice.com', 'where soffice']) {
                    try {
                        const { stdout } = await execAsync(cmd, { timeout: 5000 });
                        const candidates = stdout
                            .split(/\r?\n/)
                            .map((s) => s.trim())
                            .filter(Boolean);
                        for (const c of candidates) {
                            if (existsSync(c)) {
                                this.libreOfficePath = c;
                                console.log(`[DEBUG] Found LibreOffice via where command: ${c}`);
                                return true;
                            }
                        }
                    }
                    catch {
                        // ignore and continue
                    }
                }
            }
            // 【优先级 4】检查常见的系统安装路径
            const systemPaths = [
                'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
                'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
                'C:\\Program Files\\LibreOffice\\program\\soffice.com',
                'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.com',
                '/usr/bin/soffice',
                '/usr/bin/libreoffice',
                '/usr/local/bin/soffice',
                '/usr/local/bin/libreoffice',
                '/Applications/LibreOffice.app/Contents/MacOS/soffice',
            ];
            for (const path of systemPaths) {
                try {
                    if (existsSync(path)) {
                        this.libreOfficePath = path;
                        console.log(`[DEBUG] Found LibreOffice at system path: ${path}`);
                        return true;
                    }
                }
                catch {
                    continue;
                }
            }
            // 【优先级 5】尝试从 PATH 环境变量中查找
            for (const command of ['soffice', 'libreoffice']) {
                try {
                    const { stdout, stderr } = await execAsync(`${command} --version`, { timeout: 5000 });
                    const output = stdout + stderr;
                    if (output.includes('LibreOffice') || output.includes('libreoffice')) {
                        this.libreOfficePath = command;
                        console.log(`[DEBUG] Found LibreOffice in system PATH: ${command}`);
                        return true;
                    }
                }
                catch {
                    // ignore and continue
                }
            }
            console.error('[ERROR] ❌ LibreOffice not found in any location');
            return false;
        }
        catch (error) {
            console.error('[ERROR] Exception during LibreOffice detection:', error);
            return false;
        }
    }
    /**
     * 检查 ImageMagick 是否可用
     * ImageMagick 用于将 PDF 转换为多页图片（如果存在）
     */
    async checkImageMagickAvailability() {
        try {
            const isWindows = process.platform === 'win32';
            const resourcesPath = process.resourcesPath;
            const currentDir = __dirname;
            const projectRootFromDist = join(currentDir, '..');
            // 优先检查项目内的 ImageMagick（开发环境和打包后）
            const possiblePaths = [];
            const bundledExecutableName = isWindows ? 'magick.exe' : 'magick';
            // 【优先级 1】打包后：resourcesPath 目录（最高优先级）
            if (resourcesPath) {
                possiblePaths.push(join(resourcesPath, 'ImageMagick-7.1.2-Q16-HDRI', bundledExecutableName));
            }
            // 【优先级 2】开发环境：process.cwd() 下的 resources 目录
            possiblePaths.push(join(process.cwd(), 'resources', 'ImageMagick-7.1.2-Q16-HDRI', bundledExecutableName));
            // 【优先级 3】dist-electron 同级的 resources 目录（通过 __dirname 推断）
            possiblePaths.push(join(projectRootFromDist, 'resources', 'ImageMagick-7.1.2-Q16-HDRI', bundledExecutableName));
            // 【优先级 4】系统安装的 ImageMagick（只使用 magick.exe，不使用 convert 避免与 Windows 系统工具冲突）
            possiblePaths.push('magick'); // ImageMagick 7+ 命令
            possiblePaths.push('C:\\Program Files\\ImageMagick-7.1.1-Q16-HDRI\\magick.exe');
            possiblePaths.push('C:\\Program Files (x86)\\ImageMagick-7.1.1-Q16-HDRI\\magick.exe');
            possiblePaths.push('/usr/bin/magick');
            possiblePaths.push('/usr/local/bin/magick');
            possiblePaths.push('/opt/homebrew/bin/magick');
            // Windows: 使用 where 自动定位（只查找 magick，不查找 convert）
            if (isWindows) {
                try {
                    const { stdout } = await execAsync('where magick', { timeout: 5000 });
                    const candidates = stdout
                        .split(/\r?\n/)
                        .map((s) => s.trim())
                        .filter(Boolean)
                        // 过滤掉 Windows 系统目录中的文件
                        .filter((c) => !c.toLowerCase().includes('system32') && !c.toLowerCase().includes('syswow64'));
                    for (const c of candidates) {
                        if (existsSync(c)) {
                            this.imageMagickPath = c;
                            console.log(`[DEBUG] Found ImageMagick via where: ${c}`);
                            return true;
                        }
                    }
                }
                catch {
                    // ignore and continue
                }
            }
            // 尝试每个可能的路径
            for (const path of possiblePaths) {
                try {
                    // 检查文件是否存在（对于绝对路径或显式可执行路径）
                    if (path.includes('\\') || path.includes('/')) {
                        if (existsSync(path)) {
                            this.imageMagickPath = path;
                            console.log(`[DEBUG] Found ImageMagick at: ${path}`);
                            return true;
                        }
                    }
                    else {
                        // 对于系统 PATH 中的命令，尝试执行
                        const { stdout, stderr } = await execAsync(`"${path}" --version`, { timeout: 5000 });
                        const output = stdout + stderr;
                        if (output.includes('ImageMagick') || output.includes('magick')) {
                            this.imageMagickPath = path;
                            console.log(`[DEBUG] Found ImageMagick in PATH: ${path}`);
                            return true;
                        }
                    }
                }
                catch {
                    continue;
                }
            }
            return false;
        }
        catch (error) {
            return false;
        }
    }
    /**
     * 获取内置 Ghostscript 路径
     * Ghostscript 用于将 PDF 转换为多页图片
     */
    async getGhostscriptPath() {
        if (this.ghostscriptPath && existsSync(this.ghostscriptPath)) {
            return this.ghostscriptPath;
        }
        try {
            const isWindows = process.platform === 'win32';
            const resourcesPath = process.resourcesPath;
            const candidates = [];
            // 打包后：resources 目录
            if (resourcesPath) {
                if (isWindows) {
                    candidates.push(join(resourcesPath, 'gs10.06.0', 'bin', 'gswin64c.exe'), join(resourcesPath, 'gs10.06.0', 'bin', 'gswin32c.exe'));
                }
                else {
                    candidates.push(join(resourcesPath, 'gs10.06.0', 'bin', 'gs'));
                }
            }
            // 开发环境：项目根目录下的 resources
            const cwd = process.cwd();
            if (isWindows) {
                candidates.push(join(cwd, 'resources', 'gs10.06.0', 'bin', 'gswin64c.exe'), join(cwd, 'resources', 'gs10.06.0', 'bin', 'gswin32c.exe'));
            }
            else {
                candidates.push(join(cwd, 'resources', 'gs10.06.0', 'bin', 'gs'));
            }
            candidates.push('/usr/bin/gs', '/usr/local/bin/gs', 'gs');
            for (const c of candidates) {
                try {
                    if (c.includes('/') || c.includes('\\')) {
                        if (existsSync(c)) {
                            this.ghostscriptPath = c;
                            console.log(`[DEBUG] Found Ghostscript at: ${c}`);
                            return c;
                        }
                    }
                    else {
                        const { stdout, stderr } = await execAsync(`${c} --version`, { timeout: 5000 });
                        const output = `${stdout}${stderr}`;
                        if (output.trim().length > 0) {
                            this.ghostscriptPath = c;
                            console.log(`[DEBUG] Found Ghostscript in PATH: ${c}`);
                            return c;
                        }
                    }
                }
                catch {
                    continue;
                }
            }
            console.error('[ERROR] ❌ Ghostscript not found in bundled resources');
            return null;
        }
        catch (error) {
            console.error('[ERROR] Exception during Ghostscript detection:', error);
            return null;
        }
    }
    /**
     * 使用 Ghostscript 将 PDF 转换为多页图片
     *
     * @param pdfPath - PDF 文件路径
     * @param outputDir - 输出目录
     * @param format - 输出格式 (png 或 jpg)
     * @returns 生成的图片文件路径数组
     */
    async convertPdfToImagesWithImageMagick(pdfPath, outputDir, format) {
        const imageFiles = [];
        try {
            const gsPath = await this.getGhostscriptPath();
            if (!gsPath) {
                throw new Error('Ghostscript 不可用');
            }
            const outputPattern = join(outputDir, `page-%03d.${format}`);
            const density = 300;
            const quality = format === 'jpg' ? 90 : 100;
            const env = { ...process.env };
            const device = format === 'jpg' ? 'jpeg' : 'pngalpha';
            const command = `"${gsPath}" -dSAFER -dBATCH -dNOPAUSE -sDEVICE=${device} -r${density} -sOutputFile="${outputPattern}" "${pdfPath}"`;
            console.log(`Executing Ghostscript command: ${command}`);
            await execAsync(command, {
                timeout: this.timeout,
                maxBuffer: 50 * 1024 * 1024,
            });
            // 查找生成的图片文件
            // @ts-ignore
            const files = fs.readdirSync(outputDir);
            let generatedFiles = files
                .filter((f) => f.startsWith('page-') && f.endsWith(`.${format}`))
                .sort();
            // 如果一次性转换只得到 0/1 张图片，尝试逐页转换直到失败
            if (generatedFiles.length <= 1) {
                for (const f of generatedFiles) {
                    try {
                        fs.unlinkSync(join(outputDir, f));
                    }
                    catch { }
                }
                const perPageFiles = [];
                const maxPages = 500;
                for (let pageIndex = 0; pageIndex < maxPages; pageIndex++) {
                    const pageName = `page-${String(pageIndex + 1).padStart(3, '0')}.${format}`;
                    const pageOutput = join(outputDir, pageName);
                    let pageCommand;
                    if (gsPath) {
                        const escapedGsPath = gsPath.replace(/\\/g, '/');
                        pageCommand = `"${this.imageMagickPath}" convert -define pdf:gs-command="${escapedGsPath}" -density ${density} "${pdfPath}[${pageIndex}]" -quality ${quality} "${pageOutput}"`;
                    }
                    else {
                        pageCommand = `"${this.imageMagickPath}" convert -density ${density} "${pdfPath}[${pageIndex}]" -quality ${quality} "${pageOutput}"`;
                    }
                    try {
                        await execAsync(pageCommand, {
                            timeout: this.timeout,
                            maxBuffer: 50 * 1024 * 1024,
                            env,
                        });
                    }
                    catch (e) {
                        if (pageIndex === 0) {
                            throw e;
                        }
                        break;
                    }
                    if (!existsSync(pageOutput)) {
                        if (pageIndex === 0) {
                            break;
                        }
                        break;
                    }
                    perPageFiles.push(pageOutput);
                }
                generatedFiles = perPageFiles.map((p) => basename(p));
            }
            for (const file of generatedFiles) {
                imageFiles.push(join(outputDir, file));
            }
            console.log(`Ghostscript generated ${imageFiles.length} images`);
            return imageFiles;
        }
        catch (error) {
            console.error('Ghostscript conversion failed:', error);
            throw new Error(`图片转换失败: ${error.message}`);
        }
    }
    /**
     * 使用 LibreOffice 将 PPTX 的每一页导出为图片
     * 优先使用 ImageMagick（如果可用），否则回退到单页导出
     * 注意：LibreOffice 的 --convert-to 命令对于多页文档只会导出第一页
     * 因此我们需要使用其他方法：先转 PDF，然后用 sharp 处理 PDF 的每一页
     * 但 sharp 不支持 PDF，所以我们使用 LibreOffice 的 --print-to-file 功能
     *
     * 最终方案：使用 LibreOffice 的 macro 或者直接导出为多个图片文件
     * 简化方案：先转 PDF，然后用 ghostscript 或其他工具转图片
     *
     * 由于环境限制，我们采用最简单的方案：
     * 使用 LibreOffice 命令行参数导出每一页为独立的图片文件
     *
     * @param pdfPath - PDF 文件路径（实际上这里传入的是 PPTX 路径）
     * @param outputDir - 输出目录
     * @returns 生成的图片文件路径数组
     */
    async convertPptxToImagesDirectly(pptxPath, outputDir, format) {
        try {
            try {
                const pdfFileName = basename(pptxPath, extname(pptxPath)) + '.pdf';
                const pdfPath = join(outputDir, pdfFileName);
                const pdfCommand = `"${this.libreOfficePath}" --headless --convert-to pdf "${pptxPath}" --outdir "${outputDir}"`;
                await execAsync(pdfCommand, {
                    timeout: this.timeout,
                    maxBuffer: 10 * 1024 * 1024,
                });
                if (!existsSync(pdfPath)) {
                    throw new Error('PDF 转换失败');
                }
                const imageFiles = await this.convertPdfToImagesWithImageMagick(pdfPath, outputDir, format);
                try {
                    // @ts-ignore
                    fs.unlinkSync(pdfPath);
                }
                catch { }
                return imageFiles;
            }
            catch (error) {
                console.warn('PDF 转图片多页转换失败，回退到单页导出模式', error);
            }
            console.warn('⚠️ 多页图片转换组件不可用，只能导出第一页');
            const outputFileName = `page-000.${format}`;
            const outputPath = join(outputDir, outputFileName);
            const command = `"${this.libreOfficePath}" --headless --convert-to ${format} "${pptxPath}" --outdir "${outputDir}"`;
            await execAsync(command, {
                timeout: this.timeout,
                maxBuffer: 10 * 1024 * 1024,
            });
            // @ts-ignore
            const files = fs.readdirSync(outputDir);
            const generatedFile = files.find((f) => f.endsWith(`.${format}`));
            if (generatedFile) {
                const generatedPath = join(outputDir, generatedFile);
                if (generatedPath !== outputPath) {
                    // @ts-ignore
                    fs.copyFileSync(generatedPath, outputPath);
                }
                return [outputPath];
            }
            return [];
        }
        catch (error) {
            console.error('PPTX to images conversion failed:', error);
            throw new Error(`图片转换失败: ${error.message}`);
        }
    }
    /**
     * 转换为 PDF
     *
     * 验收标准 7.1: WHEN 用户选择转换为 PDF THEN THE Format_Converter SHALL 将每个 PPTX 文件转换为 PDF 格式
     * 验收标准 7.6: WHEN 转换大文件 THEN THE System SHALL 使用流式处理避免内存溢出
     * 验收标准 24.1: WHEN 处理大文件（>50MB）THEN THE System SHALL 使用流式读写避免内存溢出
     *
     * @param inputPath - 输入 PPTX 文件路径
     * @param outputPath - 输出 PDF 文件路径
     * @throws Error 如果 LibreOffice 未安装或转换失败
     */
    async convertToPdf(inputPath, outputPath) {
        // 检查输入文件是否存在
        if (!existsSync(inputPath)) {
            throw new Error(`输入文件不存在: ${inputPath}`);
        }
        // 检查是否为大文件，如果是则启动内存监控
        const isLarge = await this.isLargeFile(inputPath);
        if (isLarge) {
            this.memoryMonitor.startMonitoring(500); // 每 500ms 采样一次
        }
        try {
            // 确保 LibreOffice 可用
            if (!this.libreOfficePath) {
                const available = await this.checkAvailability();
                if (!available) {
                    throw new Error(this.buildLibreOfficeNotFoundMessage('PDF 转换'));
                }
            }
            // 确保输出目录存在
            const outputDir = dirname(outputPath);
            if (!existsSync(outputDir)) {
                await mkdir(outputDir, { recursive: true });
            }
            // 使用 LibreOffice 命令行工具转换
            // --headless: 无界面模式
            // --invisible: 不显示任何窗口
            // --nologo: 不显示启动画面
            // --norestore: 不恢复之前的会话
            // --convert-to pdf: 转换为 PDF 格式
            // --outdir: 输出目录
            const command = `"${this.libreOfficePath}" --headless --invisible --nologo --norestore --convert-to pdf "${inputPath}" --outdir "${outputDir}"`;
            console.log(`[PDF转换] 执行命令: ${command}`);
            console.log(`[PDF转换] 输入文件: ${inputPath}`);
            console.log(`[PDF转换] 输出目录: ${outputDir}`);
            const { stdout, stderr } = await execAsync(command, {
                timeout: this.timeout,
                maxBuffer: 10 * 1024 * 1024, // 10MB buffer
                windowsHide: true, // Windows 下隐藏命令行窗口
            });
            console.log(`[PDF转换] stdout: ${stdout}`);
            if (stderr) {
                console.log(`[PDF转换] stderr: ${stderr}`);
            }
            // 等待一小段时间确保文件写入完成
            await new Promise((resolve) => setTimeout(resolve, 1000));
            // 检查转换是否成功
            // LibreOffice 会在输出目录生成与输入文件同名但扩展名为 .pdf 的文件
            const generatedPdfPath = join(outputDir, inputPath
                .split(/[/\\]/)
                .pop()
                .replace(/\.[^.]+$/, '.pdf'));
            console.log(`[PDF转换] 期望生成的PDF路径: ${generatedPdfPath}`);
            // 等待文件生成，最多重试 10 次
            let retryCount = 0;
            const maxRetries = 10;
            while (!existsSync(generatedPdfPath) && retryCount < maxRetries) {
                console.log(`[PDF转换] 等待文件生成... (${retryCount + 1}/${maxRetries})`);
                await new Promise((resolve) => setTimeout(resolve, 500));
                retryCount++;
            }
            if (!existsSync(generatedPdfPath)) {
                console.error(`[PDF转换] 文件未生成`);
                console.error(`[PDF转换] stdout: ${stdout}`);
                console.error(`[PDF转换] stderr: ${stderr}`);
                throw new Error(`PDF 转换失败: ${stderr || stdout || '未生成输出文件'}`);
            }
            // 等待文件完全写入，检查文件大小是否稳定
            let lastSize = 0;
            let stableCount = 0;
            while (stableCount < 3) {
                const pdfStats = await stat(generatedPdfPath);
                if (pdfStats.size === lastSize && pdfStats.size > 0) {
                    stableCount++;
                }
                else {
                    stableCount = 0;
                }
                lastSize = pdfStats.size;
                if (stableCount < 3) {
                    await new Promise((resolve) => setTimeout(resolve, 200));
                }
            }
            // 检查生成的 PDF 文件大小
            const pdfStats = await stat(generatedPdfPath);
            console.log(`[PDF转换] 生成的PDF文件大小: ${pdfStats.size} bytes`);
            if (pdfStats.size === 0) {
                throw new Error('PDF 转换失败: 生成的文件为空');
            }
            // 检查 PDF 文件头，确保是有效的 PDF 文件
            const fs = await import('fs/promises');
            let buffer;
            let readRetries = 0;
            const maxReadRetries = 5;
            // 重试读取文件，避免文件锁问题
            while (readRetries < maxReadRetries) {
                try {
                    buffer = await fs.readFile(generatedPdfPath, { encoding: null });
                    break;
                }
                catch (error) {
                    if (error.code === 'EBUSY' || error.code === 'EPERM') {
                        console.log(`[PDF转换] 文件被锁定，等待解锁... (${readRetries + 1}/${maxReadRetries})`);
                        await new Promise((resolve) => setTimeout(resolve, 500));
                        readRetries++;
                    }
                    else {
                        throw error;
                    }
                }
            }
            if (!buffer) {
                throw new Error('PDF 转换失败: 无法读取生成的文件');
            }
            const header = buffer.slice(0, 5).toString('ascii');
            if (!header.startsWith('%PDF-')) {
                console.error(`[PDF转换] 无效的PDF文件头: ${header}`);
                console.error(`[PDF转换] 文件前100字节: ${buffer.slice(0, 100).toString('hex')}`);
                throw new Error('PDF 转换失败: 生成的文件不是有效的 PDF 格式');
            }
            console.log(`[PDF转换] PDF文件验证通过，文件头: ${header}`);
            // 如果生成的文件路径与期望的输出路径不同，需要重命名
            // 对于大文件，使用流式复制
            if (generatedPdfPath !== outputPath && existsSync(generatedPdfPath)) {
                if (isLarge) {
                    // 使用流式复制大文件
                    await this.streamCopyFile(generatedPdfPath, outputPath);
                    await unlink(generatedPdfPath);
                }
                else {
                    // 小文件直接重命名
                    const fs = await import('fs/promises');
                    await fs.copyFile(generatedPdfPath, outputPath);
                }
            }
            // 如果启用了内存监控，检查内存使用
            if (isLarge) {
                const peakMemory = this.memoryMonitor.getPeakMemory();
                if (peakMemory) {
                    const fileSize = (await stat(inputPath)).size;
                    // 验证内存使用不超过文件大小的 2 倍
                    if (peakMemory.rss > fileSize * 2) {
                        console.warn(`警告: PDF 转换内存使用过高。` +
                            `文件大小: ${MemoryMonitor.formatBytes(fileSize)}, ` +
                            `峰值内存: ${MemoryMonitor.formatBytes(peakMemory.rss)}`);
                    }
                }
            }
        }
        catch (error) {
            // 处理超时错误
            if (error.killed && error.signal === 'SIGTERM') {
                throw new Error(`PDF 转换超时 (超过 ${this.timeout / 1000} 秒)`);
            }
            // 处理其他错误
            if (error.message.includes('LibreOffice')) {
                throw error;
            }
            throw new Error(`PDF 转换失败: ${error.message}`);
        }
        finally {
            // 停止内存监控
            if (isLarge) {
                this.memoryMonitor.stopMonitoring();
            }
        }
    }
    /**
     * 转换为图片
     *
     * 使用 LibreOffice 将 PPTX 转换为图片，然后使用 sharp 库进行后处理以获得更好的质量控制。
     *
     * 验收标准 7.2: WHEN 用户选择转换为图片 THEN THE Format_Converter SHALL 支持导出为 PNG 或 JPG 格式
     * 验收标准 7.3: WHEN 转换为图片格式 THEN THE System SHALL 为每个幻灯片生成独立的图片文件
     * 验收标准 7.6: WHEN 转换大文件 THEN THE System SHALL 使用流式处理避免内存溢出
     * 验收标准 24.1: WHEN 处理大文件（>50MB）THEN THE System SHALL 使用流式读写避免内存溢出
     *
     * @param inputPath - 输入 PPTX 文件路径
     * @param outputDir - 输出目录
     * @param format - 图片格式 (png 或 jpg)
     * @param options - 可选的图片处理选项
     * @returns 生成的图片文件路径数组
     */
    async convertToImages(inputPath, outputDir, format, options) {
        // 检查输入文件是否存在
        if (!existsSync(inputPath)) {
            throw new Error(`输入文件不存在: ${inputPath}`);
        }
        // 检查是否为大文件，如果是则启动内存监控
        const isLarge = await this.isLargeFile(inputPath);
        if (isLarge) {
            this.memoryMonitor.startMonitoring(500);
        }
        try {
            // 确保 LibreOffice 可用
            if (!this.libreOfficePath) {
                const available = await this.checkAvailability();
                if (!available) {
                    throw new Error(this.buildLibreOfficeNotFoundMessage('图片转换'));
                }
            }
            // 确保输出目录存在
            if (!existsSync(outputDir)) {
                await mkdir(outputDir, { recursive: true });
            }
            // 创建临时目录用于 LibreOffice 输出
            const tempDir = join(outputDir, '.temp_conversion');
            if (!existsSync(tempDir)) {
                await mkdir(tempDir, { recursive: true });
            }
            // 步骤 1: 直接使用 LibreOffice 将 PPTX 转换为图片
            console.log(`Converting PPTX to ${format.toUpperCase()} images...`);
            const tempImageFiles = await this.convertPptxToImagesDirectly(inputPath, tempDir, format);
            console.log(`Generated ${tempImageFiles.length} image files`);
            if (tempImageFiles.length === 0) {
                throw new Error('未生成图片文件');
            }
            // 步骤 2: 使用 sharp 处理每个图片以获得更好的质量控制
            // 对于大文件，使用流式处理
            const processedImageFiles = [];
            const baseName = basename(inputPath, extname(inputPath));
            for (let i = 0; i < tempImageFiles.length; i++) {
                const tempImagePath = tempImageFiles[i];
                const slideNumber = i + 1;
                const outputFileName = `${baseName}_slide_${slideNumber}.${format}`;
                const outputPath = join(outputDir, outputFileName);
                // 使用 sharp 处理图片
                // sharp 内部使用流式处理，对大图片友好
                let sharpInstance = sharp(tempImagePath, {
                    // 对于大文件，限制内存使用
                    limitInputPixels: isLarge ? 268402689 : false, // 约 16384x16384 像素
                });
                // 调整大小（如果指定）
                if (options?.width || options?.height) {
                    sharpInstance = sharpInstance.resize(options.width, options.height, {
                        fit: 'inside', // 保持宽高比
                        withoutEnlargement: true, // 不放大图片
                    });
                }
                // 根据格式应用不同的处理
                if (format === 'png') {
                    sharpInstance = sharpInstance.png({
                        compressionLevel: options?.compressionLevel ?? 6,
                        quality: 100, // PNG 使用无损压缩
                    });
                }
                else if (format === 'jpg') {
                    sharpInstance = sharpInstance.jpeg({
                        quality: options?.quality ?? 90,
                        mozjpeg: true, // 使用 mozjpeg 以获得更好的压缩
                    });
                }
                // 保存处理后的图片
                await sharpInstance.toFile(outputPath);
                processedImageFiles.push(outputPath);
                // 对于大文件，处理完每张图片后立即删除临时文件以释放磁盘空间
                if (isLarge) {
                    try {
                        await unlink(tempImagePath);
                    }
                    catch {
                        // 忽略删除错误
                    }
                }
            }
            // 步骤 3: 清理临时文件
            if (!isLarge) {
                // 小文件一次性清理
                for (const tempFile of tempImageFiles) {
                    try {
                        await unlink(tempFile);
                    }
                    catch {
                        // 忽略删除错误
                    }
                }
            }
            // 删除 PDF 文件
            const pdfFileName = basename(inputPath, extname(inputPath)) + '.pdf';
            const pdfFilePath = join(tempDir, pdfFileName);
            try {
                if (existsSync(pdfFilePath)) {
                    await unlink(pdfFilePath);
                }
            }
            catch {
                // 忽略删除错误
            }
            // 删除临时目录（使用 rm 而不是 rmdir 以递归删除）
            try {
                const fsPromises = await import('fs/promises');
                await fsPromises.rm(tempDir, { recursive: true, force: true });
            }
            catch {
                // 忽略删除错误
            }
            // 如果启用了内存监控，检查内存使用
            if (isLarge) {
                const peakMemory = this.memoryMonitor.getPeakMemory();
                if (peakMemory) {
                    const fileSize = (await stat(inputPath)).size;
                    if (peakMemory.rss > fileSize * 2) {
                        console.warn(`警告: 图片转换内存使用过高。` +
                            `文件大小: ${MemoryMonitor.formatBytes(fileSize)}, ` +
                            `峰值内存: ${MemoryMonitor.formatBytes(peakMemory.rss)}`);
                    }
                }
            }
            return processedImageFiles;
        }
        catch (error) {
            // 清理临时目录
            const tempDir = join(outputDir, '.temp_conversion');
            try {
                const fs = await import('fs/promises');
                const tempFiles = await fs.readdir(tempDir);
                for (const file of tempFiles) {
                    await unlink(join(tempDir, file));
                }
                await fs.rmdir(tempDir);
            }
            catch {
                // 忽略清理错误
            }
            if (error.killed && error.signal === 'SIGTERM') {
                throw new Error(`图片转换超时 (超过 ${this.timeout / 1000} 秒)`);
            }
            throw new Error(`图片转换失败: ${error.message}`);
        }
        finally {
            // 停止内存监控
            if (isLarge) {
                this.memoryMonitor.stopMonitoring();
            }
        }
    }
    /**
     * 转换为 HTML
     *
     * 验收标准 7.4: WHEN 用户选择转换为 HTML THEN THE Format_Converter SHALL 生成可在浏览器中查看的 HTML 文件
     *
     * @param inputPath - 输入 PPTX 文件路径
     * @param outputPath - 输出 HTML 文件路径
     */
    async convertToHtml(inputPath, outputPath) {
        if (!existsSync(inputPath)) {
            throw new Error(`输入文件不存在: ${inputPath}`);
        }
        if (!this.libreOfficePath) {
            const available = await this.checkAvailability();
            if (!available) {
                throw new Error(this.buildLibreOfficeNotFoundMessage('HTML 转换'));
            }
        }
        const outputDir = dirname(outputPath);
        if (!existsSync(outputDir)) {
            await mkdir(outputDir, { recursive: true });
        }
        try {
            const command = `"${this.libreOfficePath}" --headless --convert-to html "${inputPath}" --outdir "${outputDir}"`;
            await execAsync(command, {
                timeout: this.timeout,
                maxBuffer: 10 * 1024 * 1024,
            });
            const generatedHtmlPath = join(outputDir, inputPath
                .split(/[/\\]/)
                .pop()
                .replace(/\.[^.]+$/, '.html'));
            if (!existsSync(generatedHtmlPath)) {
                throw new Error('HTML 转换失败: 未生成输出文件');
            }
            if (generatedHtmlPath !== outputPath && existsSync(generatedHtmlPath)) {
                const fs = await import('fs/promises');
                await fs.copyFile(generatedHtmlPath, outputPath);
            }
        }
        catch (error) {
            if (error.killed && error.signal === 'SIGTERM') {
                throw new Error(`HTML 转换超时 (超过 ${this.timeout / 1000} 秒)`);
            }
            throw new Error(`HTML 转换失败: ${error.message}`);
        }
    }
    /**
     * PPT 与 PPTX 互转
     *
     * 验收标准 7.5: WHEN 用户选择 PPT 与 PPTX 互转 THEN THE Format_Converter SHALL 在两种格式之间转换
     *
     * @param inputPath - 输入文件路径
     * @param outputPath - 输出文件路径
     * @param targetFormat - 目标格式 (ppt 或 pptx)
     */
    async convertFormat(inputPath, outputPath, targetFormat) {
        if (!existsSync(inputPath)) {
            throw new Error(`输入文件不存在: ${inputPath}`);
        }
        if (!this.libreOfficePath) {
            const available = await this.checkAvailability();
            if (!available) {
                throw new Error(this.buildLibreOfficeNotFoundMessage('格式转换'));
            }
        }
        const outputDir = dirname(outputPath);
        if (!existsSync(outputDir)) {
            await mkdir(outputDir, { recursive: true });
        }
        try {
            // LibreOffice 使用 'ppt' 表示 PPT 格式，'pptx' 表示 PPTX 格式
            const formatArg = targetFormat === 'pptx' ? 'pptx' : 'ppt';
            const command = `"${this.libreOfficePath}" --headless --convert-to ${formatArg} "${inputPath}" --outdir "${outputDir}"`;
            await execAsync(command, {
                timeout: this.timeout,
                maxBuffer: 10 * 1024 * 1024,
            });
            const generatedFilePath = join(outputDir, inputPath
                .split(/[/\\]/)
                .pop()
                .replace(/\.[^.]+$/, `.${targetFormat}`));
            if (!existsSync(generatedFilePath)) {
                throw new Error(`格式转换失败: 未生成输出文件`);
            }
            if (generatedFilePath !== outputPath && existsSync(generatedFilePath)) {
                const fs = await import('fs/promises');
                await fs.copyFile(generatedFilePath, outputPath);
            }
        }
        catch (error) {
            if (error.killed && error.signal === 'SIGTERM') {
                throw new Error(`格式转换超时 (超过 ${this.timeout / 1000} 秒)`);
            }
            throw new Error(`格式转换失败: ${error.message}`);
        }
    }
    /**
     * 设置转换超时时间
     *
     * @param timeout - 超时时间（毫秒）
     */
    setTimeout(timeout) {
        if (timeout <= 0) {
            throw new Error('超时时间必须大于 0');
        }
        // @ts-ignore - 允许修改 readonly 属性用于测试
        this.timeout = timeout;
    }
    /**
     * 获取当前超时时间
     */
    getTimeout() {
        return this.timeout;
    }
}
// 导出内存监控相关类型和类
export { MemoryMonitor };
