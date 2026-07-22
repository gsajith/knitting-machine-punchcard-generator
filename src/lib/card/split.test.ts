import { describe, expect, it } from "vitest";
import { minimumPieces, splitCard, PRINTERS, describeSplit, piecePattern } from "@/lib/card/split";
import { BROTHER_24 } from "@/lib/card/profile";
import { createPattern, setPunched, isPunched } from "@/lib/card/pattern";

const X1 = PRINTERS[4];

describe("splitting", () => {
  it("keeps a short card in one piece", () => {
    expect(minimumPieces(40, X1, BROTHER_24)).toBe(1);
  });
  it("splits a card too long for the bed", () => {
    const pieces = minimumPieces(60, X1, BROTHER_24);
    expect(pieces).toBeGreaterThan(1);
    const split = splitCard(60, pieces, X1, BROTHER_24);
    expect(split.fits).toBe(true);
  });
  it("distributes rows evenly", () => {
    const split = splitCard(61, 2, X1, BROTHER_24);
    const carried = split.pieces.map((p) => p.lastRow - p.firstRow + 1);
    expect(Math.max(...carried) - Math.min(...carried)).toBeLessThanOrEqual(1);
  });
  it("adds overlap rows per seam", () => {
    const split = splitCard(60, 3, X1, BROTHER_24);
    expect(split.totalRows).toBe(60 + BROTHER_24.overlapRows * 3);
  });
  it("makes overlap rows duplicate the next piece", () => {
    const pattern = createPattern(24, 20);
    for (let r = 0; r < 20; r++) setPunched(pattern, r, r % 24, true);
    const split = splitCard(20, 2, X1, BROTHER_24);
    const [a, b] = split.pieces.map((p) => piecePattern(pattern, p));
    for (let k = 0; k < BROTHER_24.overlapRows; k++) {
      const tail = a.rows - BROTHER_24.overlapRows + k;
      for (let c = 0; c < 24; c++) {
        expect(isPunched(a, tail, c)).toBe(isPunched(b, k, c));
      }
    }
  });
  it("never exceeds the bed", () => {
    for (const printer of PRINTERS) {
      for (const rows of [36, 60, 90, 120]) {
        const split = splitCard(rows, minimumPieces(rows, printer, BROTHER_24), printer, BROTHER_24);
        expect(split.fits).toBe(true);
      }
    }
  });
  it("describes the split", () => {
    expect(describeSplit(splitCard(60, 2, X1, BROTHER_24))).toContain("2 pieces");
  });
});
