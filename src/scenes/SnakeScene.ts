import Phaser from "phaser";
import { getLevelMap } from "../levels/store";
import { Snake } from "../entities/Snake";
import AppleScene from "./AppleScene";
import { LAYER_TILES, PADS } from "../constants";

export default class SnakeScene extends Phaser.Scene {
  private snake?: Snake;
  private readonly tile = LAYER_TILES.snake;
  private inputZone?: Phaser.GameObjects.Zone;

  constructor() {
    super({ key: "SnakeScene", active: false });
  }

  create() {
    this.cameras.main.roundPixels = true;
    // создаём змейку
    const map = getLevelMap();
    this.snake = new Snake(this, { map, tile: this.tile, pad: PADS.snake });
    // найдём сцену с яблоками и свяжем менеджер
    const appleScene = this.scene.get("AppleScene") as AppleScene;
    const apples = appleScene?.getApples();
    if (apples) this.snake.attachApples(apples);
    this.layout();
    this.scale.on("resize", this.layout, this);
    // зонирование по краям экрана для мобильного управления
    this.setupEdgeControls();
  }

  private layout() {
    if (!this.snake) return;
    const { width, height } = this.scale;
    this.snake.layout(width, height);
    this.layoutEdgeControls(width, height);
  }

  // Создаём полноэкранную зону; направление определяется по положению тапа
  private setupEdgeControls() {
    if (this.inputZone) return;
    const zone = this.add
      .zone(0, 0, 10, 10)
      .setOrigin(0)
      .setInteractive({ useHandCursor: false })
      .setScrollFactor(0);
    zone.on("pointerdown", (p: Phaser.Input.Pointer) => {
      const dir = this.pickDirFromPointer(p);
      this.snake?.inputDirection(dir);
    });
    this.inputZone = zone;
    this.layoutEdgeControls(this.scale.width, this.scale.height);
  }

  // Растягиваем зону на весь экран
  private layoutEdgeControls(viewW: number, viewH: number) {
    if (!this.inputZone) return;
    this.inputZone.setPosition(0, 0);
    this.inputZone.setSize(viewW, viewH);
  }

  // Выбор направления по доминирующей оси относительно центра экрана
  private pickDirFromPointer(p: Phaser.Input.Pointer): "up" | "down" | "left" | "right" {
    const w = this.scale.width;
    const h = this.scale.height;
    const cx = w / 2;
    const cy = h / 2;
    const dx = p.x - cx;
    const dy = p.y - cy;
    if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? "left" : "right";
    return dy < 0 ? "up" : "down";
  }
}
