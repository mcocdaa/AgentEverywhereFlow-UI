import { useCallback, useEffect, useState } from 'react'
import { translations, type Locale, type Translations } from './translations'

const LOCALE_STORAGE_KEY = 'aef_desktop_locale'

function readStoredLocale(): Locale {
  if (typeof window === 'undefined') return 'zh-CN'
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY)
    if (stored === 'zh-CN' || stored === 'en-US') return stored
  } catch {
    // ignore storage failures
  }
  return 'zh-CN'
}

export function useLocale(): {
  locale: Locale
  t: Translations
  toggleLocale: () => void
  setLocale: (next: Locale) => void
} {
  const [locale, setLocaleState] = useState<Locale>(readStoredLocale)

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === LOCALE_STORAGE_KEY && (event.newValue === 'zh-CN' || event.newValue === 'en-US')) {
        setLocaleState(event.newValue)
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next)
    } catch {
      // ignore storage failures
    }
  }, [])

  const toggleLocale = useCallback(() => {
    setLocale(locale === 'zh-CN' ? 'en-US' : 'zh-CN')
  }, [locale, setLocale])

  return {
    locale,
    t: translations[locale],
    toggleLocale,
    setLocale,
  }
}
