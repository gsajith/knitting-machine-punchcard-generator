import { describe, expect, it } from "vitest";

import { isPunched } from "@/lib/card/pattern";
import { BROTHER_24 } from "@/lib/card/profile";
import {
  cloneTile,
  countTilePunched,
  createTile,
  isValidTileWidth,
  resizeTile,
  setTileCell,
  tileCell,
  tileToPattern,
  tileWidthsFor,
  tilesEvenly,
} from "@/lib/card/tile";

/** A 2x2 motif with a single punched stitch, so orientation is unambiguous. */
function cornerTile() {
  const tile = createTile(2, 2);
  setTileCell(tile, 0, 0, true);
  return tile;
}

describe("tileWidthsFor", () => {
  it("offers exactly the divisors of the stitch count", () => {
    expect(tileWidthsFor(24)).toEqual([1, 2, 3, 4, 6, 8, 12, 24]);
  });

  it("rejects widths that would leave a partial repeat", () => {
    expect(isValidTileWidth(5, 24)).toBe(false);
    expect(isValidTileWidth(7, 24)).toBe(false);
    expect(isValidTileWidth(6, 24)).toBe(true);
  });

  it("rejects nonsense widths", () => {
    expect(isValidTileWidth(0, 24)).toBe(false);
    expect(isValidTileWidth(-6, 24)).toBe(false);
    expect(isValidTileWidth(2.5, 24)).toBe(false);
  });
});

describe("createTile", () => {
  it("starts blank", () => {
    expect(countTilePunched(createTile(6, 8))).toBe(0);
  });

  it("refuses dimensions that are not positive whole numbers", () => {
    expect(() => createTile(0, 8)).toThrow(/width/);
    expect(() => createTile(6, 0)).toThrow(/height/);
    expect(() => createTile(6, 1.5)).toThrow(/height/);
  });

  it("reads back what was written, and nothing outside its bounds", () => {
    const tile = cornerTile();

    expect(tileCell(tile, 0, 0)).toBe(true);
    expect(tileCell(tile, 1, 1)).toBe(false);
    expect(tileCell(tile, 99, 0)).toBe(false);
    expect(tileCell(tile, 0, -1)).toBe(false);
  });
});

describe("resizeTile", () => {
  it("keeps what still fits when growing", () => {
    const grown = resizeTile(cornerTile(), 6, 8);

    expect(grown.width).toBe(6);
    expect(grown.height).toBe(8);
    expect(tileCell(grown, 0, 0)).toBe(true);
    expect(countTilePunched(grown)).toBe(1);
  });

  it("keeps what still fits when shrinking, and drops the rest", () => {
    const tile = createTile(4, 4, true);
    const shrunk = resizeTile(tile, 2, 2);

    expect(countTilePunched(shrunk)).toBe(4);
  });

  it("does not disturb the original", () => {
    const tile = cornerTile();
    resizeTile(tile, 8, 8);

    expect(tile.width).toBe(2);
    expect(countTilePunched(tile)).toBe(1);
  });

  // Trying a different repeat width shouldn't mean redrawing from scratch.
  it("survives a round trip through a larger size", () => {
    const tile = cornerTile();
    const returned = resizeTile(resizeTile(tile, 8, 8), 2, 2);

    expect(returned.cells).toEqual(tile.cells);
  });
});

describe("cloneTile", () => {
  it("does not share cells with the original", () => {
    const tile = cornerTile();
    const copy = cloneTile(tile);
    setTileCell(copy, 1, 1, true);

    expect(tileCell(tile, 1, 1)).toBe(false);
  });
});

describe("tileToPattern", () => {
  it("repeats across the width and up the length", () => {
    const pattern = tileToPattern(cornerTile(), 24, 8);

    // Punched wherever both indices are even multiples of the tile origin.
    for (let row = 0; row < 8; row++) {
      for (let column = 0; column < 24; column++) {
        const expected = row % 2 === 0 && column % 2 === 0;
        expect(isPunched(pattern, row, column)).toBe(expected);
      }
    }
  });

  it("fills a card of the right size", () => {
    const pattern = tileToPattern(createTile(6, 8), BROTHER_24.columns, 40);

    expect(pattern.columns).toBe(24);
    expect(pattern.rows).toBe(40);
    expect(pattern.cells).toHaveLength(24 * 40);
  });

  it("carries a full tile through unchanged", () => {
    const pattern = tileToPattern(createTile(6, 8, true), 24, 40);

    expect(pattern.cells.every(Boolean)).toBe(true);
  });

  // A row count that isn't a whole number of repeats leaves a partial motif at
  // the top, which reads as a jog where the card's ends meet.
  it("leaves a partial repeat when the rows do not divide evenly", () => {
    const tile = createTile(2, 3);
    setTileCell(tile, 0, 0, true);

    expect(tilesEvenly(tile, 24, 40)).toBe(false);
    expect(tilesEvenly(tile, 24, 39)).toBe(true);
  });

  it("knows when a width would not tile evenly", () => {
    expect(tilesEvenly(createTile(5, 8), 24, 40)).toBe(false);
    expect(tilesEvenly(createTile(6, 8), 24, 40)).toBe(true);
  });
});
