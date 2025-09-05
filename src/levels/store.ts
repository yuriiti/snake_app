// Хранилище данных уровня: единоразовый парсинг и общий доступ
import { ParsedLevel, parseLevel } from './parse'
import LEVELS from './levels.json'

export type LevelDef = { key: string; map: string[] }

const LEVEL_LIST = (LEVELS as unknown as LevelDef[]) || []
let currentIndex = 0

let cached: ParsedLevel | null = null

// Возвращает массив уровней из единого JSON
export function getLevels(): LevelDef[] {
  return LEVEL_LIST
}

// Возвращает map активного уровня
export function getLevelMap(): string[] {
  return LEVEL_LIST[currentIndex]?.map ?? []
}

// Возвращает разобранный уровень (кешируется между сценами)
export function getLevel(): ParsedLevel {
  if (!cached) cached = parseLevel(getLevelMap())
  return cached
}

// Удобный доступ к размерам карты
export function getLevelSize(): { cols: number; rows: number } {
  const { cols, rows } = getLevel()
  return { cols, rows }
}

// Сбрасывает кеш разбора уровня, чтобы пересоздать сущности при рестарте
export function resetLevelCache() {
  cached = null
}

// Текущий индекс уровня
export function getCurrentLevelIndex(): number {
  return currentIndex
}

// Выбрать текущий уровень по индексу и сбросить кеш разбора
export function selectLevel(index: number): void {
  if (Number.isFinite(index) && index >= 0 && index < LEVEL_LIST.length) {
    currentIndex = index
  } else {
    currentIndex = 0
  }
  resetLevelCache()
}

// Выбрать уровень по ключу, вернуть true если найден
export function selectLevelByKey(key: string): boolean {
  const idx = LEVEL_LIST.findIndex((l) => l.key === key)
  if (idx >= 0) {
    selectLevel(idx)
    return true
  }
  return false
}

// ---------------- Completed levels tracking in localStorage ----------------
// Храним список ключей уровней через запятую в localStorage по ключу 'levels'
const COMPLETED_LEVELS_KEY = 'levels'

function getCompletedLevelsRaw(): string {
  try {
    return localStorage.getItem(COMPLETED_LEVELS_KEY) || ''
  } catch {
    return ''
  }
}

function setCompletedLevelsRaw(value: string): void {
  try {
    localStorage.setItem(COMPLETED_LEVELS_KEY, value)
  } catch {
    // ignore
  }
}

function parseLevels(list: string): string[] {
  return list
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

function stringifyLevels(arr: string[]): string {
  return arr.join(',')
}

export function isLevelCompleted(levelKey: string): boolean {
  const raw = getCompletedLevelsRaw()
  if (!raw) return false
  const arr = parseLevels(raw)
  return arr.includes(levelKey)
}

export function markLevelCompleted(levelKey: string): void {
  const raw = getCompletedLevelsRaw()
  // Ensure uniqueness of the list before adding
  const unique = Array.from(new Set(parseLevels(raw)))
  if (!unique.includes(levelKey)) {
    unique.push(levelKey)
  }
  // Persist a canonical, de-duplicated list
  setCompletedLevelsRaw(stringifyLevels(unique))
}
