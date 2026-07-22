import { describe, expect, it } from "vitest";

import {
  blankDesign,
  canFlatten,
  cloneDesign,
  designRows,
  designToPattern,
  flatten,
  rowsForRepeats,
  smallestLegalRepeats,
  type Design,
} from "@/lib/card/design";
import { countPunched, isPunched, setPunched } from "@/lib/card/pattern";
import { BROTHER_24 } from "@/lib/card/profile";
import { createTile, setTileCell } from "@/lib/card/tile";

function motif() {
  const tile = createTile(6, 8);
  setTileCell(tile, 0, 0, true);
  setTileCell(tile, 3, 4, true);
  return tile;
}

function tileDesign(repeats = 5): Design {
  return { kind: "tile", tile: motif(), repeats };
}

describe("repeat arithmetic", () => {
  it("multiplies rows by the repeat count", () => {
    expect(rowsForRepeats(motif(), 5)).toBe(40);
  });

  it("picks the fewest repeats that clear the minimum row count", () => {
    // 36 minimum, 8-row motif -> 5 repeats = 40 rows.
    expect(smallestLegalRepeats(motif(), BROTHER_24.minRows)).toBe(5);
  });

  it("never returns zero repeats, even for a very tall motif", () => {
    expect(smallestLegalRepeats(createTile(6, 100), BROTHER_24.minRows)).toBe(1);
  });

  it("does not round a whole multiple up", () => {
    expect(smallestLegalRepeats(createTile(6, 36), 36)).toBe(1);
    expect(smallestLegalRepeats(createTile(6, 12), 36)).toBe(3);
  });

  it("reports the rows a design produces", () => {
    expect(designRows(tileDesign(5))).toBe(40);
  });
});

describe("blankDesign", () => {
  it("starts legal without the user doing arithmetic", () => {
    const design = blankDesign(createTile(6, 8), BROTHER_24);

    expect(design.repeats).toBe(5);
    expect(designRows(design)).toBeGreaterThanOrEqual(BROTHER_24.minRows);
    expect(designRows(design) % design.tile.height).toBe(0);
  });
});

describe("designToPattern", () => {
  it("repeats the motif across the card", () => {
    const pattern = designToPattern(tileDesign(5), BROTHER_24);

    expect(pattern.rows).toBe(40);
    expect(pattern.columns).toBe(24);
    // Two punched stitches per motif, 4 across x 5 up.
    expect(countPunched(pattern)).toBe(2 * 4 * 5);
  });

  it("returns a flattened card unchanged", () => {
    const flatDesign = flatten(tileDesign(5), BROTHER_24);
    const pattern = designToPattern(flatDesign, BROTHER_24);

    expect(pattern).toBe((flatDesign as { pattern: unknown }).pattern);
  });
});

describe("flatten", () => {
  it("produces a card identical to what the motif would have made", () => {
    const design = tileDesign(5);
    const before = designToPattern(design, BROTHER_24);
    const after = designToPattern(flatten(design, BROTHER_24), BROTHER_24);

    expect(after.cells).toEqual(before.cells);
  });

  it("gives up the repeat guarantee in exchange for per-stitch editing", () => {
    const flatDesign = flatten(tileDesign(5), BROTHER_24);
    if (flatDesign.kind !== "flat") throw new Error("expected a flat design");

    setPunched(flatDesign.pattern, 7, 13, true);

    expect(isPunched(flatDesign.pattern, 7, 13)).toBe(true);
    // The equivalent stitch in the next repeat is untouched — which is exactly
    // the property a tile design does not allow.
    expect(isPunched(flatDesign.pattern, 15, 13)).toBe(false);
  });

  it("is a no-op on an already flattened design", () => {
    const once = flatten(tileDesign(5), BROTHER_24);
    expect(flatten(once, BROTHER_24)).toBe(once);
  });

  // One way only: there is deliberately no unflatten. Inferring a motif from a
  // finished card is ambiguous whenever more than one repeat would explain it.
  it("offers no way back", () => {
    expect(canFlatten(tileDesign(5))).toBe(true);
    expect(canFlatten(flatten(tileDesign(5), BROTHER_24))).toBe(false);
  });
});

describe("cloneDesign", () => {
  it("does not share a tile with the original", () => {
    const design = tileDesign(5);
    const copy = cloneDesign(design);
    if (copy.kind !== "tile") throw new Error("expected a tile design");

    setTileCell(copy.tile, 5, 5, true);

    expect(designToPattern(design, BROTHER_24).cells).toEqual(
      designToPattern(tileDesign(5), BROTHER_24).cells,
    );
  });

  it("does not share a pattern with the original", () => {
    const design = flatten(tileDesign(5), BROTHER_24);
    const copy = cloneDesign(design);
    if (copy.kind !== "flat" || design.kind !== "flat") {
      throw new Error("expected flat designs");
    }

    setPunched(copy.pattern, 0, 1, true);

    expect(isPunched(design.pattern, 0, 1)).toBe(false);
  });
});
