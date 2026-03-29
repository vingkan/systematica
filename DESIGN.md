# Design System — Systematica

## Product Context
- **What this is:** A two-player asymmetric card game that teaches software system design through play
- **Who it's for:** Junior/learning developers, CS students, bootcamp grads, early-career engineers
- **Space/industry:** EdTech, tabletop games, system design education
- **Project type:** Digital card game (React + Vite), deployed to GitHub Pages, designed for eventual physical card production

## Aesthetic Direction
- **Direction:** Blueprint / Industrial-Technical
- **Decoration level:** Intentional — subtle blueprint grid texture on the table surface, glowing connection lines between cards, pulsing status indicators on overloaded cards. No decorative blobs, no gradients for decoration's sake.
- **Mood:** Engineering precision meets tabletop warmth. Like the best DevOps dashboard you've ever seen, turned into a game night. Technical but inviting. The contrast between precise infrastructure subject matter and approachable game feel IS the identity.
- **Reference sites:** Balatro (dark table backdrop, saturated cards, zone-based UI), Marvel Snap (cards as visual priority, dark glass chrome), Slay the Spire (information hierarchy, card readability)
- **Differentiation:** No other card game uses the blueprint aesthetic. Schematic-style cards with no illustrations. The card IS the architecture component. JetBrains Mono for stats signals "real tech, not fantasy."

## Typography
- **Display/Hero:** Satoshi (700, 900) — geometric, confident, modern. Game title, phase names, card names. Loaded from Fontshare CDN.
- **Body:** DM Sans (400, 500) — clean, readable at small card-label sizes, good tabular-nums support. Card rules text, descriptions, UI labels.
- **UI/Labels:** DM Sans 500
- **Data/Tables:** JetBrains Mono (500, 600) — monospace for card stats, capacity indicators, throughput limits. Because this IS a game about technical infrastructure. Supports tabular-nums natively.
- **Code:** JetBrains Mono (400)
- **Loading:**
  - Satoshi: `https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700,900&display=swap`
  - DM Sans + JetBrains Mono: Google Fonts
- **Scale:**
  - 3xl: 56px (hero title)
  - 2xl: 36px (section headings, large card names)
  - xl: 28px (section titles)
  - lg: 24px (card names on full-size cards)
  - md: 16px (body text)
  - sm: 14px (card stats, small card names)
  - xs: 12px (phase labels, eyebrows)
  - 2xs: 10px (section labels, tiny annotations)
  - 3xs: 9px (card type labels, queue indicators)
  - 4xs: 8px (mini card labels, architecture card types)

## Color

### Approach: Balanced, semantic

Each card type gets a distinct color that carries meaning. The palette flows cool-to-warm as data moves deeper through the architecture: blue (network, data in motion) to bronze (storage, data at rest).

### Background & Surface
| Token | Hex | Usage |
|-------|-----|-------|
| `--bg-deep` | `#0d1117` | Page background |
| `--bg-blueprint` | `#131a2b` | Game table / board background |
| `--bg-surface` | `#1a2332` | Card backgrounds, elevated panels |
| `--bg-elevated` | `#212d3f` | Hover states, tooltips |
| `--grid-line` | `rgba(74, 158, 206, 0.06)` | Minor blueprint grid lines |
| `--grid-line-major` | `rgba(74, 158, 206, 0.12)` | Major blueprint grid lines, borders |

### Card Type Colors
| Token | Hex | Card Type | Meaning |
|-------|-----|-----------|---------|
| `--network` | `#4a9ece` | Network | Steel blue — data in motion, connections |
| `--compute` | `#3daa6f` | Compute | Emerald green — active processing |
| `--storage` | `#c4915e` | Storage | Warm bronze — data at rest is precious |
| `--application` | `#d4a834` | Application | Dark goldenrod — business logic, valuable |
| `--request` | `#e05555` | Request | Signal red — incoming traffic, urgency |
| `--effect` | `#9b6dcc` | Effect | Deep violet — chaos, disruption |

Each card type color has three variants:
- Base: the accent color (text, icons, borders)
- Background: `rgba([color], 0.12)` — card fill
- Border: `rgba([color], 0.4)` — card border

### Text
| Token | Hex | Usage |
|-------|-----|-------|
| `--text-primary` | `#e8e6e3` | Primary text, card names (warm off-white) |
| `--text-secondary` | `#9aa5b4` | Body text, descriptions |
| `--text-muted` | `#5a6a7e` | Labels, annotations, inactive states |

### Semantic
| Token | Hex | Usage |
|-------|-----|-------|
| `--danger` | `#e74c3c` | Overloaded cards, failed requests, errors |
| `--success` | `#27ae60` | Completed requests, healthy status |
| `--warning` | `#d4a834` | Stampeding Herd alerts, caution states |
| `--info` | `#4a9ece` | Turn info, phase transitions |

### Dark mode
Default. This is a dark-first game (the blueprint table IS dark).

### Light mode strategy
Invert surfaces: `--bg-deep: #f0f2f5`, `--bg-surface: #ffffff`. Reduce card background opacity. Keep accent colors the same. Text flips to dark: `--text-primary: #1a2332`.

## Spacing
- **Base unit:** 8px
- **Density:** Comfortable — cards need breathing room on the dark table
- **Scale:**
  - `--sp-2xs`: 2px
  - `--sp-xs`: 4px
  - `--sp-sm`: 8px
  - `--sp-md`: 16px
  - `--sp-lg`: 24px
  - `--sp-xl`: 32px
  - `--sp-2xl`: 48px
  - `--sp-3xl`: 64px

## Layout
- **Approach:** Grid-disciplined
- **Grid:** The game board splits into two halves (server architecture left, client deck right). The server architecture arranges in horizontal layers: network (top) → compute (middle) → storage (bottom). This mirrors how architecture diagrams are drawn.
- **Max content width:** 1200px for non-game screens (menus, rules). The game board is full-width.
- **Blueprint grid:** Background uses a 16px minor / 128px major grid pattern in the blueprint accent color. This is the defining visual element of the design.
- **Border radius:** Hierarchical scale:
  - `sm`: 3px (mini elements, phase chips)
  - `md`: 4px (buttons, inputs)
  - `lg`: 6px (cards, panels)
  - `xl`: 8px (game board container)
  - `full`: 9999px (not used — no pills or circles in the blueprint aesthetic)

### Card Dimensions
- Full card: 140px x 196px (approximately poker-card proportions, scalable)
- Mini card (in-play token): 90px x 125px
- Architecture card (on board): 110px x 80px (landscape, compact for the board view)

### Blueprint Corner Marks
Every card has small L-shaped registration marks in the card's accent color at the top-left and bottom-right corners. These are the signature visual element of the blueprint aesthetic. Implemented with `::before` and `::after` pseudo-elements.

## Motion
- **Approach:** Intentional — purposeful transitions that aid comprehension, not playful bouncing
- **Easing:**
  - Enter: `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out, snappy entry)
  - Exit: `ease-in`
  - Move: `ease-in-out`
- **Duration:**
  - Micro: 80ms (hover color changes, focus rings)
  - Short: 180ms (button state changes, card hover lift)
  - Medium: 300ms (phase transitions, card movement)
  - Long: 500ms (overload pulse animation)
- **Key animations:**
  - Card hover: translateY(-4px) with shadow increase, 180ms
  - Overload pulse: box-shadow oscillates between subtle and bright red glow, 1.5s infinite
  - Request routing: card slides along connection lines from LB → compute → storage (medium duration)
  - Phase transition: brief horizontal sweep across the phase bar

## Connection Lines
Dashed lines (`1px dashed`) connect cards in the architecture. Directional arrows at endpoints (CSS triangle via `::after`). Lines use `--text-muted` color by default, glow to the card's accent color on hover. This makes the board look like a real architecture diagram.

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-29 | Blueprint aesthetic chosen | Unique in the card game space, maps directly to "building an architecture" metaphor, reinforces educational purpose |
| 2026-03-29 | JetBrains Mono for stats | Monospace numbers on capacity indicators signal "real tech," differentiates from fantasy/casual card games |
| 2026-03-29 | Schematic cards, no illustrations | Card IS the component. Cheaper for physical production. Reinforces technical aesthetic. |
| 2026-03-29 | Cool-to-warm color flow | Blue (network) → green (compute) → bronze (storage) maps to data flow from transient to persistent |
| 2026-03-29 | Warm bronze for storage instead of purple | Better color separation from effect cards (violet). Evokes "data at rest is precious." |
| 2026-03-29 | Corner registration marks on cards | Signature blueprint visual element. Implemented with CSS pseudo-elements. |
