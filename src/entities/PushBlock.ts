import Phaser from "phaser";
import { Cell } from "../levels/parse";
import { GridEntity } from "../game/GridEntity";
import { ensureSquareTexture } from "../utils/graphics";
import { TEXTURE_KEYS, COLORS } from "../constants";

export class PushBlocks extends GridEntity {
  private rows: number;
  private cols: number;
  private key!: string;
  // key: "x,y" -> sprite
  private map: Map<string, Phaser.GameObjects.Image> = new Map();

  constructor(
    scene: Phaser.Scene,
    rows: number,
    cols: number,
    positions: Cell[],
    tile: number,
    pad: number,
    parent?: Phaser.GameObjects.Container
  ) {
    super(scene, tile, pad, parent);
    this.rows = rows;
    this.cols = cols;
    this.key = this.ensureTexture();
    for (const p of positions) this.spawn(p.x, p.y);
  }

  positionsSet(): Set<string> {
    return new Set(this.map.keys());
  }

  hasAt(x: number, y: number): boolean {
    return this.map.has(`${x},${y}`);
  }

  // Перемещение блока из (fx,fy) в (tx,ty). Возвращает Promise анимации.
  moveBlock(
    fx: number,
    fy: number,
    tx: number,
    ty: number,
    duration: number
  ): Promise<void> {
    const fromKey = `${fx},${fy}`;
    const toKey = `${tx},${ty}`;
    const spr = this.map.get(fromKey);
    if (!spr) return Promise.resolve();
    this.map.delete(fromKey);
    this.map.set(toKey, spr);
    const targetX = tx * this.tile + this.pad;
    const targetY = ty * this.tile + this.pad;
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: spr,
        x: targetX,
        y: targetY,
        duration: Math.max(40, duration),
        ease: "Sine.easeInOut",
        onComplete: () => resolve(),
      });
    });
  }

  // Применяет гравитацию к блокам: падают на 1 клетку за шаг, пока нет опоры.
  // solidsBelow(x,y) возвращает true если клетка (x, y+1) занята твёрдым объектом.
  async applyGravity(
    solidsBelow: (x: number, y: number) => boolean,
    isInside: (x: number, y: number) => boolean
  ): Promise<void> {
    // Повторяем, пока есть хотя бы один падающий блок
    while (true) {
      const fallers: Array<{ key: string; spr: Phaser.GameObjects.Image; x: number; y: number }> = [];
      for (const [key, spr] of this.map.entries()) {
        const [cx, cy] = key.split(",");
        const x = Number(cx);
        const y = Number(cy);
        const ny = y + 1;
        if (!isInside(x, ny)) {
          // Выпал за карту — удаляем
          spr.destroy();
          this.map.delete(key);
          continue;
        }
        if (!solidsBelow(x, y)) {
          fallers.push({ key, spr, x, y });
        }
      }
      if (fallers.length === 0) break;

      // Обновляем модельные координаты и ключи перед анимацией
      const newEntries: Array<[string, Phaser.GameObjects.Image]> = [];
      for (const f of fallers) {
        this.map.delete(f.key);
        const newKey = `${f.x},${f.y + 1}`;
        newEntries.push([newKey, f.spr]);
      }
      for (const [k, v] of newEntries) this.map.set(k, v);

      // Анимируем падение только у тех, кто падает
      await new Promise<void>((resolve) => {
        this.scene.tweens.add({
          targets: fallers.map((f) => f.spr),
          y: "+=" + this.tile,
          duration: 100,
          ease: "Sine.easeIn",
          onComplete: () => resolve(),
        });
      });
    }
  }

  private spawn(x: number, y: number) {
    const img = this.scene.add
      .image(x * this.tile + this.pad, y * this.tile + this.pad, this.key)
      .setOrigin(0, 0);
    this.layer.add(img);
    this.map.set(`${x},${y}`, img);
  }

  private ensureTexture(): string {
    const size = this.tile - this.pad * 2;
    const key = `${TEXTURE_KEYS.pushBlock}_${size}`;
    ensureSquareTexture(this.scene, key, size, COLORS.pushBlock);
    return key;
  }

  destroy() {
    for (const spr of this.map.values()) spr.destroy();
    this.map.clear();
    this.layer.destroy(true);
  }
}

