import { promises as fs } from 'fs';
/**
 * 密码保护器
 * 为 PPT 文件添加或删除密码保护
 * 使用 officecrypto-tool 的 Node.js API 实现真正的 Office 文档加密
 */
export class PasswordProtector {
    /**
     * 添加密码保护
     *
     * @param inputPath 输入文件路径
     * @param outputPath 输出文件路径
     * @param password 密码
     */
    async addPassword(inputPath, outputPath, password) {
        try {
            console.log('=== Add Password Debug ===');
            console.log('Input file:', inputPath);
            console.log('Output file:', outputPath);
            console.log('Password length:', password.length);
            // 使用 officecrypto-tool 的 Node.js API
            const officecrypto = await import('officecrypto-tool');
            // 读取文件
            const inputBuffer = await fs.readFile(inputPath);
            console.log('File read successfully, size:', inputBuffer.length);
            // 加密
            console.log('Encrypting file...');
            const encryptedBuffer = await officecrypto.encrypt(inputBuffer, {
                password: password
            });
            console.log('File encrypted successfully, size:', encryptedBuffer.length);
            // 写入文件
            await fs.writeFile(outputPath, encryptedBuffer);
            console.log('Encrypted file written successfully');
            console.log('Password protection added successfully');
            console.log('=== End Add Password Debug ===');
        }
        catch (error) {
            console.error('Add password error:', error);
            if (error instanceof Error) {
                throw new Error(`Failed to add password: ${error.message}`);
            }
            throw new Error('Failed to add password: Unknown error');
        }
    }
    /**
     * 删除密码保护
     *
     * @param inputPath 输入文件路径
     * @param outputPath 输出文件路径
     * @param currentPassword 当前密码
     */
    async removePassword(inputPath, outputPath, currentPassword) {
        try {
            console.log('=== Remove Password Debug ===');
            console.log('Input file:', inputPath);
            console.log('Output file:', outputPath);
            console.log('Current password length:', currentPassword.length);
            // 使用 officecrypto-tool 的 Node.js API
            const officecrypto = await import('officecrypto-tool');
            // 读取文件
            const inputBuffer = await fs.readFile(inputPath);
            console.log('File read successfully, size:', inputBuffer.length);
            // 解密
            console.log('Decrypting file...');
            const decryptedBuffer = await officecrypto.decrypt(inputBuffer, {
                password: currentPassword
            });
            console.log('File decrypted successfully, size:', decryptedBuffer.length);
            // 写入文件
            await fs.writeFile(outputPath, decryptedBuffer);
            console.log('Decrypted file written successfully');
            console.log('Password protection removed successfully');
            console.log('=== End Remove Password Debug ===');
        }
        catch (error) {
            console.error('Remove password error:', error);
            if (error instanceof Error) {
                // 检查是否是密码错误
                if (error.message.includes('password') || error.message.includes('decrypt') || error.message.includes('invalid')) {
                    throw new Error('密码错误或文件未加密');
                }
                throw new Error(`Failed to remove password: ${error.message}`);
            }
            throw new Error('Failed to remove password: Unknown error');
        }
    }
}
