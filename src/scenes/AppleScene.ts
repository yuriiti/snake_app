import Phaser from 'phaser'
// Сцена с яблоками (коллекция)
import { listCells } from '../levels/parse'
import { getLevel } from '../levels/store'
import { Apples } from '../entities/Apple'
import { layoutGridContainer } from '../utils/layout'
import { LAYER_TILES, PADS } from '../constants'

export default class AppleScene extends Phaser.Scene {
  private readonly tile = LAYER_TILES.apples
  private apples?: Apples
  private layer?: Phaser.GameObjects.Container
  private rows = 0
  private cols = 0

  constructor() {
    super({ key: 'AppleScene', active: false })
  }

  create() {
    this.cameras.main.roundPixels = true
    const parsed = getLevel()
    this.rows = parsed.rows
    this.cols = parsed.cols
    // Создаём менеджер яблок и кладём слой в сцену
    this.apples = new Apples(this, listCells(parsed.apples), this.tile, PADS.apples)
    this.layer = this.apples.getLayer()
    this.layout()
    this.scale.on('resize', this.layout, this)
  }

  getApples() {
    return this.apples
  }

  private layout() {
    if (!this.layer) return
    layoutGridContainer(this, this.layer, this.cols, this.rows, this.tile)
  }
}
