import Phaser from 'phaser'
import { resetLevelCache, selectLevel, getCurrentLevelIndex, getLevels } from '../levels/store'
import { resetHudStats } from './hudStats'

// Общая функция перезапуска уровня: сброс кеша и рестарт игровых сцен
export function restartLevel(scene: Phaser.Scene) {
  // Сброс кеша уровня
  resetLevelCache()
  // Сброс HUD статистики (таймер, шаги)
  resetHudStats()

  // Перезапуск основных игровых сцен, порядок слоёв сохраняется
  const keys = ['AppleScene', 'PortalScene', 'SnakeScene']
  for (const key of keys) {
    const sc = scene.scene.get(key)
    sc?.scene.restart()
  }

}

// Запустить уровень по индексу: выбрать, сбросить кеши и перезапустить игровые сцены
export function startLevelIndex(scene: Phaser.Scene, index: number) {
  const levels = getLevels()
  if (!(Number.isFinite(index) && index >= 0 && index < levels.length)) return
  selectLevel(index)
  resetLevelCache()
  resetHudStats()
  const keys = ['BackgroundScene', 'MapScene', 'AppleScene', 'PortalScene', 'SnakeScene', 'HudScene']
  for (const key of keys) {
    const sc = scene.scene.get(key)
    if (sc) sc.scene.restart()
    else scene.scene.launch(key)
  }
}

// Удобный переход на следующий уровень (или возврат к выбору, если дальше нет)
export function startNextLevel(scene: Phaser.Scene) {
  const idx = getCurrentLevelIndex() + 1
  const levels = getLevels()
  if (idx >= levels.length) {
    // Возвращаемся к выбору уровней
    if (!scene.scene.isActive('LevelSelectScene')) scene.scene.launch('LevelSelectScene')
    const toStop = ['SnakeScene', 'PortalScene', 'AppleScene', 'MapScene', 'BackgroundScene', 'HudScene']
    for (const key of toStop) scene.scene.stop(key)
    return
  }
  startLevelIndex(scene, idx)
}
