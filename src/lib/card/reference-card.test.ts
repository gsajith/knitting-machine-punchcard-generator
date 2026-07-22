import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  analyzeTopSurface,
  classifyLoops,
  clusterGroups,
  median,
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

/**
 * How far this hand-drawn card's features stray from their intended positions.
 * Measured, not guessed: columns land within 0.07 mm and the edge columns
 * within 0.27 mm of nominal. Deliberately not loose enough to absorb a
 * half-pitch error, which is what the oracle is for.
 */
const DRAWING_BIAS = 0.15;
const EDGE_DRAWING_BIAS = 0.3;

/**
 * Outlines are noisier than centres on this card — they were drawn freehand,
 * so a diameter lands within about 0.1 mm while a centre lands within 0.07 mm.
 * Still far tighter than the 0.5 mm difference between the belt and loop
 * diameters, so this cannot confuse one for the other.
 */
const DIAMETER_BIAS = 0.15;

let cached: MeshAnalysis | null = null;

function referenceCard(): MeshAnalysis {
  if (!cached) cached = analyzeTopSurface(read3mf(readFileSync(REFERENCE)));
  return cached;
}

/** Columns holding more than a handful of holes; excludes hand-drawn strays. */
function columnsOf(holes: { centreX: number }[]) {
  return clusterGroups(
    holes.map((hole) => hole.centreX),
    1,
  ).filter((cluster) => cluster.count > 5);
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
    const columns = columnsOf(classifyLoops(referenceCard(), BROTHER_24).pattern);

    expect(columns).toHaveLength(BROTHER_24.columns);
    expect(medianSpacing(columns.map((c) => c.centre))).toBeCloseTo(
      BROTHER_24.stitchPitch,
      1,
    );
  });

  it("has rows at the profile's row pitch", () => {
    const pattern = classifyLoops(referenceCard(), BROTHER_24).pattern;

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
    const columns = columnsOf(classifyLoops(referenceCard(), BROTHER_24).pattern);
    const outermost = (BROTHER_24.columns - 1) * 0.5 * BROTHER_24.stitchPitch;

    expect(Math.abs(columns[0].centre + outermost)).toBeLessThan(DRAWING_BIAS);
    expect(
      Math.abs(columns[columns.length - 1].centre - outermost),
    ).toBeLessThan(DRAWING_BIAS);
  });

  // Anchors the belt and loop geometry that issue #4 has to generate.
  it("carries belt hole columns at the profile's offset and diameter", () => {
    const belt = classifyLoops(referenceCard(), BROTHER_24, 1).belt;
    const columns = columnsOf(belt);

    expect(columns).toHaveLength(2);
    for (const column of columns) {
      expect(
        Math.abs(Math.abs(column.centre) - BROTHER_24.beltHoleOffsetX),
      ).toBeLessThan(EDGE_DRAWING_BIAS);
    }

    const diameter = median(belt.map((hole) => hole.width));
    expect(Math.abs(diameter - BROTHER_24.beltHole.width)).toBeLessThan(
      DIAMETER_BIAS,
    );
  });

  it("carries loop hole columns at the profile's offset and diameter", () => {
    const loop = classifyLoops(referenceCard(), BROTHER_24, 1).loop;
    const columns = columnsOf(loop);

    expect(columns).toHaveLength(2);
    for (const column of columns) {
      expect(
        Math.abs(Math.abs(column.centre) - BROTHER_24.loopHoleOffsetX),
      ).toBeLessThan(EDGE_DRAWING_BIAS);
    }

    const diameter = median(loop.map((hole) => hole.width));
    expect(Math.abs(diameter - BROTHER_24.loopHole.width)).toBeLessThan(
      DIAMETER_BIAS,
    );
  });

  it("puts its loop holes on row boundaries, half a row off the belt holes", () => {
    const { belt, loop } = classifyLoops(referenceCard(), BROTHER_24, 1);

    const beltRows = clusterGroups(
      belt.map((hole) => hole.centreY),
      1,
    ).filter((cluster) => cluster.count > 1);
    const loopRows = clusterGroups(
      loop.map((hole) => hole.centreY),
      1,
    ).filter((cluster) => cluster.count > 1);

    // Both columns step by a full row; the two sets are offset by half of one.
    expect(medianSpacing(beltRows.map((c) => c.centre))).toBeCloseTo(
      BROTHER_24.rowPitch,
      1,
    );
    expect(medianSpacing(loopRows.map((c) => c.centre))).toBeCloseTo(
      BROTHER_24.rowPitch,
      1,
    );

    const offset = Math.abs(beltRows[0].centre - loopRows[0].centre);
    expect(offset).toBeCloseTo(BROTHER_24.rowPitch / 2, 0);
  });
});
