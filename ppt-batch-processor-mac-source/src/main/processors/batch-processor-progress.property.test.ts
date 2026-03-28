import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'
import { BatchProcessor } from './batch-processor'
import {
  TaskConfig,
  ProcessProgress,
  FileInfo,
  TaskType,
  TaskCategory
} from '../../shared/types'

/**
 * Property-Based Tests for BatchProcessor Progress Tracking
 * 
 * Feature: ppt-batch-processor
 * Property 14: 进度跟踪一致性
 * 
 * **Validates: Requirements 20.1, 20.2**
 * 
 * Property: For any batch processing task, the progress percentage should equal 
 * (completed files / total files) × 100, and the final progress should be 100%.
 */
describe('BatchProcessor - Property 14: Progress Tracking Consistency', () => {
  let processor: BatchProcessor

  beforeEach(() => {
    processor = new BatchProcessor()
  })

  afterEach(() => {
    if (processor) {
      processor.destroy()
    }
  })

  it('should maintain progress consistency: percentage = (completedFiles / totalFiles) * 100', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary number of files (1-20 to keep tests fast)
        fc.integer({ min: 1, max: 20 }),
        async (fileCount) => {
          // Create a task with the specified number of files
          const task = createMockTask('test-task', fileCount)
          processor.addTask(task)

          // Track all progress updates
          const progressSnapshots: ProcessProgress[] = []
          processor.on('progress-update', (progress: ProcessProgress) => {
            progressSnapshots.push({ ...progress })
          })

          // Execute the task
          await processor.start()

          // Verify property: For each progress update, percentage should equal (completedFiles / totalFiles) * 100
          for (const snapshot of progressSnapshots) {
            const expectedPercentage = Math.round((snapshot.completedFiles / snapshot.totalFiles) * 100)
            expect(snapshot.percentage).toBe(expectedPercentage)
          }

          // Verify property: Final progress should be 100%
          const finalProgress = progressSnapshots[progressSnapshots.length - 1]
          expect(finalProgress.percentage).toBe(100)
          expect(finalProgress.completedFiles).toBe(fileCount)
          expect(finalProgress.totalFiles).toBe(fileCount)

          return true
        }
      ),
      { numRuns: 20, timeout: 30000 }
    )
  }, 30000)

  it('should never exceed 100% progress', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary number of files (1-20)
        fc.integer({ min: 1, max: 20 }),
        async (fileCount) => {
          const task = createMockTask('test-task', fileCount)
          processor.addTask(task)

          // Track all progress updates
          const progressSnapshots: ProcessProgress[] = []
          processor.on('progress-update', (progress: ProcessProgress) => {
            progressSnapshots.push({ ...progress })
          })

          await processor.start()

          // Verify property: Progress percentage should never exceed 100
          for (const snapshot of progressSnapshots) {
            expect(snapshot.percentage).toBeLessThanOrEqual(100)
            expect(snapshot.percentage).toBeGreaterThanOrEqual(0)
          }

          return true
        }
      ),
      { numRuns: 20, timeout: 30000 }
    )
  }, 30000)

  it('should track progress monotonically (percentage should never decrease)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 20 }),
        async (fileCount) => {
          const task = createMockTask('test-task', fileCount)
          processor.addTask(task)

          const percentageHistory: number[] = []
          processor.on('progress-update', (progress: ProcessProgress) => {
            percentageHistory.push(progress.percentage)
          })

          await processor.start()

          // Verify property: percentage should be monotonically non-decreasing
          for (let i = 1; i < percentageHistory.length; i++) {
            expect(percentageHistory[i]).toBeGreaterThanOrEqual(percentageHistory[i - 1])
          }

          return true
        }
      ),
      { numRuns: 20, timeout: 30000 }
    )
  }, 30000)

  it('should emit progress updates during processing', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 15 }),
        async (fileCount) => {
          const task = createMockTask('test-task', fileCount)
          processor.addTask(task)

          let progressUpdateCount = 0
          processor.on('progress-update', () => {
            progressUpdateCount++
          })

          await processor.start()

          // Verify property: Should have at least one progress update
          expect(progressUpdateCount).toBeGreaterThan(0)

          return true
        }
      ),
      { numRuns: 20, timeout: 30000 }
    )
  }, 30000)

  it('should reach 100% completion for any number of files', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 20 }),
        async (fileCount) => {
          const task = createMockTask('test-task', fileCount)
          processor.addTask(task)

          let finalProgress: ProcessProgress | null = null
          processor.on('progress-update', (progress: ProcessProgress) => {
            finalProgress = { ...progress }
          })

          await processor.start()

          // Verify property: Final progress should always be 100%
          expect(finalProgress).not.toBeNull()
          expect(finalProgress?.percentage).toBe(100)
          expect(finalProgress?.completedFiles).toBe(fileCount)
          expect(finalProgress?.totalFiles).toBe(fileCount)

          return true
        }
      ),
      { numRuns: 20, timeout: 30000 }
    )
  }, 30000)
})

// Helper functions

function createMockTask(id: string, fileCount: number): TaskConfig {
  const files: FileInfo[] = Array.from({ length: fileCount }, (_, i) => ({
    name: `file${i}.pptx`,
    path: `/input/file${i}.pptx`,
    size: 1024 * 1024, // 1MB
    format: 'pptx',
    slideCount: 10
  }))

  return {
    id,
    name: 'Test Task',
    category: 'content' as TaskCategory,
    type: 'text-replace' as TaskType,
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
  }
}
