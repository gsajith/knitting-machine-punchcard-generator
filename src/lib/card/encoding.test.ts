import { describe, expect, it } from "vitest";

import { flatten, type Design } from "@/lib/card/design";
import { decodeDesign, encodeDesign, ENCODING_VERSION } from "@/lib/card/encoding";
import { createPattern, setPunched } from "@/lib/card/pattern";
import { BROTHER_24 } from "@/lib/card/profile";
import { createTile, setTileCell, tileWidthsFor } from "@/lib/card/tile";

/**
 * Deterministic pseudo-randomness. Tests that fail only sometimes are worse
 * than tests that do not exist, so the sequence is fixed and a failure can be
 * reproduced from the seed alone.
 */
function randomiser(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function randomTile(random: () => number) {
  const widths = tileWidthsFor(BROTHER_24.columns);
  const width = widths[Math.floor(random() * widths.length)];
  const height = 1 + Math.floor(random() * 16);
  const tile = createTile(width, height);

  for (let row = 0; row < height; row++) {
    for (let column = 0; column < width; column++) {
      if (random() < 0.5) setTileCell(tile, row, column, true);
    }
  }

  return tile;
}

function motifDesign(): Design {
  const tile = createTile(6, 8);
  setTileCell(tile, 0, 0, true);
  setTileCell(tile, 3, 4, true);
  return { kind: "tile", tile, repeats: 5 };
}

describe("round trip", () => {
  it("preserves a motif design", () => {
    const design = motifDesign();
    const restored = decodeDesign(encodeDesign(design));

    expect(restored).toEqual(design);
  });

  it("preserves a flattened design", () => {
    const design = flatten(motifDesign(), BROTHER_24);
    const restored = decodeDesign(encodeDesign(design));

    expect(restored).toEqual(design);
  });

  it("preserves a blank motif", () => {
    const design: Design = { kind: "tile", tile: createTile(4, 4), repeats: 9 };

    expect(decodeDesign(encodeDesign(design))).toEqual(design);
  });

  it("preserves a fully punched motif", () => {
    const design: Design = {
      kind: "tile",
      tile: createTile(24, 8, true),
      repeats: 5,
    };

    expect(decodeDesign(encodeDesign(design))).toEqual(design);
  });

  it("preserves a single-stitch motif", () => {
    const design: Design = {
      kind: "tile",
      tile: createTile(1, 1, true),
      repeats: 36,
    };

    expect(decodeDesign(encodeDesign(design))).toEqual(design);
  });

  // The bit packing is the part most likely to be subtly wrong — an off-by-one
  // in the final partial byte only shows up at certain sizes.
  it("preserves 200 random motifs across every legal width", () => {
    const random = randomiser(20260722);

    for (let attempt = 0; attempt < 200; attempt++) {
      const design: Design = {
        kind: "tile",
        tile: randomTile(random),
        repeats: 1 + Math.floor(random() * 12),
      };

      expect(decodeDesign(encodeDesign(design))).toEqual(design);
    }
  });

  it("preserves random full cards", () => {
    const random = randomiser(7);

    for (let attempt = 0; attempt < 25; attempt++) {
      const rows = 1 + Math.floor(random() * 60);
      const pattern = createPattern(BROTHER_24.columns, rows);
      for (let i = 0; i < pattern.cells.length; i++) {
        if (random() < 0.5) pattern.cells[i] = true;
      }

      const design: Design = { kind: "flat", pattern };
      expect(decodeDesign(encodeDesign(design))).toEqual(design);
    }
  });
});

describe("link size", () => {
  it("keeps a full card inside an ordinary URL", () => {
    // Every stitch punched — the encoding is fixed-width, so this is the same
    // size as any other 24x48 card, but it makes that explicit.
    const pattern = createPattern(BROTHER_24.columns, 48);
    for (let row = 0; row < pattern.rows; row++) {
      for (let column = 0; column < pattern.columns; column++) {
        setPunched(pattern, row, column, true);
      }
    }

    const encoded = encodeDesign({ kind: "flat", pattern });

    // 24 x 48 bits = 144 bytes -> 192 base64 characters, plus a short header.
    expect(encoded.length).toBeLessThan(220);
    expect(encoded.length).toBeGreaterThan(190);
  });

  it("keeps a motif tiny", () => {
    expect(encodeDesign(motifDesign()).length).toBeLessThan(40);
  });

  it("uses only URL-safe characters", () => {
    const random = randomiser(99);
    const design: Design = {
      kind: "tile",
      tile: randomTile(random),
      repeats: 4,
    };

    expect(encodeDesign(design)).toMatch(/^[A-Za-z0-9._-]+$/);
  });
});

describe("versioning", () => {
  it("leads with the version", () => {
    expect(encodeDesign(motifDesign()).startsWith(`${ENCODING_VERSION}.`)).toBe(
      true,
    );
  });

  // A shared link is a compatibility surface. A design from a newer format must
  // fail loudly rather than decode into the wrong pattern.
  it("refuses a version it does not understand", () => {
    const encoded = encodeDesign(motifDesign());
    const future = encoded.replace(/^1\./, "2.");

    expect(() => decodeDesign(future)).toThrow(/version/i);
  });

  it("names both versions so the message is actionable", () => {
    const future = encodeDesign(motifDesign()).replace(/^1\./, "7.");

    expect(() => decodeDesign(future)).toThrow(/7/);
  });
});

describe("malformed input", () => {
  it("rejects a truncated link", () => {
    expect(() => decodeDesign("1.t.6.8")).toThrow(/fields/);
  });

  it("rejects an unknown kind", () => {
    const encoded = encodeDesign(motifDesign()).replace("1.t.", "1.q.");
    expect(() => decodeDesign(encoded)).toThrow(/kind/);
  });

  it("rejects dimensions that do not match the payload", () => {
    const encoded = encodeDesign(motifDesign()).replace("1.t.6.8.", "1.t.6.9.");
    expect(() => decodeDesign(encoded)).toThrow(/stitches/);
  });

  it("rejects a non-numeric dimension", () => {
    expect(() => decodeDesign("1.t.x.8.5.AAAA")).toThrow(/tile width/);
  });

  it("rejects characters outside the alphabet", () => {
    const encoded = encodeDesign(motifDesign());
    expect(() => decodeDesign(`${encoded}$`)).toThrow(/invalid character/);
  });

  it("rejects a zero repeat count", () => {
    const encoded = encodeDesign(motifDesign()).replace(".5.", ".0.");
    expect(() => decodeDesign(encoded)).toThrow(/repeat count/);
  });
});
