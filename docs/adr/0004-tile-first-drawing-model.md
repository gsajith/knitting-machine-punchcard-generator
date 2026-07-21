# 4. Tile-first drawing model with a one-way flatten

Status: Accepted

## Context

The card width is fixed at 24 stitches. A motif of width *w* only tiles cleanly
if *w* divides 24 — so w ∈ {1, 2, 3, 4, 6, 8, 12, 24}. Knitters already think
this way.

The card is a loop. If the row count is not a multiple of the motif height, the
pattern jogs at the closure seam — a permanent, visible defect repeating forever
in the fabric.

So "replicate across the width and height" is not a one-shot button. It is a
constraint system, which argues for the motif being the real document and the
card being derived from it.

## Decision

The **tile is the document**. The user edits a *w* × *h* motif. The full 24 × N
card is derived by tiling.

- Tile width is restricted to divisors of 24.
- Card row count snaps to a multiple of tile height.
- The full-card view is a live derived preview, not an editing surface.

A one-way **flatten** converts the tile into a directly editable full card for
asymmetric designs, border rows, and one-off tweaks. Flattening gives up the
seamless-repeat guarantee, and this is stated in the UI at the moment it happens.

## Consequences

- Seamless loops are correct by construction, not by user discipline.
- Flatten is one-way; there is no inference back from a card to a tile. This is
  deliberate — the inverse is ambiguous.
- Resizing a tile must preserve existing content rather than clearing it.
