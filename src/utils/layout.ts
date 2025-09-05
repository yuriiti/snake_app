import Phaser from 'phaser'

// Вспомогательные функции для вычисления масштаба и позиционирования
// контейнеров на экране относительно размеров сетки уровня

export type GridLayout = {
  scale: number
  offsetX: number
  offsetY: number
}

export function computeGridLayout(
  scene: Phaser.Scene,
  cols: number,
  rows: number,
  tile: number,
): GridLayout {
  const { width, height } = scene.scale
  const mapW = cols * tile
  const mapH = rows * tile
  const scale = Math.min(width / mapW, height / mapH)
  const displayW = mapW * scale
  const displayH = mapH * scale
  const offsetX = (width - displayW) / 2
  const offsetY = (height - displayH) / 2
  return { scale, offsetX, offsetY }
}

export function layoutGridContainer(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  cols: number,
  rows: number,
  tile: number,
) {
  // Применяем рассчитанные параметры к контейнеру
  const { scale, offsetX, offsetY } = computeGridLayout(scene, cols, rows, tile)
  container.setScale(scale)
  container.setPosition(offsetX, offsetY)
}
