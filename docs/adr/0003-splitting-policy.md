# 3. Splitting: printer preset, auto piece count, evenly balanced rows

Status: Accepted

## Context

A card is 140 mm wide and `rows × 5 mm` long. The width fits every Bambu bed;
the length frequently does not.

| Printer | Bed | Usable length (~5 mm margin) | Max rows/piece |
| --- | --- | --- | --- |
| A1 mini | 180×180 | ~174 mm | 34 |
| A1 / P1P / P1S / X1C | 256×256 | ~250 mm | 50 |
| H2D | 350×320 | ~314 mm | 62 |

Given a piece count, rows can be distributed by filling each piece to the bed
limit, or by spreading them evenly. For a 60-row card on an X1C (61 printed rows
with one seam), max-fill gives 50 + 11 — a 250 mm piece and a 55 mm stub —
while balanced gives 31 + 30.

Piece count is `ceil()` either way, so max-fill never produces fewer pieces. The
only difference is how rows are distributed among pieces already committed to.

## Decision

The user selects a **printer preset** (or enters a custom bed size). The app
derives usable length, computes the minimum piece count, and distributes rows
**as evenly as possible**.

The user may raise the piece count manually — never lower it below the computed
minimum.

## Consequences

- No awkward stub pieces; long thin prints (the worst warping risk) are avoided.
- Changing piece count changes seam count, which changes total material — the
  preview must recompute and display this.
- Bed margin is a constant that may need tuning for printers with exclusion
  zones.
