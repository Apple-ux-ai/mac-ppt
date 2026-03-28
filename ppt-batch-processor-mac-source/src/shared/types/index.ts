// 任务类型
export type TaskType =
  | 'text-replace'
  | 'image-replace'
  | 'format-convert'
  | 'add-watermark'
  | 'split-ppt'
  | 'merge-ppt'
  | 'extract-images'
  | 'extract-notes'
  | 'extract-pages'
  | 'optimize-compress'
  | 'delete-blank-pages'
  | 'delete-notes'
  | 'delete-background'
  | 'delete-macros'
  | 'delete-header-footer'
  | 'add-password'
  | 'remove-password'
  | 'edit-metadata'
  | 'clear-metadata'
  | 'delete-pages'
  | 'replace-pages'
  | 'insert-pages'
  | 'template-generate'
  | 'excel-rules'

// 任务分类
export type TaskCategory =
  | 'content' // 文件内容类
  | 'conversion' // 格式转换类
  | 'header-footer' // 页眉页脚类
  | 'watermark' // 文件水印类
  | 'merge-split' // 合并拆分类
  | 'page' // 页面处理类
  | 'extraction' // 数据提取类
  | 'properties' // 文件属性类

// 任务状态
export type TaskStatus = 'pending' | 'running' | 'paused' | 'completed' | 'error' | 'cancelled'

// 文件信息
export interface FileInfo {
  name: string
  path: string
  size: number
  format: string
  slideCount?: number
  file?: File // 浏览器环境中的 File 对象
}

// Excel 规则类型
export type ExcelRuleType = 'text-replace' | 'image-replace' | 'delete-content'

// Excel 规则
export interface ExcelRule {
  type: ExcelRuleType
  searchText?: string
  replaceText?: string
  sourceImage?: string
  targetImage?: string
  deleteContent?: string
}

// 任务选项
export interface TaskOptions {
  // 文本替换选项
  searchText?: string
  replaceText?: string
  caseSensitive?: boolean // 大小写敏感
  wholeWord?: boolean // 全词匹配
  useRegex?: boolean // 使用正则表达式
  replaceInNotes?: boolean // 替换备注中的文本
  replaceInTables?: boolean // 替换表格中的文本
  skipHiddenSlides?: boolean // 跳过隐藏的幻灯片

  // 图片替换选项
  sourceImage?: string
  targetImage?: string
  imageReplaceMode?: 'all' | 'by-page' | 'all-same'
  targetPageNumber?: number
  keepImageSize?: boolean
  keepImagePosition?: boolean

  // 删除空白页选项
  noText?: boolean
  noImages?: boolean
  noShapes?: boolean
  ignoreBackground?: boolean

  // 删除背景选项
  removeImages?: boolean
  removeColors?: boolean
  applyToMaster?: boolean

  // 格式转换选项
  targetFormat?: 'pdf' | 'png' | 'jpg' | 'html' | 'ppt' | 'pptx'

  // 水印选项
  watermark?: WatermarkOptions
  watermarkType?: 'text' | 'image'
  watermarkContent?: string
  watermarkPosition?: 'top-left' | 'top-right' | 'center' | 'bottom-left' | 'bottom-right'
  watermarkOpacity?: number
  watermarkFontSize?: number
  watermarkFontColor?: string
  watermarkImagePath?: string
  applyWatermarkToImages?: boolean

  // 拆分选项
  pagesPerFile?: number
  splitMode?: 'by-pages' | 'by-count' | 'by-range'
  splitPagesPerFile?: number
  splitFileCount?: number
  splitNamingRule?: 'numbered' | 'custom'
  splitCustomPrefix?: string

  // 合并选项
  mergeOrder?: 'selected' | 'alphabetical' | 'date'
  mergeAddSeparator?: boolean
  mergeSeparatorText?: string

  // 压缩选项
  imageQuality?: number

  // 页面操作选项
  pageRange?: string // 例如: "1-3,5,7-9"
  sourcePages?: string[]

  // 替换页面选项
  replaceTargetFile?: string
  replacePageNumber?: number
  replaceSourceFile?: string
  replaceSourcePageNumber?: number

  // 插入页面选项
  insertTargetFile?: string
  insertPosition?: number // 插入位置（页码）
  insertSourceFile?: string
  insertSourcePageRange?: string

  // 提取页面选项
  extractSourceFile?: string
  extractPageRange?: string

  // 提取图片选项
  extractImagesSourceFile?: string
  extractImagesFormat?: 'original' | 'png' | 'jpg'

  // 提取备注选项
  extractNotesSourceFile?: string
  extractNotesFormat?: 'txt' | 'md'

  // 编辑元数据选项
  editMetadataSourceFile?: string
  metadataTitle?: string
  metadataAuthor?: string
  metadataSubject?: string
  metadataKeywords?: string
  metadataComments?: string

  // 优化压缩选项
  compressLevel?: 'low' | 'medium' | 'high'
  compressImages?: boolean
  removeEmbeddedFonts?: boolean

  // 删除页眉页脚选项
  removeHeader?: boolean
  removeFooter?: boolean
  removeSlideNumber?: boolean
  removeDateTime?: boolean

  // 删除宏选项
  confirmDeleteMacros?: boolean

  // 删除备注选项
  confirmDeleteNotes?: boolean

  // 模板选项
  templatePath?: string
  dataSourcePath?: string
  outputPattern?: string // 输出文件名模式，例如: "{{姓名}}_{{日期}}.pptx"
  mergeToSingleFile?: boolean // 是否合并到单个文件

  // Excel 规则选项
  excelRulesPath?: string
  excelRules?: ExcelRule[]

  // 元数据选项
  metadata?: Partial<Metadata>

  // 密码选项
  password?: string
  oldPassword?: string

  // 页码选项
  pageNumberFormat?: string // 页码格式，如 "第 {page} 页 / 共 {total} 页"
  pageNumberPosition?:
    | 'bottom-center'
    | 'bottom-left'
    | 'bottom-right'
    | 'top-center'
    | 'top-left'
    | 'top-right'
  pageNumberStartFrom?: number // 起始页码
  pageNumberSkipFirst?: boolean // 跳过首页
  pageNumberFont?: string
  pageNumberSize?: number
  pageNumberColor?: string

  // 批量字体选项
  fontTargetType?: 'all' | 'title' | 'body' | 'custom'
  fontOldFont?: string // 要替换的字体
  fontNewFont?: string // 新字体
  fontMinSize?: number // 最小字号
  fontMaxSize?: number // 最大字号
  fontNewSize?: number // 新字号（统一字号）
  fontKeepRatio?: boolean // 保持比例

  // 智能去重选项
  deduplicateMode?: 'exact' | 'similar' | 'visual'
  deduplicateSimilarity?: number // 相似度阈值 0-100
  deduplicateKeepFirst?: boolean // 保留第一个

  // 导出长图选项
  longImageDirection?: 'vertical' | 'horizontal'
  longImageGap?: number // 幻灯片间距
  longImageBackground?: string // 背景色
  longImageFormat?: 'png' | 'jpg'
  longImageQuality?: number // 图片质量 1-100

  // 批量重命名选项
  renamePattern?: string // 重命名模式，如 "{序号}_{原标题}"
  renameStartNumber?: number // 起始序号
  renamePadding?: number // 序号位数，如 3 表示 001, 002...

  // 日期时间选项
  datetimeFormat?: string // 日期时间格式
  datetimePosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  datetimeFont?: string
  datetimeSize?: number
  datetimeColor?: string
  datetimeIncludeDate?: boolean
  datetimeIncludeTime?: boolean

  // 通用选项
  overwriteOriginal?: boolean
  fileNamePattern?: string
}

// 水印选项
export interface WatermarkOptions {
  type: 'text' | 'image'
  content: string // 文本内容或图片路径
  position: 'top-left' | 'top-right' | 'center' | 'bottom-left' | 'bottom-right'
  opacity: number // 0-1
  fontSize?: number
  fontColor?: string
  size?: { width: number; height: number }
}

// 元数据
export interface Metadata {
  title?: string
  author?: string
  subject?: string
  keywords?: string
  company?: string
  description?: string
  comments?: string
  lastModifiedBy?: string
  created?: Date
  modified?: Date
}

// 任务配置
export interface TaskConfig {
  id: string
  name: string
  category: TaskCategory
  type: TaskType
  inputFiles: FileInfo[]
  outputConfig: OutputConfig
  options: TaskOptions
  createdAt: Date
  status: TaskStatus
}

// 输出配置
export interface OutputConfig {
  directory: string
  overwriteOriginal: boolean
  fileNamePattern: string
  createSubfolders: boolean
}

// 处理进度
export interface ProcessProgress {
  totalFiles: number
  completedFiles: number
  currentFile: string
  percentage: number
  status: TaskStatus
}

// 处理结果
export interface ProcessResult {
  inputFile: string
  inputFileKey?: string
  inputFileParams?: Record<string, string | number>
  outputFile: string
  outputPath?: string
  status: 'success' | 'error'
  error?: string
  errorKey?: string
  errorParams?: Record<string, string | number>
  metadata?: {
    originalSize?: number
    newSize?: number
    itemsProcessed?: number
    rulesApplied?: number
  }
}

// PPTX 文档
export interface PptxDocument {
  filePath: string
  slides: Slide[]
  metadata: Metadata
  zipArchive: any // pizzip 实例
}

// 幻灯片
export interface Slide {
  index: number
  elements: Element[]
  notes: string
  background: Background | null
}

// 元素基类
export interface Element {
  type: 'text' | 'image' | 'shape' | 'table'
  position: { x: number; y: number }
  size: { width: number; height: number }
}

// 文本元素
export interface TextElement extends Element {
  type: 'text'
  content: string
  style: TextStyle
}

// 文本样式
export interface TextStyle {
  fontFamily?: string
  fontSize?: number
  fontColor?: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
}

// 图片元素
export interface ImageElement extends Element {
  type: 'image'
  imageData: Uint8Array // 使用 Uint8Array 替代 Buffer 以兼容浏览器环境
  format: 'png' | 'jpg' | 'gif'
  name?: string // 图片名称
  width?: number // 图片宽度
  height?: number // 图片高度
  relationshipId?: string // 关系ID，用于在ZIP中定位图片
}

// 背景
export interface Background {
  type: 'color' | 'image'
  value: string // 颜色值或图片路径
}

// 验证结果
export interface ValidationResult {
  valid: boolean
  format: 'pptx' | 'ppt' | 'unknown'
  error?: string
}

// 应用设置
export interface AppSettings {
  defaultOutputDir: string
  concurrency: number
  autoBackup: boolean
  logLevel: 'debug' | 'info' | 'warn' | 'error'
  language: string
  theme: 'light' | 'dark'
}
