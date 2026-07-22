import { createPattern, setPunched, type Pattern } from "./pattern";

/**
 * The motif the user actually edits.
 *
 * The tile is the document, not the card — the card is derived by repeating it.
 * See ADR-0004.
 */
export interface Tile {
  width: number;
  height: number;
  /** Row-major, `width * height` long. True means a punched stitch. */
  cells: boolean[];
}

/**
 * Tile widths that repeat cleanly across a card.
 *
 * A motif only tiles without a break if its width divides the card's stitch
 * count. For a 24-stitch card that leaves 1, 2, 3, 4, 6, 8, 12 and 24 — which
 * is how knitters already think about repeats.
 */
export function tileWidthsFor(columns: number): number[] {
  const widths: number[] = [];
  for (let width = 1; width <= columns; width++) {
    if (columns % width === 0) widths.push(width);
  }
  return widths;
}

export function isValidTileWidth(width: number, columns: number): boolean {
  return Number.isInteger(width) && width > 0 && columns % width === 0;
}

export function createTile(width: number, height: number, fill = false): Tile {
  if (!Number.isInteger(width) || width < 1) {
    throw new Error(`Tile width must be a positive integer, got ${width}.`);
  }
  if (!Number.isInteger(height) || height < 1) {
    throw new Error(`Tile height must be a positive integer, got ${height}.`);
  }

  return { width, height, cells: new Array<boolean>(width * height).fill(fill) };
}

export function tileCell(tile: Tile, row: number, column: number): boolean {
  if (row < 0 || row >= tile.height) return false;
  if (column < 0 || column >= tile.width) return false;
  return tile.cells[row * tile.width + column];
}

export function setTileCell(
  tile: Tile,
  row: number,
  column: number,
  punched: boolean,
): void {
  if (row < 0 || row >= tile.height) return;
  if (column < 0 || column >= tile.width) return;
  tile.cells[row * tile.width + column] = punched;
}

/**
 * Changes a tile's dimensions, keeping whatever still fits.
 *
 * Growing pads with unpunched stitches; shrinking drops what falls outside.
 * Clearing the canvas on every resize would make trying a different repeat
 * width mean redrawing from scratch.
 */
export function resizeTile(tile: Tile, width: number, height: number): Tile {
  const resized = createTile(width, height);

  const sharedRows = Math.min(tile.height, height);
  const sharedColumns = Math.min(tile.width, width);

  for (let row = 0; row < sharedRows; row++) {
    for (let column = 0; column < sharedColumns; column++) {
      setTileCell(resized, row, column, tileCell(tile, row, column));
    }
  }

  return resized;
}

/** A copy, so callers can edit without disturbing the original. */
export function cloneTile(tile: Tile): Tile {
  return { width: tile.width, height: tile.height, cells: [...tile.cells] };
}

export function countTilePunched(tile: Tile): number {
  return tile.cells.reduce((total, cell) => total + (cell ? 1 : 0), 0);
}

/**
 * Repeats a tile across the width and up the length of a card.
 *
 * The caller is responsible for `rows` being a multiple of the tile height —
 * `rowsForRepeats` exists so it never has to do that arithmetic by hand. A row
 * count that is not a multiple leaves a partial repeat at the top, which shows
 * up as a jog where the card's ends meet.
 */
export function tileToPattern(
  tile: Tile,
  columns: number,
  rows: number,
): Pattern {
  const pattern = createPattern(columns, rows);

  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const punched = tileCell(
        tile,
        row % tile.height,
        column % tile.width,
      );
      if (punched) setPunched(pattern, row, column, true);
    }
  }

  return pattern;
}

/** Whether repeating this tile fills the card exactly, with no partial repeat. */
export function tilesEvenly(
  tile: Tile,
  columns: number,
  rows: number,
): boolean {
  return columns % tile.width === 0 && rows % tile.height === 0;
}
