# Leaf — Project Guidelines

## Architecture

Leaf is an Electron + Vue 3 desktop app with three processes:

- **Main** (`src/main/`) — Node.js backend. IPC handlers live in `services/`, shared constants in `lib/`, input validation in `lib/validation.ts`
- **Preload** (`src/preload/index.ts`) — Secure bridge. All renderer↔main communication uses `contextBridge.exposeInMainWorld`
- **Renderer** (`src/renderer/`) — Vue 3 SPA. Components in `components/`, reusable logic in `composables/` (grouped by domain: `ai/`, `editor/`, `drawing/`, `vault/`, `ui/`), types in `types/`, utilities in `utils/`

## Code Style

- TypeScript strict mode everywhere (`tsconfig.node.json` + `tsconfig.app.json`)
- Prettier: single quotes, 4-space indent, 120 char width, trailing commas, LF
- ESLint flat config with typescript-eslint + vue plugin + prettier integration
- Prefer `const` over `let`. Never use `var`
- Use `path.join()` / `path.resolve()` for all file paths — never string concatenation

## Security Rules (non-negotiable)

- Every IPC handler that touches the filesystem MUST call `assertInsideBoundary()` before any read/write
- User-supplied filenames MUST pass through `assertSafeFileName()` — see `src/main/lib/validation.ts`
- `contextIsolation: true` and `nodeIntegration: false` — never change these
- External URLs opened via `shell.openExternal` must be restricted to `http://` and `https://`
- Use atomic writes (write to `.tmp`, then `rename`) for any file persistence to prevent data corruption

## Component Patterns

- Large Vue components should be decomposed: orchestrator component + sub-components + composables
- Target ~300 lines max per `.vue` file — extract sub-components when it grows beyond this
- Composables go in `src/renderer/composables/{domain}/` and follow `use{Name}.ts` naming
- Sub-components go in `src/renderer/components/{parent-name}/` — e.g., `components/ai/` for AiPanel sub-components

## Testing

- Test runner: Vitest with jsdom environment
- Tests live in `tests/` mirroring `src/` structure: `src/main/lib/foo.ts` → `tests/main/foo.test.ts`
- Focus on pure functions and utilities first — they give the most value
- Use `it.each()` for parametric tests, `describe` nesting for grouping
- Run: `npm test` (one-shot) or `npm run test:watch` (dev mode)

## Build & CI Commands

```sh
npm run dev          # Start Electron with hot reload
npm test             # Run all unit tests
npm run lint         # ESLint check
npm run format:check # Prettier check
npm run build        # Type-check + production build
```

CI pipeline: lint → format:check → type-check → build → test. Releases are gated on CI passing.
