# Knitting Machine Punchcard Generator

A web app that generates 3D-printable punchcards for 24-stitch knitting machines
(Brother KH-881 and compatibles) from patterns drawn in the browser.

Next.js + React + TypeScript, CSS Modules (**no Tailwind**), deployed on Vercel.
All geometry is generated client-side; there is no backend.

See `SPEC.md` for the full specification and `CONTEXT.md` for domain vocabulary.

## Agent skills

### Issue tracker

Issues live as GitHub issues in `gsajith/knitting-machine-punchcard-generator`,
managed via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical vocabulary, unmapped: `needs-triage`, `needs-info`, `ready-for-agent`,
`ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the repo root.
See `docs/agents/domain.md`.
