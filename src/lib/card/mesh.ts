import { type CardProfile, type HoleShape } from "./profile";
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

/** Slack when testing whether a cut falls inside a cell, in mm. */
const CUT_EPSILON = 1e-9;

interface Point2 {
  x: number;
  y: number;
}

/** A vertex on a cell boundary, with its angle about the hole it surrounds. */
interface RingVertex {
  index: number;
  angle: number;
}

/** A hole at a specific place on the card, not necessarily centred in its cell. */
interface PlacedHole {
  centreX: number;
  centreY: number;
  shape: HoleShape;
}

/**
 * A full-height vertical band of the card.
 *
 * Each strip carries its own horizontal cuts, because the three hole types do
 * not share a row phase: pattern and belt holes sit on row centres, loop holes
 * sit on row boundaries. No single grid can hold both — any cut line that
 * misses every pattern hole passes straight through the loop holes. Where two
 * strips with different cuts meet, the neighbour's cuts are added to the shared
 * edge so the surface stays free of T-junctions.
 */
interface Strip {
  x0: number;
  x1: number;
  /** Ascending y positions, from the bottom of the card to the top. */
  cuts: number[];
  /** Hole in cell `i`, if any. */
  holes: Map<number, PlacedHole>;
}

/**
 * Deduplicates 2D positions so that neighbouring cells share their boundary
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
 * Adds one cell: a rectangle, optionally carrying a hole.
 *
 * `leftExtra` and `rightExtra` are y positions the neighbouring strips need on
 * the shared vertical edges. Including them keeps the two sides of an interface
 * vertex-for-vertex identical even when the strips are cut differently.
 */
function addCell(
  welder: VertexWelder,
  triangles: number[],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  leftExtra: number[],
  rightExtra: number[],
  hole: PlacedHole | null,
  segments: number,
): void {
  // Counter-clockwise: up the right edge, across the top, down the left edge.
  const boundary: Point2[] = [{ x: x1, y: y0 }];
  for (const y of rightExtra) boundary.push({ x: x1, y });
  boundary.push({ x: x1, y: y1 }, { x: x0, y: y1 });
  for (const y of [...leftExtra].reverse()) boundary.push({ x: x0, y });
  boundary.push({ x: x0, y: y0 });

  if (!hole) {
    // Fan from the centroid. A rectangle with extra collinear edge points is
    // still convex, so the centroid is interior and every triangle is valid.
    const centroidX =
      boundary.reduce((sum, point) => sum + point.x, 0) / boundary.length;
    const centroidY =
      boundary.reduce((sum, point) => sum + point.y, 0) / boundary.length;
    const centre = welder.index(centroidX, centroidY);

    const ring = boundary.map((point) => welder.index(point.x, point.y));
    for (let k = 0; k < ring.length; k++) {
      triangles.push(centre, ring[k], ring[(k + 1) % ring.length]);
    }
    return;
  }

  const outer: RingVertex[] = boundary
    .map((point) => ({
      index: welder.index(point.x, point.y),
      angle: angleAbout(point.x - hole.centreX, point.y - hole.centreY),
    }))
    .sort((a, b) => a.angle - b.angle);

  const inner: RingVertex[] = [];
  for (let k = 0; k < segments; k++) {
    const theta = (2 * Math.PI * k) / segments;
    const x = hole.centreX + (hole.shape.width / 2) * Math.cos(theta);
    const y = hole.centreY + (hole.shape.height / 2) * Math.sin(theta);
    inner.push({
      index: welder.index(x, y),
      angle: angleAbout(x - hole.centreX, y - hole.centreY),
    });
  }
  inner.sort((a, b) => a.angle - b.angle);

  triangulateRing(triangles, outer, inner);
}

/** Y position of the centre of a row, relative to the card centre. */
export function rowCentre(
  profile: CardProfile,
  row: number,
  rows: number,
): number {
  return (row - (rows - 1) / 2) * profile.rowPitch;
}

/** Y of a boundary between rows. Boundary 0 is the card's bottom edge. */
export function rowBoundary(
  profile: CardProfile,
  boundary: number,
  rows: number,
): number {
  return (boundary - rows / 2) * profile.rowPitch;
}

/**
 * Which row boundaries carry loop holes.
 *
 * Only the ends of the piece: the two boundaries in from each end, matching the
 * reference card. Perforating the edge strip along the card's whole length
 * would weaken the most fragile part of a 0.2 mm print — see ADR-0001.
 */
export function loopHoleBoundaries(rows: number): number[] {
  const candidates = [1, 2, rows - 2, rows - 1];
  const usable = candidates.filter(
    (boundary) => boundary >= 1 && boundary <= rows - 1,
  );
  return [...new Set(usable)].sort((a, b) => a - b);
}

function buildStrips(pattern: Pattern, profile: CardProfile): Strip[] {
  const rows = pattern.rows;
  const halfWidth = profile.cardWidth / 2;
  const halfPattern = (profile.columns * profile.stitchPitch) / 2;

  // Between the belt and loop columns, so each sits inside its own strip.
  const edgeSplit = (profile.beltHoleOffsetX + profile.loopHoleOffsetX) / 2;

  const boundaryCuts = Array.from({ length: rows + 1 }, (_, k) =>
    rowBoundary(profile, k, rows),
  );
  const centreCuts = [
    rowBoundary(profile, 0, rows),
    ...Array.from({ length: rows }, (_, j) => rowCentre(profile, j, rows)),
    rowBoundary(profile, rows, rows),
  ];

  const beltHoles = (centreX: number): Map<number, PlacedHole> =>
    new Map(
      Array.from({ length: rows }, (_, row): [number, PlacedHole] => [
        row,
        {
          centreX,
          centreY: rowCentre(profile, row, rows),
          shape: profile.beltHole,
        },
      ]),
    );

  // Cell `k` of a loop strip runs from row centre k-1 to row centre k, so it is
  // centred on row boundary k — exactly where the hole goes.
  const loopHoles = (centreX: number): Map<number, PlacedHole> =>
    new Map(
      loopHoleBoundaries(rows).map((boundary): [number, PlacedHole] => [
        boundary,
        {
          centreX,
          centreY: rowBoundary(profile, boundary, rows),
          shape: profile.loopHole,
        },
      ]),
    );

  const patternStrips: Strip[] = Array.from(
    { length: profile.columns },
    (_, column): Strip => ({
      x0: -halfPattern + column * profile.stitchPitch,
      x1: -halfPattern + (column + 1) * profile.stitchPitch,
      cuts: boundaryCuts,
      holes: new Map(
        Array.from({ length: rows }, (_, row) => row)
          .filter((row) => isPunched(pattern, row, column))
          .map((row): [number, PlacedHole] => [
            row,
            {
              centreX: -halfPattern + (column + 0.5) * profile.stitchPitch,
              centreY: rowCentre(profile, row, rows),
              shape: profile.patternHole,
            },
          ]),
      ),
    }),
  );

  return [
    {
      x0: -halfWidth,
      x1: -edgeSplit,
      cuts: centreCuts,
      holes: loopHoles(-profile.loopHoleOffsetX),
    },
    {
      x0: -edgeSplit,
      x1: -halfPattern,
      cuts: boundaryCuts,
      holes: beltHoles(-profile.beltHoleOffsetX),
    },
    ...patternStrips,
    {
      x0: halfPattern,
      x1: edgeSplit,
      cuts: boundaryCuts,
      holes: beltHoles(profile.beltHoleOffsetX),
    },
    {
      x0: edgeSplit,
      x1: halfWidth,
      cuts: centreCuts,
      holes: loopHoles(profile.loopHoleOffsetX),
    },
  ];
}

/** Cuts a neighbouring strip needs on a shared edge inside this cell. */
function extrasWithin(
  neighbour: Strip | undefined,
  y0: number,
  y1: number,
): number[] {
  if (!neighbour) return [];
  return neighbour.cuts.filter(
    (cut) => cut > y0 + CUT_EPSILON && cut < y1 - CUT_EPSILON,
  );
}

/**
 * Builds the complete card: pattern holes where the pattern says, belt holes on
 * every row centre, and loop holes on the row boundaries at each end.
 */
export function buildCardMesh(pattern: Pattern, profile: CardProfile): Mesh {
  const welder = new VertexWelder();
  const surface: number[] = [];
  const strips = buildStrips(pattern, profile);

  for (let s = 0; s < strips.length; s++) {
    const strip = strips[s];

    for (let cell = 0; cell < strip.cuts.length - 1; cell++) {
      const y0 = strip.cuts[cell];
      const y1 = strip.cuts[cell + 1];

      addCell(
        welder,
        surface,
        strip.x0,
        y0,
        strip.x1,
        y1,
        extrasWithin(strips[s - 1], y0, y1),
        extrasWithin(strips[s + 1], y0, y1),
        strip.holes.get(cell) ?? null,
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
