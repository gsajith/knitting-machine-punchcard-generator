# 7. Geometry-only 3MF export, no embedded print profile

Status: Accepted

## Context

The card is **one layer thick** — the entire object *is* the first layer. That
makes several slicer defaults actively hostile:

- **Elephant-foot compensation** pulls the first layer's *solid* outline inward
  to cancel squish. On a normal part that only trims the bottom edge. Here the
  whole card is that layer, so it removes material everywhere: holes grow and
  the webs between them thin. At a typical 0.15 mm setting the 1.25 mm web
  between neighbouring stitches drops to about 0.95 mm — the axis most likely to
  tear — and belt holes go loose on the drum pins.

  (An earlier version of this ADR had the mechanism backwards, claiming the
  holes shrank. The conclusion — turn it off — was unaffected, but the reason
  is the part that transfers between slicers, so it is worth being right.)
- **XY size / hole compensation** adjusts hole and perimeter sizes deliberately.
  Slicers name it differently and do not all apply it in the same direction, so
  a positive value cannot be assumed safe. It should be zero.
- First-layer squish, flow and plate texture land directly on finished
  dimensions rather than on a sacrificial bottom.
- Material choice dominates: PLA at 0.2 mm is brittle in the weak-web direction;
  PETG, PCTG and nylon are far more tear-resistant at identical geometry.
- Extrusion line direction matters: lines run along the card's length so each web
  is a continuous strand rather than a bonded seam between strands.

Bambu 3MFs can carry a full `project_settings.config`, so shipping a known-good
profile is technically possible.

## Decision

Export **3MF as primary**: one file, one named piece per plate, mirroring the
structure of the reference file. **STL as fallback** (single file, or a zip when
split) for other slicers.

Exports contain **geometry only**. No embedded print profile.

Print guidance lives in an in-app **"Printing this card"** panel covering the
compensation settings, material recommendations, line direction, and what to
check on a first print.

## Consequences

- A profile is bound to a specific printer, nozzle and filament; handing an X1C
  profile to an A1 mini user produces confusing warnings or a silently bad print,
  and it goes stale with every Bambu Studio release. Avoided.
- Guidance stays useful to someone on a Prusa, an Elegoo, or any other slicer.
- The user must apply settings themselves. The panel must therefore be genuinely
  good, not a footnote — it carries load that the file format is not carrying.
- 3MF declares millimetres explicitly; STL does not. STL users inherit whatever
  their slicer assumes.
