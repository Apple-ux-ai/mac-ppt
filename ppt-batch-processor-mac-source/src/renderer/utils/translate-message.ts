import { translate } from '../i18n'

export function translateMessage(
  message?: string,
  messageKey?: string,
  messageParams?: Record<string, string | number>
): string {
  if (messageKey) {
    return translate(messageKey, messageParams)
  }

  if (message) {
    return translate(message, messageParams)
  }

  return ''
}
