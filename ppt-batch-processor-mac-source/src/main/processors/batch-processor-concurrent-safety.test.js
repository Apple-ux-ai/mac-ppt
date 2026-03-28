// @ts-nocheck
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fc from 'fast-check';
import { BatchProcessor } from './batch-processor';
/**
 * 属性测试：并发处理安全性
 *
 * **Validates: Requirements 5.3**
 *
 * 属性 17: 并发处理安全性
 * 对于任意并发处理的文件集合，每个文件应被独立处理，
 * 不应出现文件间的数据混淆或竞态条件。
 */
describe('BatchProcessor - Property 17: Concurrent Processing Safety', () => {
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
    }), { minLength: 3, maxLength: 20 });
    /**
     * 生成随机并发数
     */
    const concurrencyArbitrary = fc.integer({ min: 2, max: 8 });
    /**
     * 创建模拟任务
     */
    function createMockTask(files) {
        return {
            id: `test-task-${Date.now()}-${Math.random()}`,
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
     * 属性测试 1: 每个文件应被独立处理，不应出现数据混淆
     *
     * 对于任意文件列表和任意并发数，
     * 每个文件的处理结果应该与其输入文件一一对应，不应出现混淆。
     */
    it('property: each file is processed independently without data confusion', async () => {
        await fc.assert(fc.asyncProperty(concurrencyArbitrary, fileListArbitrary, async (concurrency, files) => {
            // 确保至少有 3 个文件
            if (files.length < 3) {
                files = [...files, ...files, ...files].slice(0, 3);
            }
            const concurrentProcessor = new BatchProcessor(concurrency);
            const task = createMockTask(files);
            // 为每个文件创建唯一的处理标记
            const fileMarkers = new Map();
            files.forEach(file => {
                fileMarkers.set(file.path, `marker-${file.path}-${Math.random()}`);
            });
            // 模拟文件处理，每个文件返回其唯一标记
            const originalProcessFile = concurrentProcessor.processFile.bind(concurrentProcessor);
            concurrentProcessor.processFile = vi.fn().mockImplementation(async (file, task) => {
                // 模拟一些处理时间
                await new Promise(resolve => setTimeout(resolve, Math.random() * 50));
                const result = await originalProcessFile(file, task);
                // 在元数据中添加唯一标记
                return {
                    ...result,
                    metadata: {
                        ...result.metadata,
                        marker: fileMarkers.get(file.path)
                    }
                };
            });
            concurrentProcessor.addTask(task);
            const results = await concurrentProcessor.start();
            // 验证每个结果都有正确的标记
            expect(results).toHaveLength(files.length);
            results.forEach((result, index) => {
                const expectedFile = files[index];
                const expectedMarker = fileMarkers.get(expectedFile.path);
                // 验证输入文件路径匹配
                expect(result.inputFile).toBe(expectedFile.path);
                // 验证标记匹配（没有混淆）
                expect(result.metadata?.marker).toBe(expectedMarker);
            });
            concurrentProcessor.destroy();
        }), { numRuns: 50 });
    }, 60000);
    /**
     * 属性测试 2: 并发处理不应导致竞态条件
     *
     * 对于任意文件列表和任意并发数，
     * 多次运行相同的任务应该产生一致的结果。
     */
    it('property: concurrent processing produces consistent results', async () => {
        await fc.assert(fc.asyncProperty(concurrencyArbitrary, fileListArbitrary, async (concurrency, files) => {
            if (files.length < 3) {
                files = [...files, ...files, ...files].slice(0, 3);
            }
            // 运行两次相同的任务
            const results1 = await runTask(concurrency, files);
            const results2 = await runTask(concurrency, files);
            // 验证两次运行的结果一致
            expect(results1).toHaveLength(results2.length);
            // 按输入文件路径排序以便比较
            const sorted1 = [...results1].sort((a, b) => a.inputFile.localeCompare(b.inputFile));
            const sorted2 = [...results2].sort((a, b) => a.inputFile.localeCompare(b.inputFile));
            sorted1.forEach((result1, index) => {
                const result2 = sorted2[index];
                expect(result1.inputFile).toBe(result2.inputFile);
                expect(result1.status).toBe(result2.status);
                // 输出路径应该一致
                expect(result1.outputFile).toBe(result2.outputFile);
            });
        }), { numRuns: 30 });
    }, 60000);
    /**
     * 属性测试 3: 并发处理应正确管理共享资源
     *
     * 对于任意文件列表和任意并发数，
     * 处理器的内部状态（如进度跟踪）应该正确更新，不应出现竞态条件。
     */
    it('property: concurrent processing correctly manages shared state', async () => {
        await fc.assert(fc.asyncProperty(concurrencyArbitrary, fileListArbitrary, async (concurrency, files) => {
            if (files.length < 3) {
                files = [...files, ...files, ...files].slice(0, 3);
            }
            const concurrentProcessor = new BatchProcessor(concurrency);
            const task = createMockTask(files);
            // 跟踪进度更新
            const progressUpdates = [];
            concurrentProcessor.on('progress-update', (progress) => {
                progressUpdates.push(progress.completedFiles);
            });
            concurrentProcessor.addTask(task);
            await concurrentProcessor.start();
            // 验证进度更新是单调递增的（或保持不变）
            for (let i = 1; i < progressUpdates.length; i++) {
                expect(progressUpdates[i]).toBeGreaterThanOrEqual(progressUpdates[i - 1]);
            }
            // 验证最终进度等于文件总数
            if (progressUpdates.length > 0) {
                const finalProgress = progressUpdates[progressUpdates.length - 1];
                expect(finalProgress).toBe(files.length);
            }
            concurrentProcessor.destroy();
        }), { numRuns: 50 });
    }, 60000);
    /**
     * 属性测试 4: 并发处理应正确处理文件完成事件
     *
     * 对于任意文件列表和任意并发数，
     * 应该为每个文件触发一个 file-completed 事件，且事件数量等于文件数量。
     */
    it('property: concurrent processing emits correct number of file-completed events', async () => {
        await fc.assert(fc.asyncProperty(concurrencyArbitrary, fileListArbitrary, async (concurrency, files) => {
            if (files.length < 3) {
                files = [...files, ...files, ...files].slice(0, 3);
            }
            // 确保文件路径唯一（避免重复路径导致的问题）
            files = files.map((file, index) => ({
                ...file,
                path: `${file.path}-${index}` // 添加索引确保唯一性
            }));
            const concurrentProcessor = new BatchProcessor(concurrency);
            const task = createMockTask(files);
            // 跟踪文件完成事件
            const completedFiles = new Set();
            concurrentProcessor.on('file-completed', (result) => {
                completedFiles.add(result.inputFile);
            });
            concurrentProcessor.addTask(task);
            await concurrentProcessor.start();
            // 验证每个文件都触发了完成事件
            expect(completedFiles.size).toBe(files.length);
            // 验证所有文件都在完成集合中
            files.forEach(file => {
                expect(completedFiles.has(file.path)).toBe(true);
            });
            concurrentProcessor.destroy();
        }), { numRuns: 50 });
    }, 60000);
    /**
     * 属性测试 5: 不同并发级别应产生相同的结果
     *
     * 对于任意文件列表，使用不同的并发数处理应该产生相同的结果。
     */
    it('property: different concurrency levels produce same results', async () => {
        await fc.assert(fc.asyncProperty(fileListArbitrary, async (files) => {
            if (files.length < 3) {
                files = [...files, ...files, ...files].slice(0, 3);
            }
            // 使用不同的并发数运行任务
            const results1 = await runTask(1, files); // 串行
            const results2 = await runTask(2, files); // 并发 2
            const results4 = await runTask(4, files); // 并发 4
            // 按输入文件路径排序以便比较
            const sorted1 = [...results1].sort((a, b) => a.inputFile.localeCompare(b.inputFile));
            const sorted2 = [...results2].sort((a, b) => a.inputFile.localeCompare(b.inputFile));
            const sorted4 = [...results4].sort((a, b) => a.inputFile.localeCompare(b.inputFile));
            // 验证所有结果一致
            expect(sorted1).toHaveLength(files.length);
            expect(sorted2).toHaveLength(files.length);
            expect(sorted4).toHaveLength(files.length);
            sorted1.forEach((result1, index) => {
                const result2 = sorted2[index];
                const result4 = sorted4[index];
                expect(result1.inputFile).toBe(result2.inputFile);
                expect(result1.inputFile).toBe(result4.inputFile);
                expect(result1.status).toBe(result2.status);
                expect(result1.status).toBe(result4.status);
                expect(result1.outputFile).toBe(result2.outputFile);
                expect(result1.outputFile).toBe(result4.outputFile);
            });
        }), { numRuns: 30 });
    }, 60000);
    /**
     * 属性测试 6: 并发处理应正确处理资源清理
     *
     * 对于任意文件列表和任意并发数，
     * 处理完成后应该正确清理资源，不应有资源泄漏。
     */
    it('property: concurrent processing properly cleans up resources', async () => {
        await fc.assert(fc.asyncProperty(concurrencyArbitrary, fileListArbitrary, async (concurrency, files) => {
            if (files.length < 3) {
                files = [...files, ...files, ...files].slice(0, 3);
            }
            const concurrentProcessor = new BatchProcessor(concurrency);
            const task = createMockTask(files);
            concurrentProcessor.addTask(task);
            await concurrentProcessor.start();
            // 验证任务队列已清空
            expect(concurrentProcessor.getTasks()).toHaveLength(0);
            // 验证当前任务已清空
            expect(concurrentProcessor.getCurrentTask()).toBeNull();
            // 验证进度已清空
            expect(concurrentProcessor.getProgress()).toBeNull();
            concurrentProcessor.destroy();
        }), { numRuns: 50 });
    }, 60000);
    /**
     * 边界情况测试：单个文件（无并发）
     */
    it('edge case: single file with concurrency', async () => {
        const concurrentProcessor = new BatchProcessor(4);
        const files = [
            { name: 'single.pptx', path: '/input/single.pptx', size: 1024, format: 'pptx', slideCount: 5 }
        ];
        const task = createMockTask(files);
        concurrentProcessor.addTask(task);
        const results = await concurrentProcessor.start();
        expect(results).toHaveLength(1);
        expect(results[0].status).toBe('success');
        expect(results[0].inputFile).toBe(files[0].path);
        concurrentProcessor.destroy();
    });
    /**
     * 边界情况测试：文件数等于并发数
     */
    it('edge case: file count equals concurrency', async () => {
        const concurrency = 4;
        const concurrentProcessor = new BatchProcessor(concurrency);
        const files = Array.from({ length: concurrency }, (_, i) => ({
            name: `file${i}.pptx`,
            path: `/input/file${i}.pptx`,
            size: 1024 * (i + 1),
            format: 'pptx',
            slideCount: 5 * (i + 1)
        }));
        const task = createMockTask(files);
        concurrentProcessor.addTask(task);
        const results = await concurrentProcessor.start();
        expect(results).toHaveLength(concurrency);
        expect(results.every(r => r.status === 'success')).toBe(true);
        concurrentProcessor.destroy();
    });
    /**
     * 边界情况测试：文件数少于并发数
     */
    it('edge case: fewer files than concurrency', async () => {
        const concurrentProcessor = new BatchProcessor(8);
        const files = [
            { name: 'file1.pptx', path: '/input/file1.pptx', size: 1024, format: 'pptx', slideCount: 5 },
            { name: 'file2.pptx', path: '/input/file2.pptx', size: 2048, format: 'pptx', slideCount: 10 }
        ];
        const task = createMockTask(files);
        concurrentProcessor.addTask(task);
        const results = await concurrentProcessor.start();
        expect(results).toHaveLength(2);
        expect(results.every(r => r.status === 'success')).toBe(true);
        concurrentProcessor.destroy();
    });
    /**
     * 边界情况测试：文件数远大于并发数
     */
    it('edge case: many more files than concurrency', async () => {
        const concurrentProcessor = new BatchProcessor(2);
        const files = Array.from({ length: 20 }, (_, i) => ({
            name: `file${i}.pptx`,
            path: `/input/file${i}.pptx`,
            size: 1024 * (i + 1),
            format: 'pptx',
            slideCount: 5 * (i + 1)
        }));
        const task = createMockTask(files);
        concurrentProcessor.addTask(task);
        const results = await concurrentProcessor.start();
        expect(results).toHaveLength(20);
        expect(results.every(r => r.status === 'success')).toBe(true);
        concurrentProcessor.destroy();
    });
    /**
     * 边界情况测试：并发处理中的错误隔离
     */
    it('edge case: error isolation in concurrent processing', async () => {
        const concurrentProcessor = new BatchProcessor(4);
        const files = Array.from({ length: 10 }, (_, i) => ({
            name: `file${i}.pptx`,
            path: `/input/file${i}.pptx`,
            size: 1024 * (i + 1),
            format: 'pptx',
            slideCount: 5 * (i + 1)
        }));
        const task = createMockTask(files);
        // 让某些文件失败
        const originalProcessFile = concurrentProcessor.processFile.bind(concurrentProcessor);
        let callIndex = 0;
        concurrentProcessor.processFile = vi.fn().mockImplementation(async (file, task) => {
            const currentIndex = callIndex++;
            if (currentIndex % 3 === 0) {
                throw new Error(`Error for ${file.name}`);
            }
            return originalProcessFile(file, task);
        });
        concurrentProcessor.addTask(task);
        const results = await concurrentProcessor.start();
        // 验证所有文件都被处理
        expect(results).toHaveLength(10);
        // 验证错误和成功的文件数量
        const errorCount = results.filter(r => r.status === 'error').length;
        const successCount = results.filter(r => r.status === 'success').length;
        expect(errorCount + successCount).toBe(10);
        concurrentProcessor.destroy();
    });
    /**
     * 边界情况测试：快速连续的并发任务
     */
    it('edge case: rapid concurrent task execution', async () => {
        const concurrentProcessor = new BatchProcessor(4);
        const files = Array.from({ length: 5 }, (_, i) => ({
            name: `file${i}.pptx`,
            path: `/input/file${i}.pptx`,
            size: 1024 * (i + 1),
            format: 'pptx',
            slideCount: 5 * (i + 1)
        }));
        // 快速添加多个任务
        const task1 = createMockTask(files);
        const task2 = createMockTask(files.map(f => ({ ...f, path: f.path.replace('input', 'input2') })));
        concurrentProcessor.addTask(task1);
        concurrentProcessor.addTask(task2);
        const results = await concurrentProcessor.start();
        // 验证所有文件都被处理
        expect(results).toHaveLength(10);
        expect(results.every(r => r.status === 'success')).toBe(true);
        concurrentProcessor.destroy();
    });
    /**
     * 边界情况测试：并发处理中的暂停和恢复
     */
    it('edge case: pause and resume during concurrent processing', async () => {
        const concurrentProcessor = new BatchProcessor(2);
        const files = Array.from({ length: 10 }, (_, i) => ({
            name: `file${i}.pptx`,
            path: `/input/file${i}.pptx`,
            size: 1024 * (i + 1),
            format: 'pptx',
            slideCount: 5 * (i + 1)
        }));
        const task = createMockTask(files);
        concurrentProcessor.addTask(task);
        // 启动处理并快速暂停
        const startPromise = concurrentProcessor.start();
        await new Promise(resolve => setTimeout(resolve, 50));
        concurrentProcessor.pause();
        await new Promise(resolve => setTimeout(resolve, 100));
        concurrentProcessor.resume();
        const results = await startPromise;
        // 验证所有文件最终都被处理
        expect(results).toHaveLength(10);
        expect(results.every(r => r.status === 'success')).toBe(true);
        concurrentProcessor.destroy();
    });
    /**
     * 边界情况测试：并发处理中的取消
     */
    it('edge case: cancel during concurrent processing', async () => {
        const concurrentProcessor = new BatchProcessor(2);
        const files = Array.from({ length: 20 }, (_, i) => ({
            name: `file${i}.pptx`,
            path: `/input/file${i}.pptx`,
            size: 1024 * (i + 1),
            format: 'pptx',
            slideCount: 5 * (i + 1)
        }));
        const task = createMockTask(files);
        concurrentProcessor.addTask(task);
        // 启动处理并快速取消
        const startPromise = concurrentProcessor.start();
        await new Promise(resolve => setTimeout(resolve, 50));
        concurrentProcessor.cancel();
        const results = await startPromise;
        // 验证任务被取消
        expect(task.status).toBe('cancelled');
        // 某些文件可能在取消前完成
        expect(results.length).toBeLessThanOrEqual(files.length);
        concurrentProcessor.destroy();
    });
    /**
     * 边界情况测试：极高并发数
     */
    it('edge case: very high concurrency', async () => {
        const concurrentProcessor = new BatchProcessor(16);
        const files = Array.from({ length: 10 }, (_, i) => ({
            name: `file${i}.pptx`,
            path: `/input/file${i}.pptx`,
            size: 1024 * (i + 1),
            format: 'pptx',
            slideCount: 5 * (i + 1)
        }));
        const task = createMockTask(files);
        concurrentProcessor.addTask(task);
        const results = await concurrentProcessor.start();
        expect(results).toHaveLength(10);
        expect(results.every(r => r.status === 'success')).toBe(true);
        concurrentProcessor.destroy();
    });
    /**
     * 边界情况测试：并发处理相同文件名（不同路径）
     */
    it('edge case: concurrent processing of files with same name but different paths', async () => {
        const concurrentProcessor = new BatchProcessor(4);
        const files = [
            { name: 'test.pptx', path: '/input/dir1/test.pptx', size: 1024, format: 'pptx', slideCount: 5 },
            { name: 'test.pptx', path: '/input/dir2/test.pptx', size: 2048, format: 'pptx', slideCount: 10 },
            { name: 'test.pptx', path: '/input/dir3/test.pptx', size: 3072, format: 'pptx', slideCount: 15 },
            { name: 'test.pptx', path: '/input/dir4/test.pptx', size: 4096, format: 'pptx', slideCount: 20 }
        ];
        const task = createMockTask(files);
        concurrentProcessor.addTask(task);
        const results = await concurrentProcessor.start();
        // 验证每个文件都被正确处理，没有混淆
        expect(results).toHaveLength(4);
        expect(results.every(r => r.status === 'success')).toBe(true);
        // 验证每个结果对应正确的输入文件
        files.forEach((file, index) => {
            expect(results[index].inputFile).toBe(file.path);
        });
        concurrentProcessor.destroy();
    });
});
/**
 * 辅助函数：运行任务并返回结果
 */
async function runTask(concurrency, files) {
    const processor = new BatchProcessor(concurrency);
    const task = {
        id: `test-task-${Date.now()}-${Math.random()}`,
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
    processor.addTask(task);
    const results = await processor.start();
    processor.destroy();
    return results;
}
