import Phaser from "phaser";
import { Cell, keyFor, parseLevel, ParsedLevel } from "../levels/parse";
import { Apples } from "./Apple";
import { PushBlocks } from "./PushBlock";
import { ensureSquareTexture } from "../utils/graphics";
import { TEXTURE_KEYS, COLORS } from "../constants";
import { restartLevel } from "../game/restartLevel";
import { stopTimer } from "../game/hudStats";

type Dir = "up" | "down" | "left" | "right";

// Direction utilities kept close to usage for clarity
const DIR_DELTAS: Record<Dir, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

const OPPOSITE_DIR: Record<Dir, Dir> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

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
  private pushBlocks?: PushBlocks;
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
  private snakeHeadKey!: string;
  private snakeBodyKey!: string;
  private pendingPush?: Promise<void>;

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

    // Ensure snake textures are available (size-specific keys)
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

  attachPushBlocks(blocks: PushBlocks) {
    this.pushBlocks = blocks;
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

  // Единая точка запроса направления с бизнес-правилами
  private requestDirection(dir: Dir) {
    if (dir === "up" && this.allInOneColumn()) {
      // блокируем шаг и делаем короткий прыжок в step()
      this.skipNextStepWithBounce = true;
      return;
    }
    this.nextDir = dir;
  }

  // Публичный метод для мобильного/мышиного ввода: один шаг в заданном направлении
  // Использует ту же логику ограничений, что и клавиши-стрелки
  inputDirection(dir: "up" | "down" | "left" | "right") {
    if (this.won) return;
    if (this.isMoving) return;
    this.requestDirection(dir);
    this.step();
  }

  private onKeyDown(ev: KeyboardEvent) {
    if (ev.repeat) return; // без автоповтора — один шаг на нажатие
    if (this.won) return; // победа — блокируем дальнейшее управление
    if (this.isMoving) return; // во время анимации новые шаги игнорируем
    const keyToDir: Record<string, Dir | undefined> = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
    };
    const dir = keyToDir[ev.key];
    if (!dir) return;
    this.requestDirection(dir);
    // выполняем один шаг размером в клетку
    this.step();
  }
  // Основной шаг: упорядоченный пайплайн из небольших операций
  private async step() {
    // 1) Специальный bounce-кейс: короткая анимация без изменения модели
    if (this.skipNextStepWithBounce) {
      await this.performBounce();
      return;
    }
    if (this.snake.length === 0) return;

    this.dir = this.nextDir;

    // 3) Планируем перемещение: вычисляем новую голову и валидируем
    const plan = this.planMove(this.dir);
    if (!plan) return; // недопустимо: стена/границы/самоукус

    // 4) Анимация и фиксация модели
    this.isMoving = true;
    const moveAnim = this.animateMove(plan.newSnake, plan.grew);
    const pushAnim = this.pendingPush ?? Promise.resolve();
    await Promise.all([moveAnim, pushAnim]);
    this.pendingPush = undefined;
    this.scene.events.emit("snakeStep");

    // 5) Победа до гравитации (например, портал под головой)
    if (this.isWinPosition(plan.newSnake[0])) {
      this.handleWin();
      return;
    }

    // 6) Сначала гравитация толкаемых блоков, затем змейки
    await this.applyPushBlocksGravity();
    // Основная гравитация змейки
    if (await this.applyGravityOrDie(false)) return;

    // 7) Доп. гравитация при повороте (bridge mode)
    if (this.lastDir && this.dir !== this.lastDir) {
      if (await this.applyGravityOrDie(true)) return;
    }

    // 8) Поедание яблока и потенциальная доп. гравитация после исчезновения опоры
    if (plan.grew) await this.consumeAppleAndMaybeFall();

    // 9) Финальная проверка портала
    if (!this.won && this.isWinPosition(this.snake[0])) this.handleWin();

    // 10) Сохранение направления и завершение шага
    this.lastDir = this.dir;
    this.isMoving = false;
  }

  // Подготовка перемещения и валидация следующей клетки
  private planMove(
    dir: Dir
  ): { next: Cell; grew: boolean; newSnake: Cell[] } | null {
    const head = this.snake[0];
    const { dx, dy } = DIR_DELTAS[dir];
    const next = { x: head.x + dx, y: head.y + dy };
    if (!this.isInsideMap(next)) return null;
    if (this.isWall(next)) return null;
    if (this.isSelfCollision(next)) return null;
    // Если перед нами толкаемый блок — попробуем толкнуть
    if (this.pushBlocks && this.pushBlocks.hasAt(next.x, next.y)) {
      const dest = { x: next.x + dx, y: next.y + dy };
      // проверка границ и занятости клетки назначения
      if (!this.isInsideMap(dest)) return null;
      if (this.isWall(dest)) return null;
      if (this.applesMgr?.hasAt(dest.x, dest.y)) return null;
      if (this.pushBlocks.hasAt(dest.x, dest.y)) return null;
      // Клетка назначения не должна совпадать с новой змейкой (после шага)
      const grewTmp = this.applesMgr?.hasAt(next.x, next.y) ?? false;
      const tmpNewSnake: Cell[] = [
        next,
        ...this.snake.slice(
          0,
          grewTmp ? this.snake.length : this.snake.length - 1
        ),
      ];
      if (tmpNewSnake.some((s) => s.x === dest.x && s.y === dest.y))
        return null;
      // Планируем толчок: запустим анимацию параллельно со змейкой
      this.pendingPush = this.pushBlocks.moveBlock(
        next.x,
        next.y,
        dest.x,
        dest.y,
        this.moveMs
      );
    }
    const grew = this.applesMgr?.hasAt(next.x, next.y) ?? false;
    const newSnake: Cell[] = [
      next,
      ...this.snake.slice(0, grew ? this.snake.length : this.snake.length - 1),
    ];
    return { next, grew, newSnake };
  }

  private isInsideMap(p: Cell): boolean {
    return p.x >= 0 && p.y >= 0 && p.x < this.cols && p.y < this.rows;
  }

  private isWall(p: Cell): boolean {
    return this.walls.has(keyFor(p.x, p.y));
  }

  private isSelfCollision(p: Cell): boolean {
    return this.snake.some((s, i) => i !== 0 && s.x === p.x && s.y === p.y);
  }

  private async performBounce() {
    this.skipNextStepWithBounce = false;
    this.isMoving = true;
    await this.animateBounceHalf();
    this.isMoving = false;
  }

  private async applyGravityOrDie(bridgeMode: boolean): Promise<boolean> {
    const { out } = await this.applySnakeGravity(bridgeMode);
    if (out) {
      this.isMoving = false;
      this.onFallOffBottom();
      return true;
    }
    return false;
  }

  private handleWin() {
    this.won = true;
    this.flashWin();
    stopTimer();
    this.scene.events.emit("levelWin");
    this.lastDir = this.dir;
    this.isMoving = false;
  }

  private async consumeAppleAndMaybeFall() {
    const head = this.snake[0];
    if (this.applesMgr?.hasAt(head.x, head.y)) {
      this.applesMgr.eatAt(head.x, head.y);
      // Гравитация блоков может измениться после исчезновения опоры
      await this.applyPushBlocksGravity();
      await this.applyGravityOrDie(false);
    }
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
    // removed applyTexturesAndAngles()
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
      const total = grew
        ? this.snakeSprites.length - 1
        : this.snakeSprites.length; // новый сегмент не двигаем
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
      const spritesToMove = grew
        ? this.snakeSprites.slice(2)
        : this.snakeSprites.slice(1);
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
    const s = this.texSize();
    this.snakeHeadKey = `${TEXTURE_KEYS.snakeHead}_${s}`;
    this.snakeBodyKey = `${TEXTURE_KEYS.snakeBody}_${s}`;
    ensureSquareTexture(this.scene, this.snakeHeadKey, s, COLORS.snake.head);
    ensureSquareTexture(this.scene, this.snakeBodyKey, s, COLORS.snake.body);
  }

  // Выбор ключа текстуры по индексу сегмента
  private texKeyForIndex(i: number): string {
    return i === 0 ? this.snakeHeadKey : this.snakeBodyKey;
  }

  // dirDelta inlined by DIR_DELTAS

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
    // push blocks act as support you can walk on
    if (this.pushBlocks) {
      for (const k of this.pushBlocks.positionsSet()) {
        const [cx, cy] = k.split(",");
        const x = Number(cx),
          y = Number(cy);
        if (y >= 0 && y < H && x >= 0 && x < W) grid[y][x] = true;
      }
    }
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

  private async applyPushBlocksGravity() {
    if (!this.pushBlocks) return;
    // solidsBelow: true если в клетке (x, y+1) есть опора (стены, яблоки, блоки, змейка)
    const solidsBelow = (x: number, y: number) => {
      const ny = y + 1;
      if (ny >= this.rows || ny < 0) return false;
      if (this.walls.has(keyFor(x, ny))) return true;
      if (this.applesMgr?.hasAt(x, ny)) return true;
      if (this.pushBlocks?.hasAt(x, ny)) return true;
      // Змейка как опора
      for (const seg of this.snake)
        if (seg.x === x && seg.y === ny) return true;
      return false;
    };
    const isInside = (x: number, y: number) => this.isInsideMap({ x, y });
    await this.pushBlocks.applyGravity(solidsBelow, isInside);
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

  // applyTexturesAndAngles() and idxAngle() removed by request
}
