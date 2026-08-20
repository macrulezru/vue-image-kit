# Contributing

Thanks for considering a contribution to `vue-image-kit`.

## Setup

```bash
npm install
```

Requires Node.js >= 18.

## Project layout

- `src/` — library source (component, composables, directive, CLI, CDN adapters, Nuxt module, Vite plugin).
- `test/` — Vitest unit/component tests (jsdom), mirroring `src/`'s structure.
- `e2e/` — Playwright browser tests, run against the `demo` app.
- `demo/` — a Vite app aliased straight to `src/`, exercising every feature; also the target for e2e tests.
- `demo-nuxt/` — a separate, minimal Nuxt 3 app (same "alias straight to `src/`" trick, via `nuxt.config.ts`), for Nuxt-specific behavior the Vite demo can't exercise: module registration, `breakpoints`, auto-imported composables, `onDemandServer`'s real Nitro route, SSR-rendered `<VImage>`. Not part of the e2e/CI loop — run it manually when touching `src/nuxt/**`.
- `scripts/` — build helper scripts.

## Scripts

| Command | Purpose |
|---|---|
| `npm run test` | Run the Vitest unit/component suite once. |
| `npm run test:watch` | Run Vitest in watch mode. |
| `npm run test:coverage` | Run Vitest with coverage. |
| `npm run test:e2e` | Run Playwright e2e tests against the demo app. |
| `npm run typecheck` | Type-check the library and CLI project. |
| `npm run lint` | ESLint with `--fix`. |
| `npm run format` | Prettier over `src/`. |
| `npm run lint:style` | Stylelint over `.vue`/`.css`/`.scss` in `src/`. |
| `npm run build` | Build all distributable targets (main, cdn, nuxt, cli, vite plugin, server). |
| `npm run check:size` | Fail if a shipped browser bundle's gzip size exceeds its budget (`scripts/check-bundle-size.cjs`). Run after `build`. |
| `npm run demo` | Install and run the demo app (`demo:dev` if already installed). |
| `npm run demo:nuxt` | Install and run the Nuxt demo app (`demo:nuxt:dev` if already installed). Touch `src/nuxt/**`? Run this and check by hand — it's not covered by CI. |
| `npm run demo:nuxt:build` | Production build of the Nuxt demo (`.output/`) — the closest thing to a real deploy check for `src/nuxt/**`. |

Before opening a PR, make sure these all pass locally — CI runs the same checks
(`lint`, `typecheck`, `test`, `build`, `check:size`) on Node 18/20/22, plus
`test:e2e` on the built demo:

```bash
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
npm run check:size
```

If `check:size` fails on an intentional size increase, raise the relevant
limit in `scripts/check-bundle-size.cjs` and update the numbers in the
"Bundle size & peer dependencies" section of `README.md` in the same PR.

## Making changes

- Keep changes scoped — prefer several small PRs over one large one.
- Add or update tests for any behavioral change. Unit tests live in `test/`
  next to the module they cover; browser-only behavior (IntersectionObserver,
  real `<picture>` format selection, canvas decoding) belongs in `e2e/`.
- If you touch a feature documented in `README.md`, update the relevant
  section in the same PR.
- Follow the existing code style — `eslint` and `prettier` are enforced in CI
  and will fail the build on violations.
- Record user-facing changes under `[Unreleased]` in `CHANGELOG.md`.

## Commit messages

No strict convention is enforced, but a short imperative summary
(`Fix retry backoff timing`, `Add Gumlet CDN adapter`) is preferred over
generic messages like `update` or `fix`.

## Reporting bugs / requesting features

Open an issue at https://github.com/macrulezru/vue-image-kit/issues with a
minimal reproduction (a link to a StackBlitz/CodeSandbox or a small repo is
ideal for bugs).

## License

By contributing, you agree that your contributions will be licensed under the
project's [MIT license](LICENSE).
