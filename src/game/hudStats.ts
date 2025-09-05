// Глобальное хранилище статистики HUD: таймер и шаги

let steps = 0
let startTs = now()
let stoppedElapsedMs: number | null = null

function now(): number {
  if (typeof performance !== 'undefined' && performance.now) return performance.now()
  return Date.now()
}

// Сбрасывает счётчики времени и шагов
export function resetHudStats(): void {
  steps = 0
  startTs = now()
  stoppedElapsedMs = null
}

// Увеличивает количество шагов и возвращает новое значение
export function incSteps(delta = 1): number {
  steps += delta
  return steps
}

// Текущее количество шагов
export function getSteps(): number {
  return steps
}

// Метка старта таймера (ms, от performance.now или Date.now)
export function getStartTs(): number {
  return startTs
}

// Прошедшее время с момента старта (ms)
export function getElapsedMs(): number {
  if (stoppedElapsedMs !== null) return stoppedElapsedMs
  return Math.max(0, now() - startTs)
}

// Останавливает таймер, фиксируя прошедшее время на текущий момент
export function stopTimer(): void {
  if (stoppedElapsedMs === null) {
    stoppedElapsedMs = Math.max(0, now() - startTs)
  }
}
