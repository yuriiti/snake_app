// Простая локальная таблица лидеров в localStorage
// Хранится отдельно для каждого уровня по ключу уровня

import { t } from "../i18n";
import {
  preferNameFromTelegram,
  getTelegramUser,
  getInitDataField,
  getTelegramHash,
  getTelegramInitData,
} from "../telegram";
import { EDGE_LEADERBOARD_URL } from "../config";
import { markLevelCompleted } from "../levels/store";

export type ScoreEntry = {
  name: string;
  timeMs: number;
  steps: number;
  ts: number; // timestamp сохранения
};

const STORAGE_PREFIX = "leaderboard:";
const NAME_KEY = "playerName";

function lsGet<T = any>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function lsSet<T = any>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export function getPlayerName(): string {
  const name = (lsGet<string | null>(NAME_KEY, null) || "").trim();
  if (name) return name;
  const tgName = preferNameFromTelegram();
  if (tgName) return tgName;
  return t("leaderboard.player");
}

export function setPlayerName(name: string): void {
  lsSet(NAME_KEY, (name || "").trim());
}

export function getLeaderboard(levelKey: string): ScoreEntry[] {
  return lsGet<ScoreEntry[]>(STORAGE_PREFIX + levelKey, []);
}

export function saveLeaderboard(levelKey: string, entries: ScoreEntry[]) {
  lsSet(STORAGE_PREFIX + levelKey, entries);
}

// Try to send result to Supabase Edge Function (fire-and-forget)
async function postRemoteResult(
  levelKey: string,
  timeMs: number,
  steps: number,
  name: string
) {
  try {
    // Only attempt if we have Telegram context with hash for verification
    const user = getTelegramUser();
    const hash = getTelegramHash();
    const authDate = getInitDataField("auth_date");
    if (!user || !hash || !authDate) return;

    const payload = {
      level_key: levelKey,
      steps,
      time_ms: timeMs,
      name: name || t("leaderboard.player"),
      telegram: {
        id: String(user.id ?? ""),
        first_name: String(user.first_name ?? ""),
        last_name: String(user.last_name ?? ""),
        username: String(user.username ?? ""),
        photo_url: String(user.photo_url ?? ""),
        auth_date: String(authDate ?? ""),
        hash: String(hash ?? ""),
      },
    };

    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };
    // Provide raw initData header as an extra signal for server-side verification when applicable
    const initData = getTelegramInitData();
    if (initData)
      (headers as Record<string, string>)["X-Telegram-Init-Data"] = initData;

    await fetch(EDGE_LEADERBOARD_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      // CORS by default; no credentials needed
    });
  } catch {
    // Silently ignore remote errors; local leaderboard still works
  }
}

// Добавляет результат и возвращает ТОП-10 по времени (возр.), шаги — тай-брейк
export function addResult(
  levelKey: string,
  timeMs: number,
  steps: number,
  name = getPlayerName()
): ScoreEntry[] {
  const cur = getLeaderboard(levelKey).slice(0);
  cur.push({
    name: name || t("leaderboard.player"),
    timeMs,
    steps,
    ts: Date.now(),
  });
  cur.sort((a, b) => a.timeMs - b.timeMs || a.steps - b.steps || a.ts - b.ts);
  const top10 = cur.slice(0, 10);
  saveLeaderboard(levelKey, top10);
  // Отметим уровень как пройденный в хранилище уровней
  markLevelCompleted(levelKey);
  // Параллельно отправим результат в Edge Function (если доступен Telegram-контекст)
  void postRemoteResult(
    levelKey,
    timeMs,
    steps,
    name || t("leaderboard.player")
  );
  return top10;
}
