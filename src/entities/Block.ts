import Phaser from "phaser";
import { ensureSquareTexture } from "../utils/graphics";
import { TEXTURE_KEYS, COLORS, PADS } from "../constants";
import { listCells } from "../levels/parse";

export class Block {
  constructor(public x: number, public y: number) {}

  addTo(scene: Phaser.Scene, tile: number, textureKey = TEXTURE_KEYS.block) {
    const size = Math.max(1, tile - PADS.block * 2);
    // Use size-specific key to avoid reusing a texture of different dimensions
    const key =
      textureKey === TEXTURE_KEYS.block ? `${textureKey}_${size}` : textureKey;
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
}
