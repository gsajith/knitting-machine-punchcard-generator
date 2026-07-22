import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  analyzeTopSurface,
  clusterGroups,
  medianSpacing,
  type MeshAnalysis,
} from "@/lib/card/analyze";
import { BROTHER_24 } from "@/lib/card/profile";
import { read3mf } from "@/lib/card/read-3mf";

/**
 * The golden test: run the oracle against a real punchcard that our code did
 * not produce.
 *
 * `reference/triangle+one+card.3mf` was drawn by hand by someone else. Its hole
 * outlines are noisy and it contains at least one stray, but the hole *centres*
 * sit on an exact lattice — which is how the card profile was established. If
 * the oracle cannot read this file, it cannot be trusted to check ours either.
 */

const REFERENCE = join(process.cwd(), "reference", "triangle+one+card.3mf");

/** Half the pattern area's width — holes beyond this are belt or loop holes. */
const PATTERN_HALF_WIDTH = (BROTHER_24.columns * BROTHER_24.stitchPitch) / 2;

let cached: MeshAnalysis | null = null;

function referenceCard(): MeshAnalysis {
  if (!cached) cached = analyzeTopSurface(read3mf(readFileSync(REFERENCE)));
  return cached;
}

describe("reference card", () => {
  it("reads as a single card with many holes", () => {
    const analysis = referenceCard();

    expect(analysis.holes.length).toBeGreaterThan(1000);
    expect(analysis.outline.height).toBeGreaterThan(analysis.outline.width);
  });

  it("is 142.4 mm wide — wider than the 140 mm we generate", () => {
    // Not a defect. The two sources disagreed on outer width and we chose
    // 140 mm; belt and loop holes are identical either way. See ADR-0001.
    expect(referenceCard().outline.width).toBeCloseTo(142.4, 1);
    expect(BROTHER_24.cardWidth).toBe(140);
  });

  it("has 24 pattern columns at the profile's stitch pitch", () => {
    const pattern = referenceCard().holes.filter(
      (hole) => Math.abs(hole.centreX) <= PATTERN_HALF_WIDTH,
    );

    // Strays land in clusters of one; real columns hold dozens of holes.
    const columns = clusterGroups(
      pattern.map((hole) => hole.centreX),
      1,
    ).filter((cluster) => cluster.count > 5);

    expect(columns).toHaveLength(BROTHER_24.columns);
    expect(medianSpacing(columns.map((c) => c.centre))).toBeCloseTo(
      BROTHER_24.stitchPitch,
      1,
    );
  });

  it("has rows at the profile's row pitch", () => {
    const pattern = referenceCard().holes.filter(
      (hole) => Math.abs(hole.centreX) <= PATTERN_HALF_WIDTH,
    );

    const rows = clusterGroups(
      pattern.map((hole) => hole.centreY),
      1,
    ).filter((cluster) => cluster.count > 5);

    expect(medianSpacing(rows.map((c) => c.centre))).toBeCloseTo(
      BROTHER_24.rowPitch,
      1,
    );
  });

  it("places its outermost pattern columns where the profile expects", () => {
    const pattern = referenceCard().holes.filter(
      (hole) => Math.abs(hole.centreX) <= PATTERN_HALF_WIDTH,
    );

    const columns = clusterGroups(
      pattern.map((hole) => hole.centreX),
      1,
    ).filter((cluster) => cluster.count > 5);

    // The profile says ±51.75. This card was drawn by hand and carries a
    // consistent bias of up to ~0.07 mm, so it is checked against a tolerance
    // that reflects the artifact rather than the intent. The pitch, which is
    // what the profile actually depends on, is exact to 0.003 mm.
    const outermost = (BROTHER_24.columns - 1) * 0.5 * BROTHER_24.stitchPitch;
    const drawingBias = 0.15;

    expect(Math.abs(columns[0].centre + outermost)).toBeLessThan(drawingBias);
    expect(
      Math.abs(columns[columns.length - 1].centre - outermost),
    ).toBeLessThan(drawingBias);
  });

  // Anchors the belt and loop geometry that issue #4 has to generate.
  it("carries belt and loop hole columns outside the pattern area", () => {
    const edge = referenceCard().holes.filter(
      (hole) => Math.abs(hole.centreX) > PATTERN_HALF_WIDTH,
    );

    const columns = clusterGroups(
      edge.map((hole) => hole.centreX),
      1,
    ).filter((cluster) => cluster.count > 5);

    expect(columns).toHaveLength(4);

    const offsets = columns.map((c) => Math.abs(c.centre)).sort((a, b) => a - b);
    expect(offsets[0]).toBeCloseTo(BROTHER_24.beltHoleOffsetX, 0);
    expect(offsets[3]).toBeCloseTo(BROTHER_24.loopHoleOffsetX, 0);
  });
});
