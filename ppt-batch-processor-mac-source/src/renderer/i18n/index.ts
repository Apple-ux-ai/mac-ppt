import { ref } from 'vue'

type LocaleMessages = Record<string, string>

const localeModules = import.meta.glob('../../locales/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, LocaleMessages>

const messages: Record<string, LocaleMessages> = {}

for (const [filePath, content] of Object.entries(localeModules)) {
  const match = filePath.match(/\/([^/]+)\.json$/)
  if (!match) continue

  const fileName = match[1]
  if (fileName.endsWith('.source-map')) continue

  const localeMatch = fileName.match(/(?:^|-)(zh|en)$/)
  const localeKey = localeMatch ? localeMatch[1] : fileName

  messages[localeKey] = {
    ...(messages[localeKey] || {}),
    ...content,
  }
}

function getInitialLocale(): string {
  if (typeof window === 'undefined') return 'zh'

  try {
    const saved = window.localStorage.getItem('app-settings')
    if (saved) {
      const parsed = JSON.parse(saved) as { language?: string }
      if (parsed.language) return resolveLocale(parsed.language)
    }
  } catch {
    // Ignore malformed persisted settings and fall back to browser locale.
  }

  return resolveLocale(window.navigator.language || 'zh')
}

const locale = ref(getInitialLocale())

export function getAvailableLocales(): string[] {
  return Object.keys(messages).sort((a, b) => a.localeCompare(b))
}

function resolveLocale(input: string): string {
  const normalized = input.replace(/_/g, '-')
  const underscore = normalized.replace(/-/g, '_')
  const base = normalized.split('-')[0]
  const candidates = [
    input,
    normalized,
    underscore,
    normalized.toLowerCase(),
    underscore.toLowerCase(),
    base,
    base.toLowerCase(),
    'zh',
  ]

  return candidates.find((candidate) => candidate in messages) || 'zh'
}

function formatMessage(message: string, params?: Record<string, string | number>): string {
  if (!params) return message
  return message.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = params[key]
    return value === undefined ? `{${key}}` : String(value)
  })
}

export function setLocale(nextLocale: string): string {
  const resolved = resolveLocale(nextLocale)
  locale.value = resolved
  return resolved
}

export function translate(key: string, params?: Record<string, string | number>): string {
  const activeMessages = messages[resolveLocale(locale.value)] || {}
  const fallbackMessages = messages.zh || {}
  const message = activeMessages[key] || fallbackMessages[key] || key
  return formatMessage(message, params)
}

export function useI18n() {
  return {
    locale,
    setLocale,
    t: translate,
  }
}
