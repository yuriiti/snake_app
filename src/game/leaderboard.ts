// Простая локальная таблица лидеров в localStorage
// Хранится отдельно для каждого уровня по ключу уровня

import { t } from "../i18n";
import { preferNameFromTelegram, getTelegramInitData } from "../telegram";
import { EDGE_LEADERBOARD_URL } from "../config";
import { markLevelCompleted } from "../levels/store";

export type ScoreEntry = {
  name: string;
  timeMs: number;
  steps: number;
  ts: number; // timestamp сохранения
};

export function getPlayerName(): string {
  const tgName = preferNameFromTelegram();
  if (tgName) return tgName;
  return t("leaderboard.player");
}

// Try to send result to Supabase Edge Function (fire-and-forget)
async function postRemoteResult(
  levelKey: string,
  timeMs: number,
  steps: number,
  name: string
) {
  try {
    // Only attempt if we have Telegram initData for verification
    const initData = getTelegramInitData();

    if (!initData) return;

    const payload = {
      level_key: levelKey,
      steps,
      time_ms: timeMs,
      name: name || t("leaderboard.player"),
      telegram: initData,
    };

    const headers: HeadersInit = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    };

    await fetch(EDGE_LEADERBOARD_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
  } catch {
    // Silently ignore remote errors; local leaderboard still works
  }
}

// Добавляет результат и возвращает ТОП-10 по времени (возр.), шаги — тай-брейк
export async function addResult(
  levelKey: string,
  timeMs: number,
  steps: number,
  name = getPlayerName()
): Promise<void> {
  // Отметим уровень как пройденный в хранилище уровней
  markLevelCompleted(levelKey);
  // Параллельно отправим результат в Edge Function (если доступен Telegram-контекст)
  await postRemoteResult(
    levelKey,
    timeMs,
    steps,
    name || t("leaderboard.player")
  );
}
