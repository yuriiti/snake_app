import Phaser from "phaser";
// Сцена отрисовки стен/блоков карты
import { getLevel } from "../levels/store";
import { Block } from "../entities/Block";
import { layoutGridContainer } from "../utils/layout";
import { LAYER_TILES } from "../constants";

export default class MapScene extends Phaser.Scene {
  private readonly tile = LAYER_TILES.map;
  private container?: Phaser.GameObjects.Container;
  private rows = 0;
  private cols = 0;

  constructor() {
    super({ key: "MapScene", active: false });
  }

  preload() {}

  create() {
    this.cameras.main.roundPixels = true;
    // Берём данные уровня из общего хранилища
    const { rows, cols, walls } = getLevel();
    this.rows = rows;
    this.cols = cols;

    // Контейнер для отрисовки блоков
    this.container = this.add.container(0, 0);

    // Создаём сущности блоков и добавляем их спрайты
    const blocks = Block.fromWalls(walls);
    for (const b of blocks) {
      // Добавляем спрайт блока (ключ текстуры по умолчанию)
      this.container.add(b.addTo(this, this.tile));
    }

    this.layout();
    this.scale.on("resize", this.layout, this);
  }

  private layout() {
    if (!this.container) return;
    layoutGridContainer(this, this.container, this.cols, this.rows, this.tile);
  }
}
