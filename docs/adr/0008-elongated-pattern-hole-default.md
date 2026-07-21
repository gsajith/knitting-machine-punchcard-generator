# 8. Elongated 3.25 × 3.75 pattern hole as the default

Status: Accepted — **provisional, rests on an unverified inference**

## Context

At the nominal ⌀3.75 round pattern hole, the material between holes is:

- **0.75 mm horizontally** (between side-by-side stitches, 4.5 mm pitch)
- **1.25 mm vertically** (between stacked rows, 5.0 mm pitch)

The card is 0.2 mm thick, so the horizontal web is roughly 1.7 extrusion widths
of a single layer. It is the weak axis and the likely tear location on a card
with many adjacent punched stitches. The vertical web is not a problem.

Options considered, in order of payoff per unit of risk:

| Option | Effect | Risk |
| --- | --- | --- |
| Material (PETG/PCTG/nylon over PLA) | Large | None — no geometry change |
| Extrusion line direction along card length | Web becomes a continuous strand | None — slicer setting |
| Elongated hole 3.25 w × 3.75 h | Webs 1.25 mm on **both** axes | Needs ≥3.25 mm pin clearance |
| Shrink to ⌀3.5 or ⌀3.25 | 1.0 / 1.25 mm webs | Loses clearance on both axes |
| Thicken the card | — | Rejected: 0.2 mm stiffness confirmed correct |

The first two are free and are applied regardless, via the printing guide.

The inference supporting elongation: **belt holes are ⌀3.25 and the drum's drive
pins seat in them.** If the machine's pins pass a 3.25 mm hole, a pattern hole
very likely does not need to be wider. This is reasoning from an adjacent
feature, not a measurement of the reading mechanism.

## Decision

Default pattern hole is **3.25 wide × 3.75 tall** (elongated along the card).

The round **⌀3.75 "Classic"** geometry is retained as a selectable preset — it is
the only shape with direct evidence behind it.

Belt holes stay ⌀3.25 round and loop holes stay ⌀3.75 round. Only pattern holes
change shape; they are the only holes with a web problem and the only ones whose
counterpart is not load-bearing against the drum.

## Consequences

- Webs become 1.25 mm on both axes — a ~65% improvement on the weak axis at
  essentially unchanged open area.
- **This makes an inference the shipped behaviour.** If the reading mechanism
  needs more than 3.25 mm of horizontal clearance, every card generated at the
  default will under-read.
- The downside is bounded: reverting is a one-line profile change plus a reprint,
  and the Classic preset is already present.
- **How to falsify:** print one card of each geometry and run both on the
  machine. If Classic reads correctly and the default does not, swap the default
  and update this ADR to Superseded.
