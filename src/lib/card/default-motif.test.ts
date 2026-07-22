import { describe, expect, it } from "vitest";

import { defaultMotif, MOTIF_HEIGHT, MOTIF_WIDTH } from "@/lib/card/default-motif";
import { smallestLegalRepeats } from "@/lib/card/design";
import { BROTHER_24 } from "@/lib/card/profile";
import { countTilePunched, tileCell } from "@/lib/card/tile";

describe("default motif", () => {
  it("repeats cleanly across the card", () => {
    expect(BROTHER_24.columns % MOTIF_WIDTH).toBe(0);
  });

  it("makes a legal card in whole repeats", () => {
    const repeats = smallestLegalRepeats(defaultMotif(), BROTHER_24.minRows);
    expect(repeats * MOTIF_HEIGHT).toBeGreaterThanOrEqual(BROTHER_24.minRows);
  });

  it("is neither blank nor solid", () => {
    const punched = countTilePunched(defaultMotif());
    expect(punched).toBeGreaterThan(0);
    expect(punched).toBeLessThan(MOTIF_WIDTH * MOTIF_HEIGHT);
  });

  // Without a clear edge the motif merges with the one beside it and reads as
  // a band rather than a shape.
  it("keeps a gap between neighbouring repeats", () => {
    const tile = defaultMotif();

    for (let row = 0; row < MOTIF_HEIGHT; row++) {
      expect(tileCell(tile, row, 0)).toBe(false);
      expect(tileCell(tile, row, MOTIF_WIDTH - 1)).toBe(false);
    }
    for (let column = 0; column < MOTIF_WIDTH; column++) {
      expect(tileCell(tile, 0, column)).toBe(false);
    }
  });
});
