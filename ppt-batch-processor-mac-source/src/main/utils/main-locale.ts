import zhMessages from '../../locales/zh.json'

type MessageParams = Record<string, string | number>

const messages = zhMessages as Record<string, string>

function formatMessage(message: string, params?: MessageParams): string {
  if (!params) return message

  return message.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = params[key]
    return value === undefined ? `{${key}}` : String(value)
  })
}

export function getMainText(
  key: string,
  fallback?: string,
  params?: MessageParams
): string {
  const template = messages[key] || fallback || key
  return formatMessage(template, params)
}
