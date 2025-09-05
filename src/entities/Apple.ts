import Phaser from "phaser";
import { Cell } from "../levels/parse";
import { ensureSquareTexture } from "../utils/graphics";
import { TEXTURE_KEYS, COLORS, RADIUS } from "../constants";
import { GridEntity } from "../game/GridEntity";

// Отдельное яблоко и менеджер коллекции яблок на сетке
export class Apple {
  sprite?: Phaser.GameObjects.Image;
  glow?: Phaser.FX.Glow;
  tween?: Phaser.Tweens.Tween;
  constructor(public x: number, public y: number) {}
}

export class Apples extends GridEntity {
  private map: Map<string, Apple> = new Map();

  constructor(
    scene: Phaser.Scene,
    positions: Cell[],
    tile: number,
    pad: number,
    parent?: Phaser.GameObjects.Container
  ) {
    super(scene, tile, pad, parent);
    this.ensureTexture();
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
    return this.map.has(`${x},${y}`);
  }

  // Съесть яблоко в клетке (при наличии), вернуть успех
  eatAt(x: number, y: number): boolean {
    const key = `${x},${y}`;
    const a = this.map.get(key);
    if (!a) return false;
    a.tween?.remove();
    a.sprite?.destroy();
    this.map.delete(key);
    // Уведомим слушателей (например, сцену портала) о количестве
    this.scene.events.emit("applesLeft", this.map.size);
    return true;
  }

  private addApple(x: number, y: number) {
    const key = `${x},${y}`;
    const img = this.scene.add.image(
      x * this.tile + this.pad,
      y * this.tile + this.pad,
      TEXTURE_KEYS.apple
    );
    img.setOrigin(0, 0);
    this.layer.add(img);

    // Эффект свечения и лёгкое "дыхание" через твины
    const outerMin = 3.5;
    const outerMax = 5;
    const duration = 400;
    const hold = 100;
    const repeatDelay = 10;

    const glow = img.postFX.addGlow(COLORS.apple, outerMin, 0, false, 1, 20);

    const tween = this.scene.tweens.add({
      targets: glow,
      outerStrength: { from: outerMin, to: outerMax },
      duration,
      ease: "Sine.InOut",
      yoyo: true,
      hold,
      repeatDelay,
      repeat: -1,
    });

    const a = new Apple(x, y);
    a.sprite = img;
    a.glow = glow;
    a.tween = tween;
    this.map.set(key, a);
  }

  private ensureTexture() {
    const key = TEXTURE_KEYS.apple;
    if (this.scene.textures.exists(key)) return;
    const s = this.tile - this.pad * 2;
    ensureSquareTexture(this.scene, key, s, COLORS.apple, RADIUS);
  }
}
