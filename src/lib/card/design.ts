import { type Pattern } from "./pattern";
import { type CardProfile } from "./profile";
import { cloneTile, tileToPattern, type Tile } from "./tile";

/**
 * What the user is editing.
 *
 * A design is either a repeating motif or a flattened card. The motif is the
 * normal case and guarantees a seamless loop; flattening trades that guarantee
 * for the freedom to edit stitches individually. See ADR-0004.
 */
export type Design =
  | { kind: "tile"; tile: Tile; repeats: number }
  | { kind: "flat"; pattern: Pattern };

/** Rows a card will have when a tile is repeated a given number of times. */
export function rowsForRepeats(tile: Tile, repeats: number): number {
  return tile.height * repeats;
}

/**
 * The fewest whole repeats that produce a legal card.
 *
 * A card has to be long enough to wrap the drum, and it has to contain a whole
 * number of repeats or the pattern jogs where the ends meet. Rather than making
 * the user reconcile those two constraints, the repeat count starts at the
 * smallest value that satisfies both.
 */
export function smallestLegalRepeats(tile: Tile, minRows: number): number {
  return Math.max(1, Math.ceil(minRows / tile.height));
}

/** Rows in the card this design produces. */
export function designRows(design: Design): number {
  return design.kind === "tile"
    ? rowsForRepeats(design.tile, design.repeats)
    : design.pattern.rows;
}

/** The card a design describes. */
export function designToPattern(
  design: Design,
  profile: CardProfile,
): Pattern {
  if (design.kind === "flat") return design.pattern;

  return tileToPattern(
    design.tile,
    profile.columns,
    rowsForRepeats(design.tile, design.repeats),
  );
}

/**
 * Converts a repeating design into a directly editable card.
 *
 * One way only. Going back would mean inferring a motif from a finished card,
 * which is ambiguous whenever the card contains more than one candidate repeat —
 * and silently picking one would be worse than refusing.
 */
export function flatten(design: Design, profile: CardProfile): Design {
  if (design.kind === "flat") return design;

  return { kind: "flat", pattern: designToPattern(design, profile) };
}

/** Whether flattening would change what the user can do. */
export function canFlatten(design: Design): boolean {
  return design.kind === "tile";
}

export function cloneDesign(design: Design): Design {
  return design.kind === "tile"
    ? { kind: "tile", tile: cloneTile(design.tile), repeats: design.repeats }
    : {
        kind: "flat",
        pattern: {
          columns: design.pattern.columns,
          rows: design.pattern.rows,
          cells: [...design.pattern.cells],
        },
      };
}

/** A starting design: one blank motif, repeated just enough to be legal. */
export function blankDesign(
  tile: Tile,
  profile: CardProfile,
): Extract<Design, { kind: "tile" }> {
  return {
    kind: "tile",
    tile,
    repeats: smallestLegalRepeats(tile, profile.minRows),
  };
}
