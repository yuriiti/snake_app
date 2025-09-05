import Phaser from "phaser";
import { COLORS, GRID, LAYER_TILES, PADS } from "../constants";
import { getLevel, getLevelMap, resetLevelCache } from "../levels/store";
import { Block } from "../entities/Block";
import { Portal } from "../entities/Portal";
import { Snake } from "../entities/Snake";
import { Apples } from "../entities/Apple";
import { listCells } from "../levels/parse";
import { ensureBlockPadTexture } from "../utils/graphics";
import { computeGridLayout, layoutGridContainer } from "../utils/layout";
import {
  getElapsedMs,
  getSteps,
  incSteps,
  resetHudStats,
} from "../game/hudStats";
import { restartLevel } from "../game/restartLevel";

export default class GameScene extends Phaser.Scene {
  // Grid/level
  private rows = 0;
  private cols = 0;

  // Background
  private bg?: Phaser.GameObjects.Rectangle;
  private grid?: Phaser.GameObjects.TileSprite;

  // Map, portal, snake
  private mapContainer?: Phaser.GameObjects.Container;
  private portal?: Portal;
  private portalLayer?: Phaser.GameObjects.Container;
  private snake?: Snake;
  private apples?: Apples;

  // HUD
  private timeText?: Phaser.GameObjects.Text;
  private stepsText?: Phaser.GameObjects.Text;
  private restartText?: Phaser.GameObjects.Text;
  private backText?: Phaser.GameObjects.Text;
  private lastTimeUpdate = 0;
  private btnUp?: Phaser.GameObjects.Container;
  private btnDown?: Phaser.GameObjects.Container;
  private btnLeft?: Phaser.GameObjects.Container;
  private btnRight?: Phaser.GameObjects.Container;

  // Subscriptions
  private onApplesLeft?: (left: number) => void;

  constructor() {
    super({ key: "GameScene", active: false });
  }

  create() {
    this.cameras.main.roundPixels = true;

    // Reset HUD stats at level start
    resetHudStats();

    // --- Level data
    const parsed = getLevel();
    this.rows = parsed.rows;
    this.cols = parsed.cols;

    // --- Background and grid overlay
    const { width, height } = this.scale;
    this.bg = this.add
      .rectangle(width / 2, height / 2, width, height, COLORS.background)
      .setScrollFactor(0)
      .setOrigin(0.5, 0.5);

    const gridKey = `grid_blocks_${GRID.cell}_${GRID.pad}`;
    ensureBlockPadTexture(
      this,
      gridKey,
      GRID.cell,
      GRID.color,
      GRID.alpha,
      GRID.pad
    );
    this.grid = this.add
      .tileSprite(0, 0, width, height, gridKey)
      .setOrigin(0, 0)
      .setScrollFactor(0);

    // --- Map blocks
    this.mapContainer = this.add.container(0, 0);
    const blocks = Block.fromWalls(parsed.walls);
    for (const b of blocks) this.mapContainer.add(b.addTo(this, LAYER_TILES.map));

    // --- Portal
    this.portal = new Portal(
      this,
      parsed.portal,
      LAYER_TILES.portal,
      PADS.portal
    );
    this.portalLayer = this.portal.getLayer();

    // --- Apples manager (inlined)
    this.apples = new Apples(
      this,
      listCells(parsed.apples),
      LAYER_TILES.apples,
      PADS.apples
    );
    this.portal.attachApples(this.apples);
    // Track portal active state via applesLeft updates
    this.onApplesLeft = (left: number) => this.portal?.setActive(left === 0);
    this.events.on("applesLeft", this.onApplesLeft);

    // --- Snake
    this.snake = new Snake(this, {
      map: getLevelMap(),
      tile: LAYER_TILES.snake,
      pad: PADS.snake,
    });
    this.snake.attachApples(this.apples);

    // --- HUD: texts
    this.timeText = this.add.text(12, 10, "00:00").setDepth(1000);
    this.stepsText = this.add.text(12, 34, "0").setDepth(1000);

    // Restart button (↻)
    this.restartText = this.add
      .text(0, 0, "↻")
      .setDepth(1000)
      .setInteractive({ useHandCursor: true });
    this.restartText
      .on("pointerover", () => this.restartText?.setAlpha(0.9))
      .on("pointerout", () => this.restartText?.setAlpha(1))
      .on("pointerdown", () => this.restartText?.setScale(0.95))
      .on("pointerup", () => {
        this.restartText?.setScale(1);
        restartLevel(this);
      });

    // Back button (≡) to LevelSelect
    this.backText = this.add
      .text(0, 0, "≡")
      .setDepth(1000)
      .setInteractive({ useHandCursor: true });
    this.backText
      .on("pointerover", () => this.backText?.setAlpha(0.9))
      .on("pointerout", () => this.backText?.setAlpha(1))
      .on("pointerdown", () => this.backText?.setScale(0.95))
      .on("pointerup", () => {
        this.backText?.setScale(1);
        // Return to level select
        resetLevelCache();
        resetHudStats();
        if (!this.scene.isActive("LevelSelectScene"))
          this.scene.launch("LevelSelectScene");
        // Stop gameplay scene
        for (const key of ["GameScene"]) this.scene.stop(key);
      });

    // --- HUD: D‑Pad controls
    this.createDpad();

    // --- Events from Snake
    const onStep = () => {
      incSteps();
      this.stepsText?.setText(`${getSteps()}`);
    };
    const onWin = () => {
      const timeMs = getElapsedMs();
      const steps = getSteps();
      if (!this.scene.isActive("ResultScene"))
        this.scene.launch("ResultScene", { timeMs, steps });
    };
    this.events.on("snakeStep", onStep);
    this.events.on("levelWin", onWin);

    // Cleanup subscriptions
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.layout, this);
      this.events.off("applesLeft", this.onApplesLeft as any);
      this.events.off("snakeStep", onStep);
      this.events.off("levelWin", onWin);
    });

    // Initial layout and on resize
    this.scale.on("resize", this.layout, this);
    this.layout();
  }

  update(_time: number, _delta: number) {
    if (!this.timeText) return;
    const now = this.time.now;
    if (now - this.lastTimeUpdate < 200) return;
    this.lastTimeUpdate = now;
    const elapsed = getElapsedMs();
    const mm = Math.floor(elapsed / 60000);
    const ss = Math.floor((elapsed % 60000) / 1000);
    const pad2 = (n: number) => n.toString().padStart(2, "0");
    this.timeText.setText(`${pad2(mm)}:${pad2(ss)}`);
  }

  private layout = () => {
    const { width, height } = this.scale;

    // Background fill and grid alignment
    this.bg?.setPosition(width / 2, height / 2).setSize(width, height);
    if (this.grid) {
      const { scale, offsetX, offsetY } = computeGridLayout(
        this,
        this.cols,
        this.rows,
        LAYER_TILES.map
      );
      this.grid.setScale(scale);
      this.grid.setPosition(offsetX, offsetY);
      this.grid.setSize(this.cols * LAYER_TILES.map, this.rows * LAYER_TILES.map);
    }

    // Map, Portal, Snake scaling to grid
    if (this.mapContainer)
      layoutGridContainer(
        this,
        this.mapContainer,
        this.cols,
        this.rows,
        LAYER_TILES.map
      );
    if (this.apples)
      layoutGridContainer(
        this,
        this.apples.getLayer(),
        this.cols,
        this.rows,
        LAYER_TILES.apples
      );
    if (this.portalLayer)
      layoutGridContainer(
        this,
        this.portalLayer,
        this.cols,
        this.rows,
        LAYER_TILES.portal
      );
    if (this.snake) this.snake.layout(width, height);

    // HUD responsive layout
    this.layoutHud();
  };

  private layoutHud() {
    if (!this.timeText) return;
    const w = this.scale.width;
    const h = this.scale.height;

    const minSide = Math.min(w, h);
    const fontSize = Phaser.Math.Clamp(Math.round(minSide * 0.035), 12, 28);
    const strokeThickness = Math.max(2, Math.round(fontSize * 0.18));
    const margin = Math.max(8, Math.round(fontSize * 0.6));
    const spacing = Math.round(fontSize * 0.4);

    this.timeText
      ?.setFontSize(fontSize)
      .setStroke("#000000", strokeThickness)
      .setColor("#ffffff")
      .setFontFamily("monospace");
    this.stepsText
      ?.setFontSize(fontSize)
      .setStroke("#000000", strokeThickness)
      .setColor("#ffffff")
      .setFontFamily("monospace");
    this.restartText
      ?.setFontSize(fontSize * 1.6)
      .setStroke("#000000", strokeThickness)
      .setColor("#ffffff")
      .setFontFamily("monospace");
    this.backText
      ?.setFontSize(fontSize * 1.6)
      .setStroke("#000000", strokeThickness)
      .setColor("#ffffff")
      .setFontFamily("monospace");

    this.timeText?.setPosition(margin, margin);
    const timeHeight = this.timeText ? this.timeText.height : fontSize;
    this.stepsText?.setPosition(margin, margin + timeHeight + spacing);

    if (this.restartText || this.backText) {
      const gapX = Math.round(spacing * 1.25);
      const restartW = this.restartText ? this.restartText.width : 0;
      const backW = this.backText ? this.backText.width : 0;
      if (this.restartText) {
        this.restartText.setPosition(w - margin - restartW, margin);
      }
      if (this.backText) {
        const rightEdge = this.restartText
          ? this.restartText.x - gapX
          : w - margin;
        this.backText.setPosition(rightEdge - backW, margin);
      }
    }

    this.layoutDpad(margin);
  }

  private makeDirButton(
    label: string,
    onPress: () => void
  ): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0).setDepth(1000);
    container.setScrollFactor(0);
    const bg = this.add
      .rectangle(0, 0, 10, 10, 0xffffff, 0.08)
      .setStrokeStyle(2, 0xffffff, 0.2)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    const txt = this.add
      .text(0, 0, label, {
        fontFamily: "monospace",
        color: "#ffffff",
      })
      .setOrigin(0.5)
      .setDepth(1001);
    txt.setScrollFactor(0);
    bg.setScrollFactor(0);
    bg
      .on("pointerdown", () => {
        container.setScale(0.96);
        onPress();
      })
      .on("pointerup", () => container.setScale(1))
      .on("pointerout", () => container.setScale(1));
    container.add([bg, txt]);
    return container;
  }

  private createDpad() {
    const getSnake = () => this.snake;
    this.btnUp = this.makeDirButton("↑", () => getSnake()?.inputDirection("up"));
    this.btnDown = this.makeDirButton("↓", () => getSnake()?.inputDirection("down"));
    this.btnLeft = this.makeDirButton("←", () => getSnake()?.inputDirection("left"));
    this.btnRight = this.makeDirButton("→", () => getSnake()?.inputDirection("right"));
  }

  private layoutDpad(margin: number) {
    if (!this.btnUp || !this.btnDown || !this.btnLeft || !this.btnRight) return;
    const w = this.scale.width;
    const h = this.scale.height;
    const minSide = Math.min(w, h);
    const btnSize = Phaser.Math.Clamp(Math.round(minSide * 0.2), 44, 110);
    const gap = Math.round(btnSize * 0.2);
    const bottomY = h - 60 - margin - btnSize / 2;
    const centerX = Math.round(w * 0.5);

    const tune = (btn: Phaser.GameObjects.Container) => {
      const [bg, txt] = btn.list as [
        Phaser.GameObjects.Rectangle,
        Phaser.GameObjects.Text
      ];
      bg.setSize(btnSize, btnSize);
      txt.setFontSize(Math.round(btnSize * 0.58));
      txt.setStroke("#000000", Math.max(2, Math.round(btnSize * 0.08)));
    };
    tune(this.btnUp);
    tune(this.btnDown);
    tune(this.btnLeft);
    tune(this.btnRight);

    this.btnDown.setPosition(centerX, bottomY);
    this.btnUp.setPosition(centerX, bottomY - (btnSize + gap));
    this.btnLeft.setPosition(centerX - (btnSize + gap), bottomY);
    this.btnRight.setPosition(centerX + (btnSize + gap), bottomY);
  }
}
