type Scheme = 'light' | 'dark'

export type TelegramContext = {
  enabled: boolean
  tg?: TelegramWebApp
  initData?: string
  user?: TelegramUser | null
  colorScheme?: Scheme
  theme?: TelegramWebApp['themeParams']
  platform?: string
}

let cached: TelegramContext | null = null

export function isTelegramMiniApp(): boolean {
  return typeof window !== 'undefined' && !!window.Telegram?.WebApp
}

export function initTelegram(): TelegramContext {
  if (cached) return cached
  const enabled = isTelegramMiniApp()
  if (!enabled) {
    cached = { enabled }
    return cached
  }
  const tg = window.Telegram!.WebApp
  try {
    tg.ready()
  } catch {}
  try {
    tg.expand()
  } catch {}
  cached = {
    enabled: true,
    tg,
    initData: tg.initData,
    user: tg.initDataUnsafe?.user ?? null,
    colorScheme: tg.colorScheme as Scheme,
    theme: tg.themeParams,
    platform: tg.platform,
  }
  return cached
}

export function getTelegramContext(): TelegramContext {
  return cached ?? initTelegram()
}

export function getTelegramUser(): TelegramUser | null {
  return getTelegramContext().user ?? null
}

export function getTelegramAuthInitData(): string | null {
  const ctx = getTelegramContext()
  return ctx.enabled ? (ctx.initData || '') : null
}

export function preferNameFromTelegram(): string | null {
  const u = getTelegramUser()
  if (!u) return null
  if (u.username && u.username.trim()) return u.username
  const full = [u.first_name, u.last_name].filter(Boolean).join(' ').trim()
  return full || null
}

export type ThemeChangeListener = (scheme: Scheme, theme: TelegramWebApp['themeParams']) => void

export function onTelegramThemeChange(cb: ThemeChangeListener): () => void {
  const ctx = getTelegramContext()
  if (!ctx.enabled || !ctx.tg) return () => {}
  const handler = () => cb(ctx.tg!.colorScheme as Scheme, ctx.tg!.themeParams)
  try {
    ctx.tg.onEvent('themeChanged', handler)
  } catch {}
  return () => {
    try {
      ctx.tg!.offEvent('themeChanged', handler)
    } catch {}
  }
}

// Helper: add Telegram auth to fetch headers
export function withTelegramAuthHeaders(init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers || {})
  const initData = getTelegramAuthInitData()
  if (initData) headers.set('X-Telegram-Init-Data', initData)
  return { ...init, headers }
}
