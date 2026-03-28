import { ipcMain, dialog, BrowserWindow } from 'electron';
import { fileValidator } from '../utils/file-validator';
import { Logger, LogLevel } from '../utils/logger';
import { progressTracker, ProgressStage } from '../utils/progress-tracker';
import { taskPersistence } from '../utils/task-persistence';
import { extractLocalizedError, createLocalizedError, createLocalizedErrorPayload, } from '../utils/user-visible-messages';
import { getMainText } from '../utils/main-locale';
import { getMainDialogText } from '../utils/main-dialog-text';
import * as path from 'path';
import { promises as fs } from 'fs';
const activeTasks = new Map();
const logger = new Logger({ logLevel: LogLevel.INFO });
export async function registerIPCHandlers() {
    await taskPersistence.initialize();
    ipcMain.handle('select-files', handleSelectFiles);
    ipcMain.handle('select-folder', handleSelectFolder);
    ipcMain.handle('select-excel-file', handleSelectExcelFile);
    ipcMain.handle('select-image-file', handleSelectImageFile);
    ipcMain.handle('get-file-stats', (_event, filePath) => handleGetFileStats(filePath));
    ipcMain.handle('get-image-list', (_event, folderPath) => handleGetImageList(folderPath));
    ipcMain.handle('process-files', (_event, taskConfig) => {
        const { inputFiles, outputConfig, options, type } = taskConfig;
        const fullOptions = { ...options, taskType: type, outputConfig };
        return handleProcessFiles(inputFiles, outputConfig?.directory || '', fullOptions);
    });
    ipcMain.handle('cancel-task', (_event, taskId) => handleCancelTask(taskId));
    ipcMain.handle('download-file', (_event, filePath) => handleDownloadFile(filePath));
    ipcMain.handle('download-all-files', (_event, filePaths) => handleDownloadAllFiles(filePaths));
    ipcMain.handle('validate-files', (_event, filePaths, options) => handleValidateFiles(filePaths, options));
    ipcMain.handle('get-task-progress', (_event, taskId) => handleGetTaskProgress(taskId));
    ipcMain.handle('get-resumable-tasks', handleGetResumableTasks);
    ipcMain.handle('resume-task', (_event, taskId) => handleResumeTask(taskId));
    ipcMain.handle('get-task-history', handleGetTaskHistory);
    ipcMain.handle('export-task-history', (_event, outputPath, format) => handleExportTaskHistory(outputPath, format));
    progressTracker.on('progress', (update) => {
        const mainWindow = BrowserWindow.getAllWindows()[0];
        if (mainWindow) {
            mainWindow.webContents.send('progress-update', update);
        }
    });
}
async function handleSelectFiles() {
    console.log('IPC: File selection request');
    const result = await dialog.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
        filters: [
            { name: 'PowerPoint Files', extensions: ['pptx', 'ppt'] },
            { name: 'All Files', extensions: ['*'] },
        ],
    });
    if (result.canceled) {
        console.log('IPC: Selection canceled');
        return { files: [] };
    }
    console.log('IPC: Validating files');
    const validationResults = await fileValidator.validateFiles(result.filePaths, {
        checkLocked: true,
        checkIntegrity: true,
        checkPassword: true,
        extractMetadata: true,
    });
    const validFiles = [];
    const errors = [];
    for (const [filePath, validation] of validationResults) {
        if (validation.valid) {
            validFiles.push(filePath);
            console.log('  OK: ' + path.basename(filePath));
            if (validation.warnings.length > 0) {
                console.log('    Warnings:', validation.warnings.map((w) => w.message).join(', '));
            }
        }
        else {
            console.log('  SKIP: ' + path.basename(filePath));
            errors.push({
                file: path.basename(filePath),
                errors: validation.errors,
                warnings: validation.warnings,
            });
        }
    }
    console.log(`IPC: Returning ${validFiles.length} valid files`);
    return { files: validFiles, validationResults: Object.fromEntries(validationResults) };
}
async function handleSelectFolder() {
    console.log('IPC: Folder selection request');
    const result = await dialog.showOpenDialog({
        properties: ['openDirectory'],
    });
    if (result.canceled) {
        console.log('IPC: Folder selection canceled');
        return null;
    }
    const selectedFolder = result.filePaths[0];
    console.log('IPC: Selected folder:', selectedFolder);
    return selectedFolder;
}
async function handleSelectExcelFile() {
    console.log('IPC: Excel file selection request');
    const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [
            { name: 'Excel Files', extensions: ['xlsx', 'xls'] },
            { name: 'All Files', extensions: ['*'] },
        ],
    });
    if (result.canceled) {
        console.log('IPC: Excel file selection canceled');
        return null;
    }
    const selectedFile = result.filePaths[0];
    console.log('IPC: Selected Excel file:', selectedFile);
    return selectedFile;
}
async function handleSelectImageFile() {
    console.log('IPC: Image file selection request');
    const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [
            { name: 'Image Files', extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg'] },
            { name: 'All Files', extensions: ['*'] },
        ],
    });
    if (result.canceled) {
        console.log('IPC: Image file selection canceled');
        return null;
    }
    const selectedFile = result.filePaths[0];
    console.log('IPC: Selected image file:', selectedFile);
    return selectedFile;
}
async function handleGetFileStats(filePath) {
    try {
        const stats = await fs.stat(filePath);
        const fileExtension = path.extname(filePath).toLowerCase();
        return {
            exists: true,
            size: stats.size,
            mtime: stats.mtime,
            extension: fileExtension,
            fileName: path.basename(filePath),
        };
    }
    catch (error) {
        return {
            exists: false,
            ...extractLocalizedError(error),
        };
    }
}
async function handleGetImageList(folderPath) {
    try {
        const files = await fs.readdir(folderPath);
        const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.svg'];
        const imageFiles = files
            .filter((file) => imageExtensions.includes(path.extname(file).toLowerCase()))
            .map((file) => ({
            fileName: file,
            filePath: path.join(folderPath, file),
        }));
        return imageFiles;
    }
    catch (error) {
        console.error('Error getting image list:', error);
        return [];
    }
}
async function handleProcessFiles(inputFiles, outputDir, options) {
    const taskLogs = [];
    const log = (message) => {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] ${message}`;
        console.log(logEntry);
        taskLogs.push(logEntry);
    };
    log('========================================');
    log('IPC: Processing files request received');
    log('========================================');
    // 替换页面、插入页面、提取页面、提取图片和提取备注功能特殊处理：使用特定文件而不是 inputFiles
    let actualInputFiles = inputFiles;
    if (options.taskType === 'replace-pages' && options.replaceTargetFile) {
        actualInputFiles = [{ path: options.replaceTargetFile }];
        log('Replace pages mode: using target file from options');
    }
    else if (options.taskType === 'insert-pages' && options.insertTargetFile) {
        actualInputFiles = [{ path: options.insertTargetFile }];
        log('Insert pages mode: using target file from options');
    }
    else if (options.taskType === 'extract-pages' && options.extractSourceFile) {
        actualInputFiles = [{ path: options.extractSourceFile }];
        log('Extract pages mode: using source file from options');
    }
    else if (options.taskType === 'extract-images' && options.extractImagesSourceFile) {
        actualInputFiles = [{ path: options.extractImagesSourceFile }];
        log('Extract images mode: using source file from options');
    }
    else if (options.taskType === 'extract-notes' && options.extractNotesSourceFile) {
        actualInputFiles = [{ path: options.extractNotesSourceFile }];
        log('Extract notes mode: using source file from options');
    }
    else if (options.taskType === 'edit-metadata' && options.editMetadataSourceFile) {
        actualInputFiles = [{ path: options.editMetadataSourceFile }];
        log('Edit metadata mode: using source file from options');
    }
    else if (options.taskType === 'clear-metadata' && options.editMetadataSourceFile) {
        actualInputFiles = [{ path: options.editMetadataSourceFile }];
        log('Clear metadata mode: using source file from options');
    }
    else if (options.taskType === 'add-password') {
        // add-password uses regular inputFiles from file selection
        log('Add password mode: using regular input files');
    }
    log(`Input files: ${actualInputFiles.map((f) => path.basename(f.path)).join(', ')}`);
    log(`Task type: ${options.taskType}`);
    log(`Processing options: ${JSON.stringify(options, null, 2)}`);
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    let isCanceled = false;
    const cancelTask = () => {
        log(`Task ${taskId} canceled`);
        isCanceled = true;
        progressTracker.cancelTask(taskId);
    };
    activeTasks.set(taskId, { cancel: cancelTask });
    // 获取主窗口用于发送进度事件
    const mainWindow = BrowserWindow.getAllWindows()[0];
    // 创建临时输出目录
    const os = await import('os');
    const tempOutputDir = path.join(os.tmpdir(), 'ppt-processor', taskId);
    try {
        await fs.mkdir(tempOutputDir, { recursive: true });
        log(`Created temp output directory: ${tempOutputDir}`);
        // 初始化进度追踪器
        progressTracker.createTask(taskId, options.taskType || 'unknown', actualInputFiles.length);
        progressTracker.startTask(taskId);
        const results = [];
        let totalProcessed = 0;
        const totalFiles = actualInputFiles.length;
        for (let i = 0; i < totalFiles; i++) {
            if (isCanceled) {
                throw new Error('Task canceled');
            }
            const inputFile = actualInputFiles[i];
            const inputPath = inputFile.path;
            const baseName = path.basename(inputPath, path.extname(inputPath));
            // 使用文件名模式生成输出文件名
            const fileNamePattern = options.outputConfig?.fileNamePattern || '{name}_processed';
            // 支持 {name} 和 {original} 两种占位符
            const newBaseName = fileNamePattern
                .replace('{name}', baseName)
                .replace('{original}', baseName);
            // 格式转换任务使用目标格式的扩展名，其他任务使用 .pptx
            let outputExtension = path.extname(inputPath) || '.pptx';
            if (options.taskType === 'format-convert' && options.targetFormat) {
                outputExtension = `.${options.targetFormat}`;
            }
            const outputPath = path.join(tempOutputDir, `${newBaseName}${outputExtension}`);
            log('----------------------------------------');
            log(`Processing file ${i + 1}/${totalFiles}: ${path.basename(inputPath)}`);
            log(`Input path: ${inputPath}`);
            log(`Output path (temp): ${outputPath}`);
            log('----------------------------------------');
            // 使用进度追踪器更新进度
            progressTracker.startFile(taskId, inputPath, inputFile.size || 0);
            progressTracker.setStage(taskId, ProgressStage.PROCESSING, `正在处理: ${path.basename(inputPath)}`, 'main.progress.processingFile', { file: path.basename(inputPath) });
            try {
                switch (options.taskType) {
                    case 'text-replace':
                        await processTextReplace(inputPath, outputPath, options);
                        break;
                    case 'excel-rules':
                        await processExcelRules(inputPath, outputPath, options);
                        break;
                    case 'template-generate': {
                        const generatedFiles = await processTemplateGenerate(inputPath, outputDir, options);
                        totalProcessed++;
                        progressTracker.completeFile(taskId, inputPath, true);
                        for (const genPath of generatedFiles) {
                            results.push({
                                inputFile: path.basename(inputPath),
                                outputFile: path.basename(genPath),
                                outputPath: genPath,
                                status: 'success',
                                skipMove: true,
                            });
                        }
                        log(`✓ Template generate: ${path.basename(inputPath)} -> ${generatedFiles.length} files`);
                        continue;
                    }
                    case 'image-replace':
                        await processImageReplace(inputPath, outputPath, options);
                        break;
                    case 'delete-blank-pages':
                        await processDeleteBlankPages(inputPath, outputPath, options);
                        break;
                    case 'replace-text':
                        await processReplaceText(inputPath, outputPath, options);
                        break;
                    case 'delete-text':
                        await processDeleteText(inputPath, outputPath, options);
                        break;
                    case 'extract-text':
                        await processExtractText(inputPath, outputDir, options);
                        break;
                    case 'batch-replace':
                        await processBatchReplace(inputPath, outputPath, options);
                        break;
                    case 'delete-pages':
                        await processDeletePages(inputPath, outputPath, options);
                        break;
                    case 'replace-pages':
                        await processReplacePages(inputPath, outputPath, options);
                        break;
                    case 'insert-pages':
                        await processInsertPages(inputPath, outputPath, options);
                        break;
                    case 'optimize':
                        await processOptimize(inputPath, outputPath, options);
                        break;
                    case 'split-ppt': {
                        const splitOutputFiles = await processSplitPpt(inputPath, outputDir, options);
                        totalProcessed++;
                        progressTracker.completeFile(taskId, inputPath, true);
                        for (const splitFile of splitOutputFiles) {
                            results.push({
                                inputFile: path.basename(inputPath),
                                outputFile: path.basename(splitFile),
                                outputPath: splitFile,
                                status: 'success',
                                skipMove: true,
                            });
                        }
                        log(`✓ Split: ${path.basename(inputPath)} -> ${splitOutputFiles.length} files`);
                        continue;
                    }
                    case 'merge-ppt':
                        // merge-ppt 任务在循环外单独处理，此处仅更新进度，不生成单文件输出
                        totalProcessed++;
                        progressTracker.completeFile(taskId, inputPath, true);
                        log(`✓ Queued for merge: ${path.basename(inputPath)}`);
                        continue;
                    case 'add-watermark':
                        await processAddWatermark(inputPath, outputPath, options);
                        break;
                    case 'format-convert': {
                        const formatResult = await processFormatConvert(inputPath, outputDir, options);
                        totalProcessed++;
                        progressTracker.completeFile(taskId, inputPath, true);
                        if (Array.isArray(formatResult)) {
                            // 图片转换返回多个文件
                            for (const resultFile of formatResult) {
                                results.push({
                                    inputFile: path.basename(inputPath),
                                    outputFile: path.basename(resultFile),
                                    outputPath: resultFile,
                                    status: 'success',
                                    skipMove: true,
                                });
                            }
                            log(`✓ Format convert: ${path.basename(inputPath)} -> ${formatResult.length} files`);
                        }
                        else {
                            // 单文件转换
                            results.push({
                                inputFile: path.basename(inputPath),
                                outputFile: path.basename(formatResult),
                                outputPath: formatResult,
                                status: 'success',
                                skipMove: true,
                            });
                            log(`✓ Format convert: ${path.basename(inputPath)} -> ${path.basename(formatResult)}`);
                        }
                        continue;
                    }
                    case 'extract-pages':
                        await processExtractPages(inputPath, outputPath, options);
                        break;
                    case 'extract-images': {
                        const zipOutputFile = await processExtractImages(inputPath, outputDir, options);
                        totalProcessed++;
                        progressTracker.completeFile(taskId, inputPath, true);
                        results.push({
                            inputFile: path.basename(inputPath),
                            outputFile: path.basename(zipOutputFile),
                            outputPath: zipOutputFile,
                            status: 'success',
                            skipMove: true,
                        });
                        log(`✓ Extract images: ${path.basename(inputPath)} -> ${path.basename(zipOutputFile)}`);
                        continue;
                    }
                    case 'extract-notes': {
                        const notesOutputFile = await processExtractNotes(inputPath, outputDir, options);
                        totalProcessed++;
                        progressTracker.completeFile(taskId, inputPath, true);
                        results.push({
                            inputFile: path.basename(inputPath),
                            outputFile: path.basename(notesOutputFile),
                            outputPath: notesOutputFile,
                            status: 'success',
                            skipMove: true,
                        });
                        log(`✓ Extract notes: ${path.basename(inputPath)}`);
                        continue;
                    }
                    case 'edit-metadata':
                        await processEditMetadata(inputPath, outputPath, options);
                        break;
                    case 'clear-metadata':
                        await processClearMetadata(inputPath, outputPath, options);
                        break;
                    case 'add-password':
                        await processAddPassword(inputPath, outputPath, options);
                        break;
                    case 'remove-password':
                        await processRemovePassword(inputPath, outputPath, options);
                        break;
                    case 'optimize-compress':
                        await processOptimizeCompress(inputPath, outputPath, options);
                        break;
                    case 'delete-notes':
                        await processDeleteNotes(inputPath, outputPath, options);
                        break;
                    case 'delete-background':
                        await processDeleteBackground(inputPath, outputPath, options);
                        break;
                    case 'delete-header-footer':
                        await processDeleteHeaderFooter(inputPath, outputPath, options);
                        break;
                    case 'delete-macros':
                        await processDeleteMacros(inputPath, outputPath, options);
                        break;
                    default:
                        throw new Error(`Unsupported task type: ${options.taskType}`);
                }
                totalProcessed++;
                progressTracker.completeFile(taskId, inputPath, true);
                results.push({
                    inputFile: path.basename(inputPath),
                    inputPath: inputPath,
                    outputFile: path.basename(outputPath),
                    outputPath: outputPath,
                    status: 'success',
                });
                log(`✓ Processed successfully: ${path.basename(inputPath)}`);
            }
            catch (error) {
                const localizedError = extractLocalizedError(error);
                const errorMsg = localizedError.error;
                const errorStack = error instanceof Error ? error.stack : '';
                log(`✗ Error processing ${path.basename(inputPath)}: ${errorMsg}`);
                if (errorStack)
                    log(`Stack trace: ${errorStack}`);
                progressTracker.completeFile(taskId, inputPath, false);
                progressTracker.addError(taskId, path.basename(inputPath), errorMsg);
                results.push({
                    inputFile: path.basename(inputPath),
                    status: 'error',
                    error: errorMsg,
                    errorKey: localizedError.errorKey,
                    errorParams: localizedError.errorParams,
                });
            }
        }
        log('========================================');
        log('Processing completed');
        log(`Total files: ${totalFiles}`);
        log(`Processed: ${totalProcessed}`);
        log(`Errors: ${results.filter((r) => r.status === 'error').length}`);
        log('========================================');
        // 特殊处理 merge-ppt 任务（在循环外只执行一次）
        if (options.taskType === 'merge-ppt' && actualInputFiles.length > 0) {
            log('Processing merge-ppt task (once for all files)');
            progressTracker.setStage(taskId, ProgressStage.PROCESSING, '正在合并 PPT 文件...', 'main.progress.mergingPpt');
            const firstFile = actualInputFiles[0];
            const baseName = path.basename(firstFile.path, path.extname(firstFile.path));
            const defaultOutputPath = path.join(tempOutputDir, `${baseName}_merged.pptx`);
            try {
                const actualOutputPath = await processMergePpt(firstFile.path, defaultOutputPath, options, actualInputFiles);
                results.push({
                    inputFile: `合并的 ${actualInputFiles.length} 个文件`,
                    inputFileKey: 'main.result.mergedFiles',
                    inputFileParams: { count: actualInputFiles.length },
                    outputFile: path.basename(actualOutputPath),
                    outputPath: actualOutputPath,
                    status: 'success',
                });
                log('✓ Merge-ppt task completed');
            }
            catch (error) {
                const localizedError = extractLocalizedError(error);
                const errorMsg = localizedError.error;
                log(`✗ Error in merge-ppt task: ${errorMsg}`);
                progressTracker.completeFile(taskId, firstFile.path, false);
                progressTracker.addError(taskId, 'merge-ppt', errorMsg);
                results.push({
                    inputFile: `合并的 ${actualInputFiles.length} 个文件`,
                    inputFileKey: 'main.result.mergedFiles',
                    inputFileParams: { count: actualInputFiles.length },
                    status: 'error',
                    error: errorMsg,
                    errorKey: localizedError.errorKey,
                    errorParams: localizedError.errorParams,
                });
            }
        }
        // 完成进度追踪
        progressTracker.completeTask(taskId, results.filter((r) => r.status === 'error').length === 0);
        // 将处理后的文件移动到最终目的地
        const overwriteOriginal = options.outputConfig?.overwriteOriginal === true;
        const finalOutputDir = outputDir || path.join(require('os').homedir(), 'Downloads', 'ppt-processor');
        if (!overwriteOriginal) {
            await fs.mkdir(finalOutputDir, { recursive: true });
            log(`Ensuring final output directory exists: ${finalOutputDir}`);
        }
        else {
            log('Mode: Overwrite original files');
        }
        // 移动每个成功的文件到最终输出目录（跳过已直接输出到目标目录的文件）
        for (const result of results) {
            // skipMove 标记表示文件已直接输出到用户目录，无需移动
            if (result.status === 'success' && result.outputPath && !result.skipMove) {
                let finalPath;
                if (overwriteOriginal) {
                    // 覆盖原文件：优先使用保存的 inputPath
                    finalPath =
                        result.inputPath || path.join(finalOutputDir, path.basename(result.outputPath));
                }
                else {
                    finalPath = path.join(finalOutputDir, path.basename(result.outputPath));
                }
                try {
                    log(`Moving/Overwriting: ${result.outputPath} -> ${finalPath}`);
                    await fs.copyFile(result.outputPath, finalPath);
                    result.outputPath = finalPath; // 更新为最终路径
                    log(`  ✓ Success: ${path.basename(result.outputPath)}`);
                }
                catch (moveError) {
                    const moveErrorMsg = moveError instanceof Error ? moveError.message : String(moveError);
                    log(`  ✗ Failed to ${overwriteOriginal ? 'overwrite' : 'move'} file: ${path.basename(result.outputPath)}. Error: ${moveErrorMsg}`);
                }
            }
            else if (result.skipMove) {
                log(`  Skipped move (already in target): ${path.basename(result.outputPath)}`);
            }
        }
        // 在项目根目录的 logs 文件夹生成日志文件
        try {
            const projectLogsDir = path.join(process.cwd(), 'logs');
            await fs.mkdir(projectLogsDir, { recursive: true });
            const logFileName = `processing_${Date.now()}.log`;
            const projectLogPath = path.join(projectLogsDir, logFileName);
            await fs.writeFile(projectLogPath, taskLogs.join('\n'), 'utf-8');
            log(`Project log generated at: ${projectLogPath}`);
        }
        catch (logError) {
            console.error('Failed to write log file:', logError);
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
        if (mainWindow) {
            mainWindow.webContents.send('task-completed', {
                taskId,
                success: true,
                results,
                finalOutputDir,
                summary: {
                    total: totalFiles,
                    processed: totalProcessed,
                    errors: results.filter((r) => r.status === 'error').length,
                },
            });
        }
        return {
            success: true,
            taskId,
            results,
            finalOutputDir,
            summary: {
                total: totalFiles,
                processed: totalProcessed,
                errors: results.filter((r) => r.status === 'error').length,
            },
        };
    }
    catch (error) {
        const localizedError = extractLocalizedError(error);
        const errorMsg = localizedError.error;
        log(`Critical processing error: ${errorMsg}`);
        progressTracker.addError(taskId, 'Task', errorMsg);
        progressTracker.completeTask(taskId, false);
        // 即便失败，也尝试在某处写日志
        try {
            const projectLogsDir = path.join(process.cwd(), 'logs');
            await fs.mkdir(projectLogsDir, { recursive: true });
            const errorLogFileName = `error_${Date.now()}.log`;
            const errorLogPath = path.join(projectLogsDir, errorLogFileName);
            await fs.writeFile(errorLogPath, taskLogs.join('\n'), 'utf-8');
        }
        catch (e) { }
        return {
            success: false,
            taskId,
            ...localizedError,
        };
    }
    finally {
        activeTasks.delete(taskId);
        progressTracker.clearTask(taskId);
        log(`Task ${taskId} finished at ${new Date().toISOString()}`);
    }
}
async function handleCancelTask(taskId) {
    console.log(`Canceling task: ${taskId}`);
    const task = activeTasks.get(taskId);
    if (task) {
        task.cancel();
        activeTasks.delete(taskId);
        return true;
    }
    return false;
}
async function processReplaceText(inputPath, outputPath, options) {
    console.log('    ========== processReplaceText ==========');
    console.log('    Search text:', options.searchText);
    console.log('    Replace text:', options.replaceText);
    console.log('    Use regex:', options.useRegex);
    console.log('    Case sensitive:', options.caseSensitive);
    console.log('    Whole word:', options.wholeWord);
    console.log('    All options:', JSON.stringify(options, null, 2));
    const { TextProcessor } = await import('../processors/text-processor');
    const processor = new TextProcessor();
    const processorOptions = {
        searchText: options.searchText,
        replaceText: options.replaceText,
        caseSensitive: options.caseSensitive || false,
        wholeWord: options.wholeWord || false,
        useRegex: options.useRegex || false,
    };
    console.log('    Processor options:', JSON.stringify(processorOptions, null, 2));
    await processor.replaceText(inputPath, outputPath, processorOptions);
    console.log('    Text replaced successfully');
}
async function processDeleteText(inputPath, outputPath, options) {
    console.log('    Deleting text...');
    console.log('    Search text:', options.searchText);
    console.log('    Use regex:', options.useRegex);
    const { TextProcessor } = await import('../processors/text-processor');
    const processor = new TextProcessor();
    await processor.replaceText(inputPath, outputPath, {
        searchText: options.searchText,
        replaceText: '',
        caseSensitive: options.caseSensitive || false,
        wholeWord: options.wholeWord || false,
        useRegex: options.useRegex || false,
    });
    console.log('    Text deleted successfully');
}
async function processExtractText(inputPath, outputDir, options) {
    console.log('    Extracting text...');
    // TODO: Implement text extraction functionality
    throw new Error('Text extraction feature is not yet implemented');
}
async function processBatchReplace(inputPath, outputPath, options) {
    console.log('    Batch replacing text...');
    console.log('    Replacement pairs:', options.replacePairs.length);
    const { TextProcessor } = await import('../processors/text-processor');
    const processor = new TextProcessor();
    let currentInput = inputPath;
    let currentOutput = outputPath;
    for (let i = 0; i < options.replacePairs.length; i++) {
        const pair = options.replacePairs[i];
        console.log(`    Replacing: "${pair.search}" → "${pair.replace}"`);
        await processor.replaceText(currentInput, currentOutput, {
            searchText: pair.search,
            replaceText: pair.replace,
            caseSensitive: options.caseSensitive || false,
            wholeWord: options.wholeWord || false,
            useRegex: options.regexEnabled || false,
        });
        // For subsequent replacements, use the output as input
        if (i < options.replacePairs.length - 1) {
            currentInput = currentOutput;
        }
    }
    console.log('    Batch replacement completed');
}
async function processDeletePages(inputPath, outputPath, options) {
    const deleteMode = options.deletePageMode || 'range';
    const pageRange = options.pageRange || '1';
    console.log('    Deleting pages:', {
        mode: deleteMode,
        pageRange: pageRange,
    });
    const { PageProcessor } = await import('../services/page-processor');
    const { PptxParser } = await import('../services/pptx-parser');
    const processor = new PageProcessor();
    const parser = new PptxParser();
    if (deleteMode === 'range') {
        // 模式1: 按页码范围删除
        console.log('    Mode: Delete specified pages');
        await processor.deletePages(inputPath, outputPath, pageRange);
    }
    else if (deleteMode === 'keep') {
        // 模式2: 保留指定页面，删除其他
        console.log('    Mode: Keep specified pages, delete others');
        // 打开文档获取总页数
        const document = await parser.open(inputPath);
        const totalPages = document.slides.length;
        console.log(`    Total pages: ${totalPages}`);
        // 解析要保留的页码
        const keepPages = [];
        const parts = pageRange.split(',').map((s) => s.trim());
        for (const part of parts) {
            if (part.includes('-')) {
                const [start, end] = part.split('-').map((s) => parseInt(s.trim()));
                if (!isNaN(start) && !isNaN(end)) {
                    for (let i = start; i <= end && i <= totalPages; i++) {
                        if (i >= 1 && !keepPages.includes(i)) {
                            keepPages.push(i);
                        }
                    }
                }
            }
            else {
                const page = parseInt(part);
                if (!isNaN(page) && page >= 1 && page <= totalPages && !keepPages.includes(page)) {
                    keepPages.push(page);
                }
            }
        }
        keepPages.sort((a, b) => a - b);
        console.log(`    Pages to keep: ${keepPages.join(', ')}`);
        // 计算要删除的页码（所有页码减去要保留的页码）
        const allPages = Array.from({ length: totalPages }, (_, i) => i + 1);
        const deletePages = allPages.filter((page) => !keepPages.includes(page));
        console.log(`    Pages to delete: ${deletePages.join(', ')}`);
        if (deletePages.length === 0) {
            console.log('    No pages to delete');
            // 如果没有要删除的页面，直接复制文件
            await fs.copyFile(inputPath, outputPath);
        }
        else {
            // 将要删除的页码转换为范围字符串
            let deleteRangeStr = '';
            let rangeStart = deletePages[0];
            let rangeEnd = deletePages[0];
            for (let i = 1; i <= deletePages.length; i++) {
                if (i < deletePages.length && deletePages[i] === rangeEnd + 1) {
                    rangeEnd = deletePages[i];
                }
                else {
                    if (deleteRangeStr)
                        deleteRangeStr += ',';
                    if (rangeStart === rangeEnd) {
                        deleteRangeStr += rangeStart;
                    }
                    else {
                        deleteRangeStr += `${rangeStart}-${rangeEnd}`;
                    }
                    if (i < deletePages.length) {
                        rangeStart = deletePages[i];
                        rangeEnd = deletePages[i];
                    }
                }
            }
            console.log(`    Delete range: ${deleteRangeStr}`);
            // 执行删除
            await processor.deletePages(inputPath, outputPath, deleteRangeStr);
        }
    }
    else {
        throw new Error(`Unknown delete mode: ${deleteMode}`);
    }
    console.log('    Pages deleted successfully');
}
async function processReplacePages(inputPath, outputPath, options) {
    console.log('    Replacing pages:', {
        targetPageNumber: options.replacePageNumber,
        sourceFile: options.replaceSourceFile,
        sourcePageNumber: options.replaceSourcePageNumber,
    });
    const { PageProcessor } = await import('../services/page-processor');
    const processor = new PageProcessor();
    // 验证必需参数
    if (!options.replaceSourceFile) {
        throw new Error('Source file is required for page replacement');
    }
    if (!options.replacePageNumber) {
        throw new Error('Target page number is required');
    }
    if (!options.replaceSourcePageNumber) {
        throw new Error('Source page number is required');
    }
    // 将页码转换为范围字符串
    const targetPageRange = options.replacePageNumber.toString();
    const sourcePageRange = options.replaceSourcePageNumber.toString();
    console.log(`    Replacing target page ${targetPageRange} with source page ${sourcePageRange}`);
    // 执行替换页面操作
    await processor.replacePages(inputPath, options.replaceSourceFile, targetPageRange, sourcePageRange, outputPath);
    console.log('    Pages replaced successfully');
}
async function processInsertPages(inputPath, outputPath, options) {
    console.log('    Inserting pages:', {
        insertPosition: options.insertPosition,
        sourceFile: options.insertSourceFile,
        sourcePageRange: options.insertSourcePageRange,
    });
    const { PageProcessor } = await import('../services/page-processor');
    const processor = new PageProcessor();
    // 验证必需参数
    if (!options.insertSourceFile) {
        throw new Error('Source file is required for page insertion');
    }
    if (options.insertPosition === undefined || options.insertPosition === null) {
        throw new Error('Insert position is required');
    }
    if (!options.insertSourcePageRange) {
        throw new Error('Source page range is required');
    }
    console.log(`    Inserting pages from ${options.insertSourcePageRange} at position ${options.insertPosition}`);
    console.log(`    Target file: ${options.insertTargetFile}`);
    console.log(`    Source file: ${options.insertSourceFile}`);
    // 使用 insertTargetFile 作为目标文件，而不是 inputPath
    const targetFile = options.insertTargetFile || inputPath;
    // 执行插入页面操作
    await processor.insertPages(targetFile, options.insertSourceFile, options.insertPosition, options.insertSourcePageRange, outputPath);
    console.log('    Pages inserted successfully');
}
async function processOptimize(inputPath, outputPath, options) {
    console.log('    Optimizing presentation...');
    const { FileOptimizer } = await import('../services/file-optimizer.js');
    const optimizer = new FileOptimizer();
    const optimizeOptions = {
        level: options.compressLevel || 'medium',
        compressImages: options.compressImages !== false,
        removeEmbeddedFonts: options.removeEmbeddedFonts === true,
    };
    await optimizer.optimize(inputPath, outputPath, optimizeOptions);
    console.log(`    File optimized successfully`);
}
export async function processSplitPpt(inputPath, outputDir, options) {
    console.log('    Split PPT options:', {
        mode: options.splitMode,
        pagesPerFile: options.splitPagesPerFile,
        fileCount: options.splitFileCount,
        namingRule: options.splitNamingRule,
    });
    const { PageProcessor } = await import('../services/page-processor');
    const { PptxParser } = await import('../services/pptx-parser');
    const processor = new PageProcessor();
    const parser = new PptxParser();
    // 打开文档获取总页数
    const document = await parser.open(inputPath);
    const totalPages = document.slides.length;
    console.log(`    Total pages: ${totalPages}`);
    const baseName = path.basename(inputPath, path.extname(inputPath));
    // 确保输出目录存在
    await fs.mkdir(outputDir, { recursive: true });
    console.log(`    Ensured output directory exists: ${outputDir}`);
    let splitRanges = [];
    // 兼容旧值（pages/count/files）和新值（by-pages/by-count/by-range）
    const rawSplitMode = options.splitMode || 'by-pages';
    const splitMode = rawSplitMode === 'by-pages'
        ? 'pages'
        : rawSplitMode === 'by-count'
            ? 'files'
            : rawSplitMode === 'by-range'
                ? 'range'
                : rawSplitMode;
    if (splitMode === 'pages') {
        // 按每个文件的页数拆分，默认每个文件 1 页
        const pagesPerFile = options.splitPagesPerFile || 1;
        console.log(`    Using pages per file: ${pagesPerFile}`);
        for (let i = 0; i < totalPages; i += pagesPerFile) {
            const start = i + 1;
            const end = Math.min(i + pagesPerFile, totalPages);
            splitRanges.push(`${start}-${end}`);
        }
    }
    else if (splitMode === 'files' || splitMode === 'count') {
        // 按文件数量拆分，默认拆分为 2 个文件
        const fileCount = options.splitFileCount || 2;
        const pagesPerFile = Math.ceil(totalPages / fileCount);
        console.log(`    Using file count: ${fileCount}, pages per file: ${pagesPerFile}`);
        for (let i = 0; i < fileCount; i++) {
            const start = i * pagesPerFile + 1;
            const end = Math.min((i + 1) * pagesPerFile, totalPages);
            if (start <= totalPages) {
                splitRanges.push(`${start}-${end}`);
            }
        }
    }
    // 如果没有生成任何拆分范围，使用默认值
    if (splitRanges.length === 0) {
        console.log('    No split ranges generated, using default: 1 page per file');
        for (let i = 0; i < totalPages; i++) {
            splitRanges.push(`${i + 1}-${i + 1}`);
        }
    }
    console.log(`    Splitting into ${splitRanges.length} files`);
    const outputFiles = [];
    // 提取每个范围到单独的文件
    for (let i = 0; i < splitRanges.length; i++) {
        const range = splitRanges[i];
        let fileName;
        if (options.splitNamingRule === 'number') {
            fileName = `${baseName}_${i + 1}.pptx`;
        }
        else if (options.splitNamingRule === 'range') {
            fileName = `${baseName}_${range.replace('-', '_')}.pptx`;
        }
        else if (options.splitNamingRule === 'custom' && options.splitCustomPrefix) {
            fileName = `${options.splitCustomPrefix}_${i + 1}.pptx`;
        }
        else {
            fileName = `${baseName}_part${i + 1}.pptx`;
        }
        const splitOutputPath = path.join(outputDir, fileName);
        console.log(`    Extracting pages ${range} to ${fileName}`);
        // 解析页面范围
        const [startPage, endPage] = range.split('-').map(Number);
        await processor.extractPages(inputPath, splitOutputPath, startPage, endPage);
        // 使用 LibreOffice 验证和修复文件
        console.log(`    Validating and repairing ${fileName} with LibreOffice...`);
        await validateAndRepairWithLibreOffice(splitOutputPath);
        outputFiles.push(splitOutputPath);
    }
    console.log('    PPT split completed');
    return outputFiles;
}
async function processMergePpt(inputPath, outputPath, options, inputFiles) {
    console.log('    Merge PPT options:', {
        order: options.mergeOrder,
        outputName: options.mergeOutputName,
        addSeparator: options.mergeAddSeparator,
    });
    const { PageProcessor } = await import('../services/page-processor');
    const processor = new PageProcessor();
    // 获取所有输入文件路径
    const filePaths = inputFiles.map((f) => f.path);
    // 根据排序规则排序
    if (options.mergeOrder === 'name') {
        filePaths.sort((a, b) => {
            const nameA = path.basename(a).toLowerCase();
            const nameB = path.basename(b).toLowerCase();
            return nameA.localeCompare(nameB);
        });
    }
    else if (options.mergeOrder === 'size') {
        // 按文件大小排序（需要读取文件大小）
        const filesWithSize = await Promise.all(filePaths.map(async (p) => {
            const stats = await fs.stat(p);
            return { path: p, size: stats.size };
        }));
        filesWithSize.sort((a, b) => a.size - b.size);
        filePaths.length = 0;
        filePaths.push(...filesWithSize.map((f) => f.path));
    }
    // 如果是 'custom' 则保持原顺序
    console.log(`    Merging ${filePaths.length} files`);
    console.log(`    Order: ${filePaths.map((p) => path.basename(p)).join(', ')}`);
    // 确定输出文件路径
    const outputDir = path.dirname(outputPath);
    let mergedOutputPath;
    if (options.mergeOutputName) {
        mergedOutputPath = path.join(outputDir, `${options.mergeOutputName}.pptx`);
    }
    else {
        mergedOutputPath = outputPath;
    }
    // 确保输出目录存在
    await fs.mkdir(outputDir, { recursive: true });
    console.log(`    Ensured output directory exists: ${outputDir}`);
    // 执行合并
    await processor.mergePpt(filePaths, mergedOutputPath);
    console.log(`    Merged file saved to: ${path.basename(mergedOutputPath)}`);
    return mergedOutputPath;
}
/**
 * 使用 LibreOffice 验证和修复 PPT 文件
 * @param filePath PPT 文件路径
 */
async function validateAndRepairWithLibreOffice(filePath) {
    try {
        const { execFile } = await import('child_process');
        const { promisify } = await import('util');
        const execFileAsync = promisify(execFile);
        const fs = await import('fs/promises');
        const path = await import('path');
        const os = await import('os');
        const isWindows = process.platform === 'win32';
        const libreOfficePaths = isWindows
            ? [
                'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
                'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
                'C:\\Program Files\\LibreOffice\\program\\soffice.com',
                'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.com',
                'C:\\Program Files\\LibreOffice 7\\program\\soffice.exe',
                'C:\\Program Files\\LibreOffice 24.2\\program\\soffice.exe',
            ]
            : [
                '/usr/bin/soffice',
                '/usr/local/bin/soffice',
                '/usr/bin/libreoffice',
                '/usr/local/bin/libreoffice',
                '/Applications/LibreOffice.app/Contents/MacOS/soffice',
            ];
        const libreOfficeCommands = isWindows
            ? ['soffice.exe', 'soffice.com', 'soffice']
            : ['soffice', 'libreoffice'];
        let libreOfficePath = '';
        for (const testPath of libreOfficePaths) {
            try {
                await fs.access(testPath);
                libreOfficePath = testPath;
                break;
            }
            catch {
                continue;
            }
        }
        if (!libreOfficePath) {
            for (const command of libreOfficeCommands) {
                try {
                    const { stdout, stderr } = await execFileAsync(command, ['--version'], { timeout: 5000 });
                    const output = `${stdout ?? ''}${stderr ?? ''}`;
                    if (output.toLowerCase().includes('libreoffice')) {
                        libreOfficePath = command;
                        break;
                    }
                }
                catch {
                    continue;
                }
            }
        }
        if (!libreOfficePath) {
            console.warn('LibreOffice not found, skipping file validation');
            return;
        }
        console.log('Using LibreOffice at:', libreOfficePath);
        // 创建临时目录
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ppt-validate-'));
        try {
            // 使用 LibreOffice 转换文件，这会验证和修复文件
            await execFileAsync(libreOfficePath, ['--headless', '--convert-to', 'pptx', '--outdir', tempDir, filePath], { timeout: 30000 });
            // 获取转换后的文件路径
            const baseName = path.basename(filePath);
            const validatedPath = path.join(tempDir, baseName);
            // 检查转换后的文件是否存在
            try {
                await fs.access(validatedPath);
                // 如果存在，替换原始文件
                await fs.copyFile(validatedPath, filePath);
                console.log(`    File validated and repaired by LibreOffice: ${baseName}`);
            }
            catch {
                console.warn('LibreOffice validation failed, using original file');
            }
        }
        catch (e) {
            console.warn('LibreOffice validation error:', e);
        }
        finally {
            // 清理临时目录
            try {
                await fs.rm(tempDir, { recursive: true, force: true });
            }
            catch {
                // 忽略删除失败
            }
        }
    }
    catch (error) {
        console.warn('Failed to validate with LibreOffice:', error);
    }
}
async function processAddWatermark(inputPath, outputPath, options) {
    console.log('    Adding watermark...');
    console.log('    Watermark type:', options.watermarkType);
    console.log('    Watermark text:', options.watermarkText);
    console.log('    Apply to images:', options.applyWatermarkToImages);
    const { WatermarkAdder } = await import('../services/watermark-adder');
    const adder = new WatermarkAdder();
    const watermarkOptions = {
        type: options.watermarkType || 'text',
        applyToImages: options.applyWatermarkToImages === true,
    };
    if (options.watermarkType === 'text') {
        watermarkOptions.text = options.watermarkText || 'Watermark';
        watermarkOptions.fontSize = options.watermarkFontSize || 48;
        watermarkOptions.fontColor = options.watermarkColor || '#000000';
    }
    else if (options.watermarkType === 'image') {
        watermarkOptions.imagePath = options.watermarkImage;
        watermarkOptions.width = options.watermarkWidth;
        watermarkOptions.height = options.watermarkHeight;
    }
    watermarkOptions.opacity = options.watermarkOpacity !== undefined ? options.watermarkOpacity : 0.5;
    watermarkOptions.rotation = options.watermarkRotation || 0;
    watermarkOptions.position = options.watermarkPosition || 'center';
    const result = await adder.addWatermark(inputPath, outputPath, watermarkOptions);
    if (!result.success) {
        throw new Error(`Add watermark failed: ${result.errors.join(', ')}`);
    }
    console.log(`    Watermark added to ${result.processedSlides} slides`);
}
async function processFormatConvert(inputPath, outputDir, options) {
    console.log('    Converting format:', {
        targetFormat: options.targetFormat,
        imageQuality: options.imageQuality,
    });
    const { FormatConverter } = await import('../services/format-converter');
    const converter = new FormatConverter();
    const targetFormat = options.targetFormat || 'pdf';
    const path = await import('path');
    const fs = await import('fs/promises');
    const baseName = path.basename(inputPath, path.extname(inputPath));
    // 确保输出目录存在
    await fs.mkdir(outputDir, { recursive: true });
    if (targetFormat === 'pdf') {
        // PDF 转换 - 输出到 outputDir
        console.log('    Converting to PDF using FormatConverter...');
        const outputPath = path.join(outputDir, `${baseName}.pdf`);
        await converter.convertToPdf(inputPath, outputPath);
        // 验证输出文件
        const stats = await fs.stat(outputPath);
        if (stats.size === 0) {
            throw new Error('PDF conversion failed: output file is empty');
        }
        console.log(`    PDF conversion completed: ${stats.size} bytes`);
        return outputPath;
    }
    else if (targetFormat === 'png' || targetFormat === 'jpg') {
        console.log(`    Converting to ${targetFormat.toUpperCase()} using FormatConverter...`);
        const imagesDir = path.join(outputDir, `${baseName}_images`);
        await fs.mkdir(imagesDir, { recursive: true });
        const imageFiles = await converter.convertToImages(inputPath, imagesDir, targetFormat, {
            quality: options.imageQuality || 90,
            compressionLevel: options.compressionLevel ?? 6,
        });
        if (imageFiles.length === 0) {
            throw new Error('Image conversion failed: no images generated');
        }
        const zipFilePath = path.join(outputDir, `${baseName}_images.zip`);
        const fsNode = await import('fs');
        const archiverModule = await import('archiver');
        const archiver = archiverModule.default || archiverModule;
        await new Promise((resolve, reject) => {
            const output = fsNode.createWriteStream(zipFilePath);
            const archive = archiver('zip', { zlib: { level: 9 } });
            output.on('close', () => resolve());
            output.on('error', (err) => reject(err));
            archive.on('error', (err) => reject(err));
            archive.pipe(output);
            archive.directory(imagesDir, false);
            archive.finalize();
        });
        await fs.rm(imagesDir, { recursive: true, force: true });
        console.log(`    Image conversion completed: ${imageFiles.length} files, zipped to ${zipFilePath}`);
        return zipFilePath;
    }
    else if (targetFormat === 'html') {
        // HTML 转换 - 输出到 outputDir
        console.log('    Converting to HTML using FormatConverter...');
        const outputPath = path.join(outputDir, `${baseName}.html`);
        await converter.convertToHtml(inputPath, outputPath);
        const stats = await fs.stat(outputPath);
        console.log(`    HTML conversion completed: ${stats.size} bytes`);
        return outputPath;
    }
    else if (targetFormat === 'ppt' || targetFormat === 'pptx') {
        // PPT/PPTX 互转 - 输出到 outputDir
        console.log(`    Converting to ${targetFormat.toUpperCase()} using FormatConverter...`);
        const outputPath = path.join(outputDir, `${baseName}.${targetFormat}`);
        await converter.convertFormat(inputPath, outputPath, targetFormat);
        const stats = await fs.stat(outputPath);
        console.log(`    Format conversion completed: ${stats.size} bytes`);
        return outputPath;
    }
    else {
        throw new Error(`Unsupported target format: ${targetFormat}`);
    }
}
async function processExtractPages(inputPath, outputPath, options) {
    console.log('    Extracting pages:', {
        pageRange: options.extractPageRange,
    });
    const { PageProcessor } = await import('../services/page-processor');
    const processor = new PageProcessor();
    // 验证必需参数
    if (!options.extractPageRange) {
        throw new Error('Page range is required for page extraction');
    }
    // 解析页码范围（例如 "1-3,5,7-9"）
    const ranges = options.extractPageRange.split(',').map((r) => r.trim());
    let startPage = 1;
    let endPage = 1;
    // 简单处理：如果是单个数字或范围
    if (ranges.length === 1) {
        const range = ranges[0];
        if (range.includes('-')) {
            const [start, end] = range.split('-').map((n) => parseInt(n.trim()));
            startPage = start;
            endPage = end;
        }
        else {
            startPage = endPage = parseInt(range);
        }
    }
    else {
        // 对于复杂范围（如 "1-3,5,7-9"），需要更复杂的处理
        // 这里暂时只支持简单的单个范围
        throw new Error('Complex page ranges not yet supported. Please use a single range like "1-3" or a single page like "5"');
    }
    console.log(`    Extracting pages ${startPage} to ${endPage}`);
    // 执行提取页面操作
    await processor.extractPages(inputPath, outputPath, startPage, endPage);
    console.log('    Pages extracted successfully');
}
async function processExtractImages(inputPath, outputDir, options) {
    console.log('    Extracting images:', {
        format: options.extractImagesFormat,
    });
    const { ImageExtractor } = await import('../services/image-extractor');
    const extractor = new ImageExtractor();
    const targetFormat = options.extractImagesFormat || 'original';
    const path = await import('path');
    const fs = await import('fs/promises');
    const os = await import('os');
    await fs.mkdir(outputDir, { recursive: true });
    const baseName = path.basename(inputPath, path.extname(inputPath));
    const tempImagesDir = path.join(os.tmpdir(), 'ppt-processor', 'extract-images', `${baseName}_${Date.now()}`);
    try {
        await fs.mkdir(tempImagesDir, { recursive: true });
        const extractedImages = await extractor.extractImages(inputPath, tempImagesDir, targetFormat);
        const zipFilePath = path.join(outputDir, `${baseName}_images.zip`);
        const fsNode = await import('fs');
        const archiverModule = await import('archiver');
        const archiver = archiverModule.default || archiverModule;
        await new Promise((resolve, reject) => {
            const output = fsNode.createWriteStream(zipFilePath);
            const archive = archiver('zip', { zlib: { level: 9 } });
            output.on('close', () => resolve());
            output.on('error', (err) => reject(err));
            archive.on('error', (err) => reject(err));
            archive.pipe(output);
            archive.directory(tempImagesDir, false);
            archive.finalize();
        });
        console.log(`    Images extracted successfully: ${extractedImages.length} images, zipped to ${zipFilePath}`);
        return zipFilePath;
    }
    finally {
        await fs.rm(tempImagesDir, { recursive: true, force: true });
    }
}
async function processExtractNotes(inputPath, outputDir, options) {
    console.log('    Extracting notes:', {
        format: options.extractNotesFormat,
    });
    const { NotesExtractor } = await import('../services/notes-extractor');
    const extractor = new NotesExtractor();
    const path = await import('path');
    const targetFormat = options.extractNotesFormat || 'txt';
    // 生成输出文件路径
    const baseName = path.basename(inputPath, path.extname(inputPath));
    const outputFileName = `${baseName}_notes.${targetFormat}`;
    const outputPath = path.join(outputDir, outputFileName);
    // 执行提取备注操作
    await extractor.extractNotes(inputPath, outputPath, targetFormat);
    console.log(`    Notes extracted successfully to: ${outputPath}`);
    return outputPath;
}
async function processEditMetadata(inputPath, outputPath, options) {
    console.log('    Editing metadata:', {
        title: options.metadataTitle,
        author: options.metadataAuthor,
        subject: options.metadataSubject,
        keywords: options.metadataKeywords,
        comments: options.metadataComments,
    });
    const { MetadataEditor } = await import('../services/metadata-editor');
    const editor = new MetadataEditor();
    // 构建元数据对象
    const metadata = {};
    if (options.metadataTitle)
        metadata.title = options.metadataTitle;
    if (options.metadataAuthor)
        metadata.author = options.metadataAuthor;
    if (options.metadataSubject)
        metadata.subject = options.metadataSubject;
    if (options.metadataKeywords)
        metadata.keywords = options.metadataKeywords;
    if (options.metadataComments)
        metadata.comments = options.metadataComments;
    // 执行编辑元数据操作
    await editor.editMetadata(inputPath, outputPath, metadata);
    console.log('    Metadata edited successfully');
}
async function processClearMetadata(inputPath, outputPath, options) {
    console.log('    Clearing metadata...');
    const { MetadataEditor } = await import('../services/metadata-editor');
    const editor = new MetadataEditor();
    // 清空所有元数据字段
    const metadata = {
        title: '',
        author: '',
        subject: '',
        keywords: '',
        comments: '',
    };
    // 执行清空元数据操作
    await editor.editMetadata(inputPath, outputPath, metadata);
    console.log('    Metadata cleared successfully');
}
async function processAddPassword(inputPath, outputPath, options) {
    console.log('    Adding password protection...');
    const { PasswordProtector } = await import('../services/password-protector');
    const protector = new PasswordProtector();
    const password = options.password || '';
    if (!password) {
        throw new Error('Password is required for add-password task');
    }
    // 执行添加密码操作
    await protector.addPassword(inputPath, outputPath, password);
    console.log('    Password protection added successfully');
}
async function processRemovePassword(inputPath, outputPath, options) {
    console.log('    Removing password protection...');
    const { PasswordProtector } = await import('../services/password-protector');
    const protector = new PasswordProtector();
    const currentPassword = options.oldPassword || '';
    if (!currentPassword) {
        throw new Error('Current password is required to remove password protection');
    }
    // 执行删除密码操作
    await protector.removePassword(inputPath, outputPath, currentPassword);
    console.log('    Password protection removed successfully');
}
async function processOptimizeCompress(inputPath, outputPath, options) {
    console.log('    Optimizing and compressing file...', {
        compressLevel: options.compressLevel,
    });
    const { FileOptimizer } = await import('../services/file-optimizer.js');
    const optimizer = new FileOptimizer();
    const optimizeOptions = {
        level: options.compressLevel || 'medium',
        compressImages: true,
        removeEmbeddedFonts: false,
    };
    await optimizer.optimize(inputPath, outputPath, optimizeOptions);
    console.log('    File optimized and compressed successfully');
}
async function processDeleteNotes(inputPath, outputPath, options) {
    console.log('    Deleting notes from slides...');
    const { NotesRemover } = await import('../services/notes-remover');
    const remover = new NotesRemover();
    const result = await remover.removeNotes(inputPath, outputPath);
    if (!result.success) {
        throw new Error(`Failed to delete notes: ${result.errors.join(', ')}`);
    }
    console.log(`    Notes deleted from ${result.processedSlides} slides`);
}
async function processDeleteBackground(inputPath, outputPath, options) {
    console.log('    Deleting background...', {
        removeImages: options.removeImages,
        removeColors: options.removeColors,
        applyToMaster: options.applyToMaster,
    });
    const { BackgroundRemover } = await import('../services/background-remover');
    const remover = new BackgroundRemover();
    const removeOptions = {
        removeImages: options.removeImages !== false,
        removeColors: options.removeColors !== false,
        applyToMaster: options.applyToMaster || false,
    };
    const result = await remover.removeBackground(inputPath, outputPath, removeOptions);
    if (!result.success) {
        throw new Error(`Failed to delete background: ${result.errors.join(', ')}`);
    }
    console.log(`    Background deleted from ${result.processedSlides} slides, ${result.processedMasters} masters`);
}
async function processDeleteHeaderFooter(inputPath, outputPath, options) {
    console.log('    Deleting header/footer...', {
        removeHeader: options.removeHeader,
        removeFooter: options.removeFooter,
        removeSlideNumber: options.removeSlideNumber,
        removeDateTime: options.removeDateTime,
    });
    const { HeaderFooterRemover } = await import('../services/header-footer-remover');
    const remover = new HeaderFooterRemover();
    const removeOptions = {
        removeHeader: options.removeHeader !== false,
        removeFooter: options.removeFooter !== false,
        removeSlideNumber: options.removeSlideNumber !== false,
        removeDateTime: options.removeDateTime !== false,
    };
    const result = await remover.removeHeaderFooter(inputPath, outputPath, removeOptions);
    if (!result.success) {
        throw new Error(`Failed to delete header/footer: ${result.errors.join(', ')}`);
    }
    console.log(`    Header/footer deleted from ${result.processedSlides} slides, removed ${result.removedCount} items`);
}
async function processDeleteMacros(inputPath, outputPath, options) {
    console.log('    Deleting macros...');
    const { MacroRemover } = await import('../services/macro-remover');
    const remover = new MacroRemover();
    const result = await remover.removeMacros(inputPath, outputPath);
    if (!result.success) {
        throw new Error(`Failed to delete macros: ${result.errors.join(', ')}`);
    }
    if (result.hadMacros) {
        console.log(`    Macros deleted, removed files: ${result.removedFiles.join(', ')}`);
    }
    else {
        console.log('    No macros found in the file');
    }
}
async function processTextReplace(inputPath, outputPath, options) {
    console.log('    ========== processTextReplace ==========');
    console.log('    Search text:', options.searchText);
    console.log('    Replace text:', options.replaceText);
    console.log('    Use regex:', options.useRegex);
    console.log('    Case sensitive:', options.caseSensitive);
    console.log('    Whole word:', options.wholeWord);
    console.log('    All options:', JSON.stringify(options, null, 2));
    const { TextProcessor } = await import('../processors/text-processor');
    const processor = new TextProcessor();
    const processorOptions = {
        searchText: options.searchText,
        replaceText: options.replaceText,
        caseSensitive: options.caseSensitive || false,
        wholeWord: options.wholeWord || false,
        useRegex: options.useRegex || false,
        replaceInNotes: options.replaceInNotes || false,
        replaceInTables: options.replaceInTables || false,
        skipHiddenSlides: options.skipHiddenSlides || false,
    };
    console.log('    Processor options:', JSON.stringify(processorOptions, null, 2));
    await processor.replaceText(inputPath, outputPath, processorOptions);
    console.log('    Text replacement completed');
}
async function processExcelRules(inputPath, outputPath, options) {
    console.log('[LOG] processExcelRules started for:', inputPath);
    console.log('    Applying Excel rules...', {
        excelRulesPath: options.excelRulesPath,
    });
    const { ExcelRulesProcessor } = await import('../processors/excel-rules-processor');
    const processor = new ExcelRulesProcessor();
    // 前端传递的是 excelRulesPath，不是 excelPath
    const excelPath = options.excelRulesPath || options.excelPath;
    if (!excelPath) {
        console.error('[LOG] Excel file path is missing!');
        throw new Error('Excel file path is required for excel-rules task');
    }
    // 直接使用 applyRulesToFile 方法
    const result = await processor.applyRulesToFile(inputPath, outputPath, excelPath, options);
    console.log('[LOG] processExcelRules result:', result);
    if (result.status === 'error') {
        console.error('[LOG] processExcelRules failed:', result.error);
        throw createLocalizedError('main.error.ruleApplyFailed', `规则应用失败: ${result.error || '应用Excel规则失败'}`, { message: result.error || '应用Excel规则失败' });
    }
    console.log('    Excel rules applied successfully');
}
async function processTemplateGenerate(inputPath, finalOutputDir, options) {
    console.log('    Generating from template...', {
        dataSourcePath: options.dataSourcePath,
        outputDir: finalOutputDir,
        outputPattern: options.outputPattern,
    });
    const { TemplateEngine } = await import('../services/template-engine');
    const engine = new TemplateEngine();
    const dataSourcePath = options.dataSourcePath || options.dataSource;
    if (!dataSourcePath) {
        throw new Error('Data source is required for template-generate task');
    }
    const template = await engine.loadTemplate(inputPath);
    // 确定最终输出目录（优先使用参数，其次使用 options.outputConfig.directory）
    let outputDir = finalOutputDir;
    if (!outputDir && options.outputConfig?.directory) {
        outputDir = options.outputConfig.directory;
    }
    if (!outputDir) {
        outputDir = path.dirname(inputPath);
    }
    // 确保输出目录存在
    await fs.mkdir(outputDir, { recursive: true });
    const dataList = await engine.parseDataSource(dataSourcePath);
    const outputFiles = await engine.batchGenerate(template, dataList, outputDir, options.outputPattern);
    console.log(`    Generated ${outputFiles.length} files from template`);
    return outputFiles;
}
async function processImageReplace(inputPath, outputPath, options) {
    console.log('    Replacing images...', {
        mode: options.imageReplaceMode,
        targetImage: options.targetImage,
    });
    const { ImageReplacer } = await import('../services/image-replacer');
    const replacer = new ImageReplacer();
    // 前端传递的是 targetImage，不是 newImagePath
    const newImagePath = options.targetImage || options.newImagePath;
    if (!newImagePath) {
        throw new Error('New image path is required for image-replace task');
    }
    const rules = [];
    if (options.imageReplaceMode === 'by-page' && options.targetPageNumber) {
        // 替换指定页的图片
        rules.push({
            matchType: 'page',
            matchValue: options.targetPageNumber,
            newImagePath: newImagePath,
            keepOriginalSize: options.keepImageSize !== false,
        });
    }
    else if (options.imageReplaceMode === 'all-same') {
        // 替换所有相同的图片
        rules.push({
            matchType: 'all',
            newImagePath: newImagePath,
            keepOriginalSize: options.keepImageSize !== false,
            replaceAllSameImages: true,
        });
    }
    else {
        // 默认替换所有图片
        rules.push({
            matchType: 'all',
            newImagePath: newImagePath,
            keepOriginalSize: options.keepImageSize !== false,
        });
    }
    const result = await replacer.replaceImages(inputPath, outputPath, rules);
    if (!result.success) {
        throw new Error(`Failed to replace images: ${result.errors.join(', ')}`);
    }
    console.log(`    Replaced ${result.replacedCount} images`);
}
async function processDeleteBlankPages(inputPath, outputPath, options) {
    console.log('    Deleting blank pages with options:', options);
    const { BlankPageRemover } = await import('../services/blank-page-remover');
    const remover = new BlankPageRemover();
    const blankOptions = {
        hasText: options.hasText !== false,
        hasImages: options.hasImages !== false,
        hasShapes: options.hasShapes !== false,
        ignoreBackground: options.ignoreBackground !== false,
    };
    const result = await remover.removeBlankPages(inputPath, outputPath, blankOptions);
    if (!result.success) {
        throw new Error(`Failed to delete blank pages: ${result.errors.join(', ')}`);
    }
    console.log(`    Deleted ${result.removedCount} blank pages, ${result.remainingCount} pages remaining`);
}
async function handleDownloadFile(filePath) {
    console.log('Download file request:', filePath);
    try {
        const fileName = path.basename(filePath);
        const defaultPath = path.join(require('os').homedir(), 'Downloads', fileName);
        const result = await dialog.showSaveDialog({
            title: getMainDialogText('main.dialog.saveFileTitle'),
            defaultPath,
            filters: [
                { name: 'PowerPoint Files', extensions: ['pptx', 'ppt'] },
                { name: 'PDF Files', extensions: ['pdf'] },
                { name: 'Image Files', extensions: ['png', 'jpg'] },
                { name: 'All Files', extensions: ['*'] },
            ],
        });
        if (result.canceled || !result.filePath) {
            return {
                success: false,
                ...createLocalizedErrorPayload('main.message.userCanceled', '用户取消'),
            };
        }
        await fs.copyFile(filePath, result.filePath);
        console.log('File saved to:', result.filePath);
        return { success: true, savedPath: result.filePath };
    }
    catch (error) {
        console.error('Download file error:', error);
        return { success: false, ...extractLocalizedError(error) };
    }
}
async function handleDownloadAllFiles(filePaths) {
    console.log('Download all files request:', filePaths.length, 'files');
    const result = await dialog.showOpenDialog({
        title: getMainDialogText('main.dialog.selectSaveDirectoryTitle'),
        properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return {
            success: false,
            savedCount: 0,
            errors: [getMainText('main.message.userCanceled', '用户取消')],
        };
    }
    const targetDir = result.filePaths[0];
    const errors = [];
    let savedCount = 0;
    for (const filePath of filePaths) {
        try {
            const fileName = path.basename(filePath);
            const targetPath = path.join(targetDir, fileName);
            await fs.copyFile(filePath, targetPath);
            savedCount++;
            console.log('Saved:', fileName);
        }
        catch (error) {
            const fileName = path.basename(filePath);
            errors.push(`${fileName}: ${extractLocalizedError(error).error}`);
        }
    }
    console.log(`Download complete: ${savedCount}/${filePaths.length} files saved`);
    return {
        success: savedCount > 0,
        savedCount,
        errors,
    };
}
async function handleValidateFiles(filePaths, options) {
    const validationResults = await fileValidator.validateFiles(filePaths, options);
    const results = Array.from(validationResults.entries()).map(([path, result]) => ({
        path,
        valid: result.valid,
        errors: result.errors,
        warnings: result.warnings,
        info: result.info,
    }));
    return {
        valid: results.every((r) => r.valid),
        results,
    };
}
async function handleGetTaskProgress(taskId) {
    return progressTracker.getProgress(taskId);
}
async function handleGetResumableTasks() {
    return taskPersistence.getResumableTasks();
}
async function handleResumeTask(taskId) {
    try {
        const result = await taskPersistence.resumeTask(taskId);
        if (!result) {
            return {
                success: false,
                ...createLocalizedErrorPayload('main.error.taskNotFoundOrNotResumable', getMainText('main.error.taskNotFoundOrNotResumable', '任务不存在或不可恢复')),
            };
        }
        return {
            success: true,
            task: result.task,
            resumeFrom: result.resumeFrom,
            pendingFiles: result.pendingFiles,
        };
    }
    catch (error) {
        return {
            success: false,
            ...extractLocalizedError(error),
        };
    }
}
async function handleGetTaskHistory() {
    return taskPersistence.getAllTasks();
}
async function handleExportTaskHistory(outputPath, format = 'json') {
    try {
        await taskPersistence.exportTaskHistory(outputPath, format);
        return { success: true };
    }
    catch (error) {
        return {
            success: false,
            ...extractLocalizedError(error),
        };
    }
}
