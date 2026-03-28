import { EventEmitter } from 'events';
import { cpus, totalmem } from 'os';
import pLimit from 'p-limit';
/**
 * BatchProcessor 类
 * 负责管理和执行批量处理任务队列
 *
 * 功能:
 * - 任务队列管理 (addTask, start, pause, resume, cancel)
 * - 进度跟踪和事件发送
 * - 错误隔离 (单个文件失败不影响其他文件)
 * - 并发处理控制 (使用 p-limit)
 * - 内存监控和动态调整
 *
 * 验证需求: 20.1, 20.6, 24.2, 24.3
 */
export class BatchProcessor extends EventEmitter {
    constructor(concurrency, memoryConfig) {
        super();
        this.tasks = [];
        this.currentTask = null;
        this.progress = null;
        this.results = [];
        this.isPaused = false;
        this.isCancelled = false;
        this.memoryCheckTimer = null;
        this.currentMemoryUsage = 0;
        /**
         * 默认处理函数（用于向后兼容）
         */
        this.defaultProcessor = async (file) => {
            return {
                inputFile: file.path,
                outputFile: file.path,
                status: 'success'
            };
        };
        // Increase max listeners for property-based testing
        this.setMaxListeners(50);
        // 设置并发数，默认为 CPU 核心数
        this.concurrency = concurrency || cpus().length;
        this.limit = pLimit(this.concurrency);
        // 设置内存监控配置
        this.memoryConfig = {
            maxMemoryUsagePercent: memoryConfig?.maxMemoryUsagePercent || 0.8, // 默认 80%
            checkInterval: memoryConfig?.checkInterval || 1000, // 默认 1 秒
            minConcurrency: memoryConfig?.minConcurrency || 1,
            maxConcurrency: memoryConfig?.maxConcurrency || cpus().length * 2,
            ...memoryConfig
        };
        // 发送初始化事件
        this.emit('processor-initialized', {
            concurrency: this.concurrency,
            memoryConfig: this.memoryConfig
        });
    }
    /**
     * 添加处理任务到队列
     * @param task 任务配置
     * @param processor 自定义处理函数
     */
    addTask(task, processor) {
        // 验证任务配置
        if (!task.id || !task.type || !task.inputFiles || task.inputFiles.length === 0) {
            throw new Error('Invalid task configuration');
        }
        // 设置任务初始状态
        task.status = 'pending';
        task.createdAt = task.createdAt || new Date();
        // 添加到任务队列
        this.tasks.push({
            config: task,
            processor: processor || this.defaultProcessor
        });
        // 发送任务添加事件
        this.emit('task-added', task);
    }
    /**
     * 开始处理任务队列
     * @returns 处理结果数组
     */
    async start() {
        if (this.tasks.length === 0) {
            throw new Error('No tasks in queue');
        }
        // 重置状态
        this.results = [];
        this.isPaused = false;
        this.isCancelled = false;
        // 处理每个任务
        for (const taskItem of this.tasks) {
            const task = taskItem.config;
            const processor = taskItem.processor;
            // 检查是否被取消
            if (this.isCancelled) {
                // 如果任务还没开始，标记为取消
                if (task.status === 'pending') {
                    task.status = 'cancelled';
                }
                this.emit('task-cancelled', task);
                break;
            }
            // 检查是否暂停
            while (this.isPaused && !this.isCancelled) {
                await this.sleep(100);
            }
            // 设置当前任务
            this.currentTask = task;
            task.status = 'running';
            // 初始化进度
            this.progress = {
                totalFiles: task.inputFiles.length,
                completedFiles: 0,
                currentFile: '',
                percentage: 0,
                status: 'running'
            };
            // 发送任务开始事件
            this.emit('task-started', task);
            try {
                // 处理任务中的所有文件
                const taskResults = await this.processTask(task, processor);
                this.results.push(...taskResults);
                // 更新任务状态 - 检查是否被取消
                if (this.isCancelled) {
                    task.status = 'cancelled';
                }
                else {
                    task.status = 'completed';
                    this.emit('task-completed', { task, results: taskResults });
                }
            }
            catch (error) {
                // 任务级错误
                task.status = 'error';
                this.emit('task-error', { task, error });
            }
        }
        // 清空任务队列
        this.tasks = [];
        this.currentTask = null;
        this.progress = null;
        return this.results;
    }
    /**
     * 暂停处理
     */
    pause() {
        if (this.currentTask && this.currentTask.status === 'running') {
            this.isPaused = true;
            if (this.progress) {
                this.progress.status = 'paused';
            }
            this.emit('task-paused', this.currentTask);
        }
    }
    /**
     * 恢复处理
     */
    resume() {
        if (this.isPaused) {
            this.isPaused = false;
            if (this.progress) {
                this.progress.status = 'running';
            }
            this.emit('task-resumed', this.currentTask);
        }
    }
    /**
     * 取消处理
     */
    cancel() {
        this.isCancelled = true;
        if (this.currentTask) {
            this.currentTask.status = 'cancelled';
        }
        if (this.progress) {
            this.progress.status = 'cancelled';
        }
        // 停止内存监控
        this.stopMemoryMonitoring();
        this.emit('task-cancelled', this.currentTask);
    }
    /**
     * 清理资源
     */
    destroy() {
        this.stopMemoryMonitoring();
        this.removeAllListeners();
        this.tasks = [];
        this.currentTask = null;
        this.progress = null;
        this.results = [];
    }
    /**
     * 获取当前进度
     * @returns 进度信息
     */
    getProgress() {
        return this.progress;
    }
    /**
     * 获取当前任务
     * @returns 当前任务配置
     */
    getCurrentTask() {
        return this.currentTask;
    }
    /**
     * 获取任务队列
     * @returns 任务配置数组
     */
    getTasks() {
        return this.tasks.map(t => t.config);
    }
    /**
     * 清空任务队列
     */
    clearTasks() {
        this.tasks = [];
        this.emit('tasks-cleared');
    }
    /**
     * 获取当前并发数
     * @returns 并发数
     */
    getConcurrency() {
        return this.concurrency;
    }
    /**
     * 设置并发数
     * @param concurrency 新的并发数
     */
    setConcurrency(concurrency) {
        if (concurrency < this.memoryConfig.minConcurrency) {
            concurrency = this.memoryConfig.minConcurrency;
        }
        if (concurrency > this.memoryConfig.maxConcurrency) {
            concurrency = this.memoryConfig.maxConcurrency;
        }
        this.concurrency = concurrency;
        this.limit = pLimit(concurrency);
        this.emit('concurrency-changed', { concurrency });
    }
    /**
     * 获取当前内存使用情况
     * @returns 内存使用百分比 (0-1)
     */
    getMemoryUsage() {
        return this.currentMemoryUsage;
    }
    /**
     * 启动内存监控
     */
    startMemoryMonitoring() {
        // 清除现有的定时器
        if (this.memoryCheckTimer) {
            clearInterval(this.memoryCheckTimer);
        }
        // 启动新的定时器
        this.memoryCheckTimer = setInterval(() => {
            this.checkMemoryAndAdjust();
        }, this.memoryConfig.checkInterval);
    }
    /**
     * 停止内存监控
     */
    stopMemoryMonitoring() {
        if (this.memoryCheckTimer) {
            clearInterval(this.memoryCheckTimer);
            this.memoryCheckTimer = null;
        }
    }
    /**
     * 检查内存使用并动态调整并发数
     */
    checkMemoryAndAdjust() {
        const memUsage = process.memoryUsage();
        const totalMemory = totalmem();
        const usedMemory = memUsage.heapUsed + memUsage.external;
        // 计算内存使用百分比
        this.currentMemoryUsage = usedMemory / totalMemory;
        // 发送内存使用事件
        this.emit('memory-usage', {
            usedMemory,
            totalMemory,
            percentage: this.currentMemoryUsage,
            heapUsed: memUsage.heapUsed,
            heapTotal: memUsage.heapTotal,
            external: memUsage.external
        });
        // 如果内存使用超过阈值，降低并发数
        if (this.currentMemoryUsage > this.memoryConfig.maxMemoryUsagePercent) {
            const newConcurrency = Math.max(this.memoryConfig.minConcurrency, Math.floor(this.concurrency * 0.75) // 降低 25%
            );
            if (newConcurrency < this.concurrency) {
                this.setConcurrency(newConcurrency);
                this.emit('concurrency-decreased', {
                    reason: 'high-memory-usage',
                    oldConcurrency: this.concurrency,
                    newConcurrency,
                    memoryUsage: this.currentMemoryUsage
                });
            }
        }
        // 如果内存使用较低，可以尝试增加并发数
        else if (this.currentMemoryUsage < this.memoryConfig.maxMemoryUsagePercent * 0.6) {
            const newConcurrency = Math.min(this.memoryConfig.maxConcurrency, Math.floor(this.concurrency * 1.25) // 增加 25%
            );
            if (newConcurrency > this.concurrency) {
                this.setConcurrency(newConcurrency);
                this.emit('concurrency-increased', {
                    reason: 'low-memory-usage',
                    oldConcurrency: this.concurrency,
                    newConcurrency,
                    memoryUsage: this.currentMemoryUsage
                });
            }
        }
    }
    /**
     * 处理单个任务
     * @param task 任务配置
     * @param processor 自定义处理函数
     * @returns 处理结果数组
     */
    async processTask(task, processor) {
        const results = [];
        // 使用对象来确保线程安全的计数器（通过引用传递）
        const progressState = {
            completedCount: 0
        };
        // 启动内存监控
        this.startMemoryMonitoring();
        try {
            // 使用 p-limit 实现并发控制
            // 为每个文件创建一个限制的 Promise
            const filePromises = task.inputFiles.map((file, index) => this.limit(async () => {
                // 检查是否被取消
                if (this.isCancelled) {
                    return null;
                }
                // 检查是否暂停
                while (this.isPaused && !this.isCancelled) {
                    await this.sleep(100);
                }
                // 再次检查是否被取消（暂停后可能被取消）
                if (this.isCancelled) {
                    return null;
                }
                // 更新进度 - 当前正在处理的文件
                if (this.progress) {
                    this.progress.currentFile = file.name;
                    this.emit('progress-update', this.progress);
                }
                try {
                    console.log(`[BatchProcessor] Processing file: ${file.name}`);
                    console.log(`  - path: ${file.path}`);
                    console.log(`  - taskType: ${task.type}`);
                    // 使用自定义处理函数处理单个文件
                    const result = await processor(file);
                    // 原子性地更新完成计数和进度（在 Node.js 单线程中是安全的）
                    progressState.completedCount++;
                    if (this.progress) {
                        this.progress.completedFiles = progressState.completedCount;
                        this.progress.percentage = Math.round((progressState.completedCount / task.inputFiles.length) * 100);
                        this.emit('progress-update', this.progress);
                    }
                    // 发送文件完成事件
                    this.emit('file-completed', result);
                    return result;
                }
                catch (error) {
                    const msg = error instanceof Error ? error.message : String(error);
                    const stack = error instanceof Error ? error.stack : undefined;
                    console.error(`[BatchProcessor] File processing error: ${file.name}`);
                    console.error(`  - message: ${msg}`);
                    if (stack)
                        console.error(stack);
                    // 文件级错误 - 错误隔离，继续处理其他文件
                    const errorResult = {
                        inputFile: file.path,
                        outputFile: '',
                        status: 'error',
                        error: error instanceof Error ? error.message : String(error)
                    };
                    // 原子性地更新完成计数
                    progressState.completedCount++;
                    if (this.progress) {
                        this.progress.completedFiles = progressState.completedCount;
                        this.progress.percentage = Math.round((progressState.completedCount / task.inputFiles.length) * 100);
                        this.emit('progress-update', this.progress);
                    }
                    // 发送文件错误事件
                    this.emit('file-error', { file, error });
                    return errorResult;
                }
            }));
            // 等待所有文件处理完成
            const fileResults = await Promise.all(filePromises);
            // 过滤掉被取消的结果（null）
            results.push(...fileResults.filter((r) => r !== null));
            // 更新最终进度
            if (this.progress && !this.isCancelled) {
                this.progress.completedFiles = task.inputFiles.length;
                this.progress.percentage = 100;
                this.progress.status = 'completed';
                this.emit('progress-update', this.progress);
            }
        }
        finally {
            // 停止内存监控
            this.stopMemoryMonitoring();
        }
        return results;
    }
    /**
     * 处理单个文件
     * @param file 文件信息
     * @param task 任务配置
     * @returns 处理结果
     */
    async processFile(file, task) {
        // TODO: 实现具体的文件处理逻辑
        // 这里将在后续任务中实现不同类型的处理器
        // 目前返回一个占位结果
        // 模拟处理时间
        await this.sleep(100);
        return {
            inputFile: file.path,
            outputFile: this.generateOutputPath(file, task),
            status: 'success',
            metadata: {
                originalSize: file.size,
                newSize: file.size,
                itemsProcessed: 0
            }
        };
    }
    /**
     * 生成输出文件路径
     * @param file 输入文件信息
     * @param task 任务配置
     * @returns 输出文件路径
     */
    generateOutputPath(file, task) {
        const { directory, fileNamePattern, overwriteOriginal } = task.outputConfig;
        if (overwriteOriginal) {
            return file.path;
        }
        // 简单的文件名生成逻辑
        // TODO: 实现更复杂的文件名模式支持
        const baseName = file.name.replace(/\.[^/.]+$/, '');
        const extension = file.name.match(/\.[^/.]+$/)?.[0] || '';
        const pattern = fileNamePattern || '{name}_processed';
        const fileName = pattern.replace('{name}', baseName) + extension;
        return `${directory}/${fileName}`;
    }
    /**
     * 睡眠函数
     * @param ms 毫秒数
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
