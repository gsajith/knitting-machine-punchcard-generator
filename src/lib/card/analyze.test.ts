import { describe, expect, it } from "vitest";

import {
  analyzeTopSurface,
  checkCard,
  checkMachineHoles,
  checkPatternLattice,
  classifyLoops,
  clusterGroups,
  clusterValues,
  median,
  medianSpacing,
} from "@/lib/card/analyze";
import { demoPattern } from "@/lib/card/demo-pattern";
import { buildCardMesh, type Mesh } from "@/lib/card/mesh";
import {
  createPattern,
  isPunched,
  setPunched,
  type Pattern,
} from "@/lib/card/pattern";
import { read3mf } from "@/lib/card/read-3mf";
import {
  BROTHER_24,
  BROTHER_24_CLASSIC,
  loopHoleBoundaries,
  rowBoundary,
} from "@/lib/card/profile";
import { meshTo3mf } from "@/lib/card/threemf";

const ROWS = 8;

/** Moves every vertex, to simulate a systematically misplaced card. */
function translate(mesh: Mesh, dx: number, dy: number): Mesh {
  const positions = [...mesh.positions];
  for (let i = 0; i < positions.length; i += 3) {
    positions[i] += dx;
    positions[i + 1] += dy;
  }
  return { positions, triangles: [...mesh.triangles] };
}

function remap(
  pattern: Pattern,
  move: (row: number, column: number) => [number, number],
): Pattern {
  const moved = createPattern(pattern.columns, pattern.rows);
  for (let row = 0; row < pattern.rows; row++) {
    for (let column = 0; column < pattern.columns; column++) {
      if (!isPunched(pattern, row, column)) continue;
      const [toRow, toColumn] = move(row, column);
      setPunched(moved, toRow, toColumn, true);
    }
  }
  return moved;
}

const mirrorColumns = (pattern: Pattern): Pattern =>
  remap(pattern, (row, column) => [row, pattern.columns - 1 - column]);

const flipRows = (pattern: Pattern): Pattern =>
  remap(pattern, (row, column) => [pattern.rows - 1 - row, column]);

/** Deliberately asymmetric in both axes, so a mirror or flip is detectable. */
function scatteredPattern(): Pattern {
  const pattern = createPattern(BROTHER_24.columns, ROWS);
  setPunched(pattern, 0, 0, true);
  setPunched(pattern, 1, 5, true);
  setPunched(pattern, 3, 11, true);
  setPunched(pattern, 5, 17, true);
  setPunched(pattern, 7, BROTHER_24.columns - 1, true);
  return pattern;
}

describe("analyzeTopSurface", () => {
  it("finds no pattern holes on a blank card, but still the machine ones", () => {
    const mesh = buildCardMesh(createPattern(BROTHER_24.columns, ROWS), BROTHER_24);
    const analysis = analyzeTopSurface(mesh);
    const grouped = classifyLoops(analysis, BROTHER_24);

    expect(grouped.pattern).toHaveLength(0);
    expect(grouped.belt).toHaveLength(2 * ROWS);
    expect(analysis.outline.width).toBeCloseTo(BROTHER_24.cardWidth, 6);
    expect(analysis.outline.height).toBeCloseTo(ROWS * BROTHER_24.rowPitch, 6);
  });

  it("recovers one loop per punched stitch", () => {
    const pattern = scatteredPattern();
    const analysis = analyzeTopSurface(buildCardMesh(pattern, BROTHER_24));

    expect(classifyLoops(analysis, BROTHER_24).pattern).toHaveLength(5);
  });

  it("recovers hole size from the profile", () => {
    const analysis = analyzeTopSurface(
      buildCardMesh(scatteredPattern(), BROTHER_24),
    );

    for (const hole of classifyLoops(analysis, BROTHER_24).pattern) {
      expect(hole.width).toBeCloseTo(BROTHER_24.patternHole.width, 6);
      expect(hole.height).toBeCloseTo(BROTHER_24.patternHole.height, 6);
    }
  });

  it("recovers round holes when the classic profile is used", () => {
    const analysis = analyzeTopSurface(
      buildCardMesh(scatteredPattern(), BROTHER_24_CLASSIC),
    );

    for (const hole of classifyLoops(analysis, BROTHER_24_CLASSIC).pattern) {
      expect(hole.width).toBeCloseTo(3.75, 6);
      expect(hole.height).toBeCloseTo(3.75, 6);
    }
  });

  it("finds every boundary component to be a simple closed loop", () => {
    const analysis = analyzeTopSurface(
      buildCardMesh(demoPattern(BROTHER_24, 24), BROTHER_24),
    );

    expect(analysis.openLoopCount).toBe(0);
  });
});

describe("classifyLoops", () => {
  it("tells the three hole types apart", () => {
    const analysis = analyzeTopSurface(
      buildCardMesh(scatteredPattern(), BROTHER_24),
    );
    const grouped = classifyLoops(analysis, BROTHER_24);

    expect(grouped.pattern).toHaveLength(5);
    expect(grouped.belt).toHaveLength(2 * ROWS);
    expect(grouped.loop).toHaveLength(2 * loopHoleBoundaries(ROWS).length);
    expect(grouped.unknown).toHaveLength(0);
  });
});

describe("machine holes", () => {
  const analysis = () =>
    analyzeTopSurface(buildCardMesh(scatteredPattern(), BROTHER_24));

  it("passes a correctly generated card", () => {
    expect(checkMachineHoles(analysis(), BROTHER_24, ROWS)).toEqual([]);
  });

  it("puts a belt hole on every row centre, both edges", () => {
    const belt = classifyLoops(analysis(), BROTHER_24).belt;

    expect(belt).toHaveLength(2 * ROWS);
    expect(belt.filter((hole) => hole.centreX < 0)).toHaveLength(ROWS);

    for (const hole of belt) {
      expect(Math.abs(hole.centreX)).toBeCloseTo(BROTHER_24.beltHoleOffsetX, 6);
      expect(hole.width).toBeCloseTo(BROTHER_24.beltHole.width, 6);
      expect(hole.height).toBeCloseTo(BROTHER_24.beltHole.height, 6);
    }
  });

  it("puts loop holes only at the ends, on row boundaries", () => {
    const loops = classifyLoops(analysis(), BROTHER_24).loop;
    const boundaries = loopHoleBoundaries(ROWS);

    expect(loops).toHaveLength(2 * boundaries.length);

    for (const hole of loops) {
      expect(Math.abs(hole.centreX)).toBeCloseTo(BROTHER_24.loopHoleOffsetX, 6);
      expect(hole.width).toBeCloseTo(BROTHER_24.loopHole.width, 6);
    }

    // Exactly the boundaries the profile nominates — no more, no fewer.
    const expected = boundaries
      .map((boundary) => rowBoundary(BROTHER_24, boundary, ROWS))
      .sort((a, b) => a - b);
    const recovered = [...new Set(loops.map((hole) => hole.centreY))].sort(
      (a, b) => a - b,
    );

    expect(recovered).toEqual(expected);
    // ...and none of them in the middle of the card.
    expect(recovered.some((y) => Math.abs(y) < BROTHER_24.rowPitch)).toBe(false);
  });

  it("offsets loop holes half a row from belt holes", () => {
    const grouped = classifyLoops(analysis(), BROTHER_24);

    // Belt holes sit on row centres, loop holes on row boundaries. That
    // half-row offset is the distinguishing feature of the reference card.
    for (const loop of grouped.loop) {
      const nearestBelt = grouped.belt.reduce((best, belt) =>
        Math.abs(belt.centreY - loop.centreY) <
        Math.abs(best.centreY - loop.centreY)
          ? belt
          : best,
      );
      expect(Math.abs(nearestBelt.centreY - loop.centreY)).toBeCloseTo(
        BROTHER_24.rowPitch / 2,
        6,
      );
    }
  });

  it("notices a missing belt hole column", () => {
    const grouped = classifyLoops(analysis(), BROTHER_24);
    const oneSided = {
      ...analysis(),
      holes: [
        ...grouped.pattern,
        ...grouped.belt.filter((hole) => hole.centreX > 0),
        ...grouped.loop,
      ],
    };

    const violations = checkMachineHoles(oneSided, BROTHER_24, ROWS);
    expect(violations.join("\n")).toContain("unbalanced");
  });

  it("checks all three hole types together", () => {
    const pattern = scatteredPattern();
    const built = analyzeTopSurface(buildCardMesh(pattern, BROTHER_24));

    expect(checkCard(built, BROTHER_24, pattern)).toEqual([]);
  });
});

describe("checkPatternLattice", () => {
  it("passes a correctly generated card", () => {
    const pattern = scatteredPattern();
    const analysis = analyzeTopSurface(buildCardMesh(pattern, BROTHER_24));

    expect(checkPatternLattice(analysis, BROTHER_24, pattern)).toEqual([]);
  });

  it("passes a full, realistically tiled card", () => {
    const pattern = demoPattern(BROTHER_24, 40);
    const analysis = analyzeTopSurface(buildCardMesh(pattern, BROTHER_24));

    expect(checkPatternLattice(analysis, BROTHER_24, pattern)).toEqual([]);
  });

  it("passes a blank card against a blank pattern", () => {
    const pattern = createPattern(BROTHER_24.columns, ROWS);
    const analysis = analyzeTopSurface(buildCardMesh(pattern, BROTHER_24));

    expect(checkPatternLattice(analysis, BROTHER_24, pattern)).toEqual([]);
  });

  // The failures this oracle exists to catch. Every one of these produces a
  // perfectly formed, watertight card that is nonetheless wrong.
  it("rejects a card shifted by half a row", () => {
    const pattern = scatteredPattern();
    const shifted = translate(
      buildCardMesh(pattern, BROTHER_24),
      0,
      BROTHER_24.rowPitch / 2,
    );

    expect(
      checkPatternLattice(analyzeTopSurface(shifted), BROTHER_24, pattern)
        .length,
    ).toBeGreaterThan(0);
  });

  it("rejects a card shifted by half a column", () => {
    const pattern = scatteredPattern();
    const shifted = translate(
      buildCardMesh(pattern, BROTHER_24),
      BROTHER_24.stitchPitch / 2,
      0,
    );

    expect(
      checkPatternLattice(analyzeTopSurface(shifted), BROTHER_24, pattern)
        .length,
    ).toBeGreaterThan(0);
  });

  // Snapping each hole to its nearest lattice site is not enough — a mirrored
  // card puts every hole on a legal site. The check has to compare the set of
  // occupied cells against the pattern that was asked for.
  it("rejects a horizontally mirrored card", () => {
    const intended = scatteredPattern();
    const built = buildCardMesh(mirrorColumns(intended), BROTHER_24);

    const violations = checkPatternLattice(
      analyzeTopSurface(built),
      BROTHER_24,
      intended,
    );

    expect(violations.length).toBeGreaterThan(0);
    expect(violations.join("\n")).toContain("should be punched but is solid");
  });

  it("rejects a vertically flipped card", () => {
    const intended = scatteredPattern();
    const built = buildCardMesh(flipRows(intended), BROTHER_24);

    const violations = checkPatternLattice(
      analyzeTopSurface(built),
      BROTHER_24,
      intended,
    );

    expect(violations.length).toBeGreaterThan(0);
  });

  it("reports a stitch that should have been punched", () => {
    const intended = scatteredPattern();
    const built = createPattern(BROTHER_24.columns, ROWS);
    setPunched(built, 0, 0, true); // only the first of five

    const violations = checkPatternLattice(
      analyzeTopSurface(buildCardMesh(built, BROTHER_24)),
      BROTHER_24,
      intended,
    );

    expect(violations.join("\n")).toContain("should be punched but is solid");
  });

  it("reports a stitch that should have been solid", () => {
    const intended = createPattern(BROTHER_24.columns, ROWS);
    const built = scatteredPattern();

    const violations = checkPatternLattice(
      analyzeTopSurface(buildCardMesh(built, BROTHER_24)),
      BROTHER_24,
      intended,
    );

    expect(violations.join("\n")).toContain("is punched but should be solid");
  });

  it("tolerates sub-tolerance drift", () => {
    const pattern = scatteredPattern();
    const nudged = translate(buildCardMesh(pattern, BROTHER_24), 0.005, 0.005);

    expect(
      checkPatternLattice(analyzeTopSurface(nudged), BROTHER_24, pattern),
    ).toEqual([]);
  });

  it("notices holes of the wrong size", () => {
    const pattern = scatteredPattern();
    const analysis = analyzeTopSurface(
      buildCardMesh(pattern, BROTHER_24_CLASSIC),
    );

    // Round holes measured against the elongated profile.
    const violations = checkPatternLattice(analysis, BROTHER_24, pattern);

    expect(violations.join("\n")).toContain("wide");
  });
});

describe("round trip through 3MF", () => {
  it("survives being written and read back", () => {
    const pattern = scatteredPattern();
    const original = buildCardMesh(pattern, BROTHER_24);

    const restored = read3mf(meshTo3mf(original, "punchcard"));

    expect(restored.positions.length).toBe(original.positions.length);
    expect(restored.triangles.length).toBe(original.triangles.length);
    expect(
      checkPatternLattice(analyzeTopSurface(restored), BROTHER_24, pattern),
    ).toEqual([]);
  });
});

describe("clustering helpers", () => {
  it("groups values within tolerance", () => {
    expect(clusterValues([1, 1.05, 5, 5.02, 9], 0.2)).toEqual([
      1.025, 5.01, 9,
    ]);
  });

  it("counts group membership so strays can be filtered", () => {
    const groups = clusterGroups([1, 1.05, 1.02, 7], 0.2);

    expect(groups).toHaveLength(2);
    expect(groups[0].count).toBe(3);
    expect(groups[1].count).toBe(1);
  });

  it("takes the median gap, ignoring outliers", () => {
    expect(medianSpacing([0, 4.5, 9, 13.5, 40])).toBeCloseTo(4.5, 6);
  });

  it("takes a median that ignores outliers", () => {
    expect(median([1, 2, 3, 4, 1000])).toBe(3);
  });
});
