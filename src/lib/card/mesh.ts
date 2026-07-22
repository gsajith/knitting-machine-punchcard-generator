import { type CardProfile } from "./profile";
import { isPunched, type Pattern } from "./pattern";

/** An indexed triangle mesh. */
export interface Mesh {
  /** Flat xyz triples. */
  positions: number[];
  /** Flat vertex-index triples. */
  triangles: number[];
}

/** Tolerance for treating two positions as the same vertex, in mm. */
const WELD_TOLERANCE = 1e-6;

interface Point2 {
  x: number;
  y: number;
}

/** A vertex on a cell boundary, with its angle about the cell centre. */
interface RingVertex {
  index: number;
  angle: number;
}

/**
 * Deduplicates 2D positions so that neighbouring cells share their corner
 * vertices. Without this the surface would be a pile of disconnected quads and
 * nothing would be watertight.
 */
class VertexWelder {
  private readonly lookup = new Map<string, number>();
  readonly points: Point2[] = [];

  index(x: number, y: number): number {
    const key = `${Math.round(x / WELD_TOLERANCE)},${Math.round(y / WELD_TOLERANCE)}`;
    const existing = this.lookup.get(key);
    if (existing !== undefined) return existing;

    const created = this.points.length;
    this.points.push({ x, y });
    this.lookup.set(key, created);
    return created;
  }
}

function angleAbout(dx: number, dy: number): number {
  const angle = Math.atan2(dy, dx);
  return angle < 0 ? angle + 2 * Math.PI : angle;
}

/**
 * Triangulates the region between two loops that both enclose a common centre,
 * each sorted counter-clockwise by angle.
 *
 * Walks the two loops together, always advancing whichever has the nearer next
 * vertex by angle. Both loops are star-shaped about the centre, so this can
 * never produce an overlapping or inverted triangle.
 */
function triangulateRing(
  triangles: number[],
  outer: RingVertex[],
  inner: RingVertex[],
): void {
  const outerCount = outer.length;
  const innerCount = inner.length;
  const start = outer[0].angle;

  const forward = (angle: number): number => {
    const delta = angle - start;
    return delta < 0 ? delta + 2 * Math.PI : delta;
  };

  // Begin at the inner vertex nearest the first outer vertex, going forwards.
  let innerStart = 0;
  let nearest = Number.POSITIVE_INFINITY;
  for (let k = 0; k < innerCount; k++) {
    const distance = forward(inner[k].angle);
    if (distance < nearest) {
      nearest = distance;
      innerStart = k;
    }
  }

  const outerDistance = outer.map((vertex) => forward(vertex.angle));
  const innerDistance = inner.map((_, k) =>
    forward(inner[(innerStart + k) % innerCount].angle),
  );
  // The rotated inner loop may wrap past the start; keep it monotonic.
  for (let k = 1; k < innerCount; k++) {
    if (innerDistance[k] < innerDistance[k - 1]) {
      innerDistance[k] += 2 * Math.PI;
    }
  }

  const nextOuter = (k: number): number =>
    k + 1 < outerCount ? outerDistance[k + 1] : outerDistance[0] + 2 * Math.PI;
  const nextInner = (k: number): number =>
    k + 1 < innerCount ? innerDistance[k + 1] : innerDistance[0] + 2 * Math.PI;

  let i = 0;
  let j = 0;
  for (let step = 0; step < outerCount + innerCount; step++) {
    const outerVertex = outer[i % outerCount].index;
    const innerVertex = inner[(innerStart + j) % innerCount].index;

    // Once a loop has been walked all the way round its index wraps, so its
    // "next" distance would look small again. Exhaustion has to be explicit.
    const outerDone = i >= outerCount;
    const innerDone = j >= innerCount;
    const advanceOuter =
      !outerDone && (innerDone || nextOuter(i) <= nextInner(j));

    if (advanceOuter) {
      const advanced = outer[(i + 1) % outerCount].index;
      triangles.push(outerVertex, advanced, innerVertex);
      i++;
    } else {
      const advanced = inner[(innerStart + j + 1) % innerCount].index;
      // Reversed relative to the outer step: a hole is traversed the opposite
      // way round from the outline it sits in, or the surface faces inwards.
      triangles.push(outerVertex, advanced, innerVertex);
      j++;
    }
  }
}

/**
 * Adds one cell of the card: a rectangle, optionally with a hole in it.
 *
 * Cells only ever meet at their corners, so a cell's size is independent of its
 * neighbours' and the surface stays free of T-junctions.
 */
function addCell(
  welder: VertexWelder,
  triangles: number[],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  hole: { width: number; height: number } | null,
  segments: number,
): void {
  const corners: Point2[] = [
    { x: x1, y: y1 },
    { x: x0, y: y1 },
    { x: x0, y: y0 },
    { x: x1, y: y0 },
  ];

  if (!hole) {
    const [a, b, c, d] = corners.map((point) =>
      welder.index(point.x, point.y),
    );
    triangles.push(a, b, c, a, c, d);
    return;
  }

  const centreX = (x0 + x1) / 2;
  const centreY = (y0 + y1) / 2;

  const outer: RingVertex[] = corners
    .map((point) => ({
      index: welder.index(point.x, point.y),
      angle: angleAbout(point.x - centreX, point.y - centreY),
    }))
    .sort((a, b) => a.angle - b.angle);

  const inner: RingVertex[] = [];
  for (let k = 0; k < segments; k++) {
    const theta = (2 * Math.PI * k) / segments;
    const x = centreX + (hole.width / 2) * Math.cos(theta);
    const y = centreY + (hole.height / 2) * Math.sin(theta);
    inner.push({
      index: welder.index(x, y),
      angle: angleAbout(x - centreX, y - centreY),
    });
  }
  inner.sort((a, b) => a.angle - b.angle);

  triangulateRing(triangles, outer, inner);
}

/** X positions of the cell boundaries, left to right. */
function columnEdges(profile: CardProfile): number[] {
  const halfCard = profile.cardWidth / 2;
  const halfPattern = (profile.columns * profile.stitchPitch) / 2;

  const edges = [-halfCard];
  for (let k = 0; k <= profile.columns; k++) {
    edges.push(-halfPattern + k * profile.stitchPitch);
  }
  edges.push(halfCard);
  return edges;
}

/**
 * Builds the card as a flat plate perforated by its pattern holes.
 *
 * Belt and loop holes are not included yet — see issue #4.
 */
export function buildCardMesh(pattern: Pattern, profile: CardProfile): Mesh {
  const welder = new VertexWelder();
  const surface: number[] = [];

  const edgesX = columnEdges(profile);
  const halfLength = (pattern.rows * profile.rowPitch) / 2;

  for (let row = 0; row < pattern.rows; row++) {
    const y0 = -halfLength + row * profile.rowPitch;
    const y1 = y0 + profile.rowPitch;

    for (let cell = 0; cell < edgesX.length - 1; cell++) {
      // Cell 0 and the last cell are the side margins; the rest are stitches.
      const column = cell - 1;
      const punched =
        column >= 0 &&
        column < profile.columns &&
        isPunched(pattern, row, column);

      addCell(
        welder,
        surface,
        edgesX[cell],
        y0,
        edgesX[cell + 1],
        y1,
        punched ? profile.patternHole : null,
        profile.holeSegments,
      );
    }
  }

  return extrude(welder.points, surface, profile.thickness);
}

/**
 * Turns a flat triangulated surface into a solid.
 *
 * Walls are raised from the surface's boundary edges — the edges used by
 * exactly one triangle. That set is precisely the card outline plus every hole
 * outline, so the card rim and the hole walls fall out of the same pass and the
 * result is closed by construction.
 */
function extrude(points: Point2[], surface: number[], thickness: number): Mesh {
  const count = points.length;
  const positions: number[] = [];

  for (const point of points) positions.push(point.x, point.y, thickness);
  for (const point of points) positions.push(point.x, point.y, 0);

  const bottom = (index: number): number => index + count;

  const triangles: number[] = [];

  for (let t = 0; t < surface.length; t += 3) {
    const [a, b, c] = [surface[t], surface[t + 1], surface[t + 2]];
    triangles.push(a, b, c);
    triangles.push(bottom(a), bottom(c), bottom(b));
  }

  const directed = new Set<number>();
  for (let t = 0; t < surface.length; t += 3) {
    const [a, b, c] = [surface[t], surface[t + 1], surface[t + 2]];
    directed.add(a * count + b);
    directed.add(b * count + c);
    directed.add(c * count + a);
  }

  for (const edge of directed) {
    const a = Math.floor(edge / count);
    const b = edge % count;
    if (directed.has(b * count + a)) continue; // interior edge

    triangles.push(a, bottom(a), bottom(b));
    triangles.push(a, bottom(b), b);
  }

  return { positions, triangles };
}

/**
 * Counts undirected edges that are not shared by exactly two triangles.
 *
 * Zero means the mesh is closed. This catches unclosed hole walls, missing
 * caps, duplicated vertices and dropped triangles in one number.
 */
export function countUnpairedEdges(mesh: Mesh): number {
  const uses = new Map<string, number>();

  const record = (a: number, b: number): void => {
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    uses.set(key, (uses.get(key) ?? 0) + 1);
  };

  for (let t = 0; t < mesh.triangles.length; t += 3) {
    const [a, b, c] = [
      mesh.triangles[t],
      mesh.triangles[t + 1],
      mesh.triangles[t + 2],
    ];
    record(a, b);
    record(b, c);
    record(c, a);
  }

  let unpaired = 0;
  for (const count of uses.values()) {
    if (count !== 2) unpaired++;
  }
  return unpaired;
}

export function isWatertight(mesh: Mesh): boolean {
  return countUnpairedEdges(mesh) === 0;
}

/** Axis-aligned bounds of a mesh, in mm. */
export function boundingBox(mesh: Mesh): {
  min: [number, number, number];
  max: [number, number, number];
} {
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];

  for (let i = 0; i < mesh.positions.length; i += 3) {
    for (let axis = 0; axis < 3; axis++) {
      const value = mesh.positions[i + axis];
      if (value < min[axis]) min[axis] = value;
      if (value > max[axis]) max[axis] = value;
    }
  }

  return { min, max };
}
