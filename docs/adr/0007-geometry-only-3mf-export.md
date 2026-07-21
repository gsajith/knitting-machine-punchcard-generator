# 7. Geometry-only 3MF export, no embedded print profile

Status: Accepted

## Context

The card is **one layer thick** — the entire object *is* the first layer. That
makes several slicer defaults actively hostile:

- **Elephant-foot compensation** shrinks the first layer's outline inward. On a
  normal part that is cosmetic; here it shrinks every hole, and a ⌀3.25 belt hole
  losing 0.15 mm per side may no longer seat on a drum pin.
- **XY hole compensation / horizontal expansion** does the same, deliberately.
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
