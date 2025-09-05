import React, { useEffect, useRef } from "react";
import Phaser from "phaser";
import BackgroundScene from "./scenes/BackgroundScene";
import MapScene from "./scenes/MapScene";
import PortalScene from "./scenes/PortalScene";
import SnakeScene from "./scenes/SnakeScene";
import AppleScene from "./scenes/AppleScene";
import HudScene from "./scenes/HudScene";
import LevelSelectScene from "./scenes/LevelSelectScene";
import ResultScene from "./scenes/ResultScene";
import { COLORS } from "./constants";
import { onLangChange } from "./i18n";

const App: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const createGame = () => {
      const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        parent: containerRef.current!,
        backgroundColor: `#${COLORS.background.toString(16).padStart(6, "0")}`,
        // Order matters: HUD and Result last to be on top
        // LevelSelect starts first, others launch after selection
        scene: [
          LevelSelectScene,
          BackgroundScene,
          MapScene,
          PortalScene,
          AppleScene,
          SnakeScene,
          HudScene,
          ResultScene,
        ],
        pixelArt: true,
        render: { antialias: false },
        scale: {
          mode: Phaser.Scale.RESIZE,
          autoCenter: Phaser.Scale.CENTER_BOTH,
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
      }}
    >
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
};

export default App;
