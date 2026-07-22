# 1. Card profile constants and their provenance

Status: Accepted

## Context

The app generates a physical part that must fit a specific machine. Wrong pitch
or hole placement produces a card that jams, mis-feeds or under-reads, and the
failure is only discovered after printing.

Two independent sources were available:

1. **mathgrrl's OpenSCAD punchcard generator** (Brother KH-881), which states
   its constants directly: `p=3.75` punch diameter, `h=4.5` horizontal pitch,
   `v=5` vertical pitch, `b=16` horizontal border, `c=11` vertical border,
   `cols=24`.
2. **A reference `.3mf`** supplied by the user, analysed by parsing the mesh and
   recovering hole centres by boundary-loop extraction.

They agree on everything load-bearing. Pattern columns land at ±2.25 … ±51.75 in
both. Pitches are 4.5 and 5.0 in both. Belt holes are ⌀3.25 in both (±57.25 vs
±57.5 measured); loop holes ⌀3.75 (±64.5 vs ±64.25 measured). The reference's
hole outlines are hand-drawn and noisy, but every centre snaps to the same
lattice.

They disagree on card width: 140 mm (mathgrrl) vs 142.401 mm (reference). This
affects only the outer margin — belt and loop holes are unchanged either way.

## Decision

Adopt the following profile, with **140 mm** width:

```
width          140 mm            thickness    0.2 mm (single layer)
stitch pitch   4.5 mm            row pitch    5.0 mm         columns  24
min rows       36
pattern hole   3.25 w × 3.75 h   x = ±2.25 … ±51.75, row centres   [see ADR-0008]
belt hole      ⌀3.25 round       x = ±57.25, every row centre      [drive — exact]
loop hole      ⌀3.75 round       x = ±64.5, every interior row boundary
```

All constants live in a single `CardProfile` object. No physical dimension is
written anywhere else in the codebase.

140 mm was chosen because it is the width actually targeted at a KH-881, and a
slightly narrow card cannot jam where an over-wide one can.

Loop holes go on **every interior row boundary**, matching the reference card:
51 holes per side at a uniform 5.000 mm spacing, spanning ±125.0 on a 52-row
card, which is precisely its 51 interior boundaries.

This reverses an earlier decision. The first version of this ADR placed loop
holes at the piece ends only, reasoning that on a 0.2 mm single-layer card the
edge strip is the most fragile part of the object and perforating it every 5 mm
invites a tear. That reasoning was sound but irrelevant: the repo owner reported
that the resulting holes were too close together for their punchcard clips, and
that the reference card's spacing fits them. Real Brother cards also carry the
column along the full length.

Physical fit beats a theoretical fragility argument. The fragility concern is
not dismissed — it becomes a question about material and thickness, to be
answered by the test print in #14, rather than a reason to omit holes the
hardware needs.

## Consequences

- Changing machine support means adding a profile, not editing geometry code.
- `min rows = 36` is a working figure, not a verified one. It is a profile
  constant precisely so it can be corrected without touching logic.
- Unverified values are flagged in `SPEC.md` under "Open questions". They all
  resolve from a single test print.
- A clip can be fitted at any row boundary, so a split seam does not have to
  land where a loop hole happens to be. That removes a constraint #9 would
  otherwise have had to work around.
