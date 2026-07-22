import { describe, expect, it } from "vitest";

import {
  analyzeTopSurface,
  checkPatternLattice,
  clusterGroups,
  clusterValues,
  medianSpacing,
} from "@/lib/card/analyze";
import { demoPattern } from "@/lib/card/demo-pattern";
import { buildCardMesh, type Mesh } from "@/lib/card/mesh";
import { countPunched, createPattern, setPunched } from "@/lib/card/pattern";
import { read3mf } from "@/lib/card/read-3mf";
import { BROTHER_24, BROTHER_24_CLASSIC } from "@/lib/card/profile";
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

function scatteredPattern() {
  const pattern = createPattern(BROTHER_24.columns, ROWS);
  setPunched(pattern, 0, 0, true);
  setPunched(pattern, 1, 5, true);
  setPunched(pattern, 3, 11, true);
  setPunched(pattern, 5, 17, true);
  setPunched(pattern, 7, BROTHER_24.columns - 1, true);
  return pattern;
}

describe("analyzeTopSurface", () => {
  it("finds the card outline and nothing else on a blank card", () => {
    const mesh = buildCardMesh(createPattern(BROTHER_24.columns, ROWS), BROTHER_24);
    const analysis = analyzeTopSurface(mesh);

    expect(analysis.holes).toHaveLength(0);
    expect(analysis.outline.width).toBeCloseTo(BROTHER_24.cardWidth, 6);
    expect(analysis.outline.height).toBeCloseTo(ROWS * BROTHER_24.rowPitch, 6);
  });

  it("recovers one loop per punched stitch", () => {
    const pattern = scatteredPattern();
    const analysis = analyzeTopSurface(buildCardMesh(pattern, BROTHER_24));

    expect(analysis.holes).toHaveLength(countPunched(pattern));
  });

  it("recovers hole size from the profile", () => {
    const analysis = analyzeTopSurface(
      buildCardMesh(scatteredPattern(), BROTHER_24),
    );

    for (const hole of analysis.holes) {
      expect(hole.width).toBeCloseTo(BROTHER_24.patternHole.width, 6);
      expect(hole.height).toBeCloseTo(BROTHER_24.patternHole.height, 6);
    }
  });

  it("recovers round holes when the classic profile is used", () => {
    const analysis = analyzeTopSurface(
      buildCardMesh(scatteredPattern(), BROTHER_24_CLASSIC),
    );

    for (const hole of analysis.holes) {
      expect(hole.width).toBeCloseTo(3.75, 6);
      expect(hole.height).toBeCloseTo(3.75, 6);
    }
  });
});

describe("checkPatternLattice", () => {
  it("passes a correctly generated card", () => {
    const pattern = scatteredPattern();
    const analysis = analyzeTopSurface(buildCardMesh(pattern, BROTHER_24));

    expect(
      checkPatternLattice(analysis, BROTHER_24, ROWS, {
        expectedHoles: countPunched(pattern),
      }),
    ).toEqual([]);
  });

  it("passes a full, realistically tiled card", () => {
    const pattern = demoPattern(BROTHER_24, 40);
    const analysis = analyzeTopSurface(buildCardMesh(pattern, BROTHER_24));

    expect(
      checkPatternLattice(analysis, BROTHER_24, 40, {
        expectedHoles: countPunched(pattern),
      }),
    ).toEqual([]);
  });

  // The failure this oracle exists to catch: geometry that is perfectly formed
  // and watertight, but sitting half a row or half a column out of phase.
  it("rejects a card shifted by half a row", () => {
    const mesh = buildCardMesh(scatteredPattern(), BROTHER_24);
    const shifted = translate(mesh, 0, BROTHER_24.rowPitch / 2);

    const violations = checkPatternLattice(
      analyzeTopSurface(shifted),
      BROTHER_24,
      ROWS,
    );

    expect(violations.length).toBeGreaterThan(0);
    expect(violations.join("\n")).toContain("off row");
  });

  it("rejects a card shifted by half a column", () => {
    const mesh = buildCardMesh(scatteredPattern(), BROTHER_24);
    const shifted = translate(mesh, BROTHER_24.stitchPitch / 2, 0);

    const violations = checkPatternLattice(
      analyzeTopSurface(shifted),
      BROTHER_24,
      ROWS,
    );

    expect(violations.length).toBeGreaterThan(0);
    expect(violations.join("\n")).toContain("off column");
  });

  it("tolerates sub-tolerance drift", () => {
    const mesh = buildCardMesh(scatteredPattern(), BROTHER_24);
    const nudged = translate(mesh, 0.005, 0.005);

    expect(
      checkPatternLattice(analyzeTopSurface(nudged), BROTHER_24, ROWS),
    ).toEqual([]);
  });

  it("reports a hole count that does not match the pattern", () => {
    const pattern = scatteredPattern();
    const analysis = analyzeTopSurface(buildCardMesh(pattern, BROTHER_24));

    const violations = checkPatternLattice(analysis, BROTHER_24, ROWS, {
      expectedHoles: countPunched(pattern) + 1,
    });

    expect(violations.join("\n")).toContain("expected");
  });

  it("notices holes of the wrong size", () => {
    const analysis = analyzeTopSurface(
      buildCardMesh(scatteredPattern(), BROTHER_24_CLASSIC),
    );

    // Round holes measured against the elongated profile.
    const violations = checkPatternLattice(analysis, BROTHER_24, ROWS);

    expect(violations.join("\n")).toContain("wide");
  });
});

describe("round trip through 3MF", () => {
  it("survives being written and read back", () => {
    const pattern = scatteredPattern();
    const original = buildCardMesh(pattern, BROTHER_24);

    const restored = read3mf(meshTo3mf(original, "punchcard"));
    const analysis = analyzeTopSurface(restored);

    expect(restored.positions.length).toBe(original.positions.length);
    expect(restored.triangles.length).toBe(original.triangles.length);
    expect(
      checkPatternLattice(analysis, BROTHER_24, ROWS, {
        expectedHoles: countPunched(pattern),
      }),
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
});
