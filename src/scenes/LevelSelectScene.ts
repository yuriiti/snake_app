import Phaser from "phaser";
import { getLevels, selectLevel } from "../levels/store";
import { getLeaderboard } from "../game/leaderboard";
import { COLORS, RADIUS } from "../constants";
import { ensureSquareTexture } from "../utils/graphics";
import { t, cycleLang } from "../i18n";

// Генерируем текстуры для кнопок уровней
const BASE_SIZE = 72;

// Начальная сцена выбора карты
export default class LevelSelectScene extends Phaser.Scene {
  private cells: Phaser.GameObjects.Container[] = [];
  private grid!: Phaser.GameObjects.Container;
  private scrollY = 0;
  private maxScrollY = 0;
  private isDragging = false;
  private dragStartY = 0;
  private dragStartScroll = 0;
  private didDrag = false;
  private langText?: Phaser.GameObjects.Text;

  constructor() {
    super({ key: "LevelSelectScene", active: true });
  }

  create() {
    this.cameras.main.roundPixels = true;

    const levels = getLevels();

    ensureSquareTexture(this, "level_cell", BASE_SIZE, COLORS.block, RADIUS);
    ensureSquareTexture(this, "level_cell_hover", BASE_SIZE, 0x8b93a6, RADIUS);
    // Отдельные текстуры для пройденного уровня
    ensureSquareTexture(this, "level_cell_done", BASE_SIZE, 0x2ecc71, RADIUS);
    ensureSquareTexture(
      this,
      "level_cell_done_hover",
      BASE_SIZE,
      0x5fe08f,
      RADIUS
    );

    // Общий контейнер для сетки уровней — масштабируется относительно экрана
    this.grid = this.add.container(0, 0);

    // Переключатель языка в правом верхнем углу
    this.langText = this.add
      .text(0, 0, t("ui.lang"))
      .setFontFamily("monospace")
      .setColor("#ffffff")
      .setStroke("#000", 3)
      .setDepth(1000)
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () => this.langText?.setAlpha(0.9))
      .on("pointerout", () => this.langText?.setAlpha(1))
      .on("pointerdown", () => this.langText?.setScale(0.97))
      .on("pointerup", () => {
        this.langText?.setScale(1);
        // Меняем язык (сохраняется в localStorage внутри i18n)
        // Перезапуск Phaser произойдёт на уровне App по событию смены языка
        cycleLang();
      });

    // Создаём контейнеры-клетки
    this.cells = levels.map((lvl, i) => {
      const completed = (getLeaderboard(lvl.key) || []).length > 0;
      const texBase = completed ? "level_cell_done" : "level_cell";
      const texHover = completed ? "level_cell_done_hover" : "level_cell_hover";
      const container = this.add.container(0, 0);
      const img = this.add.image(0, 0, texBase).setOrigin(0.5);
      const label = this.add
        .text(0, 0, `${i + 1}`)
        .setOrigin(0.5)
        .setFontFamily("monospace")
        .setFontStyle("bold")
        .setColor("#ffffff")
        .setStroke("#000", 3)
        .setDepth(11);
      container.add([img, label]);

      // Интерактивность на изображении клетки
      container.setSize(BASE_SIZE, BASE_SIZE);
      img.setInteractive({ useHandCursor: true });
      img
        .on("pointerover", () => img.setTexture(texHover))
        .on("pointerout", () => img.setTexture(texBase))
        .on("pointerdown", () => container.setScale(0.98))
        .on("pointerup", () => {
          container.setScale(1);
          // Если был жест скролла/перетаскивание — не считаем как клик
          if (!this.didDrag) this.startGame(i);
        });
      // сохранение ссылки на элементы для layout
      (container as any).__img = img;
      (container as any).__label = label;
      this.grid.add(container);
      return container;
    });

    // Скролл колесом мыши
    this.input.on(
      "wheel",
      (_pointer: any, _over: any, _dx: number, dy: number) => {
        this.setScroll(this.scrollY + dy);
      }
    );

    // Перетаскивание для скролла (глобально, не блокирует клики по кнопкам)
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      this.isDragging = true;
      this.didDrag = false;
      this.dragStartY = p.y;
      this.dragStartScroll = this.scrollY;
    });
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (!this.isDragging || !p.isDown) return;
      const dy = p.y - this.dragStartY;
      if (Math.abs(dy) > 3) this.didDrag = true;
      this.setScroll(this.dragStartScroll - dy);
    });
    this.input.on("pointerup", () => {
      this.isDragging = false;
      // didDrag сбросим немного позже, чтобы pointerup на кнопке мог его проверить
      this.time.delayedCall(0, () => (this.didDrag = false));
    });

    this.scale.on("resize", this.layout, this);
    this.layout();
  }

  private layout() {
    const { width, height } = this.scale;

    // Жёсткие отступы и размеры
    const marginX = 24; // слева/справа
    const marginTop = 60; // сверху
    const gap = 16; // расстояние между кнопками

    // Доступная область под сетку
    const availWidth = Math.max(1, width - marginX * 2);
    const viewHeight = Math.max(1, height - marginTop);

    // Количество колонок при максимальном размере кнопки
    let columns = Math.max(
      1,
      Math.floor((availWidth + gap) / (BASE_SIZE + gap))
    );
    // Реальный размер кнопки, чтобы уместиться по ширине и не превышать 120
    let cellSize = Math.floor(
      Math.min(BASE_SIZE, (availWidth - (columns - 1) * gap) / columns)
    );
    if (cellSize <= 0) {
      columns = 1;
      cellSize = Math.max(1, Math.floor(availWidth));
    }

    const rows = Math.ceil(this.cells.length / columns);
    const contentWidth = columns * cellSize + Math.max(0, columns - 1) * gap;
    const contentHeight = rows * cellSize + Math.max(0, rows - 1) * gap;

    // Позиция контейнера и ограничения скролла
    this.maxScrollY = Math.max(0, contentHeight - viewHeight);
    this.scrollY = Phaser.Math.Clamp(this.scrollY, 0, this.maxScrollY);
    this.grid
      .setScale(1)
      .setPosition(marginX, marginTop - Math.round(this.scrollY));

    // Размер и позиция переключателя языка
    if (this.langText) {
      const minSide = Math.min(width, height);
      const fontSize = Phaser.Math.Clamp(Math.round(minSide * 0.035), 12, 28);
      const strokeThickness = Math.max(2, Math.round(fontSize * 0.18));
      this.langText
        .setFontSize(fontSize)
        .setStroke("#000", strokeThickness)
        .setPosition(
          Math.round(width - marginX - this.langText.width),
          Math.round(8)
        );
    }

    // Раскладка кнопок и установка их визуального размера
    this.cells.forEach((container, idx) => {
      const col = idx % columns;
      const row = Math.floor(idx / columns);
      const x = col * (cellSize + gap) + Math.floor(cellSize / 2);
      const y = row * (cellSize + gap) + Math.floor(cellSize / 2);
      container.setPosition(x, y);

      const img = (container as any).__img as Phaser.GameObjects.Image;
      img.setDisplaySize(cellSize, cellSize);
      container.setSize(cellSize, cellSize);

      const label = (container as any).__label as Phaser.GameObjects.Text;
      const fontSize = Phaser.Math.Clamp(
        Math.round(cellSize * 0.5),
        12,
        BASE_SIZE
      );
      label.setFontSize(fontSize).setText(`${idx + 1}`);
    });
  }

  private setScroll(y: number) {
    this.scrollY = Phaser.Math.Clamp(y, 0, this.maxScrollY);
    if (this.grid) this.grid.y = 40 - Math.round(this.scrollY); // 40 = marginTop
  }

  private startGame(index: number) {
    // Запоминаем выбранный уровень
    selectLevel(index);

    // Запускаем игровые сцены в корректном порядке слоёв
    const scenes = [
      "BackgroundScene",
      "MapScene",
      "AppleScene",
      "PortalScene",
      "SnakeScene",
      "HudScene",
    ];
    for (const key of scenes) {
      if (!this.scene.isActive(key)) this.scene.launch(key);
    }

    // Убираем сцену выбора
    this.scene.stop();
  }
}
