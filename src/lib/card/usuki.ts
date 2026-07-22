import { createTile, setTileCell, type Tile } from "./tile";

/**
 * The motif the editor opens with: an Usuki head — big ears, bows, stars.
 *
 * Drawn as a bold silhouette rather than a full figure, in the spirit of the
 * UsukiCon bag print. A silhouette also survives 24 stitches far better than
 * a body with arms and legs, where limbs come out one or two stitches wide and
 * read as noise.
 *
 * A full 24 x 40 tile repeated once, not a small repeat — the default is here
 * to show what the card can do, not to demonstrate tiling. Written top-to-bottom
 * because that is how it reads on screen; row 0 of a tile is the bottom of the
 * card, so the rows are reversed when it is built.
 */
const USUKI = [
  "........................",
  "..#..................#..",
  ".###................###.",
  "..#..................#..",
  "......####....####......",
  ".....######..######.....",
  ".....######..######.....",
  ".....######..######.....",
  ".....######..######.....",
  "#..#.######..######.#..#",
  "####.######..######.####",
  "#..#.######..######.#..#",
  ".....######..######.....",
  ".....######..######.....",
  "....################....",
  "...##################...",
  "..####################..",
  "..####################..",
  "..####################..",
  "..####################..",
  "..####################..",
  "..####...######...####..",
  "..####...######...####..",
  "..####...######...####..",
  "..####...######...####..",
  "..####################..",
  "..####################..",
  "..#########..#########..",
  "..####################..",
  "..####################..",
  "...##################...",
  "....################....",
  ".....##############.....",
  "......############......",
  "........########........",
  "........................",
  "..#..................#..",
  ".###................###.",
  "..#..................#..",
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
