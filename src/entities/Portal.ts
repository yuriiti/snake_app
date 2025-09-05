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
  private glow?: Phaser.FX.Glow;
  private tween?: Phaser.Tweens.Tween;

  constructor(
    scene: Phaser.Scene,
    pos: Cell | undefined,
    tile: number,
    pad: number,
    parent?: Phaser.GameObjects.Container
  ) {
    super(scene, tile, pad, parent);
    this.pos = pos;
    if (this.pos) this.spawn();
  }

  // Привязать менеджер яблок, чтобы отслеживать активность портала
  attachApples(apples: Apples) {
    this.apples = apples;
    this.updateActive();
  }

  setActive(active: boolean) {
    if (!this.sprite) return;
    this.sprite.setTexture(
      active ? TEXTURE_KEYS.portalActive : TEXTURE_KEYS.portalInactive
    );
    // При активации добавляем мягкое свечение, как у яблок
    if (active) {
      // If already animated, do nothing
      if (!this.glow) {
        const outerMin = 3.5;
        const outerMax = 5;
        const duration = 400;
        const hold = 100;
        const repeatDelay = 10;

        this.glow = this.sprite.postFX.addGlow(
          COLORS.portal.active,
          outerMin,
          0,
          false,
          1,
          20
        );
        this.tween = this.scene.tweens.add({
          targets: this.glow,
          outerStrength: { from: outerMin, to: outerMax },
          duration,
          ease: "Sine.InOut",
          yoyo: true,
          hold,
          repeatDelay,
          repeat: -1,
        });
      }
    } else {
      // Деактивация: убираем твин и эффект
      this.tween?.remove();
      this.tween = undefined;
      if (this.glow) {
        this.sprite.clearFX();
        this.glow = undefined;
      }
    }
  }

  private ensureTextures() {
    const size = this.tile - this.pad * 2;
    ensureSquareTexture(this.scene, TEXTURE_KEYS.portalInactive, size, COLORS.portal.inactive);
    ensureSquareTexture(this.scene, TEXTURE_KEYS.portalActive, size, COLORS.portal.active);
  }

  private spawn() {
    if (!this.pos) return;
    this.ensureTextures();
    const cx = this.pos.x * this.tile + this.tile / 2;
    const cy = this.pos.y * this.tile + this.tile / 2;
    const spr = this.scene.add.image(cx, cy, this.isActive() ? TEXTURE_KEYS.portalActive : TEXTURE_KEYS.portalInactive);
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
