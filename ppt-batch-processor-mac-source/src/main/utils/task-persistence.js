import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { createHash } from 'crypto';
import { ErrorCode, AppError } from './error-codes';
const DEFAULT_CONFIG = {
    storageDir: '',
    maxStoredTasks: 100,
    autoSaveInterval: 5000,
    retentionDays: 7
};
class TaskPersistenceService {
    constructor(config) {
        this.tasks = new Map();
        this.autoSaveTimers = new Map();
        this.initialized = false;
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.storagePath = this.config.storageDir || path.join(app.getPath('userData'), 'task-storage');
    }
    async initialize() {
        if (this.initialized)
            return;
        try {
            await this.ensureDirectory(this.storagePath);
            await this.loadAllTasks();
            await this.cleanupExpiredTasks();
            this.initialized = true;
        }
        catch (error) {
            console.error('Failed to initialize task persistence:', error);
            throw AppError.fromError(error, ErrorCode.TEMP_DIR_CREATION_FAILED);
        }
    }
    async saveTask(task) {
        task.updatedAt = Date.now();
        const taskPath = this.getTaskPath(task.id);
        const tempPath = `${taskPath}.tmp`;
        try {
            const content = JSON.stringify(task, null, 2);
            await fs.promises.writeFile(tempPath, content, 'utf-8');
            await fs.promises.rename(tempPath, taskPath);
            this.tasks.set(task.id, task);
        }
        catch (error) {
            console.error(`Failed to save task ${task.id}:`, error);
            throw AppError.fromError(error, ErrorCode.BACKUP_FAILED);
        }
    }
    async loadTask(taskId) {
        const cached = this.tasks.get(taskId);
        if (cached)
            return cached;
        const taskPath = this.getTaskPath(taskId);
        try {
            const content = await fs.promises.readFile(taskPath, 'utf-8');
            const task = JSON.parse(content);
            this.tasks.set(taskId, task);
            return task;
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                return null;
            }
            console.error(`Failed to load task ${taskId}:`, error);
            return null;
        }
    }
    async deleteTask(taskId) {
        const taskPath = this.getTaskPath(taskId);
        try {
            await fs.promises.unlink(taskPath);
            this.tasks.delete(taskId);
            this.stopAutoSave(taskId);
        }
        catch (error) {
            if (error.code !== 'ENOENT') {
                console.error(`Failed to delete task ${taskId}:`, error);
            }
        }
    }
    async getAllTasks() {
        return Array.from(this.tasks.values());
    }
    async getResumableTasks() {
        const tasks = await this.getAllTasks();
        return tasks.filter(t => t.status === 'paused' ||
            (t.status === 'error' && t.checkpoint && t.checkpoint.lastProcessedIndex < t.files.length - 1));
    }
    async createCheckpoint(taskId, processedIndex, partialResults) {
        const task = await this.loadTask(taskId);
        if (!task)
            return;
        task.checkpoint = {
            lastProcessedIndex: processedIndex,
            processedFiles: task.files
                .filter(f => f.status === 'completed')
                .map(f => f.path),
            failedFiles: task.files
                .filter(f => f.status === 'failed')
                .map(f => f.path),
            partialResults: partialResults || {}
        };
        await this.saveTask(task);
    }
    async updateFileStatus(taskId, filePath, status, output, error) {
        const task = await this.loadTask(taskId);
        if (!task)
            return;
        const file = task.files.find(f => f.path === filePath);
        if (file) {
            file.status = status;
            if (output)
                file.output = output;
            if (error)
                file.error = error;
            if (status === 'completed' || status === 'failed') {
                file.processedAt = Date.now();
            }
        }
        await this.saveTask(task);
    }
    async calculateFileHash(filePath) {
        return new Promise((resolve, reject) => {
            const hash = createHash('md5');
            const stream = fs.createReadStream(filePath);
            stream.on('data', (chunk) => hash.update(chunk));
            stream.on('end', () => resolve(hash.digest('hex')));
            stream.on('error', reject);
        });
    }
    startAutoSave(taskId, getTaskData) {
        this.stopAutoSave(taskId);
        const timer = setInterval(async () => {
            try {
                const task = getTaskData();
                await this.saveTask(task);
            }
            catch (error) {
                console.error(`Auto-save failed for task ${taskId}:`, error);
            }
        }, this.config.autoSaveInterval);
        this.autoSaveTimers.set(taskId, timer);
    }
    stopAutoSave(taskId) {
        const timer = this.autoSaveTimers.get(taskId);
        if (timer) {
            clearInterval(timer);
            this.autoSaveTimers.delete(taskId);
        }
    }
    async resumeTask(taskId) {
        const task = await this.loadTask(taskId);
        if (!task)
            return null;
        if (task.status !== 'paused' && task.status !== 'error') {
            return null;
        }
        const resumeFrom = task.checkpoint?.lastProcessedIndex ?? -1;
        const pendingFiles = task.files.filter((f, i) => i > resumeFrom && f.status === 'pending');
        return { task, resumeFrom: resumeFrom + 1, pendingFiles };
    }
    async exportTaskHistory(outputPath, format = 'json') {
        const tasks = await this.getAllTasks();
        if (format === 'json') {
            await fs.promises.writeFile(outputPath, JSON.stringify(tasks, null, 2), 'utf-8');
        }
        else {
            const headers = ['ID', 'Type', 'Status', 'Created', 'Updated', 'Total Files', 'Processed', 'Failed'];
            const rows = tasks.map(t => [
                t.id,
                t.type,
                t.status,
                new Date(t.createdAt).toISOString(),
                new Date(t.updatedAt).toISOString(),
                t.files.length,
                t.progress.processedFiles,
                t.progress.failedFiles
            ]);
            const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
            await fs.promises.writeFile(outputPath, csv, 'utf-8');
        }
    }
    async loadAllTasks() {
        try {
            const files = await fs.promises.readdir(this.storagePath);
            const taskFiles = files.filter(f => f.endsWith('.json'));
            for (const file of taskFiles) {
                try {
                    const content = await fs.promises.readFile(path.join(this.storagePath, file), 'utf-8');
                    const task = JSON.parse(content);
                    this.tasks.set(task.id, task);
                }
                catch (e) {
                    console.error(`Failed to load task file ${file}:`, e);
                }
            }
            if (this.tasks.size > this.config.maxStoredTasks) {
                await this.cleanupOldestTasks();
            }
        }
        catch (error) {
            if (error.code !== 'ENOENT') {
                throw error;
            }
        }
    }
    async cleanupExpiredTasks() {
        const now = Date.now();
        const expirationTime = this.config.retentionDays * 24 * 60 * 60 * 1000;
        for (const [id, task] of this.tasks) {
            if (task.status === 'completed' || task.status === 'cancelled') {
                if (now - task.updatedAt > expirationTime) {
                    await this.deleteTask(id);
                }
            }
        }
    }
    async cleanupOldestTasks() {
        const sortedTasks = Array.from(this.tasks.values())
            .sort((a, b) => a.updatedAt - b.updatedAt);
        const toRemove = sortedTasks.slice(0, sortedTasks.length - this.config.maxStoredTasks);
        for (const task of toRemove) {
            await this.deleteTask(task.id);
        }
    }
    async ensureDirectory(dir) {
        try {
            await fs.promises.mkdir(dir, { recursive: true });
        }
        catch (error) {
            if (error.code !== 'EEXIST') {
                throw error;
            }
        }
    }
    getTaskPath(taskId) {
        return path.join(this.storagePath, `${taskId}.json`);
    }
}
export const taskPersistence = new TaskPersistenceService();
