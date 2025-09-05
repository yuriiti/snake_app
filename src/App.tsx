import React, { useEffect, useRef } from "react";
import Phaser from "phaser";
import LevelSelectScene from "./scenes/LevelSelectScene";
import ResultScene from "./scenes/ResultScene";
import GameScene from "./scenes/GameScene";
import { COLORS } from "./constants";
import { onLangChange } from "./i18n";

const App: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const createGame = () => {
      const isMobile = /Android|iPhone|iPad|iPod|Windows Phone|Mobi/i.test(
        navigator.userAgent
      );
      const powerPreference = isMobile ? "low-power" : "high-performance";
      const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        parent: containerRef.current!,
        backgroundColor: `#${COLORS.background.toString(16).padStart(6, "0")}`,
        fps: { target: 30, forceSetTimeOut: true },
        disableContextMenu: true,
        canvasStyle:
          "touch-action: none; -ms-touch-action: none; user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: rgba(0,0,0,0); -webkit-touch-callout: none; outline: none;",
        input: {
          touch: { capture: true },
          activePointers: 2,
          mouse: {
            preventDefaultDown: true,
            preventDefaultUp: true,
            preventDefaultMove: true,
            preventDefaultWheel: true,
          },
        },
        // LevelSelect starts first, others launch after selection
        scene: [
          LevelSelectScene,
          GameScene,
          ResultScene,
        ],
        pixelArt: true,
        render: {
          antialias: false,
          powerPreference,
          clearBeforeRender: true,
          desynchronized: true,
          autoMobilePipeline: true,
        },
        scale: {
          mode: Phaser.Scale.RESIZE,
          autoCenter: Phaser.Scale.CENTER_BOTH,
          autoRound: true,
          resizeInterval: 200,
          expandParent: true,
        },
      };
      return new Phaser.Game(config);
    };

    gameRef.current = createGame();

    // Полный перезапуск Phaser при смене языка
    const unsub = onLangChange(() => {
      try {
        gameRef.current?.destroy(true);
      } catch {}
      gameRef.current = createGame();
    });

    return () => {
      try {
        unsub();
      } catch {}
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#111",
        overflow: "hidden",
        touchAction: "none",
        WebkitUserSelect: "none",
        userSelect: "none",
        WebkitTapHighlightColor: "transparent",
        WebkitTouchCallout: "none",
      }}
    >
      <div
        ref={containerRef}
        style={{ width: "100%", height: "100%", touchAction: "none" }}
      />
    </div>
  );
};

export default App;
