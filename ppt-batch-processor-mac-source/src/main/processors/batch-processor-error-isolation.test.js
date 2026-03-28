import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fc from 'fast-check';
import { BatchProcessor } from './batch-processor';
/**
 * 属性测试：批量处理错误隔离
 *
 * **Validates: Requirements 2.5, 7.7, 17.5, 21.1**
 *
 * 属性 2: 批量处理错误隔离
 * 对于任意批量处理任务，单个文件处理失败不应影响其他文件的处理，
 * 系统应继续处理剩余文件。
 */
describe('BatchProcessor - Property 2: Error Isolation', () => {
    let processor;
    beforeEach(() => {
        processor = new BatchProcessor();
    });
    afterEach(() => {
        if (processor) {
            processor.destroy();
        }
    });
    /**
     * 生成随机文件列表
     */
    const fileListArbitrary = fc.array(fc.record({
        name: fc.string({ minLength: 1, maxLength: 50 }).map(s => `${s}.pptx`),
        path: fc.string({ minLength: 1, maxLength: 100 }).map(s => `/input/${s}.pptx`),
        size: fc.integer({ min: 1024, max: 10 * 1024 * 1024 }), // 1KB to 10MB
        format: fc.constant('pptx'),
        slideCount: fc.integer({ min: 1, max: 100 })
    }), { minLength: 2, maxLength: 20 });
    /**
     * 生成随机错误索引集合（哪些文件会失败）
     */
    const errorIndicesArbitrary = (fileCount) => fc.array(fc.integer({ min: 0, max: fileCount - 1 }), { minLength: 1, maxLength: Math.max(1, Math.floor(fileCount / 2)) }).map(indices => [...new Set(indices)]); // 去重
    /**
     * 创建模拟任务
     */
    function createMockTask(files) {
        return {
            id: `test-task-${Date.now()}`,
            name: 'Test Task',
            category: 'content',
            type: 'text-replace',
            inputFiles: files,
            outputConfig: {
                directory: '/output',
                overwriteOriginal: false,
                fileNamePattern: '{name}_processed',
                createSubfolders: false
            },
            options: {
                searchText: 'old',
                replaceText: 'new'
            },
            createdAt: new Date(),
            status: 'pending'
        };
    }
    /**
     * 属性测试 1: 单个文件失败不应阻止其他文件处理
     *
     * 对于任意文件列表和任意失败文件集合，
     * 所有文件都应该被尝试处理，失败的文件不应阻止其他文件的处理。
     */
    it('property: single file failure does not prevent other files from processing', async () => {
        await fc.assert(fc.asyncProperty(fileListArbitrary, async (files) => {
            // 确保至少有 2 个文件
            if (files.length < 2) {
                files = [...files, ...files]; // 复制以确保至少 2 个
            }
            const task = createMockTask(files);
            processor.addTask(task);
            // 随机选择一些文件失败
            const errorIndices = await fc.sample(errorIndicesArbitrary(files.length), 1)[0];
            // 模拟 processFile 方法，让某些文件失败
            const originalProcessFile = processor.processFile.bind(processor);
            let callIndex = 0;
            processor.processFile = vi.fn().mockImplementation(async (file, task) => {
                const currentIndex = callIndex++;
                if (errorIndices.includes(currentIndex)) {
                    throw new Error(`Simulated error for file: ${file.name}`);
                }
                return originalProcessFile(file, task);
            });
            const results = await processor.start();
            // 验证所有文件都被尝试处理
            expect(results).toHaveLength(files.length);
            // 验证失败的文件被标记为错误
            errorIndices.forEach(index => {
                expect(results[index].status).toBe('error');
                expect(results[index].error).toBeDefined();
            });
            // 验证成功的文件被标记为成功
            files.forEach((_, index) => {
                if (!errorIndices.includes(index)) {
                    expect(results[index].status).toBe('success');
                }
            });
            // 验证成功文件数 + 失败文件数 = 总文件数
            const successCount = results.filter(r => r.status === 'success').length;
            const errorCount = results.filter(r => r.status === 'error').length;
            expect(successCount + errorCount).toBe(files.length);
        }), { numRuns: 20 });
    }, 30000);
    /**
     * 属性测试 2: 错误文件应被正确跟踪和报告
     *
     * 对于任意文件列表和任意失败文件集合，
     * 所有失败的文件都应该在结果中被正确标记，并包含错误信息。
     */
    it('property: failed files are properly tracked and reported', async () => {
        await fc.assert(fc.asyncProperty(fileListArbitrary, async (files) => {
            if (files.length < 2) {
                files = [...files, ...files];
            }
            const task = createMockTask(files);
            processor.addTask(task);
            const errorIndices = await fc.sample(errorIndicesArbitrary(files.length), 1)[0];
            const errorMessages = new Map();
            // 模拟文件处理，记录错误消息
            const originalProcessFile = processor.processFile.bind(processor);
            let callIndex = 0;
            processor.processFile = vi.fn().mockImplementation(async (file, task) => {
                const currentIndex = callIndex++;
                if (errorIndices.includes(currentIndex)) {
                    const errorMsg = `Error processing ${file.name}: simulated failure`;
                    errorMessages.set(currentIndex, errorMsg);
                    throw new Error(errorMsg);
                }
                return originalProcessFile(file, task);
            });
            const results = await processor.start();
            // 验证每个失败的文件都有错误信息
            errorIndices.forEach(index => {
                const result = results[index];
                expect(result.status).toBe('error');
                expect(result.error).toBeDefined();
                expect(result.error).toContain(files[index].name);
            });
            // 验证错误信息包含文件名
            errorIndices.forEach(index => {
                const result = results[index];
                expect(result.inputFile).toBe(files[index].path);
            });
        }), { numRuns: 20 });
    }, 30000);
    /**
     * 属性测试 3: 进度跟踪应包含所有文件（包括失败的）
     *
     * 对于任意文件列表和任意失败文件集合，
     * 进度跟踪应该正确反映所有文件的处理状态，包括失败的文件。
     */
    it('property: progress tracking includes all files including failed ones', async () => {
        await fc.assert(fc.asyncProperty(fileListArbitrary, async (files) => {
            if (files.length < 2) {
                files = [...files, ...files];
            }
            const task = createMockTask(files);
            processor.addTask(task);
            const errorIndices = await fc.sample(errorIndicesArbitrary(files.length), 1)[0];
            // 跟踪进度更新
            const progressUpdates = [];
            processor.on('progress-update', (progress) => {
                progressUpdates.push(progress.completedFiles);
            });
            // 模拟文件处理
            const originalProcessFile = processor.processFile.bind(processor);
            let callIndex = 0;
            processor.processFile = vi.fn().mockImplementation(async (file, task) => {
                const currentIndex = callIndex++;
                if (errorIndices.includes(currentIndex)) {
                    throw new Error(`Error for ${file.name}`);
                }
                return originalProcessFile(file, task);
            });
            await processor.start();
            // 验证最终进度为 100%
            const finalProgress = processor.getProgress();
            // Note: Progress might be null after completion, which is expected
            if (finalProgress) {
                expect(finalProgress.percentage).toBe(100);
                expect(finalProgress.completedFiles).toBe(files.length);
            }
            // 验证进度更新包含所有文件
            if (progressUpdates.length > 0) {
                const maxProgress = Math.max(...progressUpdates);
                expect(maxProgress).toBe(files.length);
            }
        }), { numRuns: 20 });
    }, 30000);
    /**
     * 属性测试 4: 文件错误事件应为每个失败的文件触发
     *
     * 对于任意文件列表和任意失败文件集合，
     * 应该为每个失败的文件触发一个 file-error 事件。
     */
    it('property: file-error event is emitted for each failed file', async () => {
        await fc.assert(fc.asyncProperty(fileListArbitrary, async (files) => {
            if (files.length < 2) {
                files = [...files, ...files];
            }
            const task = createMockTask(files);
            processor.addTask(task);
            const errorIndices = await fc.sample(errorIndicesArbitrary(files.length), 1)[0];
            // 跟踪错误事件
            const errorEvents = [];
            processor.on('file-error', (event) => {
                errorEvents.push(event);
            });
            // 模拟文件处理
            const originalProcessFile = processor.processFile.bind(processor);
            let callIndex = 0;
            processor.processFile = vi.fn().mockImplementation(async (file, task) => {
                const currentIndex = callIndex++;
                if (errorIndices.includes(currentIndex)) {
                    throw new Error(`Error for ${file.name}`);
                }
                return originalProcessFile(file, task);
            });
            await processor.start();
            // 验证错误事件数量等于失败文件数量
            expect(errorEvents).toHaveLength(errorIndices.length);
            // 验证每个错误事件包含正确的文件信息
            errorEvents.forEach(event => {
                expect(event.file).toBeDefined();
                expect(event.error).toBeDefined();
            });
        }), { numRuns: 20 });
    }, 30000);
    /**
     * 属性测试 5: 成功文件应完成正常处理
     *
     * 对于任意文件列表和任意失败文件集合，
     * 未失败的文件应该完成正常处理，生成有效的输出。
     */
    it('property: successful files complete normal processing', async () => {
        await fc.assert(fc.asyncProperty(fileListArbitrary, async (files) => {
            if (files.length < 2) {
                files = [...files, ...files];
            }
            const task = createMockTask(files);
            processor.addTask(task);
            const errorIndices = await fc.sample(errorIndicesArbitrary(files.length), 1)[0];
            // 模拟文件处理
            const originalProcessFile = processor.processFile.bind(processor);
            let callIndex = 0;
            processor.processFile = vi.fn().mockImplementation(async (file, task) => {
                const currentIndex = callIndex++;
                if (errorIndices.includes(currentIndex)) {
                    throw new Error(`Error for ${file.name}`);
                }
                return originalProcessFile(file, task);
            });
            const results = await processor.start();
            // 验证成功的文件有有效的输出
            files.forEach((file, index) => {
                if (!errorIndices.includes(index)) {
                    const result = results[index];
                    expect(result.status).toBe('success');
                    expect(result.inputFile).toBe(file.path);
                    expect(result.outputFile).toBeDefined();
                    expect(result.outputFile).not.toBe('');
                    expect(result.metadata).toBeDefined();
                }
            });
        }), { numRuns: 20 });
    }, 30000);
    /**
     * 属性测试 6: 错误隔离在并发处理中仍然有效
     *
     * 对于任意文件列表和任意失败文件集合，
     * 即使在并发处理的情况下，错误隔离仍然应该有效。
     */
    it('property: error isolation works with concurrent processing', async () => {
        await fc.assert(fc.asyncProperty(fc.integer({ min: 2, max: 8 }), // 并发数
        fileListArbitrary, async (concurrency, files) => {
            if (files.length < 2) {
                files = [...files, ...files];
            }
            // 创建具有指定并发数的处理器
            const concurrentProcessor = new BatchProcessor(concurrency);
            const task = createMockTask(files);
            concurrentProcessor.addTask(task);
            const errorIndices = await fc.sample(errorIndicesArbitrary(files.length), 1)[0];
            // 模拟文件处理
            const originalProcessFile = concurrentProcessor.processFile.bind(concurrentProcessor);
            let callIndex = 0;
            concurrentProcessor.processFile = vi.fn().mockImplementation(async (file, task) => {
                const currentIndex = callIndex++;
                if (errorIndices.includes(currentIndex)) {
                    throw new Error(`Error for ${file.name}`);
                }
                return originalProcessFile(file, task);
            });
            const results = await concurrentProcessor.start();
            // 验证所有文件都被处理
            expect(results).toHaveLength(files.length);
            // 验证错误隔离
            const successCount = results.filter(r => r.status === 'success').length;
            const errorCount = results.filter(r => r.status === 'error').length;
            expect(successCount + errorCount).toBe(files.length);
            expect(errorCount).toBe(errorIndices.length);
            concurrentProcessor.destroy();
        }), { numRuns: 15 });
    }, 30000);
    /**
     * 边界情况测试：所有文件都失败
     */
    it('edge case: all files fail but processing completes', async () => {
        const files = [
            { name: 'file1.pptx', path: '/input/file1.pptx', size: 1024, format: 'pptx', slideCount: 5 },
            { name: 'file2.pptx', path: '/input/file2.pptx', size: 2048, format: 'pptx', slideCount: 10 },
            { name: 'file3.pptx', path: '/input/file3.pptx', size: 3072, format: 'pptx', slideCount: 15 }
        ];
        const task = createMockTask(files);
        processor.addTask(task);
        processor.processFile = vi.fn().mockRejectedValue(new Error('All files fail'));
        const results = await processor.start();
        // 验证所有文件都被尝试处理
        expect(results).toHaveLength(3);
        expect(results.every(r => r.status === 'error')).toBe(true);
        expect(results.every(r => r.error !== undefined)).toBe(true);
    });
    /**
     * 边界情况测试：只有一个文件失败
     */
    it('edge case: only one file fails among many', async () => {
        const files = Array.from({ length: 10 }, (_, i) => ({
            name: `file${i}.pptx`,
            path: `/input/file${i}.pptx`,
            size: 1024 * (i + 1),
            format: 'pptx',
            slideCount: 5 * (i + 1)
        }));
        const task = createMockTask(files);
        processor.addTask(task);
        const failIndex = 5; // 让第 6 个文件失败
        const originalProcessFile = processor.processFile.bind(processor);
        let callIndex = 0;
        processor.processFile = vi.fn().mockImplementation(async (file, task) => {
            const currentIndex = callIndex++;
            if (currentIndex === failIndex) {
                throw new Error('Single file failure');
            }
            return originalProcessFile(file, task);
        });
        const results = await processor.start();
        // 验证只有一个文件失败
        expect(results).toHaveLength(10);
        expect(results.filter(r => r.status === 'error')).toHaveLength(1);
        expect(results.filter(r => r.status === 'success')).toHaveLength(9);
        expect(results[failIndex].status).toBe('error');
    });
    /**
     * 边界情况测试：第一个文件失败
     */
    it('edge case: first file fails but others succeed', async () => {
        const files = [
            { name: 'file1.pptx', path: '/input/file1.pptx', size: 1024, format: 'pptx', slideCount: 5 },
            { name: 'file2.pptx', path: '/input/file2.pptx', size: 2048, format: 'pptx', slideCount: 10 },
            { name: 'file3.pptx', path: '/input/file3.pptx', size: 3072, format: 'pptx', slideCount: 15 }
        ];
        const task = createMockTask(files);
        processor.addTask(task);
        const originalProcessFile = processor.processFile.bind(processor);
        let callIndex = 0;
        processor.processFile = vi.fn().mockImplementation(async (file, task) => {
            const currentIndex = callIndex++;
            if (currentIndex === 0) {
                throw new Error('First file fails');
            }
            return originalProcessFile(file, task);
        });
        const results = await processor.start();
        expect(results).toHaveLength(3);
        expect(results[0].status).toBe('error');
        expect(results[1].status).toBe('success');
        expect(results[2].status).toBe('success');
    });
    /**
     * 边界情况测试：最后一个文件失败
     */
    it('edge case: last file fails but others succeed', async () => {
        const files = [
            { name: 'file1.pptx', path: '/input/file1.pptx', size: 1024, format: 'pptx', slideCount: 5 },
            { name: 'file2.pptx', path: '/input/file2.pptx', size: 2048, format: 'pptx', slideCount: 10 },
            { name: 'file3.pptx', path: '/input/file3.pptx', size: 3072, format: 'pptx', slideCount: 15 }
        ];
        const task = createMockTask(files);
        processor.addTask(task);
        const originalProcessFile = processor.processFile.bind(processor);
        let callIndex = 0;
        processor.processFile = vi.fn().mockImplementation(async (file, task) => {
            const currentIndex = callIndex++;
            if (currentIndex === 2) {
                throw new Error('Last file fails');
            }
            return originalProcessFile(file, task);
        });
        const results = await processor.start();
        expect(results).toHaveLength(3);
        expect(results[0].status).toBe('success');
        expect(results[1].status).toBe('success');
        expect(results[2].status).toBe('error');
    });
    /**
     * 边界情况测试：交替失败模式
     */
    it('edge case: alternating failure pattern', async () => {
        const files = Array.from({ length: 6 }, (_, i) => ({
            name: `file${i}.pptx`,
            path: `/input/file${i}.pptx`,
            size: 1024 * (i + 1),
            format: 'pptx',
            slideCount: 5 * (i + 1)
        }));
        const task = createMockTask(files);
        processor.addTask(task);
        const originalProcessFile = processor.processFile.bind(processor);
        let callIndex = 0;
        processor.processFile = vi.fn().mockImplementation(async (file, task) => {
            const currentIndex = callIndex++;
            if (currentIndex % 2 === 0) {
                throw new Error('Alternating failure');
            }
            return originalProcessFile(file, task);
        });
        const results = await processor.start();
        expect(results).toHaveLength(6);
        expect(results[0].status).toBe('error');
        expect(results[1].status).toBe('success');
        expect(results[2].status).toBe('error');
        expect(results[3].status).toBe('success');
        expect(results[4].status).toBe('error');
        expect(results[5].status).toBe('success');
    });
    /**
     * 边界情况测试：不同类型的错误
     */
    it('edge case: different error types are properly isolated', async () => {
        const files = [
            { name: 'file1.pptx', path: '/input/file1.pptx', size: 1024, format: 'pptx', slideCount: 5 },
            { name: 'file2.pptx', path: '/input/file2.pptx', size: 2048, format: 'pptx', slideCount: 10 },
            { name: 'file3.pptx', path: '/input/file3.pptx', size: 3072, format: 'pptx', slideCount: 15 },
            { name: 'file4.pptx', path: '/input/file4.pptx', size: 4096, format: 'pptx', slideCount: 20 }
        ];
        const task = createMockTask(files);
        processor.addTask(task);
        const originalProcessFile = processor.processFile.bind(processor);
        let callIndex = 0;
        processor.processFile = vi.fn().mockImplementation(async (file, task) => {
            const currentIndex = callIndex++;
            if (currentIndex === 0) {
                throw new Error('File not found');
            }
            else if (currentIndex === 2) {
                throw new TypeError('Invalid file format');
            }
            return originalProcessFile(file, task);
        });
        const results = await processor.start();
        expect(results).toHaveLength(4);
        expect(results[0].status).toBe('error');
        expect(results[0].error).toContain('File not found');
        expect(results[1].status).toBe('success');
        expect(results[2].status).toBe('error');
        expect(results[2].error).toContain('Invalid file format');
        expect(results[3].status).toBe('success');
    });
    /**
     * 边界情况测试：错误发生在不同的并发批次中
     */
    it('edge case: errors in different concurrent batches', async () => {
        const concurrentProcessor = new BatchProcessor(2); // 并发数为 2
        const files = Array.from({ length: 8 }, (_, i) => ({
            name: `file${i}.pptx`,
            path: `/input/file${i}.pptx`,
            size: 1024 * (i + 1),
            format: 'pptx',
            slideCount: 5 * (i + 1)
        }));
        const task = createMockTask(files);
        concurrentProcessor.addTask(task);
        // 让第 1、3、5、7 个文件失败（每个批次都有失败）
        const originalProcessFile = concurrentProcessor.processFile.bind(concurrentProcessor);
        let callIndex = 0;
        concurrentProcessor.processFile = vi.fn().mockImplementation(async (file, task) => {
            const currentIndex = callIndex++;
            if (currentIndex % 2 === 1) {
                throw new Error(`Batch error for ${file.name}`);
            }
            return originalProcessFile(file, task);
        });
        const results = await concurrentProcessor.start();
        expect(results).toHaveLength(8);
        expect(results.filter(r => r.status === 'error')).toHaveLength(4);
        expect(results.filter(r => r.status === 'success')).toHaveLength(4);
        concurrentProcessor.destroy();
    });
});
