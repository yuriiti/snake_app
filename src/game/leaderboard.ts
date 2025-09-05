// Простая локальная таблица лидеров в localStorage
// Хранится отдельно для каждого уровня по ключу уровня

import { t } from "../i18n";
import { preferNameFromTelegram } from "../telegram";

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
  return top10;
}
