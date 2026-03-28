import { EventEmitter } from 'events';
export var ProgressStage;
(function (ProgressStage) {
    ProgressStage["INITIALIZING"] = "initializing";
    ProgressStage["VALIDATING"] = "validating";
    ProgressStage["BACKING_UP"] = "backing_up";
    ProgressStage["PROCESSING"] = "processing";
    ProgressStage["CONVERTING"] = "converting";
    ProgressStage["FINALIZING"] = "finalizing";
    ProgressStage["COMPLETED"] = "completed";
})(ProgressStage || (ProgressStage = {}));
export class ProgressTracker extends EventEmitter {
    constructor() {
        super(...arguments);
        this.tasks = new Map();
        this.callbacks = new Map();
        this.fileStartTimes = new Map();
        this.fileProcessingTimes = [];
        this.maxTimeSamples = 100;
    }
    createTask(taskId, taskType, totalFiles) {
        const progress = {
            taskId,
            taskType,
            totalFiles,
            processedFiles: 0,
            failedFiles: 0,
            currentFileIndex: -1,
            overallProgress: 0,
            stage: ProgressStage.INITIALIZING,
            startTime: Date.now(),
            elapsedTime: 0,
            status: 'pending',
            errors: [],
            warnings: [],
        };
        this.tasks.set(taskId, progress);
        this.callbacks.set(taskId, new Set());
        this.emitUpdate(taskId, 'task', progress);
        return progress;
    }
    registerCallback(taskId, callback) {
        const callbacks = this.callbacks.get(taskId);
        if (callbacks) {
            callbacks.add(callback);
        }
        return () => {
            callbacks?.delete(callback);
        };
    }
    startTask(taskId) {
        const progress = this.tasks.get(taskId);
        if (!progress)
            return;
        progress.status = 'running';
        progress.stage = ProgressStage.VALIDATING;
        progress.startTime = Date.now();
        this.emitUpdate(taskId, 'stage', progress);
    }
    setStage(taskId, stage, operation, operationKey, operationParams) {
        const progress = this.tasks.get(taskId);
        if (!progress)
            return;
        progress.stage = stage;
        if (progress.currentFile) {
            progress.currentFile.stage = stage;
            if (operation) {
                progress.currentFile.currentOperation = operation;
            }
            if (operationKey) {
                progress.currentFile.currentOperationKey = operationKey;
            }
            if (operationParams) {
                progress.currentFile.currentOperationParams = operationParams;
            }
        }
        this.emitUpdate(taskId, 'stage', progress);
    }
    startFile(taskId, filePath, fileSize) {
        const progress = this.tasks.get(taskId);
        if (!progress)
            return;
        const fileName = filePath.split(/[/\\]/).pop() || filePath;
        const fileKey = `${taskId}:${filePath}`;
        progress.currentFileIndex++;
        progress.currentFile = {
            fileName,
            filePath,
            fileSize,
            stage: ProgressStage.PROCESSING,
            progress: 0,
            currentOperation: '正在处理...',
            currentOperationKey: 'main.progress.processing',
            startTime: Date.now(),
        };
        this.fileStartTimes.set(fileKey, Date.now());
        this.calculateOverallProgress(progress);
        this.emitUpdate(taskId, 'file', progress);
    }
    updateFileProgress(taskId, progressPercent, operation, operationKey, operationParams) {
        const progress = this.tasks.get(taskId);
        if (!progress?.currentFile)
            return;
        progress.currentFile.progress = Math.min(100, Math.max(0, progressPercent));
        if (operation) {
            progress.currentFile.currentOperation = operation;
        }
        if (operationKey) {
            progress.currentFile.currentOperationKey = operationKey;
        }
        if (operationParams) {
            progress.currentFile.currentOperationParams = operationParams;
        }
        if (progress.currentFile.startTime > 0) {
            const elapsed = Date.now() - progress.currentFile.startTime;
            if (progress.currentFile.progress > 0 && progress.currentFile.progress < 100) {
                const estimatedTotal = elapsed / (progress.currentFile.progress / 100);
                progress.currentFile.estimatedTimeRemaining = Math.round(estimatedTotal - elapsed);
            }
        }
        this.calculateOverallProgress(progress);
        this.emitUpdate(taskId, 'file', progress);
    }
    completeFile(taskId, filePath, success = true) {
        const progress = this.tasks.get(taskId);
        if (!progress)
            return;
        const fileKey = `${taskId}:${filePath}`;
        const startTime = this.fileStartTimes.get(fileKey);
        if (startTime) {
            const processingTime = Date.now() - startTime;
            this.recordProcessingTime(processingTime);
            this.fileStartTimes.delete(fileKey);
        }
        if (success) {
            progress.processedFiles++;
        }
        else {
            progress.failedFiles++;
        }
        if (progress.currentFile) {
            progress.currentFile.progress = 100;
            progress.currentFile.stage = ProgressStage.COMPLETED;
        }
        this.calculateOverallProgress(progress);
        this.calculateTimeEstimates(progress);
        this.emitUpdate(taskId, 'file', progress);
    }
    addError(taskId, fileName, error) {
        const progress = this.tasks.get(taskId);
        if (!progress)
            return;
        progress.errors.push({ fileName, error });
        progress.failedFiles++;
        if (progress.currentFile) {
            progress.currentFile.error = error;
        }
        this.emitUpdate(taskId, 'error', progress, { errors: progress.errors });
    }
    addWarning(taskId, fileName, warning) {
        const progress = this.tasks.get(taskId);
        if (!progress)
            return;
        progress.warnings.push({ fileName, warning });
        if (progress.currentFile) {
            progress.currentFile.warning = warning;
        }
        this.emitUpdate(taskId, 'warning', progress, { warnings: progress.warnings });
    }
    pauseTask(taskId) {
        const progress = this.tasks.get(taskId);
        if (!progress)
            return;
        progress.status = 'paused';
        this.emitUpdate(taskId, 'task', progress);
    }
    resumeTask(taskId) {
        const progress = this.tasks.get(taskId);
        if (!progress)
            return;
        progress.status = 'running';
        this.emitUpdate(taskId, 'task', progress);
    }
    completeTask(taskId, success = true) {
        const progress = this.tasks.get(taskId);
        if (!progress)
            return;
        progress.status = success ? 'completed' : 'error';
        progress.stage = ProgressStage.COMPLETED;
        progress.overallProgress = 100;
        progress.elapsedTime = Date.now() - progress.startTime;
        if (progress.currentFile) {
            progress.currentFile.progress = 100;
            progress.currentFile.stage = ProgressStage.COMPLETED;
        }
        this.emitUpdate(taskId, 'complete', progress);
    }
    cancelTask(taskId) {
        const progress = this.tasks.get(taskId);
        if (!progress)
            return;
        progress.status = 'cancelled';
        progress.elapsedTime = Date.now() - progress.startTime;
        this.emitUpdate(taskId, 'task', progress);
    }
    getProgress(taskId) {
        const progress = this.tasks.get(taskId);
        if (!progress)
            return undefined;
        return { ...progress };
    }
    getAllProgress() {
        return Array.from(this.tasks.values()).map((p) => ({ ...p }));
    }
    clearTask(taskId) {
        this.tasks.delete(taskId);
        this.callbacks.delete(taskId);
        for (const key of this.fileStartTimes.keys()) {
            if (key.startsWith(taskId)) {
                this.fileStartTimes.delete(key);
            }
        }
    }
    calculateOverallProgress(progress) {
        const fileWeight = progress.totalFiles > 0 ? 100 / progress.totalFiles : 0;
        const completedProgress = progress.processedFiles * fileWeight;
        const currentFileWeight = progress.currentFile
            ? (progress.currentFile.progress / 100) * fileWeight
            : 0;
        progress.overallProgress = Math.round(completedProgress + currentFileWeight);
        progress.elapsedTime = Date.now() - progress.startTime;
    }
    calculateTimeEstimates(progress) {
        if (this.fileProcessingTimes.length === 0)
            return;
        const avgTime = this.getAverageProcessingTime();
        const remainingFiles = progress.totalFiles - progress.processedFiles - progress.failedFiles;
        progress.averageFileTime = avgTime;
        progress.estimatedTimeRemaining = Math.round(avgTime * remainingFiles);
        progress.filesPerMinute = avgTime > 0 ? Math.round(60000 / avgTime) : 0;
    }
    recordProcessingTime(time) {
        this.fileProcessingTimes.push(time);
        if (this.fileProcessingTimes.length > this.maxTimeSamples) {
            this.fileProcessingTimes.shift();
        }
    }
    getAverageProcessingTime() {
        if (this.fileProcessingTimes.length === 0)
            return 0;
        const sorted = [...this.fileProcessingTimes].sort((a, b) => a - b);
        const q1 = sorted[Math.floor(sorted.length * 0.25)];
        const q3 = sorted[Math.floor(sorted.length * 0.75)];
        const iqr = q3 - q1;
        const lowerBound = q1 - 1.5 * iqr;
        const upperBound = q3 + 1.5 * iqr;
        const filtered = this.fileProcessingTimes.filter((t) => t >= lowerBound && t <= upperBound);
        if (filtered.length === 0)
            return 0;
        return filtered.reduce((a, b) => a + b, 0) / filtered.length;
    }
    emitUpdate(taskId, type, progress, delta) {
        const update = {
            type,
            taskId,
            progress: { ...progress },
            timestamp: Date.now(),
            delta,
        };
        this.emit('progress', update);
        const callbacks = this.callbacks.get(taskId);
        if (callbacks) {
            for (const callback of callbacks) {
                try {
                    callback(update);
                }
                catch (e) {
                    console.error('Progress callback error:', e);
                }
            }
        }
    }
}
export const progressTracker = new ProgressTracker();
