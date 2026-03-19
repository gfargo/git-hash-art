# Tech Stack

- Language: TypeScript (strict mode, ES2020 target)
- Runtime: Node.js and browsers
- Canvas (Node): `@napi-rs/canvas` (optional peer dependency)
- Canvas (Browser): native Canvas 2D API / OffscreenCanvas
- Color generation: `color-scheme` (declared in `global.d.ts` since it lacks types)
- Bundler: Parcel (outputs CJS `dist/main.js`, ESM `dist/module.js`, browser `dist/browser.js`, types `dist/types.d.ts`)
- Test framework: Vitest
- Formatter: Prettier
- Release: release-it
- Package manager: Yarn

## Common Commands

| Command | Purpose |
|---|---|
| `yarn build` | Production build (clears `.parcel-cache` first via `prebuild`) |
| `yarn watch` | Dev build with file watching |
| `npx vitest --run` | Run tests once |
| `yarn format` | Format source files with Prettier |
| `yarn format:check` | Check formatting without writing |
| `yarn build:examples` | Generate example images via `bin/generateExamples.js` |
| `yarn test:publish` | Dry-run npm publish |
