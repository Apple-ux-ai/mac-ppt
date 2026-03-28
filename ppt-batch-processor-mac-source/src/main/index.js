import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { registerIPCHandlers } from './ipc/handlers';
import http from 'http';
import { createLocalizedErrorPayload } from './utils/user-visible-messages';
// 版本标记 - 强制重新编译
const CODE_VERSION = '2024-01-24-REBUILD-001';
// 在 ES 模块中获取 __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// 禁用硬件加速（可选，根据需要）
// app.disableHardwareAcceleration()
let mainWindow = null;
let callbackServer = null;
let receivedToken = null;
function getAppIconPath() {
    const isDev = process.argv.includes('--dev') || process.env.VITE_DEV_SERVER_URL || !app.isPackaged;
    if (isDev) {
        return path.join(process.cwd(), 'src', 'renderer', 'assets', 'icon.png');
    }
    return path.join(process.resourcesPath, 'app-icon.png');
}
// 创建回调服务器
function createCallbackServer() {
    if (callbackServer)
        return;
    callbackServer = http.createServer((req, res) => {
        console.log('=== 收到登录回调 ===');
        console.log('请求URL:', req.url);
        // 解析 URL 参数
        const url = new URL(req.url || '', 'http://localhost:3456');
        const token = url.searchParams.get('token');
        console.log('接收到的 token:', token);
        if (token) {
            receivedToken = token;
            console.log('✅ Token 已接收，准备获取用户信息...');
            console.log('mainWindow 是否存在:', !!mainWindow);
            console.log('mainWindow.webContents 是否存在:', !!mainWindow?.webContents);
            (async () => {
                try {
                    console.log('📡 调用 get_user_info 接口...');
                    const userInfoResponse = await fetch('https://api-web.kunqiongai.com/soft_desktop/get_user_info', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            token: token,
                        },
                        body: JSON.stringify({}),
                    });
                    const userInfoData = (await userInfoResponse.json());
                    console.log('📡 用户信息响应:', userInfoData);
                    if (userInfoData.code === 1 && userInfoData.data?.user_info) {
                        const userInfo = userInfoData.data.user_info;
                        console.log('✅ 成功获取用户信息:', userInfo);
                        // 通知主窗口登录成功，同时发送 token 和用户信息
                        if (mainWindow && mainWindow.webContents) {
                            console.log('📤 发送 login-success 事件到前端（含用户信息）...');
                            // 方法1：使用 IPC 发送事件
                            mainWindow.webContents.send('login-success', {
                                token: token,
                                userInfo: userInfo,
                            });
                            console.log('✅ login-success 事件已发送（IPC）');
                            // 方法2：直接在前端执行 JavaScript 代码（备用方案）
                            setTimeout(() => {
                                try {
                                    // 安全地序列化数据，避免特殊字符问题
                                    const dataStr = JSON.stringify({ token, userInfo });
                                    const escapedData = dataStr
                                        .replace(/\\/g, '\\\\')
                                        .replace(/'/g, "\\'")
                                        .replace(/"/g, '\\"');
                                    const jsCode = `
                    (function() {
                      try {
                        console.log('🔥 后端直接执行 JS：触发登录成功');
                        const dataStr = '${escapedData}';
                        const data = JSON.parse(dataStr.replace(/\\\\"/g, '"'));
                        const event = new CustomEvent('ipc-message', {
                          detail: {
                            channel: 'login-success',
                            data: data
                          }
                        });
                        window.dispatchEvent(event);
                      } catch (e) {
                        console.error('❌ 执行登录回调失败:', e);
                      }
                    })();
                  `;
                                    mainWindow?.webContents
                                        .executeJavaScript(jsCode)
                                        .then(() => console.log('✅ 备用方案：JS 代码已执行'))
                                        .catch((err) => console.error('❌ 执行 JS 失败:', err));
                                }
                                catch (error) {
                                    console.error('❌ 生成 JS 代码失败:', error);
                                }
                            }, 500);
                        }
                        else {
                            console.error('❌ 无法发送事件：mainWindow 或 webContents 不存在');
                        }
                    }
                    else {
                        console.error('❌ 获取用户信息失败:', userInfoData.msg);
                        // 即使失败也发送 token，让前端自己处理
                        if (mainWindow && mainWindow.webContents) {
                            mainWindow.webContents.send('login-success', { token: token });
                        }
                    }
                }
                catch (error) {
                    console.error('❌ 获取用户信息异常:', error);
                    // 发生错误也发送 token
                    if (mainWindow && mainWindow.webContents) {
                        mainWindow.webContents.send('login-success', { token: token });
                    }
                }
            })();
            // 重定向回网站主页，让用户继续使用网站
            res.writeHead(302, {
                Location: 'https://aitools.kunqiongai.com',
            });
            res.end();
        }
        else {
            // 如果没有 token（比如 favicon 请求），返回 404
            res.writeHead(404);
            res.end();
        }
    });
    callbackServer.on('error', (e) => {
        if (e.code === 'EADDRINUSE') {
            console.error(`❌ 回调服务器启动失败：端口 3456 已被占用。这通常发生在软件多开或上次退出不彻底时。`);
            // 不再抛出异常，允许应用继续运行，只是回调功能可能受限
            callbackServer = null;
        }
        else {
            console.error('❌ 回调服务器发生错误:', e);
        }
    });
    callbackServer.listen(3456, () => {
        console.log('✅ 回调服务器已启动: http://localhost:3456');
    });
}
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
}
else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized())
                mainWindow.restore();
            mainWindow.focus();
        }
    });
}
function createWindow() {
    if (mainWindow)
        return;
    console.log('\n========================================');
    console.log('🚀 PPT批量处理工具 - 主进程启动');
    console.log(`📌 代码版本: ${CODE_VERSION}`);
    console.log('========================================');
    console.log('创建 BrowserWindow...');
    console.log(`  - 尺寸: 1200x800`);
    console.log(`  - Preload: ${path.join(__dirname, 'preload.cjs')}`);
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 1200,
        minHeight: 800,
        resizable: true,
        frame: false, // 禁用默认标题栏
        titleBarStyle: 'hidden', // 隐藏标题栏
        backgroundColor: '#ffffff',
        icon: getAppIconPath(),
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });
    // 开发环境加载 Vite 开发服务器
    // 检查是否存在 dist-electron 目录来判断是否为开发环境
    const isDev = process.argv.includes('--dev') || process.env.VITE_DEV_SERVER_URL || !app.isPackaged;
    if (isDev) {
        console.log('📦 开发模式: 加载 Vite 开发服务器');
        console.log(`  - URL: http://localhost:10037`);
        mainWindow.loadURL('http://localhost:10037');
        // 开发者工具已禁用
        // mainWindow.webContents.openDevTools()
    }
    else {
        // 生产环境加载打包后的文件
        console.log('📦 生产模式: 加载打包文件');
        const indexPath = path.join(__dirname, '../dist/index.html');
        console.log(`  - 文件: ${indexPath}`);
        mainWindow.loadFile(indexPath);
    }
    console.log('========================================');
    console.log('✅ 主窗口创建完成');
    console.log('========================================\n');
    // 禁用开发者工具的所有快捷键
    mainWindow.webContents.on('before-input-event', (event, input) => {
        // 禁用 F11 (全屏)
        if (input.key === 'F11') {
            event.preventDefault();
            return;
        }
        // 禁用 F12
        if (input.key === 'F12') {
            event.preventDefault();
            return;
        }
        // 禁用 Ctrl+Shift+I (Windows/Linux) 或 Cmd+Option+I (Mac)
        if ((input.control || input.meta) && input.shift && input.key.toLowerCase() === 'i') {
            event.preventDefault();
            return;
        }
        // 禁用 Ctrl+Shift+J (Windows/Linux) 或 Cmd+Option+J (Mac)
        if ((input.control || input.meta) && input.shift && input.key.toLowerCase() === 'j') {
            event.preventDefault();
            return;
        }
        // 禁用 Ctrl+Shift+C (Windows/Linux) 或 Cmd+Option+C (Mac)
        if ((input.control || input.meta) && input.shift && input.key.toLowerCase() === 'c') {
            event.preventDefault();
            return;
        }
    });
    mainWindow.on('closed', () => {
        console.log('🔴 主窗口已关闭');
        mainWindow = null;
    });
    // 监听页面加载完成
    mainWindow.webContents.on('did-finish-load', () => {
        console.log('✅ 页面加载完成');
    });
    // 监听页面加载失败
    mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
        console.error(`❌ 页面加载失败: ${errorDescription} (${errorCode})`);
    });
}
app.whenReady().then(async () => {
    console.log('='.repeat(60));
    console.log('PPT批处理工具 - 后端服务启动');
    console.log('='.repeat(60));
    console.log(`启动时间: ${new Date().toLocaleString('zh-CN')}`);
    console.log(`Node版本: ${process.version}`);
    console.log(`Electron版本: ${process.versions.electron}`);
    console.log(`工作目录: ${process.cwd()}`);
    console.log('-'.repeat(60));
    createCallbackServer();
    console.log('正在注册 IPC 处理器...');
    await registerIPCHandlers();
    // 注册窗口控制处理器
    ipcMain.handle('window-minimize', () => {
        const win = BrowserWindow.getFocusedWindow();
        if (win)
            win.minimize();
    });
    ipcMain.handle('window-maximize', () => {
        const win = BrowserWindow.getFocusedWindow();
        if (win) {
            if (win.isMaximized()) {
                win.unmaximize();
            }
            else {
                win.maximize();
            }
        }
    });
    ipcMain.handle('window-close', () => {
        const win = BrowserWindow.getFocusedWindow();
        if (win)
            win.close();
    });
    // 获取登录地址
    ipcMain.handle('get-login-url', async () => {
        try {
            console.log('=== 获取登录地址 ===');
            // 生成简单的 client_nonce：使用纯时间戳（13位数字）
            const clientNonce = Date.now().toString();
            console.log('生成的 client_nonce:', clientNonce);
            const response = await fetch('https://api-web.kunqiongai.com/soft_desktop/get_web_login_url', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({}),
            });
            console.log('响应状态:', response.status);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = (await response.json());
            console.log('响应数据:', JSON.stringify(data));
            console.log('登录地址:', data.data?.login_url);
            if (data.code === 1 && data.data && data.data.login_url) {
                // 添加 redirect_url 参数，指向本地回调服务器
                const redirectUrl = 'http://localhost:3456/callback';
                const separator = data.data.login_url.includes('?') ? '&' : '?';
                const fullLoginUrl = `${data.data.login_url}${separator}redirect_url=${encodeURIComponent(redirectUrl)}`;
                console.log('完整登录URL（含回调）:', fullLoginUrl);
                return {
                    success: true,
                    loginUrl: fullLoginUrl,
                    token: clientNonce,
                };
            }
            else {
                throw new Error(data.msg || '获取登录地址失败');
            }
        }
        catch (error) {
            console.error('获取登录地址失败:', error);
            return {
                success: false,
                ...createLocalizedErrorPayload('main.error.getLoginUrlFailed', error instanceof Error ? error.message : '未知错误'),
            };
        }
    });
    // 获取登录 token（使用 client_nonce）
    ipcMain.handle('check-login', async (_event, clientNonce) => {
        try {
            console.log('=== 获取登录 token ===');
            console.log('接收到的参数类型:', typeof clientNonce);
            console.log('接收到的参数值:', clientNonce);
            console.log('参数长度:', clientNonce?.length);
            // 使用 URLSearchParams 构建 urlencoded 格式的请求体
            const params = new URLSearchParams();
            params.append('client_type', 'desktop');
            params.append('client_nonce', clientNonce);
            console.log('请求体:', params.toString());
            console.log('完整请求信息:', {
                url: 'https://api-web.kunqiongai.com/user/desktop_get_token',
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: params.toString(),
            });
            const response = await fetch('https://api-web.kunqiongai.com/user/desktop_get_token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: params.toString(),
            });
            console.log('响应状态:', response.status);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = (await response.json());
            console.log('响应数据:', JSON.stringify(data));
            console.log('响应code:', data.code);
            console.log('响应msg:', data.msg);
            // code === 1 表示已登录
            if (data.code === 1) {
                // 提取 token（如果有）
                const token = data.data && typeof data.data === 'object' && !Array.isArray(data.data)
                    ? data.data.token
                    : undefined;
                console.log('提取到的 token:', token);
                return {
                    success: true,
                    isLoggedIn: true,
                    message: data.msg,
                    token: token,
                };
            }
            else if (data.code === 0) {
                // code === 0 表示参数错误或用户未登录
                console.log('⚠️ 用户尚未在浏览器中完成登录，或参数格式不正确');
                return {
                    success: true,
                    isLoggedIn: false,
                    message: data.msg,
                };
            }
            else {
                return {
                    success: true,
                    isLoggedIn: false,
                    message: data.msg,
                };
            }
        }
        catch (error) {
            console.error('检查登录状态失败:', error);
            return {
                success: false,
                isLoggedIn: false,
                ...createLocalizedErrorPayload('main.error.checkLoginStatusFailed', error instanceof Error ? error.message : '未知错误'),
            };
        }
    });
    // 获取用户信息
    ipcMain.handle('get-user-info', async (_event, token) => {
        try {
            console.log('=== 获取用户信息 ===');
            console.log('token:', token);
            const response = await fetch('https://api-web.kunqiongai.com/soft_desktop/get_user_info', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    token: token,
                },
                body: JSON.stringify({}),
            });
            console.log('响应状态:', response.status);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = (await response.json());
            if (data.code === 1 && data.data && data.data.user_info) {
                return {
                    success: true,
                    userInfo: {
                        avatar: data.data.user_info.avatar,
                        nickname: data.data.user_info.nickname,
                    },
                };
            }
            else {
                throw new Error(data.msg || '获取用户信息失败');
            }
        }
        catch (error) {
            console.error('获取用户信息失败:', error);
            return {
                success: false,
                ...createLocalizedErrorPayload('main.error.getUserInfoFailed', error instanceof Error ? error.message : '未知错误'),
            };
        }
    });
    // 获取广告
    ipcMain.handle('get-adv', async () => {
        try {
            const response = await fetch('https://api-web.kunqiongai.com/soft_desktop/get_adv', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    soft_number: '10019',
                    adv_position: 'adv_position_01',
                }),
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = (await response.json());
            if (data.code === 1 && data.data && data.data.length > 0) {
                return {
                    success: true,
                    adv: data.data[0],
                };
            }
            else {
                return {
                    success: false,
                    ...createLocalizedErrorPayload('main.error.noAdvertisementAvailable', data.msg || '暂无广告'),
                };
            }
        }
        catch (error) {
            console.error('获取广告失败:', error);
            return {
                success: false,
                ...createLocalizedErrorPayload('main.error.getAdvertisementFailed', error instanceof Error ? error.message : '未知错误'),
            };
        }
    });
    // 检查软件更新
    ipcMain.handle('check-update', async () => {
        try {
            console.log('=== 检查软件更新 ===');
            // 获取当前版本
            const currentVersion = '0.0.1'; // 从 package.json 读取
            console.log('当前版本:', currentVersion);
            const response = await fetch('https://api-web.kunqiongai.com/soft_desktop/check_version', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    soft_number: '10019',
                    current_version: currentVersion,
                }),
            });
            console.log('响应状态:', response.status);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = (await response.json());
            console.log('版本检查响应:', JSON.stringify(data));
            if (data.code === 1 && data.data) {
                const { latest_version, update_url, update_notes, force_update } = data.data;
                // 简单的版本比较
                const hasUpdate = latest_version !== currentVersion;
                return {
                    success: true,
                    hasUpdate,
                    currentVersion,
                    latestVersion: latest_version,
                    updateUrl: update_url,
                    updateNotes: update_notes,
                    forceUpdate: force_update || false,
                };
            }
            else {
                return {
                    success: true,
                    hasUpdate: false,
                    currentVersion,
                    message: data.msg || '已是最新版本',
                    messageKey: 'main.message.alreadyLatestVersion',
                };
            }
        }
        catch (error) {
            console.error('检查更新失败:', error);
            return {
                success: false,
                ...createLocalizedErrorPayload('main.error.checkUpdateFailed', error instanceof Error ? error.message : '未知错误'),
            };
        }
    });
    // 在浏览器中打开外部链接
    ipcMain.handle('open-external', async (_event, url) => {
        try {
            await shell.openExternal(url);
            return { success: true };
        }
        catch (error) {
            console.error('打开外部链接失败:', error);
            return {
                success: false,
                ...createLocalizedErrorPayload('main.error.openExternalFailed', error instanceof Error ? error.message : '未知错误'),
            };
        }
    });
    console.log('✅ IPC 处理器注册完成');
    console.log('  - 文件选择: select-files, select-folder');
    console.log('  - 批量处理: process-files, cancel-task');
    console.log('  - 窗口控制: window-minimize, window-maximize, window-close');
    console.log('  - 进度监听: progress-update, file-completed, task-completed');
    console.log('-'.repeat(60));
    console.log('正在创建主窗口...');
    createWindow();
    console.log('✅ 主窗口创建完成');
    console.log('-'.repeat(60));
    console.log('后端服务已就绪，等待前端连接...');
    console.log('='.repeat(60));
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            console.log('重新创建主窗口...');
            createWindow();
        }
    });
});
app.on('window-all-closed', () => {
    console.log('所有窗口已关闭');
    console.log('退出应用...');
    // 关闭回调服务器
    if (callbackServer) {
        callbackServer.close(() => {
            console.log('✅ 回调服务器已关闭');
        });
    }
    if (process.platform !== 'darwin') {
        console.log('退出应用...');
        app.quit();
    }
});
// 应用退出前的清理
app.on('before-quit', () => {
    console.log('='.repeat(60));
    console.log('应用正在退出...');
    console.log(`运行时长: ${Math.round(process.uptime())}秒`);
    console.log('='.repeat(60));
});
