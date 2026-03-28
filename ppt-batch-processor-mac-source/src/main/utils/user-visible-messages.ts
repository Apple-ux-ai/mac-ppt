export type MessageParams = Record<string, string | number>

type LocalizedError = Error & {
  messageKey?: string
  messageParams?: MessageParams
}

export function createLocalizedError(
  messageKey: string,
  fallback: string,
  messageParams?: MessageParams
): LocalizedError {
  const error = new Error(fallback) as LocalizedError
  error.messageKey = messageKey
  error.messageParams = messageParams
  return error
}

export function createLocalizedMessage(
  messageKey: string,
  fallback: string,
  messageParams?: MessageParams
) {
  return {
    message: fallback,
    messageKey,
    messageParams,
  }
}

export function createLocalizedErrorPayload(
  errorKey: string,
  fallback: string,
  errorParams?: MessageParams
) {
  return {
    error: fallback,
    errorKey,
    errorParams,
  }
}

function parseMessage(message: string): {
  key: string
  params?: MessageParams
} {
  let match = message.match(/^输入文件不存在: (.+)$/)
  if (match) {
    return { key: 'main.error.inputFileNotFound', params: { path: match[1] } }
  }

  match = message.match(/^图片文件不存在: (.+)$/)
  if (match) {
    return { key: 'main.error.imageFileNotFound', params: { path: match[1] } }
  }

  match = message.match(/^文件不存在: (.+)$/)
  if (match) {
    return { key: 'main.error.fileNotFoundWithPath', params: { path: match[1] } }
  }

  match = message.match(/^规则应用失败: (.+)$/)
  if (match) {
    return { key: 'main.error.ruleApplyFailed', params: { message: match[1] } }
  }

  match = message.match(/^图片转换失败: (.+)$/)
  if (match) {
    return { key: 'main.error.imageConversionFailed', params: { message: match[1] } }
  }

  match = message.match(/^PDF 转换失败: (.+)$/)
  if (match) {
    return { key: 'main.error.pdfConversionFailed', params: { message: match[1] } }
  }

  match = message.match(/^PDF 转换超时 \(超过 (\d+) 秒\)$/)
  if (match) {
    return { key: 'main.error.pdfConversionTimeout', params: { seconds: match[1] } }
  }

  match = message.match(/^图片转换超时 \(超过 (\d+) 秒\)$/)
  if (match) {
    return { key: 'main.error.imageConversionTimeout', params: { seconds: match[1] } }
  }

  match = message.match(/^HTML 转换失败: (.+)$/)
  if (match) {
    return { key: 'main.error.htmlConversionFailed', params: { message: match[1] } }
  }

  match = message.match(/^HTML 转换超时 \(超过 (\d+) 秒\)$/)
  if (match) {
    return { key: 'main.error.htmlConversionTimeout', params: { seconds: match[1] } }
  }

  match = message.match(/^格式转换失败: (.+)$/)
  if (match) {
    return { key: 'main.error.formatConversionFailed', params: { message: match[1] } }
  }

  match = message.match(/^格式转换超时 \(超过 (\d+) 秒\)$/)
  if (match) {
    return { key: 'main.error.formatConversionTimeout', params: { seconds: match[1] } }
  }

  match = message.match(/^无法生成唯一文件名: (.+)$/)
  if (match) {
    return { key: 'main.error.uniqueFileNameGenerationFailed', params: { path: match[1] } }
  }

  match = message.match(/^无法创建临时目录: (.+)$/)
  if (match) {
    return { key: 'main.error.tempDirectoryCreateFailed', params: { message: match[1] } }
  }

  match = message.match(/^无法创建临时文件: (.+)$/)
  if (match) {
    return { key: 'main.error.tempFileCreateFailed', params: { message: match[1] } }
  }

  match = message.match(/^无法创建空临时文件: (.+)$/)
  if (match) {
    return { key: 'main.error.emptyTempFileCreateFailed', params: { message: match[1] } }
  }

  match = message.match(/^无法创建备份目录: (.+)$/)
  if (match) {
    return { key: 'main.error.backupDirectoryCreateFailed', params: { message: match[1] } }
  }

  match = message.match(/^备份文件失败: (.+)$/)
  if (match) {
    return { key: 'main.error.backupFileFailed', params: { message: match[1] } }
  }

  match = message.match(/^未找到文件的备份记录: (.+)$/)
  if (match) {
    return { key: 'main.error.backupRecordNotFound', params: { path: match[1] } }
  }

  match = message.match(/^备份文件不存在: (.+)$/)
  if (match) {
    return { key: 'main.error.backupFileNotFound', params: { path: match[1] } }
  }

  match = message.match(/^恢复文件失败: (.+)$/)
  if (match) {
    return { key: 'main.error.restoreFileFailed', params: { message: match[1] } }
  }

  match = message.match(/^计算校验和失败: (.+)$/)
  if (match) {
    return { key: 'main.error.checksumCalculationFailed', params: { message: match[1] } }
  }

  match = message.match(/^保存路径不存在：(.+)\n请检查输出目录是否存在$/)
  if (match) {
    return { key: 'main.error.outputPathNotFound', params: { path: match[1] } }
  }

  match = message.match(
    /^文件被占用：(.+)\n\n可能的原因：\n• 文件在PowerPoint中打开\n• 文件在其他程序中使用\n• 文件被系统锁定\n\n解决方法：\n1\. 关闭所有打开该文件的程序\n2\. 如果覆盖原文件，请先关闭PowerPoint\n3\. 或者选择保存到新文件$/
  )
  if (match) {
    return { key: 'main.error.fileInUse', params: { file: match[1] } }
  }

  match = message.match(/^没有权限保存文件：(.+)\n请检查文件夹权限或以管理员身份运行$/)
  if (match) {
    return { key: 'main.error.saveFilePermissionDenied', params: { path: match[1] } }
  }

  match = message.match(
    /^LibreOffice 未安装或不可用。(.+)需要 LibreOffice。\n应用已内置 LibreOffice，如果此错误持续出现，请联系技术支持。$/
  )
  if (match) {
    return { key: 'main.error.libreOfficeUnavailable', params: { feature: match[1] } }
  }

  match = message.match(/^读取日志文件失败: (.+)$/)
  if (match) {
    return { key: 'main.error.readLogFileFailed', params: { message: match[1] } }
  }

  match = message.match(/^保存文件失败：(.+)$/)
  if (match) {
    return { key: 'main.error.saveFileFailed', params: { message: match[1] } }
  }

  switch (message) {
    case 'Ghostscript 不可用':
      return { key: 'main.error.ghostscriptUnavailable' }
    case 'PDF 转换失败':
      return { key: 'main.error.pdfConversionFailedGeneric' }
    case 'PDF 转换失败: 生成的文件为空':
      return { key: 'main.error.pdfFileEmpty' }
    case 'PDF 转换失败: 无法读取生成的文件':
      return { key: 'main.error.pdfFileUnreadable' }
    case 'PDF 转换失败: 生成的文件不是有效的 PDF 格式':
      return { key: 'main.error.pdfFileInvalid' }
    case '未生成图片文件':
      return { key: 'main.error.noImageFilesGenerated' }
    case 'HTML 转换失败: 未生成输出文件':
      return { key: 'main.error.htmlOutputMissing' }
    case '格式转换失败: 未生成输出文件':
      return { key: 'main.error.formatOutputMissing' }
    case '超时时间必须大于 0':
      return { key: 'main.error.timeoutMustBePositive' }
    case '没有可用的日志文件':
      return { key: 'main.error.noLogFilesAvailable' }
    case '密码错误或文件未加密':
      return { key: 'main.error.passwordIncorrectOrNotEncrypted' }
    case '恢复的文件校验和不匹配':
      return { key: 'main.error.restoredFileChecksumMismatch' }
    case '无法生成唯一的备份文件名':
      return { key: 'main.error.uniqueBackupFileNameGenerationFailed' }
    case '文件名模式必须包含 {ext} 占位符以保留文件扩展名':
      return { key: 'main.error.outputPatternMissingExtensionPlaceholder' }
    case '文件名模式包含非法字符: < > : " | ? *':
      return { key: 'main.error.outputPatternContainsIllegalCharacters' }
    case '磁盘空间不足，无法保存文件\n请清理磁盘空间后重试':
      return { key: 'main.error.insufficientDiskSpaceToSave' }
    case '保存文件失败：未知错误':
      return { key: 'main.error.saveFileUnknown' }
    case '获取登录地址失败':
      return { key: 'main.error.getLoginUrlFailed' }
    case '获取用户信息失败':
      return { key: 'main.error.getUserInfoFailed' }
    case '暂无广告':
      return { key: 'main.error.noAdvertisementAvailable' }
    case '已是最新版本':
      return { key: 'main.message.alreadyLatestVersion' }
    case '未知错误':
      return { key: 'main.error.unknown' }
    default:
      return { key: 'main.error.rawMessage', params: { message } }
  }
}

export function extractLocalizedError(error: unknown) {
  if (error instanceof Error) {
    const localizedError = error as LocalizedError
    if (localizedError.messageKey) {
      return createLocalizedErrorPayload(
        localizedError.messageKey,
        localizedError.message,
        localizedError.messageParams
      )
    }

    const { key, params } = parseMessage(error.message)
    return createLocalizedErrorPayload(key, error.message, params)
  }

  const fallback = String(error)
  return createLocalizedErrorPayload('main.error.rawMessage', fallback, { message: fallback })
}
