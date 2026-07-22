import { createTile, setTileCell, type Tile } from "./tile";

/**
 * The motif the editor opens with: a doll with sparkles above and below.
 *
 * A full 24 x 40 tile repeated once, rather than a small repeat — the point is
 * to show what the card can do, not to demonstrate tiling. Written top-to-bottom
 * because that is how it reads on screen; row 0 of the tile is the bottom of the
 * card, so the rows are reversed when it is built.
 */
const USUKI = [
  // sparkles
  "..#.......#.......#.....",
  ".###.....###.....###....",
  "..#.......#.......#.....",
  "........................",
  "........................",
  // hair
  "........########........",
  ".......##########.......",
  "......############......",
  "......##........##......",
  "......##........##......",
  // face
  "......##.##..##.##......",
  "......##........##......",
  "......##..####..##......",
  "......##........##......",
  "......############......",
  // neck and shoulders
  "...........##...........",
  ".........######.........",
  ".......##########.......",
  // arms out
  "......############......",
  "......############......",
  ".......##########.......",
  // dress
  "......############......",
  ".....##############.....",
  ".....##############.....",
  "....################....",
  "....################....",
  "...##################...",
  "...##################...",
  // legs
  ".........##..##.........",
  ".........##..##.........",
  ".........##..##.........",
  // shoes
  "........####..####......",
  "........####..####......",
  "........................",
  // sparkles
  "........................",
  "..#.......#.......#.....",
  ".###.....###.....###....",
  "..#.......#.......#.....",
  "........................",
  "........................",
] as const;

export const USUKI_WIDTH = 24;
export const USUKI_HEIGHT = USUKI.length;

/** Builds the doll motif. Row 0 of the tile is the bottom of the card. */
export function usukiTile(): Tile {
  const tile = createTile(USUKI_WIDTH, USUKI_HEIGHT);

  USUKI.forEach((line, fromTop) => {
    const row = USUKI_HEIGHT - 1 - fromTop;
    for (let column = 0; column < USUKI_WIDTH; column++) {
      if (line[column] === "#") setTileCell(tile, row, column, true);
    }
  });

  return tile;
}
