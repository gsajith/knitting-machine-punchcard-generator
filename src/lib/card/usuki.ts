import { createTile, setTileCell, type Tile } from "./tile";

/**
 * The motif the editor opens with: the Usuki Paint Brush.
 *
 * A hooked handle with a hole through it, a ferrule, and a fanned head of
 * bristles, with the starburst and sparkles that surround it on the item art.
 *
 * Drawn as a silhouette, because a punchcard is one bit per stitch: a stitch is
 * either a hole or it isn't. Shape and negative space carry everything —
 * the hole in the handle and the gap at the ferrule are what make it read as a
 * brush rather than a blob.
 *
 * A full 24 x 40 tile repeated once, not a small repeat. Written top-to-bottom
 * because that is how it reads on screen; row 0 of a tile is the bottom of the
 * card, so the rows are reversed when it is built.
 */
const USUKI = [
  "........................",
  "........................",
  "........................",
  ".....####.........#.....",
  "....######........#.....",
  "....##..##.......###....",
  "....##..##.....#######..",
  "....######.......###....",
  ".....####.........#.....",
  "......####........#.....",
  ".......####.............",
  ".......#####............",
  "........####............",
  "........#####...........",
  ".........####...........",
  ".........#####..........",
  "..........####..........",
  "..........#####.........",
  "..........######........",
  ".........########.......",
  ".........#########......",
  "........................",
  "........###########.....",
  ".......############.....",
  ".......#############....",
  "..#...##############....",
  ".###..##############....",
  "..#..###############....",
  ".....##############.....",
  ".....##############.....",
  "......############......",
  "......###########.......",
  ".......#########........",
  "........######..........",
  ".........###............",
  "........................",
  "...#................#...",
  "..###..............###..",
  "...#................#...",
  "........................",
] as const;

export const USUKI_WIDTH = 24;
export const USUKI_HEIGHT = USUKI.length;

/** Builds the motif. Row 0 of the tile is the bottom of the card. */
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
