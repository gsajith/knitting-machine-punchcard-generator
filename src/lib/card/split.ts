import { createPattern, isPunched, setPunched, type Pattern } from "./pattern";
import { type CardProfile } from "./profile";

/**
 * Splitting a card into printable pieces.
 *
 * A card is 140 mm wide and `rows × 5 mm` long. The width fits every Bambu bed;
 * the length frequently does not. See ADR-0003 for why rows are distributed
 * evenly rather than filling each piece to the limit, and ADR-0002 for the
 * overlap seam.
 */

export interface Printer {
  name: string;
  /** Usable bed dimensions in mm, before margin. */
  bedWidth: number;
  bedDepth: number;
}

export const PRINTERS: Printer[] = [
  { name: "A1 mini", bedWidth: 180, bedDepth: 180 },
  { name: "A1", bedWidth: 256, bedDepth: 256 },
  { name: "P1P", bedWidth: 256, bedDepth: 256 },
  { name: "P1S", bedWidth: 256, bedDepth: 256 },
  { name: "X1 Carbon", bedWidth: 256, bedDepth: 256 },
  { name: "H2D", bedWidth: 350, bedDepth: 320 },
];

/** Kept clear of the bed edge, for skirts and exclusion zones. */
export const BED_MARGIN = 5;

export interface Piece {
  /** Rows of the finished card this piece carries, first to last. */
  firstRow: number;
  lastRow: number;
  /** Rows printed, including the overlap this piece contributes. */
  rows: number;
  /** Length in mm. */
  length: number;
  /** Rows at the top of this piece that duplicate the next piece's first rows. */
  overlapRows: number;
}

export interface Split {
  pieces: Piece[];
  /** Rows of material across every piece: N + overlap × seams. */
  totalRows: number;
  /** Seams including the loop closure. */
  seams: number;
  fits: boolean;
}

/** Longest piece this printer can take, in rows. */
export function maxRowsPerPiece(
  printer: Printer,
  profile: CardProfile,
): number {
  const usable = printer.bedDepth - 2 * BED_MARGIN;
  return Math.max(1, Math.floor(usable / profile.rowPitch));
}

export function cardFitsWidth(
  printer: Printer,
  profile: CardProfile,
): boolean {
  return profile.cardWidth <= printer.bedWidth - 2 * BED_MARGIN;
}

/** Fewest pieces this card can be printed in. */
export function minimumPieces(
  rows: number,
  printer: Printer,
  profile: CardProfile,
): number {
  const limit = maxRowsPerPiece(printer, profile);

  // Each extra seam adds overlap rows, which can itself push a piece over the
  // limit, so the count is found by checking rather than by dividing once.
  for (let pieces = 1; pieces <= rows; pieces++) {
    const longest = Math.ceil(rows / pieces) + profile.overlapRows;
    if (longest <= limit) return pieces;
  }

  return rows;
}

/**
 * Distributes rows across pieces as evenly as possible.
 *
 * Piece count is a ceiling either way, so filling each piece to the bed limit
 * never saves a piece — it just produces one long warp-prone print and a stub.
 */
export function splitCard(
  rows: number,
  pieceCount: number,
  printer: Printer,
  profile: CardProfile,
): Split {
  const count = Math.max(1, Math.min(pieceCount, rows));
  const base = Math.floor(rows / count);
  const remainder = rows % count;

  const pieces: Piece[] = [];
  let cursor = 0;

  for (let index = 0; index < count; index++) {
    const carried = base + (index < remainder ? 1 : 0);
    // Every piece contributes overlap rows to the seam that follows it. The
    // last piece's seam is the loop closure back to the first.
    const overlapRows = profile.overlapRows;
    const printedRows = carried + overlapRows;

    pieces.push({
      firstRow: cursor,
      lastRow: cursor + carried - 1,
      rows: printedRows,
      length: printedRows * profile.rowPitch,
      overlapRows,
    });

    cursor += carried;
  }

  const limit = maxRowsPerPiece(printer, profile);

  return {
    pieces,
    totalRows: pieces.reduce((total, piece) => total + piece.rows, 0),
    seams: count,
    fits:
      cardFitsWidth(printer, profile) &&
      pieces.every((piece) => piece.rows <= limit),
  };
}

/**
 * The pattern for one piece, including its overlap rows.
 *
 * The overlap duplicates the rows the next piece begins with. Two stacked
 * layers only pass a pin where both have a hole, so identical copies make the
 * seam invisible in the knitting — see ADR-0002.
 */
export function piecePattern(pattern: Pattern, piece: Piece): Pattern {
  const out = createPattern(pattern.columns, piece.rows);

  for (let row = 0; row < piece.rows; row++) {
    // Wraps past the end of the card: the last piece's overlap duplicates the
    // first rows of the first piece, which is the loop closure.
    const source = (piece.firstRow + row) % pattern.rows;

    for (let column = 0; column < pattern.columns; column++) {
      if (isPunched(pattern, source, column)) {
        setPunched(out, row, column, true);
      }
    }
  }

  return out;
}

/** Human-readable summary, e.g. "3 pieces of 22, 22 and 21 rows". */
export function describeSplit(split: Split): string {
  if (split.pieces.length === 1) {
    return `1 piece, ${split.pieces[0].rows} rows`;
  }

  const rows = split.pieces.map((piece) => piece.rows);
  return `${split.pieces.length} pieces — ${rows.join(", ")} rows`;
}
