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

## Project
- Tech stack: Vite + React + TypeScript, deployed to GitHub Pages
- Game design doc: ~/.gstack/projects/vingkan-systematica/vineshkannan-main-design-20260329-133054.md
- Original game journal: docs/original-game-design-journal.md
