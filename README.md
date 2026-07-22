# Knitting Machine Punchcard Generator

Draw a pattern pixel-art style and get a 3D-printable punchcard for a 24-stitch
knitting machine (Brother KH-881 and compatibles). Cards too long for the
printer bed are split into pieces that clip back together.

**Live:** https://knitting-machine-punchcard-generato.vercel.app/

## Status

Walking skeleton. The editor and card generator are not built yet — see the
[open issues](https://github.com/gsajith/knitting-machine-punchcard-generator/issues).

## Documentation

| File | Contents |
| --- | --- |
| [`SPEC.md`](./SPEC.md) | Card profile, requirements, verification strategy, build plan |
| [`CONTEXT.md`](./CONTEXT.md) | Domain vocabulary — belt vs loop holes, tile, seam, web |
| [`docs/adr/`](./docs/adr/) | Architectural decisions and their rationale |
| [`reference/`](./reference/) | Reference `.3mf` cards used as the golden test comparison |

## Development

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # Vitest
npm run typecheck  # tsc --noEmit
npm run lint       # ESLint
npm run build      # production build
```

Next.js + React + TypeScript, styled with **CSS Modules** (no Tailwind).
All punchcard geometry is generated client-side; there is no backend.

## A note on printing

The card is **one layer thick**, so several slicer defaults will quietly ruin
it — elephant-foot and XY hole compensation shrink every hole. See
[`docs/adr/0007-geometry-only-3mf-export.md`](./docs/adr/0007-geometry-only-3mf-export.md).
