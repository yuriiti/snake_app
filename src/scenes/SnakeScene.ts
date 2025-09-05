import Phaser from "phaser";
import { getLevelMap } from "../levels/store";
import { Snake } from "../entities/Snake";
import AppleScene from "./AppleScene";
import { LAYER_TILES, PADS } from "../constants";

export default class SnakeScene extends Phaser.Scene {
  private snake?: Snake;
  private readonly tile = LAYER_TILES.snake;

  constructor() {
    super({ key: "SnakeScene", active: false });
  }

  // Публичный метод: шаг в заданном направлении (для HUD-кнопок)
  public inputDirection(dir: "up" | "down" | "left" | "right") {
    this.snake?.inputDirection(dir);
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
    // Чистим обработчики и зону при перезапуске сцены
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.layout, this);
    });
  }

  private layout() {
    if (!this.snake) return;
    const { width, height } = this.scale;
    this.snake.layout(width, height);
  }
}
