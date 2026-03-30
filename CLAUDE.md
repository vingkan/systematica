# Systematica

A two-player asymmetric card game about building and breaking software systems.

## Design System
Always read DESIGN.md before making any visual or UI decisions.
All font choices, colors, spacing, and aesthetic direction are defined there.
Do not deviate without explicit user approval.
In QA mode, flag any code that doesn't match DESIGN.md.

## Key Design Principles
- Blueprint aesthetic: dark indigo background with graph-paper grid
- Schematic-style cards with corner registration marks, no illustrations
- Three fonts: Satoshi (display), DM Sans (body), JetBrains Mono (stats)
- Cards are color-coded by type: blue=network, green=compute, bronze=storage, gold=application, red=request, violet=effect

## Build & Test
- Tech stack: Vite + React + TypeScript, deployed to GitHub Pages
- **Before completing any task, run `npm run build` and `npm test` to verify zero errors.** This is a GitHub Pages static site — a broken build means a broken deploy.
- `npm run build` runs `tsc -b && vite build` — TypeScript must compile with zero errors (including unused variables/imports)
- `npm test` runs `vitest run` — all tests must pass
- Game engine is in `src/engine/` as pure functions with no React dependencies. Tests are in `src/__tests__/`.

## Project
- Game design doc: ~/.gstack/projects/vingkan-systematica/vineshkannan-main-design-20260329-133054.md
- Game rules and example flow: docs/ticket-booking-example.md
- Original game journal: docs/original-game-design-journal.md
