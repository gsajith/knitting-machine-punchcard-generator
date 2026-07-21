# 6. Cell-grid ring-strip triangulation, no CSG or Delaunay

Status: Accepted

## Context

The card is a flat plate perforated by up to ~1700 holes. The obvious approaches
both carry heavy dependencies:

- **CSG / boolean subtraction** of hole cylinders from a slab — needs a robust
  boolean library, is slow, and is a classic source of non-manifold output.
- **Constrained Delaunay triangulation** of a plane with holes — needs a CDT
  library and careful handling of near-touching constraints, which is exactly
  our situation at 0.75–1.25 mm webs.

But the card has structure worth exploiting: it is a perfectly regular lattice.

## Decision

Build the card as a **grid of 4.5 × 5.0 mm cells**. Each cell is a rectangle
with an optional inscribed n-gon hole.

- A rectangle with a centred hole triangulates as a **ring strip** between the
  outer rectangle loop and the inner polygon loop. No CDT, no booleans.
- A cell with no hole is two triangles.
- Adjacent cells **share edge vertices**, so the surface is continuous.
- Top and bottom faces plus hole side walls close the solid.

The result is watertight by construction. Edge margin strips and the belt/loop
hole columns are generated the same way.

## Consequences

- Zero geometry dependencies; the generator is pure arithmetic over a lattice.
- Uniform, predictable mesh density — roughly comparable to the 77k triangles in
  the reference card.
- Correctness is verifiable: every undirected edge must be shared by exactly two
  triangles. This is asserted in tests, along with a re-parse oracle that reads
  our own output back and checks every hole centre against the nominal lattice.
- Non-lattice features (arbitrary cut-outs, text, logos) do not fit this scheme.
  None are planned; adding one would require revisiting this decision.
