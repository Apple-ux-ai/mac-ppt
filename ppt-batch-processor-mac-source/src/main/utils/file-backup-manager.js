import fs from 'fs/promises';
import path from 'path';
import { randomBytes } from 'crypto';
/**
 * FileBackupManager - 文件备份管理器
 *
 * 负责在覆盖文件前自动备份，并提供恢复功能
 *
 * 验证需求:
 * - 22.2: 支持文件备份和恢复功能
 */
export class FileBackupManager {
    constructor(customBackupDir) {
        // 备份记录：原文件路径 -> 备份文件路径
        this.backupRegistry = new Map();
        // 使用自定义备份目录或默认备份目录（在用户主目录下）
        this.backupDir = customBackupDir || path.join(process.env.USERPROFILE || process.env.HOME || '.', FileBackupManager.DEFAULT_BACKUP_DIR);
    }
    /**
     * 初始化备份目录
     * 确保备份目录存在
     */
    async initialize() {
        try {
            await fs.mkdir(this.backupDir, { recursive: true });
        }
        catch (error) {
            throw new Error(`无法创建备份目录: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * 备份文件
     * 在覆盖文件前自动备份
     *
     * @param filePath - 要备份的文件路径
     * @returns 备份信息
     */
    async backupFile(filePath) {
        // 确保备份目录存在
        await this.initialize();
        // 检查文件是否存在
        try {
            await fs.access(filePath);
        }
        catch {
            throw new Error(`文件不存在: ${filePath}`);
        }
        // 生成备份文件路径
        const backupPath = await this.generateBackupPath(filePath);
        // 复制文件到备份位置
        try {
            await fs.copyFile(filePath, backupPath);
            // 获取文件信息
            const stats = await fs.stat(filePath);
            // 创建备份信息
            const backupInfo = {
                originalPath: filePath,
                backupPath: backupPath,
                timestamp: new Date(),
                size: stats.size,
                checksum: await this.calculateChecksum(filePath)
            };
            // 记录备份
            this.backupRegistry.set(filePath, backupInfo);
            return backupInfo;
        }
        catch (error) {
            throw new Error(`备份文件失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * 批量备份文件
     *
     * @param filePaths - 要备份的文件路径数组
     * @returns 备份信息数组
     */
    async backupFiles(filePaths) {
        const backupInfos = [];
        for (const filePath of filePaths) {
            try {
                const backupInfo = await this.backupFile(filePath);
                backupInfos.push(backupInfo);
            }
            catch (error) {
                // 记录错误但继续处理其他文件
                console.warn(`备份文件失败: ${filePath}`, error);
                // 可以选择抛出错误或继续
                throw error;
            }
        }
        return backupInfos;
    }
    /**
     * 恢复文件
     * 从备份恢复文件到原位置
     *
     * @param filePath - 原文件路径
     * @returns 是否恢复成功
     */
    async restoreFile(filePath) {
        // 查找备份信息
        const backupInfo = this.backupRegistry.get(filePath);
        if (!backupInfo) {
            throw new Error(`未找到文件的备份记录: ${filePath}`);
        }
        // 检查备份文件是否存在
        try {
            await fs.access(backupInfo.backupPath);
        }
        catch {
            throw new Error(`备份文件不存在: ${backupInfo.backupPath}`);
        }
        // 恢复文件
        try {
            // 复制备份文件到原位置
            await fs.copyFile(backupInfo.backupPath, filePath);
            // 验证恢复的文件
            const restoredChecksum = await this.calculateChecksum(filePath);
            if (restoredChecksum !== backupInfo.checksum) {
                throw new Error('恢复的文件校验和不匹配');
            }
            return true;
        }
        catch (error) {
            throw new Error(`恢复文件失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * 批量恢复文件
     *
     * @param filePaths - 要恢复的文件路径数组
     * @returns 恢复结果数组
     */
    async restoreFiles(filePaths) {
        const results = [];
        for (const filePath of filePaths) {
            try {
                const success = await this.restoreFile(filePath);
                results.push({
                    filePath,
                    success,
                    error: undefined
                });
            }
            catch (error) {
                results.push({
                    filePath,
                    success: false,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }
        return results;
    }
    /**
     * 删除备份文件
     *
     * @param filePath - 原文件路径
     */
    async deleteBackup(filePath) {
        const backupInfo = this.backupRegistry.get(filePath);
        if (!backupInfo) {
            // 没有备份记录，直接返回
            return;
        }
        try {
            // 删除备份文件
            await fs.unlink(backupInfo.backupPath);
            // 从注册表中移除
            this.backupRegistry.delete(filePath);
        }
        catch (error) {
            // 文件可能已经被删除，忽略错误
            if (error.code !== 'ENOENT') {
                console.warn(`删除备份文件失败: ${backupInfo.backupPath}`, error);
            }
            // 即使删除失败，也从注册表中移除
            this.backupRegistry.delete(filePath);
        }
    }
    /**
     * 清理所有备份文件
     */
    async cleanupAllBackups() {
        const deletePromises = [];
        // 删除所有备份文件
        for (const filePath of this.backupRegistry.keys()) {
            deletePromises.push(this.deleteBackup(filePath));
        }
        await Promise.all(deletePromises);
        // 清空注册表
        this.backupRegistry.clear();
    }
    /**
     * 清理整个备份目录
     */
    async cleanupBackupDir() {
        try {
            // 先清理注册的备份
            await this.cleanupAllBackups();
            // 检查备份目录是否存在
            try {
                await fs.access(this.backupDir);
            }
            catch {
                // 目录不存在，无需清理
                return;
            }
            // 删除整个备份目录
            await fs.rm(this.backupDir, { recursive: true, force: true });
        }
        catch (error) {
            console.warn(`清理备份目录失败: ${this.backupDir}`, error);
        }
    }
    /**
     * 清理旧备份
     * 删除超过指定天数的备份文件
     *
     * @param days - 保留天数
     */
    async cleanupOldBackups(days = 7) {
        const now = Date.now();
        const maxAge = days * 24 * 60 * 60 * 1000; // 转换为毫秒
        let deletedCount = 0;
        const filesToDelete = [];
        // 查找过期的备份
        for (const [filePath, backupInfo] of this.backupRegistry.entries()) {
            const age = now - backupInfo.timestamp.getTime();
            if (age > maxAge) {
                filesToDelete.push(filePath);
            }
        }
        // 删除过期的备份
        for (const filePath of filesToDelete) {
            try {
                await this.deleteBackup(filePath);
                deletedCount++;
            }
            catch (error) {
                console.warn(`删除过期备份失败: ${filePath}`, error);
            }
        }
        return deletedCount;
    }
    /**
     * 获取备份信息
     *
     * @param filePath - 原文件路径
     * @returns 备份信息，如果不存在则返回 undefined
     */
    getBackupInfo(filePath) {
        return this.backupRegistry.get(filePath);
    }
    /**
     * 获取所有备份信息
     *
     * @returns 备份信息数组
     */
    getAllBackups() {
        return Array.from(this.backupRegistry.values());
    }
    /**
     * 检查文件是否有备份
     *
     * @param filePath - 文件路径
     * @returns 是否有备份
     */
    hasBackup(filePath) {
        return this.backupRegistry.has(filePath);
    }
    /**
     * 获取备份目录路径
     *
     * @returns 备份目录路径
     */
    getBackupDir() {
        return this.backupDir;
    }
    /**
     * 获取备份数量
     *
     * @returns 备份数量
     */
    getBackupCount() {
        return this.backupRegistry.size;
    }
    /**
     * 生成备份文件路径
     *
     * @param originalPath - 原文件路径
     * @returns 备份文件路径
     */
    async generateBackupPath(originalPath) {
        const parsed = path.parse(originalPath);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const uniqueId = this.generateUniqueId();
        // 生成备份文件名: 原文件名_时间戳_唯一ID.扩展名
        const backupFileName = `${parsed.name}_${timestamp}_${uniqueId}${parsed.ext}`;
        const backupPath = path.join(this.backupDir, backupFileName);
        // 确保备份路径不存在（理论上不应该冲突，但以防万一）
        let finalBackupPath = backupPath;
        let counter = 1;
        while (await this.pathExists(finalBackupPath)) {
            const backupFileNameWithCounter = `${parsed.name}_${timestamp}_${uniqueId}_${counter}${parsed.ext}`;
            finalBackupPath = path.join(this.backupDir, backupFileNameWithCounter);
            counter++;
            if (counter > 1000) {
                throw new Error('无法生成唯一的备份文件名');
            }
        }
        return finalBackupPath;
    }
    /**
     * 生成唯一 ID
     *
     * @returns 唯一 ID 字符串
     */
    generateUniqueId() {
        return randomBytes(4).toString('hex');
    }
    /**
     * 检查路径是否存在
     *
     * @param filePath - 文件路径
     * @returns 是否存在
     */
    async pathExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * 计算文件校验和（简单的大小+修改时间）
     * 用于验证备份和恢复的完整性
     *
     * @param filePath - 文件路径
     * @returns 校验和字符串
     */
    async calculateChecksum(filePath) {
        try {
            const stats = await fs.stat(filePath);
            // 使用文件大小和修改时间作为简单的校验和
            return `${stats.size}-${stats.mtimeMs}`;
        }
        catch (error) {
            throw new Error(`计算校验和失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
// 默认备份目录名称
FileBackupManager.DEFAULT_BACKUP_DIR = '.ppt-batch-processor-backups';
// 导出默认实例
export const fileBackupManager = new FileBackupManager();
