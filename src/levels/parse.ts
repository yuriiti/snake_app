// Базовые типы и парсер уровня из текстовой карты
export type Cell = { x: number; y: number };

export type ParsedLevel = {
  rows: number;
  cols: number;
  walls: Set<string>;
  apples: Set<string>;
  // Толкаемые блоки ("B")
  pushBlocks: Set<string>;
  portal?: Cell;
  snake?: Cell[];
};

// Разбирает массив строк карты в структуру уровня
export function parseLevel(map: string[]): ParsedLevel {
  const rows = map.length;
  const cols = map[0]?.length ?? 0;
  const walls = new Set<string>();
  const apples = new Set<string>();
  const pushBlocks = new Set<string>();
  let portal: Cell | undefined;
  let start: Cell | undefined;
  const segs: Array<{ idx: number; pos: Cell }> = [];

  for (let r = 0; r < rows; r++) {
    const line = map[r];
    for (let c = 0; c < cols; c++) {
      const ch = line[c];
      const key = `${c},${r}`;
      if (ch === "#") walls.add(key);
      if (ch === "o") apples.add(key);
      if (ch === "B") pushBlocks.add(key);
      if (ch === "P") portal = { x: c, y: r };
      if (ch === "S") start = { x: c, y: r };
      // Сегменты змейки 1..9
      if (ch >= "1" && ch <= "9")
        segs.push({ idx: Number(ch), pos: { x: c, y: r } });
    }
  }
  let snake: Cell[] | undefined;
  if (start) {
    segs.sort((a, b) => a.idx - b.idx);
    snake = [start, ...segs.map((s) => s.pos)];
  }
  return { rows, cols, walls, apples, pushBlocks, portal, snake };
}

// Формирует ключ клетки вида "x,y"
export function keyFor(c: number, r: number) {
  return `${c},${r}`;
}

// Преобразует множество ключей в массив координат
export function listCells(keys: Set<string>): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (const k of keys) {
    const [cx, cy] = k.split(",");
    out.push({ x: Number(cx), y: Number(cy) });
  }
  return out;
}
