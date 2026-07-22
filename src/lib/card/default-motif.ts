import { createTile, setTileCell, type Tile } from "./tile";

/**
 * The motif the editor opens with: a small heart, repeated.
 *
 * Deliberately a repeat rather than one big picture — that is what a punchcard
 * is normally for, and it shows the tiling doing its job the moment the page
 * loads.
 *
 * 8 stitches wide so it divides 24 exactly (three across), and 8 rows tall so a
 * legal card is a whole number of repeats. The blank column each side and the
 * blank rows below are part of the motif: without them the hearts touch their
 * neighbours and read as a continuous band instead of separate shapes.
 *
 * Written top-to-bottom because that is how it reads on screen; row 0 of a tile
 * is the bottom of the card, so the rows are reversed when it is built.
 */
const MOTIF = [
  ".##..##.",
  ".######.",
  ".######.",
  "..####..",
  "...##...",
  "........",
  "........",
  "........",
] as const;

export const MOTIF_WIDTH = 8;
export const MOTIF_HEIGHT = MOTIF.length;

/** Builds the motif. Row 0 of the tile is the bottom of the card. */
export function defaultMotif(): Tile {
  const tile = createTile(MOTIF_WIDTH, MOTIF_HEIGHT);

  MOTIF.forEach((line, fromTop) => {
    const row = MOTIF_HEIGHT - 1 - fromTop;
    for (let column = 0; column < MOTIF_WIDTH; column++) {
      if (line[column] === "#") setTileCell(tile, row, column, true);
    }
  });

  return tile;
}
