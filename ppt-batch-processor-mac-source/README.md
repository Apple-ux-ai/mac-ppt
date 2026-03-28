# 📊 PPT 批量处理工具箱

<div align="center">

**一个功能强大的 PowerPoint 批量处理桌面应用程序**

基于 Electron + Vue3 + Vite + TypeScript 构建

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Electron](https://img.shields.io/badge/Electron-Latest-blue.svg)](https://www.electronjs.org/)
[![Vue 3](https://img.shields.io/badge/Vue-3.x-green.svg)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)

</div>

---

## ✨ 功能特性

### 📝 文本处理
- **文本替换**: 批量替换 PPT 中的文本内容，支持正则表达式
- **文本查找**: 快速定位包含特定文本的幻灯片
- **文本提取**: 导出所有文本内容到文件

### 🖼️ 图片处理
- **图片替换**: 批量替换 PPT 中的图片
- **图片提取**: 导出 PPT 中的所有图片
- **图片压缩**: 批量压缩图片以减小文件大小
- **水印添加**: 为所有图片添加自定义水印

### 🔄 格式转换
- **PDF 转换**: 将 PPT 批量转换为 PDF 格式
- **图片转换**: 将 PPT 页面导出为图片（PNG/JPG）
- **HTML 转换**: 将 PPT 转换为 HTML 格式

### 📑 文件操作
- **PPT 合并**: 将多个 PPT 文件合并为一个
- **PPT 拆分**: 将一个 PPT 拆分为多个文件
- **页面提取**: 提取指定页面到新文件
- **页面删除**: 批量删除指定页面

### 🔍 数据提取
- **备注提取**: 导出所有演讲者备注
- **元数据编辑**: 修改文件属性（作者、标题等）
- **模板生成**: 从现有 PPT 生成模板

### 🔐 文件保护
- **文件压缩**: 批量压缩 PPT 文件
- **内容清理**: 删除隐藏内容和元数据
- **格式统一**: 统一字体、颜色等格式

## 技术栈

- **前端框架**: Vue 3 + Vite
- **桌面框架**: Electron
- **语言**: TypeScript
- **PPTX 处理**: pizzip + xml2js
- **图片处理**: sharp
- **测试框架**: Vitest + fast-check
- **打包工具**: electron-builder

## 🚀 快速开始

### 📥 下载安装

#### Windows 用户

1. 从 [Releases](https://github.com/yourusername/ppt-batch-processor/releases) 页面下载最新版本的 `ppt-batch-processor-setup.exe`
2. 双击运行安装程序
3. 按照安装向导完成安装
4. 启动应用程序开始使用

#### 从源码构建

```bash
# 克隆仓库
git clone https://github.com/yourusername/ppt-batch-processor.git
cd ppt-batch-processor

# 安装依赖
npm install

# 开发模式运行
npm run dev

# 构建打包
npm run build
```

### 💡 使用指南

1. **选择任务类型**: 从左侧菜单选择要执行的批处理任务
2. **配置参数**: 在中间区域设置任务的具体参数
3. **选择文件**: 添加需要处理的 PPT 文件（支持拖拽）
4. **开始处理**: 点击「开始处理」按钮，在右侧查看实时进度
5. **查看结果**: 处理完成后，在输出目录查看结果文件

### 🎯 典型使用场景

#### 场景 1：批量添加公司水印
```
1. 选择「水印添加」任务
2. 上传公司 Logo 图片
3. 设置水印位置和透明度
4. 添加所有需要加水印的 PPT 文件
5. 开始处理
```

#### 场景 2：统一替换品牌名称
```
1. 选择「文本替换」任务
2. 输入旧品牌名称和新品牌名称
3. 添加所有相关 PPT 文件
4. 开始处理
```

#### 场景 3：批量转换为 PDF
```
1. 选择「PDF 转换」任务
2. 设置 PDF 质量和页面大小
3. 添加需要转换的 PPT 文件
4. 开始处理
```

## 📁 项目结构

```
ppt-batch-processor/
├── src/
│   ├── main/                    # 主进程代码
│   │   ├── index.ts            # 主进程入口
│   │   ├── preload.ts          # 预加载脚本
│   │   ├── ipc/                # IPC 通信处理
│   │   │   └── handlers.ts     # IPC 处理器
│   │   ├── services/           # 核心服务
│   │   │   ├── pptx-service.ts # PPTX 文件处理服务
│   │   │   └── file-service.ts # 文件操作服务
│   │   ├── processors/         # 批量处理器
│   │   │   ├── text-processor.ts    # 文本处理器
│   │   │   ├── image-processor.ts   # 图片处理器
│   │   │   └── convert-processor.ts # 格式转换器
│   │   └── utils/              # 工具函数
│   ├── renderer/               # 渲染进程代码
│   │   ├── main.ts            # 渲染进程入口
│   │   ├── App.vue            # 根组件
│   │   ├── components/        # Vue 组件
│   │   │   ├── TitleBar.vue   # 标题栏组件
│   │   │   ├── TaskSelector.vue    # 任务选择器
│   │   │   ├── TaskConfig.vue      # 任务配置
│   │   │   ├── FileSelector.vue    # 文件选择器
│   │   │   └── ProgressView.vue    # 进度显示
│   │   └── store/             # 状态管理
│   │       └── index.ts       # Pinia store
│   └── shared/                # 共享代码
│       ├── types/             # TypeScript 类型定义
│       └── constants/         # 常量定义
├── build/                     # 构建资源
│   ├── icon.svg              # 应用图标（SVG）
│   └── icon.ico              # 应用图标（ICO）
├── resources/                # 外部资源
│   └── LibreOffice/          # LibreOffice 便携版
├── scripts/                  # 构建脚本
├── electron-builder.yml      # 打包配置
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## 🛠️ 开发指南

### 环境要求

- **Node.js**: >= 18.0.0
- **npm**: >= 9.0.0
- **操作系统**: Windows 10/11, macOS 10.15+, Linux

### 安装依赖

```bash
# 使用 npm
npm install

# 或使用 yarn
yarn install

# 或使用 pnpm
pnpm install
```

### 开发模式

```bash
# 启动开发服务器（带热重载）
npm run dev

# 启动开发服务器并打开开发者工具
npm run dev:debug
```

开发服务器启动后，应用会自动打开。修改代码后会自动重新加载。

### 运行测试

```bash
# 运行所有测试
npm test

# 运行测试并显示 UI
npm run test:ui

# 运行测试并生成覆盖率报告
npm run test:coverage

# 监听模式运行测试
npm run test:watch
```

### 代码质量

```bash
# ESLint 检查
npm run lint

# ESLint 自动修复
npm run lint:fix

# Prettier 格式化
npm run format

# TypeScript 类型检查
npm run type-check
```

### 构建打包

```bash
# 构建并打包（生成安装程序）
npm run build

# 仅构建（不打包）
npm run build:dir

# 构建 Windows 版本
npm run build:win

# 构建 macOS 版本
npm run build:mac

# 构建 Linux 版本
npm run build:linux
```

打包完成后，安装程序位于 `release/` 目录。

## 📦 核心依赖

### 运行时依赖

| 依赖 | 版本 | 用途 |
|------|------|------|
| **electron** | Latest | 桌面应用框架 |
| **vue** | 3.x | 前端框架 |
| **pinia** | Latest | 状态管理 |
| **pizzip** | Latest | PPTX 文件解压/压缩 |
| **xml2js** | Latest | XML 解析 |
| **sharp** | Latest | 图片处理 |
| **p-limit** | Latest | 并发控制 |

### 开发依赖

| 依赖 | 版本 | 用途 |
|------|------|------|
| **vite** | Latest | 构建工具 |
| **typescript** | 5.x | 类型系统 |
| **vitest** | Latest | 单元测试 |
| **fast-check** | Latest | 属性测试 |
| **electron-builder** | Latest | 应用打包 |
| **eslint** | Latest | 代码检查 |
| **prettier** | Latest | 代码格式化 |

## 📝 开发规范

### 代码风格

- ✅ 使用 TypeScript 编写所有代码
- ✅ 遵循 ESLint 和 Prettier 规范
- ✅ 使用 ES6+ 语法特性
- ✅ 优先使用函数式编程风格
- ✅ 避免使用 `any` 类型

### 测试要求

- ✅ 为所有核心功能编写单元测试
- ✅ 为关键算法编写属性测试
- ✅ 测试覆盖率 > 80%
- ✅ 每个属性测试至少运行 100 次迭代
- ✅ 使用 Vitest 进行测试

### Git 提交规范

```
feat: 新功能
fix: 修复 bug
docs: 文档更新
style: 代码格式调整
refactor: 代码重构
test: 测试相关
chore: 构建/工具相关
```

### 分支管理

- `main`: 主分支，保持稳定
- `develop`: 开发分支
- `feature/*`: 功能分支
- `bugfix/*`: 修复分支
- `release/*`: 发布分支

## ❓ 常见问题

### Q: 应用无法启动？

**A**: 请检查以下几点：
1. 确保已安装 Node.js 18+
2. 删除 `node_modules` 并重新安装依赖
3. 检查是否有端口冲突（默认使用 10037 端口）

### Q: 处理大文件时卡顿？

**A**: 这是正常现象。大文件处理需要更多时间，请耐心等待。建议：
1. 关闭其他占用内存的程序
2. 分批处理大量文件
3. 使用 SSD 硬盘可以提升速度

### Q: 某些 PPT 文件处理失败？

**A**: 可能的原因：
1. PPT 文件已损坏
2. PPT 文件受密码保护
3. PPT 格式不支持（仅支持 .pptx 格式）

### Q: 如何贡献代码？

**A**: 欢迎贡献！请遵循以下步骤：
1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'feat: Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交 Pull Request

## 🗺️ 开发路线图

- [x] 基础文本处理功能
- [x] 图片处理功能
- [x] PDF 转换功能
- [x] 批量处理支持
- [x] 进度显示
- [ ] 云端同步
- [ ] 模板市场
- [ ] AI 辅助功能
- [ ] 多语言支持
- [ ] macOS 版本
- [ ] Linux 版本

## 🤝 贡献者

感谢所有为这个项目做出贡献的开发者！

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 📧 联系方式

- **问题反馈**: [GitHub Issues](https://github.com/yourusername/ppt-batch-processor/issues)
- **功能建议**: [GitHub Discussions](https://github.com/yourusername/ppt-batch-processor/discussions)
- **邮箱**: your.email@example.com

---

<div align="center">

**如果这个项目对你有帮助，请给一个 ⭐️ Star 支持一下！**

Made with ❤️ by [Your Name]

</div>
