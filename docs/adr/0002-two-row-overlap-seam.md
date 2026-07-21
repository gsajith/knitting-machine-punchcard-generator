# 2. Two-row overlap seam with duplicated pattern rows

Status: Accepted

## Context

A punchcard is used as a closed loop, so every card has at least one seam where
its ends are clipped together. Cards longer than the printer bed need additional
seams.

Nobody splits punchcards today — a card cut from a sheet is made in one piece —
so there is **no existing convention for a split seam**. The only convention
that exists governs loop closure.

Evidence for the loop-closure geometry: mathgrrl's `overlap()` module emits two
extra hole-rows at each end of the card, and the reference `.3mf` carries 52
hole-rows decomposing as 48 pattern rows + 2 + 2. Two independent artifacts
agreeing on two rows.

The critical physical fact: **two stacked layers only pass a pin where both
layers have a hole. An overlap reads as a logical AND.** mathgrrl punches all 24
columns in the overlap rows, which yields AND(all, all) = all-punched — two rows
of "every needle selected" at the seam. That is almost certainly because she is
faithfully reproducing a commercial blank, which ships with those rows
pre-punched and no way to alter them.

We generate the entire card, so we are not bound by that constraint.

## Decision

Every seam is a **2-row overlap**, contributed by one side of the seam, fastened
with clips through the loop holes at the row boundaries.

The overlap rows **duplicate the adjacent pattern rows** on both layers. Since
AND(pattern, pattern) = pattern, the seam is invisible in the knitting.

Loop closure and split seams use the same construction. There is one mechanism,
used (number of splits + 1) times.

Total material = `N + 2 × (number of seams)`, where N is the pattern row count.

Overlap depth is a profile parameter defaulting to 2. It is not exposed in the
main UI — the user chooses a piece count and the app handles overlap silently,
showing seam positions in the preview.

## Consequences

- A split costs 10 mm of extra material per seam. Negligible.
- Overlap rows on adjacent pieces must be byte-identical; this is a test
  invariant, not a hope.
- Registration matters: the clips and loop holes must align the two layers
  accurately, or the AND partially occludes the pattern. The loop holes enforce
  this mechanically.
- If a real Brother blank turns out to use a different overlap depth, changing
  the parameter is a one-line edit.
