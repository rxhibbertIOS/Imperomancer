# Imperomancer

Imperomancer is a tabletop display companion for running shared, map-led roleplaying sessions. It gives a Dungeon Master a private control surface and gives players a clean, dedicated table display for the information they should see together.

The project is built around one simple promise: **the DM should be able to prepare, reveal, measure, annotate, and run an encounter without breaking the flow at the table.** Maps, tactical information, dramatic prompts, and dice results belong on the display; controls and private preparation stay with the DM.

## Contents

- [The vision](#the-vision)
- [How the two-screen experience works](#how-the-two-screen-experience-works)
- [Feature overview](#feature-overview)
- [Getting started at the table](#getting-started-at-the-table)
- [Project structure](#project-structure)
- [Run locally](#run-locally)
- [Testing and quality](#testing-and-quality)
- [Adding or changing a feature](#adding-or-changing-a-feature)
- [Documentation map](#documentation-map)
- [Technology and design principles](#technology-and-design-principles)

## The vision

Physical and hybrid tabletop games are at their best when everyone shares a clear picture of the fictional space. A large display can make a dungeon, battle map, or atmospheric scene feel immediate—but operating that display should not turn the DM into an AV technician.

Imperomancer treats the table as a first-class player-facing surface. The DM can prepare scenes privately, switch between them deliberately, reveal only the areas the group has earned, and add tactical information exactly when it matters. The player view is intentionally presentation-led: it does not expose configuration panels, edit handles, browser controls, or private notes.

The application is designed for common encounter rhythms:

1. Prepare a scene and frame the part of the map that matters.
2. Publish it to the table when the group arrives there.
3. Establish scale with an optional calibrated grid.
4. Reveal information through fog, focus pings, whiteboard marks, and effects.
5. Run initiative and dice without leaving the table experience.
6. Move to the next prepared scene without rebuilding the encounter.

This is not intended to replace a campaign manager, character sheet system, or virtual tabletop with accounts and remote players. It is a focused local-session tool for a DM and a shared player display.

## How the two-screen experience works

Imperomancer has two modes served by the same application:

| Mode | Audience | Purpose |
| --- | --- | --- |
| **DM control screen** | Dungeon Master | Prepare scenes, operate tools, make private changes, and manage the session. |
| **Player/table display** | Everyone at the table | Present the published scene, shared overlays, public rolls, status prompts, and initiative. |

The DM opens the player display through **Go Live**. The two views synchronize scene state through browser messaging, while viewport updates use an acknowledged channel so rapid panning does not overwhelm the player display.

The DM preview is deliberately letterboxed to match the player display's actual renderable viewport. If a portrait map is fully visible in the DM preview, it should be fully visible on the player display too. This distinction matters because the usable browser viewport can differ from the physical monitor’s reported dimensions.

### Shared versus private information

The following are normally shared with the player display:

- published image or video scenes and their current framing;
- visible grids, fog, whiteboard strokes, focus pings, and public effect layers;
- public dice results, initiative, and status messages.

The following remain DM-facing unless explicitly published or marked visible:

- prepared scenes that are not currently published;
- private dice rolls;
- private effect layers and the measurement ruler;
- scene editing controls, fog brushes, layer editing, and the Chronicle system log.

## Feature overview

Each feature has a detailed, user-facing guide in the [knowledge base](docs/knowledge-base/README.md). The summary below is the quickest way to understand what belongs where.

### Scene library and table view

Create named, reusable scenes with images or video. Every prepared scene retains its own map framing, grid configuration, fog state, and persistent effects. Publish with a cut or fade when it is time to reveal the scene.

Read: [Scenes and the table view](docs/knowledge-base/scenes.md)

### Grid, units, and physical calibration

Overlay square, pointy-hex, or flat-hex grids. Align the grid to an existing map, label coordinates, and use custom distance units. For physical table displays, calibration can make one grid cell equal one real-world inch.

Read: [Grid, calibration, and units](docs/knowledge-base/grid-and-calibration.md)

### Fog of war

Cover a scene, reveal explored areas with round or square brushes, and repaint regions when they should be hidden again. Fog is saved with its prepared scene and remains aligned as the map moves.

Read: [Fog of war](docs/knowledge-base/fog-of-war.md)

### Whiteboard

Draw freehand marks, straight lines, rectangles, ellipses, and erasures above the table. Strokes use normalized coordinates, so they scale cleanly between the DM preview and player display.

Read: [Whiteboard](docs/knowledge-base/whiteboard.md)

### Effects and layers

Place grid-aware lines, circles, squares, cones, status markers, and measurements. Persistent effects are saved with their scene; temporary effects are ideal for short-lived tactical callouts. A layer can be public or private.

Read: [Effects and layers](docs/knowledge-base/effects-and-layers.md)

### Focus pointer

Drop temporary, pulsing rings to draw the group’s attention to a point on the map without changing its content. Choose a color for new pings and clear them when they are no longer useful.

Read: [Focus pointer](docs/knowledge-base/focus-pointer.md)

### Dice, initiative, and status

Roll dice publicly on the player display or privately on the DM screen, retain a local recent-roll history, build an initiative order, and send short status messages for dramatic beats or reminders.

Read: [Dice and roll history](docs/knowledge-base/dice-and-history.md) · [Initiative](docs/knowledge-base/initiative.md) · [Status messages](docs/knowledge-base/status-messages.md)

### Chronicle and shortcuts

Chronicle is an in-app operational log for session activity and warnings. Keyboard shortcuts keep the most common table actions close at hand while protecting text entry and open dialogs from accidental triggers.

Read: [Chronicle and keyboard shortcuts](docs/knowledge-base/chronicle-and-shortcuts.md)

## Getting started at the table

1. Start Imperomancer and open the DM control screen in your main browser window.
2. Select **Go Live** to open the Player/table display on the display used by the group.
3. In **Scene**, create or select a prepared scene and upload an image or video.
4. Frame the scene in the DM preview, then select **Publish to Table**.
5. If scale matters, enable and align the grid. Calibrate it only when physical one-inch cells are required.
6. Turn on fog, whiteboard, effects, or pointer tools as the encounter develops.
7. Start initiative and choose public or private dice rolls when needed.

For the more complete operating sequence, see the [knowledge-base overview](docs/knowledge-base/README.md).

## Project structure

```text
.
├── index.html                 Application shell and mode selection
├── landing.html               Standalone product and feature-tour page
├── src/components/            Reusable HTML components included at build time
├── public/
│   ├── js/
│   │   ├── core/              Cross-window transport, shortcuts, focus management
│   │   ├── features/          Scene, grid, fog, dice, initiative, and tool features
│   │   ├── shared/            IDs, logging, dice helpers, and legacy utilities
│   │   └── libraries/         Bundled third-party browser libraries
│   ├── styles/                Tokens, layout, primitives, and feature styles
│   └── assets/                Icons, fonts, and image assets
├── docs/                      Knowledge base and contributor documentation
├── test/                      Fast Node feature and regression tests
├── e2e/                       Playwright browser-level regression tests
└── vite.config.js             Development and production build configuration
```

The JavaScript is deliberately organized as browser globals and Alpine-compatible feature factories rather than a compiled application framework. `dm.js` and `player.js` compose the feature factories into their respective application roots.

The visual product tour is available locally at [`landing.html`](landing.html). It uses the committed captures in `docs/assets/media/`, so a current marketing preview always shows real, reproducible product states rather than placeholder imagery.

## Run locally

### Requirements

- A current Node.js runtime (Node 20 or later is recommended).
- npm.

### Install and start

```sh
npm install
npm run dev
```

Vite prints the local URL. Open it normally for the DM control surface. Add `?mode=player` to open the Player/table display directly during development.

```text
http://localhost:5173/?mode=player
```

### Production build

```sh
npm run build
npm run preview
```

The build expands the HTML components used by `index.html` and writes the resulting output to `dist/`.

## Testing and quality

The project uses both fast logic tests and real-browser tests:

```sh
# Fast Node regression suite
npm test

# Re-run Node tests while developing
npm run test:watch

# Real Chromium DM/player and rendering checks
npm run test:e2e

# Verify the production build
npm run build
```

Before the first browser test on a machine, install Chromium for Playwright:

```sh
npx playwright install chromium
```

The browser suite starts a local Vite server automatically. It covers the live DM-to-player synchronization path as well as visual viewport behavior, including portrait-image fitting at a different player display aspect ratio.

For test conventions, browser artifact inspection, debugging guidance, and instructions for adding coverage, read [Testing Imperomancer](docs/testing.md).

## Adding or changing a feature

Never treat a feature as only a JavaScript change. It needs a deliberate DM/Player visibility decision, maintainable JSDoc, end-user guidance, tests, and—when seeing the feature helps—a reproducible documentation capture. The step-by-step contributor guide, including copyable commands and recovery steps for common failures, is [Adding a feature from idea to release](docs/development-workflow.md).

## Documentation map

| Document | Audience | What it covers |
| --- | --- | --- |
| [Knowledge base](docs/knowledge-base/README.md) | DMs and future website visitors | Feature guides and practical table workflows. |
| [Testing guide](docs/testing.md) | Contributors | Node tests, Playwright, traces, debugging, and test design. |
| [Feature development workflow](docs/development-workflow.md) | New contributors and AI assistants | A no-assumptions checklist for implementing, documenting, testing, capturing, reviewing, and validating a feature. |
| [Documentation media](docs/media/README.md) | Contributors and writers | Reproducible WebP/WebM capture pipeline, fixtures, commands, and review rules. |
| [Extending media captures](docs/media/extending.md) | Contributors | Recipe contract, new-feature workflow, WebM recording, and validation. |
| [Media gallery](docs/media-gallery.md) | Writers and future website builders | Stable screenshot and video references produced by the capture pipeline. |
| [Scenes](docs/knowledge-base/scenes.md) | DMs | Scene preparation, publication, framing, and media. |
| [Grid and calibration](docs/knowledge-base/grid-and-calibration.md) | DMs | Grid alignment, units, physical scaling, and locking. |
| [Fog of war](docs/knowledge-base/fog-of-war.md) | DMs | Reveal, repaint, reset, and scene persistence. |
| [Effects and layers](docs/knowledge-base/effects-and-layers.md) | DMs | Tactical geometry, layer visibility, and measurements. |
| [Dice and history](docs/knowledge-base/dice-and-history.md) | DMs | Public/private rolls, notation, and records. |

## Technology and design principles

### Local-first session operation

Imperomancer is intended to work within a local tabletop session. It uses browser-native cross-window messaging instead of requiring player accounts or a remote service. The DM’s browser is the session control point.

### Progressive enhancement

Features guard against missing browser capabilities and external integrations. For example, dice rolls have fallbacks, invalid scene media is rejected cleanly, and keyboard shortcuts avoid triggering while a user is typing.

### Spatial consistency

Scene tools operate in scene coordinates rather than raw screen pixels. This keeps fog, effects, whiteboard marks, grids, and focus pings aligned as the view changes. The DM preview follows the player stage's real viewport ratio so it remains a trustworthy representation of what the table can see.

### Accessible interaction

The interface uses semantic controls, keyboard navigation, visible focus styles, focus trapping for dialogs, and the Atkinson Hyperlegible font family. Tooling such as the shortcut glossary and Chronicle is designed to reduce cognitive load during live play.

### Testable boundaries

State and geometry behavior are covered by fast Node tests; browser layout and cross-tab behavior are covered with Playwright. Third-party bundled libraries are tested through Imperomancer’s integration points rather than their minified implementation details.

---

Imperomancer is evolving alongside real table use. The knowledge base is the best place to start when explaining a feature to a DM; this README is the best place to start when understanding the project as a whole.
