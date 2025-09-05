export type Lang = 'en' | 'ru'

type Dict = Record<string, string>

const STORAGE_KEY = 'lang'

const messages: Record<Lang, Dict> = {
  en: {
    'result.title': 'Result',
    'result.nameLabel': 'Name',
    'result.changeName': '(change)',
    'result.promptName': 'Your name:',
    'result.time': 'Time',
    'result.steps': 'Steps',
    'result.leaderboardTitle': 'Leaderboard (Top 10)',
    'result.headerNo': 'No',
    'result.headerName': 'Name',
    'result.headerTime': 'Time',
    'result.headerSteps': 'Steps',
    'result.nextLevel': 'Next Level ▶',
    'result.restart': '↻ Restart',

    'leaderboard.player': 'Player',

    'ui.lang': 'EN',
  },
  ru: {
    'result.title': 'Результат',
    'result.nameLabel': 'Имя',
    'result.changeName': '(изменить)',
    'result.promptName': 'Ваше имя:',
    'result.time': 'Время',
    'result.steps': 'Шаги',
    'result.leaderboardTitle': 'Таблица лидеров (ТОП‑10)',
    'result.headerNo': '№',
    'result.headerName': 'Имя',
    'result.headerTime': 'Время',
    'result.headerSteps': 'Шаги',
    'result.nextLevel': 'След. уровень ▶',
    'result.restart': '↻ Заново',

    'leaderboard.player': 'Игрок',

    'ui.lang': 'RU',
  },
}

function detectLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'ru' || saved === 'en') return saved
  } catch {}
  const nav = (navigator?.language || navigator?.languages?.[0] || '').toLowerCase()
  return nav.startsWith('ru') ? 'ru' : 'en'
}

let current: Lang = detectLang()

const listeners = new Set<(lang: Lang) => void>()

export function getLang(): Lang {
  return current
}

export function setLang(lang: Lang) {
  if (lang === current) return
  current = lang
  try {
    localStorage.setItem(STORAGE_KEY, lang)
  } catch {}
  listeners.forEach((cb) => cb(current))
  try {
    window.dispatchEvent(new CustomEvent('i18n:change', { detail: { lang: current } }))
  } catch {}
}

export function onLangChange(cb: (lang: Lang) => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function t(key: string, params?: Record<string, string | number>): string {
  const dict = messages[current] || messages.en
  let str = dict[key] || key
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
    }
  }
  return str
}

export function cycleLang(): Lang {
  const next = current === 'ru' ? 'en' : 'ru'
  setLang(next)
  return next
}

export const availableLangs: Lang[] = ['en', 'ru']

