import Phaser from "phaser";
import { RADIUS } from "../constants";

// Графические помощники: создание простых процедурных текстур

// Квадратная текстура с заливкой (переиспользуется по ключу при наличии)
export function ensureSquareTexture(
  scene: Phaser.Scene,
  key: string,
  size: number,
  color: number,
  radius = RADIUS
) {
  const s = Math.max(1, Math.floor(size));
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.clear().fillStyle(color, 1);
  const r = Math.max(0, Math.min(Math.floor(radius), Math.floor(s / 2)));
  if (r > 0) g.fillRoundedRect(0, 0, s, s, r);
  else g.fillRect(0, 0, s, s);
  g.generateTexture(key, s, s);
}

// Прозрачная плитка с линиями сетки сверху и слева (тайлится без швов)
export function ensureGridTexture(
  scene: Phaser.Scene,
  key: string,
  cellSize: number,
  color: number,
  alpha = 0.25,
  thickness = 1
) {
  const s = Math.max(4, Math.floor(cellSize));
  const t = Math.max(1, Math.floor(thickness));
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.clear();
  g.fillStyle(color, alpha);
  // Top edge
  g.fillRect(0, 0, s, t);
  // Left edge
  g.fillRect(0, 0, t, s);
  g.generateTexture(key, s, s);
}

// Текстура-плитка с заполненным блоком внутри и прозрачными отступами по краям
export function ensureBlockPadTexture(
  scene: Phaser.Scene,
  key: string,
  cellSize: number,
  color: number,
  alpha = 0.2,
  pad = 8
) {
  const s = Math.max(4, Math.floor(cellSize));
  const p = Math.max(0, Math.floor(pad));
  if (scene.textures.exists(key)) return;
  const inner = Math.max(1, s - p * 2);
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.clear();
  g.fillStyle(color, alpha);
  const r = Math.max(0, Math.min(Math.floor(RADIUS), Math.floor(inner / 2)));
  if (r > 0) g.fillRoundedRect(p, p, inner, inner, r);
  else g.fillRect(p, p, inner, inner);
  g.generateTexture(key, s, s);
}
