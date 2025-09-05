import Phaser from "phaser";
import { COLORS, GRID } from "../constants";
// Фоновая сцена: окраска и вспомогательная сетка для ориентира
import { LAYER_TILES } from "../constants";
import { getLevel } from "../levels/store";
import { ensureBlockPadTexture } from "../utils/graphics";
import { computeGridLayout } from "../utils/layout";

export default class BackgroundScene extends Phaser.Scene {
  private bg?: Phaser.GameObjects.Rectangle;
  private grid?: Phaser.GameObjects.TileSprite;
  private rows = 0;
  private cols = 0;
  private readonly tile = LAYER_TILES.map;

  constructor() {
    super({ key: "BackgroundScene", active: false });
  }

  preload() {}

  create() {
    this.cameras.main.roundPixels = true;
    const parsed = getLevel();
    this.rows = parsed.rows;
    this.cols = parsed.cols;
    // Фон больше не использует ассеты — оставляем цвет из config
    // При желании можно добавить прямоугольник во весь экран:
    const { width, height } = this.scale;
    this.bg = this.add
      .rectangle(width / 2, height / 2, width, height, COLORS.background)
      .setScrollFactor(0)
      .setOrigin(0.5, 0.5);
    // Grid overlay replaced by tiled blocks with padding
    const gridKey = `grid_blocks_${GRID.cell}_${GRID.pad}`;
    ensureBlockPadTexture(
      this,
      gridKey,
      GRID.cell,
      GRID.color,
      GRID.alpha,
      GRID.pad
    );
    this.grid = this.add
      .tileSprite(0, 0, width, height, gridKey)
      .setOrigin(0, 0)
      .setScrollFactor(0);
    this.scale.on("resize", this.layout, this);

    this.layout();
  }

  private layout() {
    if (!this.bg) return;
    const { width, height } = this.scale;
    this.bg.setPosition(width / 2, height / 2);
    this.bg.setSize(width, height);
    if (this.grid) {
      // Выравниваем сетку по карте с помощью общего помощника
      const { scale, offsetX, offsetY } = computeGridLayout(
        this,
        this.cols,
        this.rows,
        this.tile
      );
      this.grid.setScale(scale);
      this.grid.setPosition(offsetX, offsetY);
      this.grid.setSize(this.cols * this.tile, this.rows * this.tile);
    }
  }
}
