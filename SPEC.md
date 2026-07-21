# Specification — Knitting Machine Punchcard Generator

A web app that generates 3D-printable punchcards for 24-stitch knitting machines
from patterns drawn pixel-art style in the browser. Cards too long for the
printer bed are split into pieces that clip back together.

Domain vocabulary: `CONTEXT.md`. Decisions and rationale: `docs/adr/`.

---

## 1. Card profile

```
CARD PROFILE — Brother 24-stitch (KH-881 and compatibles)

  width          140 mm            thickness    0.2 mm (single layer)
  stitch pitch   4.5 mm            row pitch    5.0 mm        columns  24
  height         (N + 2·seams) × 5 mm           min rows       36 (adjustable)

  pattern hole   3.25 w × 3.75 h   x = ±2.25 … ±51.75, row centres   [default]
                 ⌀3.75 round       "Classic" preset
  belt hole      ⌀3.25 round       x = ±57.25, every row centre      [drive — exact]
  loop hole      ⌀3.75 round       x = ±64.5, row boundaries, piece ends only

  seams          2 overlap rows, duplicating adjacent pattern rows
                 total material = N + 2 × (number of seams)
```

Constants live in one `CardProfile` object and nowhere else. Provenance and the
reasoning behind each value: ADR-0001, ADR-0008.

Coordinates: origin at card centre, X across width, Y along length (feed
direction). All units millimetres.

## 2. Functional requirements

### Editing

- Tile-first: the user edits a *w* × *h* motif; the 24 × N card is derived by
  tiling (ADR-0004).
- Tile width restricted to divisors of 24: 1, 2, 3, 4, 6, 8, 12, 24.
- Card row count snaps to a multiple of tile height.
- One-way **flatten** to a directly editable full card.
- Tools: drag-paint, erase, undo/redo, fill, clear, invert, mirror, shift,
  resize-preserving-content.
- Draw in **as-knitted** orientation, with explicit horizontal-mirror and
  vertical-flip toggles defaulting to identity.

### Length

- Vertical-repeat stepper, initialised to the smallest count meeting `min rows`.
- Going below the minimum is allowed but shows a persistent warning — not a hard
  block.
- Live readout: rows, millimetres, piece count.

### Splitting

- Printer preset (A1 mini, A1, P1P, P1S, X1C, H2D) or custom bed size.
- Auto-compute minimum piece count; distribute rows **evenly** (ADR-0003).
- User may raise the piece count, never lower it below the computed minimum.
- Seams cost 2 overlap rows each, handled silently; seam positions shown in the
  preview.

### Preview

- Full-card 2D view: tiled pattern, belt holes, loop holes, seam lines, piece
  boundaries, feed-direction arrow, row 1 label.
- No 3D view and no knitted-fabric simulation in v1.

### Export

- **3MF primary**: one file, one named piece per plate.
- **STL fallback**: single file, or zip when split.
- Geometry only — no embedded print profile (ADR-0007).
- In-app "Printing this card" panel: elephant-foot and XY compensation must be
  off, material recommendations, extrusion line direction along the card length,
  first-print checks.

### Persistence

- Autosave to `localStorage`; named local pattern list.
- Share via URL-fragment encoding (a full card is ~144 bytes).
- Import/export `.json`.
- No backend in v1; format and routing shaped to allow accounts and a gallery
  later (ADR-0005).

## 3. Technical approach

- Next.js + React + TypeScript. **CSS Modules, no Tailwind.** Vercel.
- All geometry client-side (ADR-0005).
- Mesh built as a grid of 4.5 × 5.0 mm cells, each a rectangle with an optional
  inscribed n-gon hole, triangulated as a ring strip. Adjacent cells share edge
  vertices, so the mesh is watertight by construction. No CSG, no Delaunay,
  no geometry dependencies (ADR-0006).
- Versioned pattern encoding — shared links are a compatibility surface.

## 4. Verification

Vitest, covering:

- **Watertightness**: every undirected edge shared by exactly two triangles.
- **Re-parse oracle**: parse generated meshes back into hole centres and
  diameters; assert every centre lands on the nominal lattice, counts are
  correct, and diameters match the profile. Golden comparison against the
  reference card in `reference/`.
- **Split arithmetic**: rows sum to `N + 2 × seams`; no piece exceeds the bed;
  overlap rows on adjacent pieces are byte-identical.
- **Pattern encoding**: URL and JSON round-trip.

UI is manually tested in v1.

## 5. Open questions

All resolve from a single test print, and all are constants in one profile file.

1. **Pin clearance** — does the reading mechanism accept a 3.25 mm horizontal
   hole? The default rests on an inference from belt-hole size (ADR-0008). If
   not, switch the default to Classic ⌀3.75 round.
2. **Web survival** — do 1.25 mm webs at 0.2 mm thickness survive handling and
   repeated feeding? Informs whether material guidance is sufficient.
3. **Belt-hole seating** — do the drum pins seat cleanly in ⌀3.25?
4. **Minimum row count** — 36 is a working figure, unverified.
5. **Overlap depth** — 2 rows is supported by two artifacts; counting the
   overlap rows on a genuine Brother blank would confirm it properly.

## 6. Build plan

Work is broken into **vertical slices** — each one cuts through every layer and
is independently verifiable, rather than completing one horizontal layer at a
time.

The geometry risk is still front-loaded: slice 2 produces a real printable file
end-to-end, and slice 3 verifies our own mesh against the reference card before
any editor work begins. What is deliberately avoided is building a headless
library that nobody can see or demo.

| # | Slice | Type | Blocked by |
| --- | --- | --- | --- |
| 1 | Walking skeleton: Next.js + TS + CSS Modules + Vitest, deployed | HITL | — |
| 2 | Tracer bullet: hardcoded pattern → downloadable 3MF | AFK | 1 |
| 3 | Re-parse oracle: verify our mesh against the reference card's lattice | AFK | 2 |
| 4 | Complete card geometry: belt holes, loop holes, margins, height formula | AFK | 3 |
| 5 | Tile model: tiling to 24×N, flatten, versioned encoding | AFK | 2 |
| 6 | Editor: draw a tile, download the card it produces | AFK | 4, 5 |
| 7 | Full-card preview + orientation toggles | AFK | 6 |
| 8 | Length control: repeat stepper, min-rows warning | AFK | 7 |
| 9 | Splitting engine (headless): bed presets, balanced rows, overlap rows | AFK | 4 |
| 10 | Split UI + multi-plate 3MF + STL fallback export | AFK | 7, 9 |
| 11 | "Printing this card" guide panel | AFK | 10 |
| 12 | Hole geometry presets (elongated / Classic) + Advanced panel | AFK | 4 |
| 13 | Persistence: localStorage, URL sharing, JSON import/export | AFK | 5, 6 |
| 14 | Test print: resolve the five open questions in §5 | HITL | 10 |
| 15 | Polish: accessibility, responsive layout, visual design pass | HITL | 13 |

Slice 14 is the only thing that can falsify ADR-0008's pin-clearance inference.
It gates whether the default hole geometry is correct.
