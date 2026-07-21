# 5. Client-side geometry generation, no backend in v1

Status: Accepted

## Context

The only two things that could require a server are mesh generation and
persistence.

Mesh generation is a few hundred thousand triangles of pure arithmetic — trivial
for JavaScript, and round-tripping meshes to a server would add latency and cost
for no benefit.

Persistence data is tiny. A 24 × 48 full card is 1152 bits = **144 bytes**; a
motif tile is usually under 20 bytes. That fits comfortably in a URL fragment,
so sharing needs no database and no shortener.

A gallery with accounts is desirable eventually, but it is a second product with
moderation, spam, cost and maintenance attached, and it cannot be undone once
users store data in it.

## Decision

All geometry is generated **in the browser**. No API route, no upload. Vercel
serves static assets.

Persistence in v1:

- autosave to `localStorage`, with a named local pattern list
- sharing via URL-fragment encoding
- import/export as a `.json` file

The pattern format and routing are shaped so that accounts and a public gallery
can be added later without a rewrite.

## Consequences

- Zero running cost, no cold starts, works offline after first load.
- Designs never leave the user's machine, which is a real privacy property worth
  stating in the UI.
- No cross-device sync and no discovery of others' patterns until a backend
  arrives. Accepted for v1.
- The pattern encoding is a compatibility surface from day one: changing it
  breaks previously shared links. Version the format.
