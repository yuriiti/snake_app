import Phaser from "phaser";
import { ensureSquareTexture } from "../utils/graphics";
import { TEXTURE_KEYS, COLORS, PADS } from "../constants";
import { listCells } from "../levels/parse";

export class Block {
  constructor(public x: number, public y: number) {}

  addTo(scene: Phaser.Scene, tile: number, textureKey = TEXTURE_KEYS.block) {
    const size = Block.sizeFor(tile);
    // Use size-specific key to avoid reusing a texture of different dimensions
    const key = Block.keyForTexture(textureKey, size);
    ensureSquareTexture(scene, key, size, COLORS.block);
    const img = scene.add.image(
      this.x * tile + PADS.block,
      this.y * tile + PADS.block,
      key
    );
    img.setOrigin(0, 0);
    return img;
  }

  static fromWalls(walls: Set<string>) {
    // Преобразуем ключи вида "x,y" в координаты и строим список блоков
    return listCells(walls).map(({ x, y }) => new Block(x, y));
  }

  private static sizeFor(tile: number) {
    return Math.max(1, tile - PADS.block * 2);
  }

  private static keyForTexture(baseKey: string, size: number) {
    return baseKey === TEXTURE_KEYS.block ? `${baseKey}_${size}` : baseKey;
  }
}
