import Phaser from "phaser";
import { Cell } from "../levels/parse";
import type { Apples } from "./Apple";
import { ensureSquareTexture } from "../utils/graphics";
import { TEXTURE_KEYS, COLORS } from "../constants";
import { GridEntity } from "../game/GridEntity";

// Портал: неактивен, пока на карте есть яблоки. Активируется и пульсирует.
export class Portal extends GridEntity {
  private sprite?: Phaser.GameObjects.Image;
  private apples?: Apples;
  private pos?: Cell;
  private keyInactive!: string;
  private keyActive!: string;

  constructor(
    scene: Phaser.Scene,
    pos: Cell | undefined,
    tile: number,
    pad: number,
    parent?: Phaser.GameObjects.Container
  ) {
    super(scene, tile, pad, parent);
    this.pos = pos;
    // Подготовим текстуры, привязанные к текущему размеру
    this.ensureTextures();
    if (this.pos) this.spawn();
  }

  // Привязать менеджер яблок, чтобы отслеживать активность портала
  attachApples(apples: Apples) {
    this.apples = apples;
    this.updateActive();
  }

  setActive(active: boolean) {
    if (!this.sprite) return;
    this.sprite.setTexture(active ? this.keyActive : this.keyInactive);
    // Убраны свечение и твины — только смена текстуры
  }

  private ensureTextures() {
    const size = this.tile - this.pad * 2;
    this.keyInactive = `${TEXTURE_KEYS.portalInactive}_${size}`;
    this.keyActive = `${TEXTURE_KEYS.portalActive}_${size}`;
    ensureSquareTexture(this.scene, this.keyInactive, size, COLORS.portal.inactive);
    ensureSquareTexture(this.scene, this.keyActive, size, COLORS.portal.active);
  }

  private spawn() {
    if (!this.pos) return;
    this.ensureTextures();
    const cx = this.pos.x * this.tile + this.tile / 2;
    const cy = this.pos.y * this.tile + this.tile / 2;
    const spr = this.scene.add.image(
      cx,
      cy,
      this.isActive() ? this.keyActive : this.keyInactive
    );
    spr.setOrigin(0.5, 0.5);
    this.layer.add(spr);
    this.sprite = spr;
    // Запустим анимацию, если изначально активен
    if (this.isActive()) this.setActive(true);
  }

  private isActive() {
    // Если менеджер яблок ещё не привязан — считаем неактивным
    return this.apples ? this.apples.count() === 0 : false;
  }

  private updateActive() {
    this.setActive(this.isActive());
  }
}
