import { type Mesh } from "./mesh";
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
  /** Every other boundary loop: one per hole. */
  holes: Loop[];
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

  const adjacency = new Map<number, number[]>();
  const connect = (a: number, b: number): void => {
    const existing = adjacency.get(a);
    if (existing) existing.push(b);
    else adjacency.set(a, [b]);
  };

  for (const [k, uses] of edgeUses) {
    if (uses !== 1) continue;
    const [a, b] = k.split(":").map(Number);
    connect(a, b);
    connect(b, a);
  }

  const visited = new Set<number>();
  const loops: Loop[] = [];

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

  return { outline: loops[0], holes: loops.slice(1) };
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

export interface LatticeOptions {
  /** How far a hole centre may sit from its nominal position, in mm. */
  tolerance?: number;
  /** How far a hole's size may differ from the profile, in mm. */
  sizeTolerance?: number;
  /** Expected number of pattern holes, when known. */
  expectedHoles?: number;
}

/**
 * Checks every recovered hole against the positions the profile says it should
 * occupy, returning one message per violation.
 *
 * Returning messages rather than throwing keeps the failure readable: a
 * half-row phase error reports every hole at once instead of stopping at the
 * first.
 */
export function checkPatternLattice(
  analysis: MeshAnalysis,
  profile: CardProfile,
  rows: number,
  options: LatticeOptions = {},
): string[] {
  const tolerance = options.tolerance ?? 0.02;
  const sizeTolerance = options.sizeTolerance ?? 0.02;
  const violations: string[] = [];

  const columnsX = Array.from({ length: profile.columns }, (_, column) =>
    stitchCentreX(profile, column),
  );
  const rowsY = Array.from({ length: rows }, (_, row) =>
    rowCentreY(profile, row, rows),
  );

  const nearest = (value: number, candidates: number[]): number =>
    candidates.reduce((best, candidate) =>
      Math.abs(candidate - value) < Math.abs(best - value) ? candidate : best,
    );

  for (const hole of analysis.holes) {
    const columnX = nearest(hole.centreX, columnsX);
    const rowY = nearest(hole.centreY, rowsY);

    const offX = Math.abs(hole.centreX - columnX);
    const offY = Math.abs(hole.centreY - rowY);

    if (offX > tolerance) {
      violations.push(
        `hole at (${hole.centreX.toFixed(3)}, ${hole.centreY.toFixed(3)}) is ${offX.toFixed(3)} mm off column ${columnX.toFixed(3)}`,
      );
    }
    if (offY > tolerance) {
      violations.push(
        `hole at (${hole.centreX.toFixed(3)}, ${hole.centreY.toFixed(3)}) is ${offY.toFixed(3)} mm off row ${rowY.toFixed(3)}`,
      );
    }

    if (Math.abs(hole.width - profile.patternHole.width) > sizeTolerance) {
      violations.push(
        `hole at (${hole.centreX.toFixed(3)}, ${hole.centreY.toFixed(3)}) is ${hole.width.toFixed(3)} mm wide, expected ${profile.patternHole.width}`,
      );
    }
    if (Math.abs(hole.height - profile.patternHole.height) > sizeTolerance) {
      violations.push(
        `hole at (${hole.centreX.toFixed(3)}, ${hole.centreY.toFixed(3)}) is ${hole.height.toFixed(3)} mm tall, expected ${profile.patternHole.height}`,
      );
    }
  }

  if (
    options.expectedHoles !== undefined &&
    analysis.holes.length !== options.expectedHoles
  ) {
    violations.push(
      `found ${analysis.holes.length} holes, expected ${options.expectedHoles}`,
    );
  }

  return violations;
}
