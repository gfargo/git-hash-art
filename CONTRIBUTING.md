# Contributing to git-hash-art

Thanks for your interest in contributing! This document covers the basics of getting set up and what to know before opening a PR.

## Setup

```bash
git clone https://github.com/gfargo/git-hash-art.git
cd git-hash-art
yarn install
yarn build
```

Node 18+ is required (see `.nvmrc`).

## Development workflow

```bash
yarn build            # Parcel build → dist/
yarn test             # Vitest suite (determinism, rendering, performance)
yarn build:examples   # Regenerate example images from PRESETS
yarn format           # Prettier
```

## The one rule: determinism

The entire library rests on one invariant — **the same hash must produce byte-identical output, forever within a release**. Everything else is negotiable.

Practical implications when touching rendering code:

- Never use `Math.random()`, `Date.now()`, or any other non-seeded source in the render path. Use the `rng` stream passed through the pipeline (or `createRng(seedFromHash(hash, salt))` for an independent stream).
- The determinism tests (`src/__tests__/generation.test.ts`) verify same-hash-same-bytes. Run them before pushing.
- It's fine for a change to alter *what* a hash renders (that's a visual change, noted in the changelog). It's not fine for two runs of the same build to differ.

## Visual changes

If your change affects rendered output, include before/after images in the PR for a few hashes so the visual impact can be reviewed. The pipeline is documented in [ALGORITHM.md](ALGORITHM.md) — please keep it up to date when you add or change a rendering stage.

## Performance

Rendering budgets are enforced by `src/__tests__/performance.test.ts`. Archetypes intentionally vary widely in workload, but the absolute worst case at 1024×1024 should stay under a few seconds. If you add an expensive render style or shape, register a cost in `RENDER_STYLE_COST` so the complexity budget can throttle it.

## Reporting bugs

Open an issue with the hash, config, library version, and environment (Node/browser). Because output is deterministic, a hash alone usually reproduces the problem exactly.
