import Phaser from "phaser";
import SnakeScene from "./SnakeScene";
import { restartLevel } from "../game/restartLevel";
import { resetLevelCache } from "../levels/store";
import {
  getElapsedMs,
  getSteps,
  incSteps,
  resetHudStats,
} from "../game/hudStats";

// Простая HUD-сцена: показывает прошедшее время и количество шагов
export default class HudScene extends Phaser.Scene {
  private timeText?: Phaser.GameObjects.Text;
  private stepsText?: Phaser.GameObjects.Text;
  private restartText?: Phaser.GameObjects.Text;
  private backText?: Phaser.GameObjects.Text;
  // D-pad controls
  private btnUp?: Phaser.GameObjects.Container;
  private btnDown?: Phaser.GameObjects.Container;
  private btnLeft?: Phaser.GameObjects.Container;
  private btnRight?: Phaser.GameObjects.Container;

  constructor() {
    super({ key: "HudScene", active: false });
  }

  create() {
    this.cameras.main.roundPixels = true;
    // Инициализация глобальных счётчиков на старте HUD (первый запуск)
    resetHudStats();

    this.timeText = this.add.text(12, 10, "00:00:000").setDepth(1000);
    this.stepsText = this.add.text(12, 34, "0").setDepth(1000);

    // Кнопка рестарта уровня (↻) в правом верхнем углу
    this.restartText = this.add
      .text(0, 0, "↻")
      .setDepth(1000)
      .setInteractive({ useHandCursor: true });
    this.restartText.on("pointerover", () => this.restartText?.setAlpha(0.9));
    this.restartText.on("pointerout", () => this.restartText?.setAlpha(1));
    this.restartText.on("pointerdown", () => this.restartText?.setScale(0.95));
    this.restartText.on("pointerup", () => {
      this.restartText?.setScale(1);
      // Перезапуск уровня через общую функцию (сбрасывает и HUD-статистику)
      restartLevel(this);
    });

    // Кнопка возврата к выбору уровней (←)
    this.backText = this.add
      .text(0, 0, "≡")
      .setDepth(1000)
      .setInteractive({ useHandCursor: true });
    this.backText.on("pointerover", () => this.backText?.setAlpha(0.9));
    this.backText.on("pointerout", () => this.backText?.setAlpha(1));
    this.backText.on("pointerdown", () => this.backText?.setScale(0.95));
    this.backText.on("pointerup", () => {
      this.backText?.setScale(1);
      // Возврат к сцене выбора уровней: запускаем LevelSelectScene и останавливаем игровые сцены
      resetHudStats();
      resetLevelCache();
      if (!this.scene.isActive("LevelSelectScene"))
        this.scene.launch("LevelSelectScene");
      // Останавливаем игровые сцены (HUD — последним)
      const toStop = [
        "SnakeScene",
        "PortalScene",
        "AppleScene",
        "MapScene",
        "BackgroundScene",
      ];
      for (const key of toStop) this.scene.stop(key);
      this.scene.stop(); // остановить HudScene
    });

    // Подписываемся на событие шага и победы из SnakeScene
    const snakeScene = this.scene.get("SnakeScene");
    const onStep = () => {
      incSteps();
      if (this.stepsText) this.stepsText.setText(`${getSteps()}`);
    };
    snakeScene?.events.on("snakeStep", onStep);

    const onWin = () => {
      // Фиксируем текущее значение времени/шагов и открываем окно результата
      const timeMs = getElapsedMs();
      const steps = getSteps();
      if (!this.scene.isActive("ResultScene")) {
        this.scene.launch("ResultScene", { timeMs, steps });
      }
    };
    snakeScene?.events.on("levelWin", onWin);

    // Чистим обработчик при выключении
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      snakeScene?.events.off("snakeStep", onStep);
      snakeScene?.events.off("levelWin", onWin);
    });

    // D-Pad кнопки управления внизу экрана
    this.createDpad();

    // Обновление расположения при ресайзе
    this.scale.on("resize", this.layout, this);
    this.layout();
  }

  update() {
    if (!this.timeText) return;
    const elapsed = getElapsedMs();
    const mm = Math.floor(elapsed / 60000);
    const ss = Math.floor((elapsed % 60000) / 1000);
    const pad2 = (n: number) => n.toString().padStart(2, "0");
    this.timeText.setText(`${pad2(mm)}:${pad2(ss)}`);
    // Держим счётчик шагов синхронизированным (обновится сразу после ресета)
    this.stepsText?.setText(`${getSteps()}`);
  }

  private getResponsiveFontSize(): number {
    const minSide = Math.min(this.scale.width, this.scale.height);
    const size = Math.round(minSide * 0.05);
    return Phaser.Math.Clamp(size, 12, 48);
  }

  private layout() {
    // Адаптивный размер шрифта и отступы
    const fontSize = this.getResponsiveFontSize();
    const strokeThickness = Math.max(2, Math.round(fontSize * 0.18));
    const margin = Math.max(8, Math.round(fontSize * 0.6));
    const spacing = Math.round(fontSize * 0.4);

    // Применяем стиль к текстовым объектам
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

    // Раскладываем элементы
    this.timeText?.setPosition(margin, margin);
    const timeHeight = this.timeText ? this.timeText.height : fontSize;
    this.stepsText?.setPosition(margin, margin + timeHeight + spacing);

    // Правый верхний угол: ← (назад) и ↻ (рестарт)
    if (this.restartText || this.backText) {
      const w = this.scale.width;
      const gapX = Math.round(spacing * 1.25);
      const restartW = this.restartText ? this.restartText.width : 0;
      const backW = this.backText ? this.backText.width : 0;
      // Располагаем рестарт в самом правом углу
      if (this.restartText) {
        this.restartText.setPosition(w - margin - restartW, margin);
      }
      // Кнопка назад — слева от рестарта
      if (this.backText) {
        const rightEdge = this.restartText
          ? this.restartText.x - gapX
          : w - margin;
        this.backText.setPosition(rightEdge - backW, margin);
      }
    }

    // ---- D-Pad layout ----
    this.layoutDpad(margin, spacing);
  }

  // Создание одного контейнера-кнопки с фоном и стрелкой
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

    bg.on("pointerdown", () => {
      container.setScale(0.96);
      onPress();
    });
    bg.on("pointerup", () => container.setScale(1));
    bg.on("pointerout", () => container.setScale(1));

    container.add([bg, txt]);
    return container;
  }

  private createDpad() {
    const getSnake = () => this.scene.get("SnakeScene") as SnakeScene;
    this.btnUp = this.makeDirButton("↑", () => getSnake().inputDirection("up"));
    this.btnDown = this.makeDirButton("↓", () =>
      getSnake().inputDirection("down")
    );
    this.btnLeft = this.makeDirButton("←", () =>
      getSnake().inputDirection("left")
    );
    this.btnRight = this.makeDirButton("→", () =>
      getSnake().inputDirection("right")
    );
  }

  private layoutDpad(margin: number, spacing: number) {
    if (!this.btnUp || !this.btnDown || !this.btnLeft || !this.btnRight) return;
    const w = this.scale.width;
    const h = this.scale.height;

    // Размеры кнопок адаптивно к экрану
    const minSide = Math.min(w, h);
    const btnSize = Phaser.Math.Clamp(Math.round(minSide * 0.18), 44, 110);
    const gap = Math.round(btnSize * 0.2);
    const bottomY = h - 40 - margin - btnSize / 2; // центр нижней кнопки
    const centerX = Math.round(w * 0.5);

    // Обновляем фон и текст в кнопках
    const tuneButton = (btn: Phaser.GameObjects.Container) => {
      const [bg, txt] = btn.list as [
        Phaser.GameObjects.Rectangle,
        Phaser.GameObjects.Text
      ];
      bg.setSize(btnSize, btnSize);
      txt.setFontSize(Math.round(btnSize * 0.58));
      txt.setStroke("#000000", Math.max(2, Math.round(btnSize * 0.08)));
    };

    tuneButton(this.btnUp);
    tuneButton(this.btnDown);
    tuneButton(this.btnLeft);
    tuneButton(this.btnRight);

    // Расставляем крестовину около нижнего края по центру
    this.btnDown.setPosition(centerX, bottomY);
    this.btnUp.setPosition(centerX, bottomY - (btnSize + gap));
    this.btnLeft.setPosition(centerX - (btnSize + gap), bottomY);
    this.btnRight.setPosition(centerX + (btnSize + gap), bottomY);
  }
}
