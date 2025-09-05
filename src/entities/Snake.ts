import Phaser from "phaser";
import { Cell, keyFor, parseLevel, ParsedLevel } from "../levels/parse";
import { Apples } from "./Apple";
import { ensureSquareTexture } from "../utils/graphics";
import { TEXTURE_KEYS, COLORS } from "../constants";
import { restartLevel } from "../game/restartLevel";
import { stopTimer } from "../game/hudStats";

type Dir = "up" | "down" | "left" | "right";

export type SnakeConfig = {
  map: string[];
  tile: number;
  apples?: Apples;
  pad?: number;
};

// Змейка: управление шагами, анимация движения и "гравитация" сегментов
export class Snake {
  private scene: Phaser.Scene;
  private tile: number;
  private pad = 0;
  private rows: number;
  private cols: number;

  private walls: Set<string>;
  private applesMgr?: Apples;
  private portal?: Cell;

  private container: Phaser.GameObjects.Container;
  private snakeLayer: Phaser.GameObjects.Container;

  private snake: Cell[] = [];
  private dir: Dir = "right";
  private nextDir: Dir = "right";
  private handleKeyDown = (ev: KeyboardEvent) => this.onKeyDown(ev);
  private snakeSprites: Phaser.GameObjects.Image[] = [];
  private isMoving = false;
  private moveMs = 140;
  private fallMs = 100;
  private lastDir: Dir | null = null;
  // When true, next step is skipped with a small bounce animation
  private skipNextStepWithBounce = false;
  private won = false;

  constructor(scene: Phaser.Scene, cfg: SnakeConfig) {
    this.scene = scene;
    this.tile = cfg.tile;
    if (cfg.pad !== undefined) this.pad = cfg.pad;

    const parsed = parseLevel(cfg.map);
    this.rows = parsed.rows;
    this.cols = parsed.cols;
    this.walls = parsed.walls;
    // apples managed externally via Apples manager
    this.portal = parsed.portal;

    this.container = scene.add.container(0, 0);
    this.snakeLayer = scene.add.container(0, 0);
    this.container.add(this.snakeLayer);

    // Ensure snake textures are available
    this.ensureSnakeTextures();
    this.initSnakeFromParsed(parsed);
    this.bindInput();
  }

  getContainer() {
    return this.container;
  }

  attachApples(apples: Apples) {
    this.applesMgr = apples;
  }

  layout(viewWidth: number, viewHeight: number) {
    const mapW = this.cols * this.tile;
    const mapH = this.rows * this.tile;
    const scale = Math.min(viewWidth / mapW, viewHeight / mapH);
    const displayW = mapW * scale;
    const displayH = mapH * scale;
    const offsetX = (viewWidth - displayW) / 2;
    const offsetY = (viewHeight - displayH) / 2;
    this.container.setScale(scale);
    this.container.setPosition(offsetX, offsetY);
  }

  destroy() {
    this.scene.input.keyboard.off("keydown", this.handleKeyDown as any);
    this.container.destroy(true);
  }

  private initSnakeFromParsed(parsed: ParsedLevel) {
    if (parsed.snake && parsed.snake.length) {
      this.snake = parsed.snake.slice();
      // Вычислим начальное направление по первым двум сегментам, если есть
      if (this.snake.length >= 2) {
        const [h, n] = this.snake;
        if (n.y === h.y) this.dir = n.x < h.x ? "right" : "left";
        else this.dir = n.y < h.y ? "down" : "up";
      } else {
        this.dir = "right";
      }
      this.nextDir = this.dir;
      this.buildSnakeSprites();
      return;
    }

    // Фоллбэк: если S/сегменты не заданы — создаём короткую змейку от центра
    const s = { x: 1, y: 1 };
    this.snake = [s, { x: s.x - 1, y: s.y }, { x: s.x - 2, y: s.y }];
    this.dir = "right";
    this.nextDir = "right";
    this.buildSnakeSprites();
  }

  private bindInput() {
    this.scene.input.keyboard.on("keydown", this.handleKeyDown as any);
    // Снимаем обработчик при выключении сцены
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scene.input.keyboard.off("keydown", this.handleKeyDown as any);
    });
  }

  // Публичный метод для мобильного/мышиного ввода: один шаг в заданном направлении
  // Использует ту же логику ограничений, что и клавиши-стрелки
  inputDirection(dir: "up" | "down" | "left" | "right") {
    if (this.won) return;
    if (this.isMoving) return;
    if (dir === "up") {
      if (this.allInOneColumn()) {
        this.skipNextStepWithBounce = true;
      } else {
        this.nextDir = "up";
      }
    } else if (dir === "down") {
      this.nextDir = "down";
    } else if (dir === "left") {
      this.nextDir = "left";
    } else if (dir === "right") {
      this.nextDir = "right";
    }
    this.step();
  }

  private onKeyDown(ev: KeyboardEvent) {
    if (ev.repeat) return; // без автоповтора — один шаг на нажатие
    if (this.won) return; // победа — блокируем дальнейшее управление
    if (this.isMoving) return; // во время анимации новые шаги игнорируем
    switch (ev.key) {
      case "ArrowUp":
        if (this.allInOneColumn()) {
          // блокируем шаг и делаем короткий прыжок в step()
          this.skipNextStepWithBounce = true;
        } else {
          this.nextDir = "up";
        }
        break;
      case "ArrowDown":
        this.nextDir = "down";
        break;
      case "ArrowLeft":
        this.nextDir = "left";
        break;
      case "ArrowRight":
        this.nextDir = "right";
        break;
      default:
        return;
    }
    // выполняем один шаг размером в клетку
    this.step();
  }

  private async step() {
    // Если змейка полностью вертикальна и предыдущая команда "вверх" была запрещена —
    // не засчитываем шаг и делаем лёгкий прыжок (полклетки вверх и обратно)
    if (this.skipNextStepWithBounce) {
      this.skipNextStepWithBounce = false;
      this.isMoving = true;
      await this.animateBounceHalf();
      this.isMoving = false;
      return;
    }
    if (this.snake.length === 0) return;
    const opposite: Record<Dir, Dir> = {
      up: "down",
      down: "up",
      left: "right",
      right: "left",
    };
    if (this.nextDir !== opposite[this.dir]) this.dir = this.nextDir;

    const head = this.snake[0];
    const { dx, dy } = this.dirDelta(this.dir);
    const next = { x: head.x + dx, y: head.y + dy };

    if (next.x < 0 || next.y < 0 || next.x >= this.cols || next.y >= this.rows)
      return;
    const nextKey = keyFor(next.x, next.y);
    if (this.walls.has(nextKey)) return;
    // запрет столкновения с телом (включая хвост)
    if (this.snake.some((s, i) => i !== 0 && s.x === next.x && s.y === next.y))
      return;

    const targetHasApple = this.applesMgr?.hasAt(next.x, next.y) ?? false;
    const newSnake: Cell[] = [
      next,
      ...this.snake.slice(
        0,
        targetHasApple ? this.snake.length : this.snake.length - 1
      ),
    ];

    this.isMoving = true;
    await this.animateMove(newSnake, targetHasApple);
    // Сообщаем об успешно завершённом шаге (после анимации перемещения)
    this.scene.events.emit("snakeStep");

    // Мгновенная победа до гравитации: если портал активен и голова на портале
    if (
      this.portal &&
      (this.applesMgr?.count() ?? 0) === 0 &&
      newSnake[0].x === this.portal.x &&
      newSnake[0].y === this.portal.y
    ) {
      this.scene.cameras.main.flash(200, 255, 255, 180);
      this.won = true;
      // Остановить таймер при победе
      stopTimer();
      // Сообщаем внешним сценам (HUD) о победе
      this.scene.events.emit("levelWin");
      this.lastDir = this.dir;
      this.isMoving = false;
      return;
    }

    // Основная гравитация
    const { out: out1 } = await this.applySnakeGravity(false);
    if (out1) {
      this.isMoving = false;
      this.onFallOffBottom();
      return;
    }
    // Доп. гравитация на повороте (bridge_mode)
    if (this.lastDir && this.dir !== this.lastDir) {
      const { out: outTurn } = await this.applySnakeGravity(true);
      if (outTurn) {
        this.lastDir = this.dir;
        this.isMoving = false;
        this.onFallOffBottom();
        return;
      }
    }

    // Поедание яблока и активация портала (после гравитации)
    if (targetHasApple) {
      const head = this.snake[0];
      if (this.applesMgr?.hasAt(head.x, head.y)) {
        this.applesMgr.eatAt(head.x, head.y);
        // Доп. гравитация после исчезновения опоры (яблоко могло держать)
        const { out: outAfterEat } = await this.applySnakeGravity(false);
        if (outAfterEat) {
          this.isMoving = false;
          this.onFallOffBottom();
          return;
        }
      }
    }

    // Финальная проверка портала
    if (!this.won && this.isWinPosition(this.snake[0])) {
      this.won = true;
      this.flashWin();
      // Остановить таймер при победе
      stopTimer();
      this.scene.events.emit("levelWin");
    }
    this.lastDir = this.dir;
    this.isMoving = false;
  }

  // Падение за нижнюю границу: красная вспышка и рестарт уровня
  private onFallOffBottom() {
    // Красная вспышка камеры змейки
    this.scene.cameras.main.flash(220, 255, 0, 0);
    // Небольшая задержка, чтобы вспышка была заметна
    this.scene.time.delayedCall(250, () => restartLevel(this.scene));
  }

  // Короткий прыжок: полклетки вверх и обратно, анимируем контейнером
  private animateBounceHalf(): Promise<void> {
    return new Promise((resolve) => {
      const dy = -this.tile * 0.5;
      const startY = this.snakeLayer.y;
      this.scene.tweens.add({
        targets: this.snakeLayer,
        y: startY + dy,
        duration: Math.max(80, Math.round(this.moveMs * 0.6)),
        ease: "Sine.easeOut",
        yoyo: true,
        onComplete: () => {
          // Возвращаем точное исходное положение (на случай накопления ошибок)
          this.snakeLayer.y = startY;
          resolve();
        },
      });
    });
  }

  private buildSnakeSprites() {
    this.snakeLayer.removeAll(true);
    this.snakeSprites = [];
    for (let i = 0; i < this.snake.length; i++) {
      const seg = this.snake[i];
      // Голова — отдельный цвет; тело — чередование
      const tex = this.texKeyForIndex(i);
      const { x, y } = this.cellToSpriteCenter(seg);
      const img = this.scene.add.image(x, y, tex).setOrigin(0.5, 0.5);
      this.snakeLayer.add(img);
      this.snakeSprites.push(img);
    }
    this.applyTexturesAndAngles();
  }

  private animateMove(newSnake: Cell[], grew: boolean): Promise<void> {
    if (!this.snakeSprites.length) return Promise.resolve();

    const oldSprites = this.snakeSprites.slice();
    const prevPos = oldSprites.map((s) => ({ x: s.x, y: s.y }));
    const headTarget = this.cellToSpriteCenter(newSnake[0]);

    // Если растём — добавляем новый сегмент за головой в позицию головы до шага
    if (grew) {
      const newBody = this.scene.add
        .image(prevPos[0].x, prevPos[0].y, this.texKeyForIndex(1))
        .setOrigin(0.5, 0.5);
      this.snakeLayer.add(newBody);
      // Обновляем порядок спрайтов согласно новым индексам
      this.snakeSprites = [oldSprites[0], newBody, ...oldSprites.slice(1)];
    }

    // Анимируем плавный переход: голова к новой клетке, каждый сегмент к позиции предшественника
    return new Promise((resolve) => {
      const tweens: Phaser.Tweens.Tween[] = [];
      let done = 0;
      const total = grew ? this.snakeSprites.length - 1 : this.snakeSprites.length; // новый сегмент не двигаем
      const onOneComplete = () => {
        done += 1;
        if (done >= total) {
          // По завершении всех твинов — фиксируем модель и углы/текстуры
          this.finishMove(newSnake);
          resolve();
        }
      };

      // Голова
      tweens.push(
        this.scene.tweens.add({
          targets: this.snakeSprites[0],
          x: headTarget.x,
          y: headTarget.y,
          duration: this.moveMs,
          ease: "Sine.easeInOut",
          onComplete: onOneComplete,
        })
      );

      // Тело
      const spritesToMove = grew ? this.snakeSprites.slice(2) : this.snakeSprites.slice(1);
      const startIndex = grew ? 2 : 1; // индекс в snakeSprites, соответствующий prevPos[1]
      for (let si = 0; si < spritesToMove.length; si++) {
        const sprite = spritesToMove[si];
        const prevIndex = startIndex + si; // индекс до шага
        const target = prevPos[prevIndex - 1];
        tweens.push(
          this.scene.tweens.add({
            targets: sprite,
            x: target.x,
            y: target.y,
            duration: this.moveMs,
            ease: "Sine.easeInOut",
            onComplete: onOneComplete,
          })
        );
      }

      // Хвост двигается как часть массива slice(1) — ничего доп. не требуется
    });
  }

  private finishMove(newSnake: Cell[]) {
    this.snake = newSnake;
    this.applyTexturesAndAngles();
    // Победа: активный портал и голова совпадает
  }

  private cellToSpriteCenter(cell: Cell) {
    const s = this.texSize();
    return {
      x: cell.x * this.tile + this.pad + s / 2,
      y: cell.y * this.tile + this.pad + s / 2,
    };
  }

  private texSize() {
    return this.tile - this.pad * 2;
  }

  // --- Local snake textures: simple colored squares ---
  private ensureSnakeTextures() {
    const keyHead = TEXTURE_KEYS.snakeHead;
    const keyBlue = TEXTURE_KEYS.snakeBodyBlue;
    const keySky = TEXTURE_KEYS.snakeBodySky;
    const s = this.texSize();
    ensureSquareTexture(this.scene, keyHead, s, COLORS.snake.head);
    ensureSquareTexture(this.scene, keyBlue, s, COLORS.snake.blue);
    ensureSquareTexture(this.scene, keySky, s, COLORS.snake.sky);
  }

  // Выбор ключа текстуры по индексу сегмента
  private texKeyForIndex(i: number): string {
    if (i === 0) return TEXTURE_KEYS.snakeHead;
    return i % 2 === 0 ? TEXTURE_KEYS.snakeBodyBlue : TEXTURE_KEYS.snakeBodySky;
  }

  private dirDelta(d: Dir): { dx: number; dy: number } {
    switch (d) {
      case "up":
        return { dx: 0, dy: -1 };
      case "down":
        return { dx: 0, dy: 1 };
      case "left":
        return { dx: -1, dy: 0 };
      case "right":
      default:
        return { dx: 1, dy: 0 };
    }
  }

  private portalActive(): boolean {
    return (this.applesMgr?.count() ?? 0) === 0;
  }

  private isWinPosition(c: Cell): boolean {
    return !!(
      this.portal &&
      this.portalActive() &&
      c.x === this.portal.x &&
      c.y === this.portal.y
    );
  }

  private flashWin() {
    this.scene.cameras.main.flash(200, 255, 255, 180);
  }

  // findNearestEmpty: удалён по запросу

  private allInOneColumn() {
    if (this.snake.length === 0) return false;
    const x = this.snake[0].x;
    return this.snake.every((s) => s.x === x);
  }

  // ------- Physics (snake gravity) based on backend engine.py -------
  private supportGrid(): boolean[][] {
    const H = this.rows;
    const W = this.cols;
    const grid: boolean[][] = Array.from({ length: H }, () =>
      Array(W).fill(false)
    );
    // walls
    for (const k of this.walls) {
      const [cx, cy] = k.split(",");
      const x = Number(cx),
        y = Number(cy);
      if (y >= 0 && y < H && x >= 0 && x < W) grid[y][x] = true;
    }
    // apples are support
    if (this.applesMgr) {
      for (const k of this.applesMgr.positionsSet()) {
        const [cx, cy] = k.split(",");
        const x = Number(cx),
          y = Number(cy);
        if (y >= 0 && y < H && x >= 0 && x < W) grid[y][x] = true;
      }
    }
    // push blocks could be added here later
    return grid;
  }

  private hasSupport(requireAll: boolean): boolean {
    const solids = this.supportGrid();
    const H = solids.length;
    const W = H ? solids[0].length : 0;
    let any = false;
    for (const seg of this.snake) {
      const bx = Math.floor(seg.x);
      const by = Math.floor(seg.y) + 1;
      const supported =
        by >= 0 && by < H && bx >= 0 && bx < W && solids[by][bx];
      if (requireAll && !supported) return false;
      if (supported) any = true;
    }
    return requireAll ? true : any;
  }

  private gravityStepPossible(solids: boolean[][]): boolean {
    const H = solids.length;
    const W = H ? solids[0].length : 0;
    for (const seg of this.snake) {
      const ny = seg.y + 1;
      if (ny >= H) return false;
      const bx = Math.floor(seg.x);
      const by = Math.floor(ny);
      if (by < 0 || by >= H || bx < 0 || bx >= W) return false;
      if (solids[by][bx]) return false;
    }
    return true;
  }

  private async applySnakeGravity(
    bridgeMode: boolean
  ): Promise<{ changed: boolean; out: boolean }> {
    let changed = false;
    const solids = this.supportGrid();
    const H = solids.length;
    // quick check for support
    if (this.hasSupport(bridgeMode)) return { changed: false, out: false };
    for (const seg of this.snake) {
      if (Math.floor(seg.y) + 1 >= H) return { changed: false, out: true };
    }
    while (!this.hasSupport(bridgeMode)) {
      const sgrid = this.supportGrid();
      if (!this.gravityStepPossible(sgrid)) {
        for (const seg of this.snake) {
          if (Math.floor(seg.y) + 1 >= H) return { changed, out: true };
        }
        break;
      }
      // update model positions
      for (const seg of this.snake) seg.y += 1;
      changed = true;
      // animate sprites one tile down
      await this.animateFallByOne();
    }
    return { changed, out: false };
  }

  private animateFallByOne(): Promise<void> {
    if (!this.snakeSprites.length) return Promise.resolve();
    // Оптимизация: один твин на контейнер, затем фиксация абсолютных координат спрайтов
    return new Promise((resolve) => {
      const delta = this.tile;
      const startY = this.snakeLayer.y;
      this.scene.tweens.add({
        targets: this.snakeLayer,
        y: startY + delta,
        duration: this.fallMs,
        ease: "Sine.easeIn",
        onComplete: () => {
          // Переносим смещение контейнера в локальные координаты спрайтов
          for (const s of this.snakeSprites) s.y += delta;
          this.snakeLayer.y = startY; // контейнер возвращаем
          resolve();
        },
      });
    });
  }

  // ---------- Orientation helpers ----------
  private idxAngle(i: number): number {
    const n = this.snake.length;
    if (n === 0) return 0;
    const degFromVec = (dx: number, dy: number) => {
      if (dx === 1 && dy === 0) return 0; // right
      if (dx === -1 && dy === 0) return 180; // left
      if (dx === 0 && dy === 1) return 90; // down
      if (dx === 0 && dy === -1) return -90; // up
      return 0;
    };
    if (i === 0 && n >= 2) {
      const a = this.snake[1];
      const b = this.snake[0];
      return degFromVec(b.x - a.x, b.y - a.y);
    }
    if (i === n - 1 && n >= 2) {
      const a = this.snake[n - 2];
      const b = this.snake[n - 1];
      return degFromVec(b.x - a.x, b.y - a.y);
    }
    if (i > 0 && i < n - 1) {
      const a = this.snake[i - 1];
      const c = this.snake[i + 1];
      // axis-based orientation (straight segments)
      if (a.x === c.x) return 90; // vertical
      return 0; // horizontal or corner
    }
    return 0;
  }

  private applyTexturesAndAngles() {
    for (let i = 0; i < this.snakeSprites.length; i++) {
      const sprite = this.snakeSprites[i];
      const key = this.texKeyForIndex(i);
      if (sprite.texture.key !== key) sprite.setTexture(key);
      sprite.setAngle(this.idxAngle(i));
    }
  }
}
