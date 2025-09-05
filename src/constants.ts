// Ключи текстур, используемые в игре
export const TEXTURE_KEYS = {
  block: "block",
  apple: "apple",
  snakeHead: "snake_head",
  snakeBodyBlue: "snake_body_blue",
  snakeBodySky: "snake_body_sky",
  portalActive: "portal_active",
  portalInactive: "portal_inactive",
} as const;

// Палитра цветов (0xRRGGBB)
export const COLORS = {
  background: 0x0e0e10,
  block: 0x6b7280,
  apple: 0xe74c3c,
  snake: {
    head: 0x1ddb6c,
    blue: 0x1e8247,
    sky: 0x1e8247,
  },
  portal: {
    active: 0xf0d46a,
    inactive: 0x2c3e50,
  },
} as const;

// Размеры тайла и отступы для разных слоёв (настраиваются независимо)
export const TILE = 128;
export const LAYER_TILES = {
  map: TILE,
  apples: TILE,
  snake: TILE,
  portal: TILE,
} as const;

export const PADS = {
  map: 0,
  apples: 34,
  snake: 12,
  portal: 16,
  block: 4,
} as const;

// Радиус скругления для процедурных текстур
export const RADIUS = 12;

// Конфигурация фоновой сетки
export const GRID = {
  cell: LAYER_TILES.map,
  color: 0xffffff,
  alpha: 0.06,
  thickness: 1,
  pad: 50,
} as const;
