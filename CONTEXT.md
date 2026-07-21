# Context: Knitting Machine Punchcard Generator

Generates 3D-printable punchcards for 24-stitch knitting machines (Brother
KH-881 and compatibles) from patterns drawn in the browser.

## Conventions

All dimensions in millimetres. Card coordinates have their origin at the card
centre: X across the width, Y along the length (the feed direction).

## Glossary

**Card** — one punchcard. Always forms a closed loop in use; the ends are
clipped together. 140 mm wide, 0.2 mm thick (a single printed layer).

**Card profile** — the set of physical constants for a machine family (pitches,
hole sizes and shapes, widths, margins). One profile object; the only place
physical constants live.

**Stitch / column** — one of the 24 pattern columns, 4.5 mm apart.

**Row** — one knitted row, 5.0 mm of card length. Minimum 36 rows for the card
to wrap the drum.

**Pattern hole** — a punched stitch; what the user draws. Default 3.25 wide ×
3.75 tall, on row centres. The "Classic" profile uses ⌀3.75 round.

**Belt hole** — ⌀3.25 round, at x = ±57.25, on every row centre. The drum's
drive pins seat in these. Load-bearing: must be dimensionally exact.

**Loop hole** — ⌀3.75 round, at x = ±64.5, on row boundaries, at piece ends
only. Clips pass through these to join pieces. Has dimensional slack.

**Web** — the material between two adjacent holes. The horizontal web (between
side-by-side stitches) is the weak axis and the likely failure mode.

**Tile / motif** — the unit the user actually edits. Width must divide 24; card
row count must be a multiple of tile height so the loop doesn't jog.

**Flatten** — one-way conversion from tile to a directly editable full card,
giving up the seamless-repeat guarantee.

**Seam** — where two pieces join. Costs 2 overlap rows, contributed by one side.
Loop closure is a seam like any other.

**Overlap rows** — the 2 rows duplicated across a seam. Two stacked layers read
as a logical AND, so identical copies make the seam invisible.

**Piece** — one printable segment. Total material = N + 2 × (number of seams).

**As-knitted orientation** — the editor shows the fabric, not the card. The card
view shows real punch layout, feed direction and row 1.

## Terms to avoid

- "Pixel" — say **stitch** (across) and **row** (along).
- "Sprocket hole" — ambiguous between belt and loop holes, which have different
  jobs and different tolerances. Always name which one.
- "Hole" unqualified in geometry code — say pattern / belt / loop hole.
