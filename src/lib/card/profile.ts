/**
 * Physical constants for a punchcard format.
 *
 * This is the only place a dimension may live. Nothing else in the codebase
 * should contain a millimetre value — see docs/adr/0001-card-profile-constants.md
 * for where these numbers came from and how confident we are in each.
 */

/** A hole's cross-section. Round holes have equal width and height. */
export interface HoleShape {
  /** Width across the card (X), in mm. */
  width: number;
  /** Height along the card (Y), in mm. */
  height: number;
}

export interface CardProfile {
  name: string;
  /** Card width across the stitches, in mm. */
  cardWidth: number;
  /** Card thickness, in mm. A single printed layer. */
  thickness: number;
  /** Centre-to-centre distance between stitch columns, in mm. */
  stitchPitch: number;
  /** Centre-to-centre distance between rows, in mm. */
  rowPitch: number;
  /** Number of pattern (stitch) columns. */
  columns: number;
  /** Shortest card that can wrap the drum, in rows. Unverified — see SPEC §5. */
  minRows: number;
  /** Rows duplicated across each seam. */
  overlapRows: number;
  /** The punched stitches the user draws. */
  patternHole: HoleShape;
  /** Drive holes the drum's pins seat in. Load-bearing: must be exact. */
  beltHole: HoleShape;
  /** Holes the joining clips pass through. Has dimensional slack. */
  loopHole: HoleShape;
  /** Distance of the belt hole columns from the card centre, in mm. */
  beltHoleOffsetX: number;
  /** Distance of the loop hole columns from the card centre, in mm. */
  loopHoleOffsetX: number;
  /** Segments used to approximate a hole outline. */
  holeSegments: number;
}

const round = (diameter: number): HoleShape => ({
  width: diameter,
  height: diameter,
});

/**
 * Brother KH-881 and compatible 24-stitch machines.
 *
 * The pattern hole is elongated along the card rather than round. That widens
 * the horizontal web — the weak axis — from 0.75 mm to 1.25 mm, but it rests on
 * an inference rather than a measurement. See ADR-0008, and BROTHER_24_CLASSIC
 * below for the geometry that has direct evidence behind it.
 */
export const BROTHER_24: CardProfile = {
  name: "Brother 24-stitch",
  cardWidth: 140,
  thickness: 0.2,
  stitchPitch: 4.5,
  rowPitch: 5,
  columns: 24,
  minRows: 36,
  overlapRows: 2,
  patternHole: { width: 3.25, height: 3.75 },
  beltHole: round(3.25),
  loopHole: round(3.75),
  beltHoleOffsetX: 57.25,
  loopHoleOffsetX: 64.5,
  holeSegments: 24,
};

/** Round pattern holes, as on a commercially cut card. */
export const BROTHER_24_CLASSIC: CardProfile = {
  ...BROTHER_24,
  name: "Brother 24-stitch (classic round holes)",
  patternHole: round(3.75),
};

/** Centre X of a stitch column, relative to the card centre. */
export function stitchCentreX(profile: CardProfile, column: number): number {
  return (column - (profile.columns - 1) / 2) * profile.stitchPitch;
}

/**
 * Where the rows sit.
 *
 * These live with the profile rather than with the mesh builder because they
 * define the card's row phase, which is part of the specification the builder
 * and the verifier are each measured against — not an implementation detail
 * either one owns.
 */

/** Centre Y of a row, relative to the card centre. Pattern and belt holes. */
export function rowCentre(
  profile: CardProfile,
  row: number,
  rows: number,
): number {
  return (row - (rows - 1) / 2) * profile.rowPitch;
}

/**
 * Y of a boundary between rows, relative to the card centre. Loop holes.
 * Boundary 0 is the card's bottom edge; boundary `rows` is its top edge.
 */
export function rowBoundary(
  profile: CardProfile,
  boundary: number,
  rows: number,
): number {
  return (boundary - rows / 2) * profile.rowPitch;
}

/**
 * Which row boundaries carry loop holes: the two in from each end.
 *
 * Perforating the edge strip along the card's whole length would weaken the
 * most fragile part of a 0.2 mm print, so these go at the ends only — see
 * ADR-0001.
 *
 * Open question for #9 (splitting): under a 2-row overlap seam, only the inner
 * hole of each pair lines up across the joint. The outer one ends up over solid
 * material from the neighbouring piece. Two per end matches the reference card
 * and mathgrrl's `loop()` module, so it stands until the seam geometry is real
 * and can settle whether the second hole earns its place.
 */
export function loopHoleBoundaries(rows: number): number[] {
  const candidates = [1, 2, rows - 2, rows - 1];
  const usable = candidates.filter(
    (boundary) => boundary >= 1 && boundary <= rows - 1,
  );
  return [...new Set(usable)].sort((a, b) => a - b);
}

/** Overall card length for a given row count, in mm. */
export function cardLength(profile: CardProfile, rows: number): number {
  return rows * profile.rowPitch;
}

/**
 * Material between two neighbouring pattern holes, in mm. The horizontal web is
 * the weak axis and the likely tear location on a 0.2 mm card.
 */
export function webThickness(profile: CardProfile): {
  horizontal: number;
  vertical: number;
} {
  return {
    horizontal: profile.stitchPitch - profile.patternHole.width,
    vertical: profile.rowPitch - profile.patternHole.height,
  };
}
