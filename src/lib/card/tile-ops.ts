import { createTile, setTileCell, tileCell, type Tile } from "./tile";

/** Editing operations on a motif. All return a new tile. */

export function clearTile(tile: Tile): Tile {
  return createTile(tile.width, tile.height);
}

export function invertTile(tile: Tile): Tile {
  return { ...tile, cells: tile.cells.map((cell) => !cell) };
}

export function mirrorTile(tile: Tile): Tile {
  const mirrored = createTile(tile.width, tile.height);
  for (let row = 0; row < tile.height; row++) {
    for (let column = 0; column < tile.width; column++) {
      setTileCell(
        mirrored,
        row,
        tile.width - 1 - column,
        tileCell(tile, row, column),
      );
    }
  }
  return mirrored;
}

export function flipTile(tile: Tile): Tile {
  const flipped = createTile(tile.width, tile.height);
  for (let row = 0; row < tile.height; row++) {
    for (let column = 0; column < tile.width; column++) {
      setTileCell(
        flipped,
        tile.height - 1 - row,
        column,
        tileCell(tile, row, column),
      );
    }
  }
  return flipped;
}

/** Shifts the motif, wrapping around — a repeat has no edges. */
export function shiftTile(tile: Tile, byRows: number, byColumns: number): Tile {
  const shifted = createTile(tile.width, tile.height);
  for (let row = 0; row < tile.height; row++) {
    for (let column = 0; column < tile.width; column++) {
      const toRow = (((row + byRows) % tile.height) + tile.height) % tile.height;
      const toColumn =
        (((column + byColumns) % tile.width) + tile.width) % tile.width;
      setTileCell(shifted, toRow, toColumn, tileCell(tile, row, column));
    }
  }
  return shifted;
}
