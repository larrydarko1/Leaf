---
description: "Use when creating or editing Vue single-file components (.vue files). Covers component decomposition, composable patterns, and template conventions."
applyTo: "**/*.vue"
---
# Vue Component Guidelines

## Structure

Follow `<script setup lang="ts">` → `<template>` → `<style scoped lang="scss">` order.

## Decomposition

When a component exceeds ~300 lines, split it:
- **Orchestrator** — the parent `.vue` file that wires sub-components and composables together
- **Sub-components** — focused UI pieces in `components/{parent-name}/` (e.g., `components/ai/AiModelBar.vue`)
- **Composables** — reusable reactive logic in `composables/{domain}/use{Name}.ts`

Examples of this pattern in the codebase:
- `AiPanel.vue` orchestrates 5 sub-components in `components/ai/` and 5 composables in `composables/ai/`
- `NoteEditor.vue` uses 4 viewer sub-components in `components/editor/` and composables from `composables/editor/`
- `useMarkdownEditor.ts` is a thin orchestrator composable that composes `useMarkdownRender`, `useMarkdownToolbar`, and `useMarkdownPreview`

## Composables

- One concern per composable — don't mix unrelated state
- Accept dependencies as parameters (refs, callbacks) rather than importing globals
- Return an object with named exports: `return { state, actions }`
- Place in `composables/{domain}/` with `use{Name}.ts` naming

## Templates

- Use `v-if` / `v-else-if` / `v-else` chains, not nested ternaries
- Emit events for parent communication — never mutate props directly
- Use scoped styles to avoid leaking
