# PPT 批量处理工具

这是一个基于 Electron 的桌面演示文稿工具箱，集中处理 PowerPoint 文件的整理、转换、内容修改和安全设置。源码位于 `ppt-batch-processor-mac-source/`。

## 主要功能

- 合并、拆分、删除和提取幻灯片、备注与图片。
- 转换格式并优化压缩演示文稿。
- 批量替换文本和图片，生成模板，并按 Excel 规则处理内容。
- 添加或移除水印、密码、宏、背景、页眉页脚及文档元数据。

## 技术栈与开发

项目使用 Vue 3、TypeScript、Vite 和 Electron。进入源码目录后可运行 `npm install` 安装依赖，再运行 `npm run dev:electron` 启动桌面开发环境。构建脚本包含 macOS ZIP 和 Linux AppImage、DEB 目标。
