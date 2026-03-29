import { getHexagramStatic, type HexagramStatic } from '../data/ichingTexts';

export type IChingLine = {
  value: number;
  isYang: boolean;
  isChanging: boolean;
};

export type IChingHexagram = HexagramStatic & {
  lines: IChingLine[];
  changingTo?: number;
};

/** Таблица Кинг Вэна: строка и столбец — триграммы в порядке 乾…坤 (бинарно 7…0) */
const KW_MATRIX: number[][] = [
  [1, 43, 14, 34, 9, 5, 26, 11],
  [10, 58, 38, 54, 61, 60, 41, 19],
  [13, 49, 30, 55, 37, 63, 22, 36],
  [25, 17, 21, 51, 42, 3, 27, 24],
  [44, 28, 50, 32, 57, 48, 18, 46],
  [6, 47, 64, 40, 59, 29, 4, 7],
  [33, 31, 56, 62, 53, 39, 52, 15],
  [12, 45, 35, 16, 20, 8, 23, 2]
];

/** Триграмма из трёх линий снизу вверх; ян = 1, инь = 0; младший разряд — нижняя линия */
function trigramBits(lines: IChingLine[], start: 0 | 3): number {
  let b = 0;
  for (let i = 0; i < 3; i++) {
    if (lines[start + i].isYang) b |= 1 << i;
  }
  return b;
}

export function linesToKingWenNumber(lines: IChingLine[]): number {
  if (lines.length !== 6) return 1;
  const lower = trigramBits(lines, 0);
  const upper = trigramBits(lines, 3);
  const row = 7 - lower;
  const col = 7 - upper;
  return KW_MATRIX[row][col];
}

export function castLine(): IChingLine {
  const coin1 = Math.random() < 0.5 ? 0 : 1;
  const coin2 = Math.random() < 0.5 ? 0 : 1;
  const coin3 = Math.random() < 0.5 ? 0 : 1;
  const sum = coin1 + coin2 + coin3;
  let value: number;
  if (sum === 0) value = 6;
  else if (sum === 1) value = 7;
  else if (sum === 2) value = 8;
  else value = 9;
  return {
    value,
    isYang: value === 7 || value === 9,
    isChanging: value === 6 || value === 9
  };
}

export function buildHexagram(lines: IChingLine[]): IChingHexagram {
  const n = linesToKingWenNumber(lines);
  const base = getHexagramStatic(n);
  const changingLines = lines.filter((l) => l.isChanging);
  let changingTo: number | undefined;
  if (changingLines.length > 0) {
    const flipped = lines.map((l) => ({
      ...l,
      isYang: l.isChanging ? !l.isYang : l.isYang,
      isChanging: false,
      value: l.isChanging ? (l.isYang ? 8 : 7) : l.value
    }));
    changingTo = linesToKingWenNumber(flipped);
  }
  return {
    ...base,
    lines,
    changingTo
  };
}
