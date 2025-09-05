import Phaser from "phaser";
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
  }
}
