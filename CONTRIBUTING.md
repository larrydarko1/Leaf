# Contributing to Leaf

Thank you for considering contributing to Leaf! This is a desktop note-taking application built with Electron and Vue 3.

## Development Setup

1. **Fork the repository**
2. **Clone your fork**
   ```sh
   git clone https://github.com/larrydarko1/leaf.git
   cd leaf
   ```
3. **Install dependencies**
   ```sh
   npm install
   ```
4. **Start the development environment**
   ```sh
   npm run dev
   ```

This will launch the Electron app with hot reload enabled.

## Project Structure

See the [README](README.md#project-structure) for the full project structure tree.

Key conventions:
- **Main process** (`src/main/`) — Electron backend. Business logic lives in `services/`, shared constants in `lib/`
- **Preload** (`src/preload/`) — Secure IPC bridge. All renderer↔main communication goes through here
- **Renderer** (`src/renderer/`) — Vue 3 frontend. Components in `components/`, reusable logic in `composables/` (grouped by domain: `ai/`, `editor/`, `drawing/`, `vault/`, `ui/`)
- **Tests** (`tests/`) — Mirrors the `src/` structure (`tests/main/`, `tests/renderer/`)

## How to Contribute

### Bug Fixes & Features
1. Create a new branch for your feature or bugfix
   ```sh
   git checkout -b feature/your-feature-name
   ```
2. Make your changes with clear commit messages
3. Run the checks below before opening a PR
4. Open a pull request describing your changes

### Before Submitting a PR

Run these commands and make sure they all pass — CI will run the same checks:

```sh
# Type-check (must pass with zero errors)
npx vue-tsc -b --noEmit

# Unit tests
npm test

# Lint
npm run lint

# Formatting
npm run format:check
```

If lint or formatting fails, auto-fix with:
```sh
npm run lint:fix
npm run format
```

### Writing Tests

Tests use [Vitest](https://vitest.dev) and live in `tests/`, mirroring the `src/` folder structure:

```
tests/
├── main/           # Tests for src/main/ code
└── renderer/       # Tests for src/renderer/ code
```

- Place test files next to what they test: `src/main/lib/paths.ts` → `tests/main/paths.test.ts`
- Use `.test.ts` file extension
- Run `npm run test:watch` during development for instant re-runs on save
- Focus on **pure functions and utilities** — they're the easiest to test and give the most value. Composables with Vue refs are also testable (see `useMarkdownToolbar.test.ts` for an example)

## Code Style

This project uses **ESLint** (flat config) + **Prettier** for consistent formatting:

- **Prettier config** (`.prettierrc`): Single quotes, 4-space indent, 120 char line width, trailing commas, LF line endings
- **ESLint config** (`eslint.config.js`): TypeScript-aware rules + Vue plugin + Prettier integration
- Follow existing patterns in the codebase — look at similar files before writing new code
- Keep components small and focused — extract sub-components and composables when a file grows beyond ~300 lines
- Write clear, descriptive comments only where the logic isn't self-evident

## Reporting Issues
- Use GitHub Issues for bugs and feature requests
- Provide steps to reproduce bugs if possible
- Include your OS version and Electron app version
- Screenshots are helpful!

## Code of Conduct
Please read our [Code of Conduct](CODE_OF_CONDUCT.md).

## Questions?
Feel free to open a discussion or issue if you need help!
