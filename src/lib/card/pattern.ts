/**
 * A punched pattern laid out on the card: which stitches are holes.
 *
 * Row 0 is the bottom of the card. Column 0 is the leftmost stitch.
 */
export interface Pattern {
  columns: number;
  rows: number;
  /** Row-major, `rows * columns` long. True means a punched stitch. */
  cells: boolean[];
}

export function createPattern(
  columns: number,
  rows: number,
  fill = false,
): Pattern {
  return {
    columns,
    rows,
    cells: new Array<boolean>(columns * rows).fill(fill),
  };
}

export function isPunched(
  pattern: Pattern,
  row: number,
  column: number,
): boolean {
  if (row < 0 || row >= pattern.rows) return false;
  if (column < 0 || column >= pattern.columns) return false;
  return pattern.cells[row * pattern.columns + column];
}

export function setPunched(
  pattern: Pattern,
  row: number,
  column: number,
  punched: boolean,
): void {
  if (row < 0 || row >= pattern.rows) return;
  if (column < 0 || column >= pattern.columns) return;
  pattern.cells[row * pattern.columns + column] = punched;
}

export function countPunched(pattern: Pattern): number {
  return pattern.cells.reduce((total, cell) => total + (cell ? 1 : 0), 0);
}
