import type { Telegram, WebApp, WebAppUser } from "telegram-web-app";

export type TelegramContext = {
  enabled: boolean;
  tg?: WebApp;
  initData?: string;
  user?: WebAppUser | null;
};

let cached: TelegramContext | null = null;

export function isTelegramMiniApp(): boolean {
  return typeof window !== "undefined" && !!window.Telegram?.WebApp;
}

export function initTelegram(): TelegramContext {
  if (cached) return cached;
  const inTg = isTelegramMiniApp();
  if (inTg) {
    const tg = window.Telegram!.WebApp;
    try {
      tg.ready();
    } catch {}
    try {
      tg.expand();
    } catch {}
    const initData: string | undefined = tg.initData;
    const user: WebAppUser | null = tg.initDataUnsafe?.user ?? null;
    cached = {
      enabled: true,
      tg,
      initData,
      user,
    };
    return cached;
  }
  cached = { enabled: false };
  return cached;
}

export function getTelegramContext(): TelegramContext {
  return cached ?? initTelegram();
}

export function getTelegramUser(): WebAppUser | null {
  const ctx = getTelegramContext();
  return ctx.tg?.initDataUnsafe?.user ?? ctx.user ?? null;
}

export function getTelegramInitData(): string | null {
  const ctx = getTelegramContext();
  if (!ctx.enabled) return null;
  return ctx.tg?.initData ?? ctx.initData ?? null;
}

export function preferNameFromTelegram(): string | null {
  const u = getTelegramUser();
  if (!u) return null;
  if (u.username && u.username.trim()) return u.username;
  const full = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
  return full || null;
}

// Read a field from initData (e.g., 'start_param', 'query_id', 'auth_date', 'hash')
export function getInitDataField(key: string): string | null {
  const ctx = getTelegramContext();
  if (!ctx.enabled) return null;
  // Prefer official parsed field where applicable
  if (key === "start_param") {
    return (ctx.tg?.initDataUnsafe as any)?.start_param ?? null;
  }
  const initData = ctx.tg?.initData ?? ctx.initData;
  if (!initData) return null;
  try {
    const p = new URLSearchParams(initData);
    return p.get(key);
  } catch {
    return null;
  }
}

export function getTelegramStartParam(): string | null {
  const ctx = getTelegramContext();
  return (
    (ctx.tg?.initDataUnsafe as any)?.start_param ??
    getInitDataField("start_param")
  );
}

// Helper: add Telegram auth to fetch headers
export function withTelegramAuthHeaders(init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers || {});
  const initData = getTelegramInitData();
  if (initData) headers.set("X-Telegram-Init-Data", initData);
  return { ...init, headers };
}

// Convenience: return 'hash' field from init data
export function getTelegramHash(): string | null {
  return getInitDataField("hash");
}
