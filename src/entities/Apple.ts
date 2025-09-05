import Phaser from "phaser";
import { Cell } from "../levels/parse";
import { ensureSquareTexture } from "../utils/graphics";
import { TEXTURE_KEYS, COLORS, RADIUS } from "../constants";
import { GridEntity } from "../game/GridEntity";

// Отдельное яблоко и менеджер коллекции яблок на сетке
export class Apple {
  sprite?: Phaser.GameObjects.Image;
  constructor(public x: number, public y: number) {}
}

export class Apples extends GridEntity {
  private map: Map<string, Apple> = new Map();
  private textureKey: string;

  constructor(
    scene: Phaser.Scene,
    positions: Cell[],
    tile: number,
    pad: number,
    parent?: Phaser.GameObjects.Container
  ) {
    super(scene, tile, pad, parent);
    this.textureKey = this.ensureTexture();
    for (const p of positions) this.addApple(p.x, p.y);
  }

  // Добавляет слой яблок в переданный контейнер
  addTo(parent: Phaser.GameObjects.Container) {
    parent.add(this.layer);
  }

  count() {
    return this.map.size;
  }

  positionsSet(): Set<string> {
    return new Set(Array.from(this.map.keys()));
  }

  hasAt(x: number, y: number) {
    return this.map.has(this.posKey(x, y));
  }

  // Съесть яблоко в клетке (при наличии), вернуть успех
  eatAt(x: number, y: number): boolean {
    const key = this.posKey(x, y);
    const a = this.map.get(key);
    if (!a) return false;
    a.sprite?.destroy();
    this.map.delete(key);
    // Уведомим слушателей (например, сцену портала) о количестве
    this.scene.events.emit("applesLeft", this.map.size);
    return true;
  }

  private addApple(x: number, y: number) {
    const key = this.posKey(x, y);
    const img = this.scene.add.image(
      x * this.tile + this.pad,
      y * this.tile + this.pad,
      this.textureKey
    );
    img.setOrigin(0, 0);
    this.layer.add(img);

    const a = new Apple(x, y);
    a.sprite = img;
    this.map.set(key, a);
  }

  private ensureTexture(): string {
    // Привязываем размер к ключу, чтобы избежать переиспользования чужой текстуры
    const s = this.tile - this.pad * 2;
    const key = `${TEXTURE_KEYS.apple}_${s}`;
    ensureSquareTexture(this.scene, key, s, COLORS.apple, RADIUS);
    return key;
  }

  private posKey(x: number, y: number) {
    return `${x},${y}`;
  }

  destroy() {
    // Явная очистка ресурсов
    for (const a of this.map.values()) a.sprite?.destroy();
    this.map.clear();
    this.layer.destroy(true);
  }
}
