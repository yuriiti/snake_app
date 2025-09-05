import Phaser from "phaser";
import { getLevels, getCurrentLevelIndex } from "../levels/store";
import {
  addResult,
  getLeaderboard,
  getPlayerName,
  setPlayerName,
  type ScoreEntry,
} from "../game/leaderboard";
import { t, onLangChange } from "../i18n";
import { restartLevel, startLevelIndex } from "../game/restartLevel";

type DataIn = { timeMs: number; steps: number };

export default class ResultScene extends Phaser.Scene {
  private overlay?: Phaser.GameObjects.Rectangle;
  private panel?: Phaser.GameObjects.Container;
  private statsText?: Phaser.GameObjects.Text;
  private titleText?: Phaser.GameObjects.Text;
  private leaderboardText?: Phaser.GameObjects.Text;
  private nameText?: Phaser.GameObjects.Text;
  private btnNext?: Phaser.GameObjects.Text;
  private btnRestart?: Phaser.GameObjects.Text;
  private unsubLang?: () => void;

  private timeMs = 0;
  private steps = 0;
  private levelKey = "";
  private top: ScoreEntry[] = [];

  constructor() {
    super({ key: "ResultScene", active: false });
  }

  init(data: DataIn) {
    this.timeMs = data?.timeMs ?? 0;
    this.steps = data?.steps ?? 0;
  }

  create() {
    this.cameras.main.roundPixels = true;

    // Вычислим текущий уровень и добавим рекорд
    const levels = getLevels();
    const idx = getCurrentLevelIndex();
    this.levelKey = levels[idx]?.key ?? `level_${idx}`;
    this.top = addResult(this.levelKey, this.timeMs, this.steps);

    // Полупрозрачный оверлей
    const { width, height } = this.scale;
    this.overlay = this.add
      .rectangle(0, 0, width, height, 0x000000, 0.8)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: false });
    // Контейнер панели
    this.panel = this.add.container(0, 0);

    // Заголовок
    this.titleText = this.add
      .text(0, 0, t("result.title"))
      .setFontFamily("monospace")
      .setFontStyle("bold")
      .setColor("#ffffff")
      .setStroke("#000", 4);
    this.panel.add(this.titleText);

    // Имя игрока (кликабельно для изменения)
    this.nameText = this.add
      .text(
        0,
        0,
        `${t("result.nameLabel")}: ${getPlayerName()}  ${t(
          "result.changeName"
        )}`
      )
      .setFontFamily("monospace")
      .setColor("#dddddd")
      .setStroke("#000", 3)
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () => this.nameText?.setAlpha(0.9))
      .on("pointerout", () => this.nameText?.setAlpha(1))
      .on("pointerup", () => {
        const cur = getPlayerName();
        const name = window.prompt(t("result.promptName"), cur) ?? cur;
        setPlayerName(name);
        // Перезапишем последнюю запись с новым именем
        this.top = getLeaderboard(this.levelKey).map((e, i) => ({ ...e }));
        // На будущее новые записи будут с новым именем
        this.refreshTexts();
      });
    this.panel.add(this.nameText);

    // Статистика: время и шаги
    this.statsText = this.add
      .text(0, 0, this.statsString())
      .setFontFamily("monospace")
      .setColor("#ffffff")
      .setStroke("#000", 3);
    this.panel.add(this.statsText);

    // Таблица лидеров (ТОП‑10)
    this.leaderboardText = this.add
      .text(0, 0, this.leaderboardString())
      .setFontFamily("monospace")
      .setColor("#ffffff")
      .setStroke("#000", 3);
    this.panel.add(this.leaderboardText);

    // Кнопки
    this.btnNext = this.add
      .text(0, 0, t("result.nextLevel"))
      .setFontFamily("monospace")
      .setColor("#00ff99")
      .setStroke("#000", 4)
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () => this.btnNext?.setAlpha(0.9))
      .on("pointerout", () => this.btnNext?.setAlpha(1))
      .on("pointerdown", () => this.btnNext?.setScale(0.98))
      .on("pointerup", () => {
        this.btnNext?.setScale(1);
        this.startNextLevel();
      });
    this.panel.add(this.btnNext);

    this.btnRestart = this.add
      .text(0, 0, t("result.restart"))
      .setFontFamily("monospace")
      .setColor("#ffdd33")
      .setStroke("#000", 4)
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () => this.btnRestart?.setAlpha(0.9))
      .on("pointerout", () => this.btnRestart?.setAlpha(1))
      .on("pointerdown", () => this.btnRestart?.setScale(0.98))
      .on("pointerup", () => {
        this.btnRestart?.setScale(1);
        // Закрыть окно и перезапустить уровень
        this.scene.stop();
        restartLevel(this);
      });
    this.panel.add(this.btnRestart);

    this.scale.on("resize", this.layout, this);
    // Обновление текстов при смене языка
    this.unsubLang = onLangChange(() => this.refreshTexts());
    // Очистка подписки на смену языка при выключении сцены
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.unsubLang) {
        try {
          this.unsubLang();
        } catch {}
        this.unsubLang = undefined;
      }
    });
    this.layout();
  }

  private formatTime(ms: number): string {
    const mm = Math.floor(ms / 60000);
    const ss = Math.floor((ms % 60000) / 1000);
    const mmm = Math.floor(ms % 1000);
    const pad2 = (n: number) => n.toString().padStart(2, "0");
    const pad3 = (n: number) => n.toString().padStart(3, "0");
    return `${pad2(mm)}:${pad2(ss)}.${pad3(mmm)}`;
  }

  private statsString(): string {
    return `${t("result.time")}: ${this.formatTime(this.timeMs)}\n${t(
      "result.steps"
    )}: ${this.steps}`;
  }

  private leaderboardString(): string {
    const nameHeader = t("result.headerName").padEnd(12, " ");
    const timeHeader = t("result.headerTime").padEnd(11, " ");
    const header = `${t("result.leaderboardTitle")}\n\n${t(
      "result.headerNo"
    )}   ${nameHeader}  ${timeHeader}  ${t("result.headerSteps")}\n`;
    const rows: string[] = [];
    const list = this.top.length ? this.top : getLeaderboard(this.levelKey);
    for (let i = 0; i < 10; i++) {
      const e = list[i];
      if (e) {
        const rank = (i + 1).toString().padStart(2, " ");
        const name = (e.name || t("leaderboard.player"))
          .padEnd(12, " ")
          .slice(0, 12);
        const time = this.formatTime(e.timeMs).padEnd(11, " ");
        const steps = e.steps.toString().padStart(4, " ");
        rows.push(`${rank}  ${name}  ${time}  ${steps}`);
      } else {
        const rank = (i + 1).toString().padStart(2, " ");
        rows.push(`${rank}  —`);
      }
    }
    return header + rows.join("\n");
  }

  private refreshTexts() {
    this.titleText?.setText(t("result.title"));
    this.nameText?.setText(
      `${t("result.nameLabel")}: ${getPlayerName()}  ${t("result.changeName")}`
    );
    this.statsText?.setText(this.statsString());
    this.leaderboardText?.setText(this.leaderboardString());
    this.btnNext?.setText(t("result.nextLevel"));
    this.btnRestart?.setText(t("result.restart"));
    this.layout(); // пересчёт размеров для корректного центрирования
  }

  private layout() {
    const { width, height } = this.scale;

    // Растягиваем подложку
    this.overlay?.setSize(width, height).setPosition(0, 0);

    if (
      !this.panel ||
      !this.titleText ||
      !this.statsText ||
      !this.leaderboardText ||
      !this.nameText ||
      !this.btnNext ||
      !this.btnRestart
    )
      return;

    // Адаптивный размер шрифта
    const base = Math.max(14, Math.round(Math.min(width, height) * 0.04));
    const small = Math.max(12, Math.round(base * 0.85));

    this.titleText.setFontSize(Math.round(base * 1.2));
    this.nameText.setFontSize(small);
    this.statsText.setFontSize(base);
    this.leaderboardText.setFontSize(small);
    this.btnNext.setFontSize(base);
    this.btnRestart.setFontSize(base);

    const pad = Math.round(base * 0.8);
    const gap = Math.round(base * 0.6);

    // Выставляем строки внутри панели столбиком
    let y = 0;
    this.titleText.setPosition(0, y);
    y += this.titleText.height + gap;
    this.nameText.setPosition(0, y);
    y += this.nameText.height + gap;
    this.statsText.setPosition(0, y);
    y += this.statsText.height + gap;
    this.leaderboardText.setPosition(0, y);
    y += this.leaderboardText.height + gap;

    // Кнопки в ряд
    this.btnRestart.setPosition(0, y);
    this.btnNext.setPosition(this.btnRestart.width + Math.round(gap * 1.5), y);

    const panelW =
      Math.max(
        this.btnNext.x + this.btnNext.width,
        this.leaderboardText.width,
        this.statsText.width,
        this.titleText.width
      ) +
      pad * 2;
    const panelH = y + this.btnNext.height + pad * 2;

    // Центрирование панели
    const px = Math.round((width - panelW) / 2);
    const py = Math.round((height - panelH) / 2);
    this.panel.setPosition(px + pad, py + pad);
  }

  private startNextLevel() {
    const levels = getLevels();
    const idx = getCurrentLevelIndex();
    const next = idx + 1;
    if (next >= levels.length) {
      // Если следующего нет — вернёмся к выбору уровней
      this.scene.stop();
      // Включим LevelSelectScene, если вдруг была остановлена
      if (!this.scene.isActive("LevelSelectScene"))
        this.scene.launch("LevelSelectScene");
      // Остановим игровые сцены
      const toStop = [
        "SnakeScene",
        "PortalScene",
        "AppleScene",
        "MapScene",
        "BackgroundScene",
        "HudScene",
      ];
      for (const key of toStop) this.scene.stop(key);
      return;
    }
    // Закрыть окно результатов и переключиться на следующий уровень
    this.scene.stop();
    this.events.emit("startNextLevel", next); // информационное событие, если понадобится
    startLevelIndex(this, next);
  }
}
