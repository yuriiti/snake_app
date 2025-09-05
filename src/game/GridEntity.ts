import Phaser from 'phaser'

export abstract class GridEntity {
  protected scene: Phaser.Scene
  protected tile: number
  protected pad: number
  protected layer: Phaser.GameObjects.Container

  constructor(
    scene: Phaser.Scene,
    tile: number,
    pad: number,
    parent?: Phaser.GameObjects.Container,
  ) {
    // Базовый класс для сущностей, живущих в координатной сетке уровня
    this.scene = scene
    this.tile = tile
    this.pad = pad
    this.layer = scene.add.container(0, 0)
    if (parent) parent.add(this.layer)
  }

  getLayer() {
    // Контейнер для отрисовки дочерних спрайтов
    return this.layer
  }
}
