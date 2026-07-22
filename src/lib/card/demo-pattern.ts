import { createPattern, setPunched, type Pattern } from "./pattern";
import { type CardProfile } from "./profile";

/** Width of the demo motif, in stitches. Divides 24. */
export const DEMO_TILE_WIDTH = 6;
/** Height of the demo motif, in rows. */
export const DEMO_TILE_HEIGHT = 8;

/**
 * A hardcoded triangle motif, tiled across the card.
 *
 * Placeholder until the editor exists (issue #6). It is deliberately
 * asymmetric so that a mirrored or flipped card is obvious on sight.
 */
export function demoPattern(profile: CardProfile, rows: number): Pattern {
  const pattern = createPattern(profile.columns, rows);

  for (let row = 0; row < rows; row++) {
    const withinTile = row % DEMO_TILE_HEIGHT;
    const width = Math.floor((withinTile * DEMO_TILE_WIDTH) / DEMO_TILE_HEIGHT);

    for (let column = 0; column < profile.columns; column++) {
      if (column % DEMO_TILE_WIDTH <= width) {
        setPunched(pattern, row, column, true);
      }
    }
  }

  return pattern;
}
