import {
  loopHoleBoundaries,
  rowBoundary,
  rowCentre,
  type Mesh,
} from "./mesh";
import { isPunched, type Pattern } from "./pattern";
import { stitchCentreX, rowCentreY, type CardProfile } from "./profile";

/**
 * Reads a finished mesh back into the features it was supposed to contain.
 *
 * This is the verification oracle. The generator and this analyzer share no
 * code — the generator emits triangles from a lattice, and this recovers a
 * lattice from triangles — so agreement between them is real evidence rather
 * than a tautology. It also runs against the hand-drawn reference cards in
 * `reference/`, which is how the card profile was established in the first
 * place.
 */

/** How far a vertex may sit from the top plane and still count as on it. */
const PLANE_TOLERANCE = 1e-4;

export interface Bounds2 {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface Loop {
  /** Centre of the loop's bounding box. */
  centreX: number;
  centreY: number;
  /** Bounding box extents, in mm. */
  width: number;
  height: number;
  /** How many distinct vertices the loop is made of. */
  vertexCount: number;
}

export interface MeshAnalysis {
  /** The card outline — the largest boundary loop on the top face. */
  outline: Loop;
  /** Every other boundary loop. Use `classifyLoops` to tell them apart. */
  holes: Loop[];
  /**
   * Boundary components that are not simple closed loops.
   *
   * A well-formed surface's boundary is a set of loops where every vertex has
   * exactly two neighbours. Anything else means holes that touch, a pinched
   * outline, or a triangulation fault.
   */
  openLoopCount: number;
}

function boundsOf(points: Array<{ x: number; y: number }>): Bounds2 {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const point of points) {
    if (point.x < minX) minX = point.x;
    if (point.x > maxX) maxX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.y > maxY) maxY = point.y;
  }

  return { minX, maxX, minY, maxY };
}

/**
 * Finds the closed loops bounding the top face.
 *
 * Only triangles lying wholly in the top plane are considered, so the walls and
 * the underside are ignored. Within that set, an edge used by exactly one
 * triangle is on a boundary — which is the card outline plus one loop per hole,
 * and nothing else.
 */
export function analyzeTopSurface(mesh: Mesh): MeshAnalysis {
  const vertexCount = mesh.positions.length / 3;

  let topZ = -Infinity;
  for (let i = 2; i < mesh.positions.length; i += 3) {
    if (mesh.positions[i] > topZ) topZ = mesh.positions[i];
  }

  const onTop = new Array<boolean>(vertexCount);
  for (let v = 0; v < vertexCount; v++) {
    onTop[v] = Math.abs(mesh.positions[v * 3 + 2] - topZ) < PLANE_TOLERANCE;
  }

  const edgeUses = new Map<string, number>();
  const key = (a: number, b: number): string =>
    a < b ? `${a}:${b}` : `${b}:${a}`;

  for (let t = 0; t < mesh.triangles.length; t += 3) {
    const a = mesh.triangles[t];
    const b = mesh.triangles[t + 1];
    const c = mesh.triangles[t + 2];
    if (!onTop[a] || !onTop[b] || !onTop[c]) continue;

    for (const [u, w] of [
      [a, b],
      [b, c],
      [c, a],
    ]) {
      const k = key(u, w);
      edgeUses.set(k, (edgeUses.get(k) ?? 0) + 1);
    }
  }

  const adjacency = new Map<number, Set<number>>();
  const connect = (a: number, b: number): void => {
    const existing = adjacency.get(a);
    if (existing) existing.add(b);
    else adjacency.set(a, new Set([b]));
  };

  for (const [k, uses] of edgeUses) {
    if (uses !== 1) continue;
    const [a, b] = k.split(":").map(Number);
    connect(a, b);
    connect(b, a);
  }

  const visited = new Set<number>();
  const loops: Loop[] = [];
  let openLoopCount = 0;

  for (const start of adjacency.keys()) {
    if (visited.has(start)) continue;

    const stack = [start];
    visited.add(start);
    const members: number[] = [];

    while (stack.length > 0) {
      const current = stack.pop() as number;
      members.push(current);
      for (const next of adjacency.get(current) ?? []) {
        if (!visited.has(next)) {
          visited.add(next);
          stack.push(next);
        }
      }
    }

    // A simple closed loop has every vertex joined to exactly two others.
    const simple = members.every(
      (member) => (adjacency.get(member)?.size ?? 0) === 2,
    );
    if (!simple) openLoopCount++;

    const points = members.map((v) => ({
      x: mesh.positions[v * 3],
      y: mesh.positions[v * 3 + 1],
    }));
    const bounds = boundsOf(points);

    loops.push({
      centreX: (bounds.minX + bounds.maxX) / 2,
      centreY: (bounds.minY + bounds.maxY) / 2,
      width: bounds.maxX - bounds.minX,
      height: bounds.maxY - bounds.minY,
      vertexCount: members.length,
    });
  }

  if (loops.length === 0) {
    throw new Error("Mesh has no boundary loops on its top face.");
  }

  loops.sort((a, b) => b.width * b.height - a.width * a.height);

  return { outline: loops[0], holes: loops.slice(1), openLoopCount };
}

/**
 * The three kinds of hole a card carries. They have different jobs and
 * different tolerances, so nothing downstream should treat them alike —
 * see CONTEXT.md.
 */
export type LoopKind = "pattern" | "belt" | "loop" | "unknown";

export interface ClassifiedLoops {
  pattern: Loop[];
  belt: Loop[];
  loop: Loop[];
  /** Anything the profile cannot account for. Always a defect. */
  unknown: Loop[];
}

/** Which column band a loop's centre falls in. */
export function classifyLoop(
  loop: Loop,
  profile: CardProfile,
  tolerance = 0.5,
): LoopKind {
  const x = Math.abs(loop.centreX);

  if (x <= (profile.columns * profile.stitchPitch) / 2) return "pattern";
  if (Math.abs(x - profile.beltHoleOffsetX) <= tolerance) return "belt";
  if (Math.abs(x - profile.loopHoleOffsetX) <= tolerance) return "loop";
  return "unknown";
}

export function classifyLoops(
  analysis: MeshAnalysis,
  profile: CardProfile,
  tolerance = 0.5,
): ClassifiedLoops {
  const grouped: ClassifiedLoops = {
    pattern: [],
    belt: [],
    loop: [],
    unknown: [],
  };

  for (const hole of analysis.holes) {
    grouped[classifyLoop(hole, profile, tolerance)].push(hole);
  }

  return grouped;
}

export interface LatticeOptions {
  /** How far a hole centre may sit from its nominal position, in mm. */
  tolerance?: number;
  /** How far a hole's size may differ from the profile, in mm. */
  sizeTolerance?: number;
}

/**
 * Checks the pattern holes in a mesh against the pattern that was asked for.
 *
 * Compares the *set* of occupied cells, not just whether each hole sits on some
 * lattice site. Snapping each hole to its nearest valid site is not enough: a
 * mirrored or flipped card puts every hole on a perfectly legal site and would
 * pass, which is exactly the defect this oracle exists to catch.
 *
 * Returns one message per violation rather than throwing, so a systematic error
 * reports every affected hole at once instead of stopping at the first.
 */
export function checkPatternLattice(
  analysis: MeshAnalysis,
  profile: CardProfile,
  pattern: Pattern,
  options: LatticeOptions = {},
): string[] {
  const tolerance = options.tolerance ?? 0.02;
  const sizeTolerance = options.sizeTolerance ?? 0.02;
  const violations: string[] = [];

  if (analysis.openLoopCount > 0) {
    violations.push(
      `${analysis.openLoopCount} boundary component(s) are not simple closed loops`,
    );
  }

  const grouped = classifyLoops(analysis, profile);

  for (const stray of grouped.unknown) {
    violations.push(
      `loop at (${stray.centreX.toFixed(3)}, ${stray.centreY.toFixed(3)}) matches no column the profile defines`,
    );
  }

  const occupied = new Map<string, Loop>();

  for (const hole of grouped.pattern) {
    const column = Math.round(
      hole.centreX / profile.stitchPitch + (profile.columns - 1) / 2,
    );
    const row = Math.round(
      hole.centreY / profile.rowPitch + (pattern.rows - 1) / 2,
    );

    const where = `(${hole.centreX.toFixed(3)}, ${hole.centreY.toFixed(3)})`;

    if (column < 0 || column >= profile.columns) {
      violations.push(`hole at ${where} is outside the card's stitch columns`);
      continue;
    }
    if (row < 0 || row >= pattern.rows) {
      violations.push(`hole at ${where} is outside the card's rows`);
      continue;
    }

    const offX = Math.abs(hole.centreX - stitchCentreX(profile, column));
    const offY = Math.abs(
      hole.centreY - rowCentreY(profile, row, pattern.rows),
    );

    if (offX > tolerance) {
      violations.push(
        `hole at ${where} is ${offX.toFixed(3)} mm off column ${column}`,
      );
    }
    if (offY > tolerance) {
      violations.push(
        `hole at ${where} is ${offY.toFixed(3)} mm off row ${row}`,
      );
    }

    if (Math.abs(hole.width - profile.patternHole.width) > sizeTolerance) {
      violations.push(
        `hole at ${where} is ${hole.width.toFixed(3)} mm wide, expected ${profile.patternHole.width}`,
      );
    }
    if (Math.abs(hole.height - profile.patternHole.height) > sizeTolerance) {
      violations.push(
        `hole at ${where} is ${hole.height.toFixed(3)} mm tall, expected ${profile.patternHole.height}`,
      );
    }

    const cell = `${row}:${column}`;
    if (occupied.has(cell)) {
      violations.push(`two holes occupy row ${row}, column ${column}`);
    }
    occupied.set(cell, hole);
  }

  // Set comparison against the pattern. This is what catches a mirror or flip.
  for (let row = 0; row < pattern.rows; row++) {
    for (let column = 0; column < profile.columns; column++) {
      const wanted = isPunched(pattern, row, column);
      const found = occupied.has(`${row}:${column}`);

      if (wanted && !found) {
        violations.push(`row ${row}, column ${column} should be punched but is solid`);
      } else if (!wanted && found) {
        violations.push(`row ${row}, column ${column} is punched but should be solid`);
      }
    }
  }

  return violations;
}

/**
 * Checks the machine features: belt holes on every row centre, loop holes on
 * the row boundaries at each end.
 *
 * Belt holes are the load-bearing ones — the drum's drive pins seat in them, so
 * a misplaced belt hole means a card that will not feed. Loop holes only take
 * the joining clips and have slack.
 */
export function checkMachineHoles(
  analysis: MeshAnalysis,
  profile: CardProfile,
  rows: number,
  options: LatticeOptions = {},
): string[] {
  const tolerance = options.tolerance ?? 0.02;
  const sizeTolerance = options.sizeTolerance ?? 0.02;
  const violations: string[] = [];
  const grouped = classifyLoops(analysis, profile);

  const checkColumn = (
    holes: Loop[],
    kind: "belt" | "loop",
    offsetX: number,
    shape: { width: number; height: number },
    expectedY: number[],
  ): void => {
    const expectedCount = 2 * expectedY.length;
    if (holes.length !== expectedCount) {
      violations.push(
        `found ${holes.length} ${kind} holes, expected ${expectedCount}`,
      );
    }

    for (const hole of holes) {
      const where = `(${hole.centreX.toFixed(3)}, ${hole.centreY.toFixed(3)})`;

      const offX = Math.abs(Math.abs(hole.centreX) - offsetX);
      if (offX > tolerance) {
        violations.push(
          `${kind} hole at ${where} is ${offX.toFixed(3)} mm off its column`,
        );
      }

      const nearestY = expectedY.reduce((best, candidate) =>
        Math.abs(candidate - hole.centreY) < Math.abs(best - hole.centreY)
          ? candidate
          : best,
      );
      const offY = Math.abs(hole.centreY - nearestY);
      if (offY > tolerance) {
        violations.push(
          `${kind} hole at ${where} is ${offY.toFixed(3)} mm off its row`,
        );
      }

      if (Math.abs(hole.width - shape.width) > sizeTolerance) {
        violations.push(
          `${kind} hole at ${where} is ${hole.width.toFixed(3)} mm wide, expected ${shape.width}`,
        );
      }
      if (Math.abs(hole.height - shape.height) > sizeTolerance) {
        violations.push(
          `${kind} hole at ${where} is ${hole.height.toFixed(3)} mm tall, expected ${shape.height}`,
        );
      }
    }

    // Both edges must carry the column, not one edge twice.
    const left = holes.filter((hole) => hole.centreX < 0).length;
    const right = holes.length - left;
    if (left !== right) {
      violations.push(
        `${kind} holes are unbalanced: ${left} on the left edge, ${right} on the right`,
      );
    }
  };

  checkColumn(
    grouped.belt,
    "belt",
    profile.beltHoleOffsetX,
    profile.beltHole,
    Array.from({ length: rows }, (_, row) => rowCentre(profile, row, rows)),
  );

  checkColumn(
    grouped.loop,
    "loop",
    profile.loopHoleOffsetX,
    profile.loopHole,
    loopHoleBoundaries(rows).map((boundary) =>
      rowBoundary(profile, boundary, rows),
    ),
  );

  return violations;
}

/** Every check the profile can make against a finished card. */
export function checkCard(
  analysis: MeshAnalysis,
  profile: CardProfile,
  pattern: Pattern,
  options: LatticeOptions = {},
): string[] {
  return [
    ...checkPatternLattice(analysis, profile, pattern, options),
    ...checkMachineHoles(analysis, profile, pattern.rows, options),
  ];
}

export interface Cluster {
  /** Mean of the grouped values. */
  centre: number;
  /** How many values fell into this group. */
  count: number;
}

/**
 * Groups nearby values.
 *
 * The count matters when reading hand-drawn cards: a stray hole produces a
 * cluster of one, and callers filter those out rather than treating them as a
 * real column.
 */
export function clusterGroups(values: number[], tolerance: number): Cluster[] {
  if (values.length === 0) return [];

  const sorted = [...values].sort((a, b) => a - b);
  const groups: number[][] = [[sorted[0]]];

  for (const value of sorted.slice(1)) {
    const current = groups[groups.length - 1];
    if (value - current[current.length - 1] <= tolerance) current.push(value);
    else groups.push([value]);
  }

  return groups.map((group) => ({
    centre: group.reduce((sum, value) => sum + value, 0) / group.length,
    count: group.length,
  }));
}

/** Groups nearby values, returning the mean of each group. */
export function clusterValues(values: number[], tolerance: number): number[] {
  return clusterGroups(values, tolerance).map((group) => group.centre);
}

/** Median gap between consecutive sorted values. */
export function medianSpacing(values: number[]): number {
  if (values.length < 2) return NaN;

  const sorted = [...values].sort((a, b) => a - b);
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) gaps.push(sorted[i] - sorted[i - 1]);

  gaps.sort((a, b) => a - b);
  const middle = Math.floor(gaps.length / 2);

  return gaps.length % 2 === 0
    ? (gaps[middle - 1] + gaps[middle]) / 2
    : gaps[middle];
}

/** Median of a set of values. */
export function median(values: number[]): number {
  if (values.length === 0) return NaN;

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}
