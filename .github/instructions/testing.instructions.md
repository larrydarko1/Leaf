---
description: "Use when writing, editing, or debugging unit tests. Covers Vitest patterns, test file organization, and mocking conventions."
applyTo: "tests/**"
---
# Testing Guidelines

## Structure

Tests mirror `src/`:
- `src/main/lib/validation.ts` → `tests/main/validation.test.ts`
- `src/renderer/utils/audio.ts` → `tests/renderer/audio.test.ts`
- `src/renderer/composables/editor/useMarkdownToolbar.ts` → `tests/renderer/useMarkdownToolbar.test.ts`

## Patterns

- Use `describe` blocks for grouping, `it` for individual assertions
- Use `it.each()` for parametric tests (e.g., testing every extension in an array)
- Use `beforeEach` to reset shared state — never let tests depend on each other
- Test both happy paths AND edge cases (empty input, boundary values, invalid types)

## What to Test

Priority order (highest value first):
1. **Security functions** — `assertInsideBoundary`, `assertSafeFileName` (test path traversal, prefix attacks)
2. **Pure utility functions** — No dependencies, easy to test, unlikely to break
3. **Composables with pure logic** — Set up Vue refs + mock DOM elements, test through the composable API
4. **IPC service handlers** — Mock `fs`, `electron` APIs

## Mocking

- Use `vi.mock('fs', ...)` for filesystem-dependent code
- For Vue composables, create real refs and DOM elements (jsdom) rather than mocking Vue internals
- For `process.resourcesPath` and similar globals, assign directly in tests and restore in `afterEach`

## Running

```sh
npm test          # One-shot run
npm run test:watch # Re-runs on file changes (use during development)
```
