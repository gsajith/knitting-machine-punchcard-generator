import { createPattern, isPunched, setPunched, type Pattern } from "./pattern";

/**
 * How the drawing maps onto the card.
 *
 * Three axes can each be flipped independently — the direction the card feeds,
 * which edge of the card is the machine's left, and whether the fabric comes
 * out mirrored. Getting any one wrong produces a beautiful, subtly reversed
 * result that only shows up after printing and knitting, so both toggles
 * default to identity until a real machine says otherwise.
 */
export interface Orientation {
  /** Reverse the stitch order across the card. */
  mirror: boolean;
  /** Reverse the row order along the card. */
  flip: boolean;
}

export const IDENTITY: Orientation = { mirror: false, flip: false };

export function isIdentity(orientation: Orientation): boolean {
  return !orientation.mirror && !orientation.flip;
}

export function applyOrientation(
  pattern: Pattern,
  orientation: Orientation,
): Pattern {
  if (isIdentity(orientation)) return pattern;

  const oriented = createPattern(pattern.columns, pattern.rows);

  for (let row = 0; row < pattern.rows; row++) {
    for (let column = 0; column < pattern.columns; column++) {
      if (!isPunched(pattern, row, column)) continue;

      const toRow = orientation.flip ? pattern.rows - 1 - row : row;
      const toColumn = orientation.mirror
        ? pattern.columns - 1 - column
        : column;

      setPunched(oriented, toRow, toColumn, true);
    }
  }

  return oriented;
}
