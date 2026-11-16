# Extending the documentation media pipeline

This guide is for contributors adding a visual explanation of a new Imperomancer feature. A media recipe is both an executable demonstration and the source of a committed documentation asset, so keep it focused, deterministic, and easy to review.

## Choose the right format

Use a **WebP screenshot** when one stable state explains the feature: a configured control, a Player-visible result, a before/after comparison, or a layout behavior.

Use a **WebM clip** when motion is the lesson: drawing fog, creating a whiteboard stroke, moving focus, advancing initiative, or a transient effect. Keep clips short—normally two to six seconds—and demonstrate a single action. Hold a stable initial state briefly before the action and a stable resulting state briefly afterwards, so an embedded player cannot clip the context or outcome.

Capture the smallest useful surface. A Player-facing feature normally needs the Player stage. DM-only configuration belongs in the DM view. When a feature crosses both roles, use two assets unless their relationship itself is the lesson.

## Step 1: add a deterministic resource

Place fixed inputs in `docs/media/resources/`.

- Put image files directly in `docs/media/resources/`; do not place source images in `public/` or `docs/assets/media/`.
- Use a descriptive lowercase kebab-case filename, such as `dm-publishing-scene.webp`, `fog-reveal-scene.jpg`, or `forest-battlefield.svg`.
- PNG, JPEG, WebP, AVIF, GIF, and SVG are supported. Prefer SVG for diagrams when available, but use the original high-quality raster image when that is what you have.
- Keep fixture dimensions and content intentional; a resource is part of the visual contract.
- Never use campaign data, private notes, personal information, remote URLs, or unlicensed art.

If the recipe needs no external resource, do not add a placeholder just for symmetry.

If you replace an existing fixture, update every recipe that names it. For example, replacing `portrait-ruins.svg` with `dm-publishing-scene.webp` means changing `imageFixtureDataUrl('portrait-ruins.svg')` to `imageFixtureDataUrl('dm-publishing-scene.webp')` in the relevant recipe(s). The capture command reports a clear missing-fixture error when a recipe names a file that is not present.

## Step 2: create one recipe module

Create `e2e/docs-media/captures/<feature-name>.js`. A recipe exports one object with a unique ID, a readable title, the complete list of files it writes, and an async `run` method.

```js
import { expect } from '@playwright/test';
import { documentationAssetPath } from '../helpers.js';

/** @type {import('../index.js').DocumentationCapture} */
export const initiativeCapture = {
    id: 'initiative-overview',
    title: 'captures the initiative order reference image',
    assets: ['initiative-turn-order.webp'],
    async run({ browser }) {
        const context = await browser.newContext({
            viewport: { width: 1200, height: 800 },
            deviceScaleFactor: 1,
        });
        const page = await context.newPage();
        await page.goto('/?mode=dm');
        await expect(page.locator('#dmApp')).toBeVisible();

        // Perform stable, user-reachable setup for this feature.
        await page.getByRole('button', { name: /initiative/i }).click();
        await expect(page.locator('[data-feature="initiative"]')).toBeVisible();

        await page.screenshot({
            path: documentationAssetPath('initiative-turn-order.webp'),
            type: 'webp',
            quality: 86,
        });
        await context.close();
    },
};
```

Use semantic Playwright locators (`getByRole`, visible text, or durable `data-*` hooks) where practical. Do not depend on brittle CSS class names or visual timing alone. If programmatic state setup is clearer and represents a user-reachable state, keep it small and comment why it is appropriate.

Always create a new context with an explicit viewport and `deviceScaleFactor: 1`. Close every page/context, even when a recipe has only one image.

### Use a scenario session for multi-step DM/Player stories

Do not repeat browser startup, scene publication, grid configuration, and fog
setup in every long workflow. Use
[`scenario-session.js`](../../e2e/docs-media/scenario-session.js) for a
repeatable two-screen session instead. It opens a real DM and Player pair in
one browser context, so the product's normal synchronization path is still
used.

```js
import { createScenarioSession } from '../scenario-session.js';

const session = await createScenarioSession(browser).instantiate();
await session.prepareScene('Dwarven Forge', 'Dwarven_Forge.png');
await session.publishScene('Dwarven Forge', 'cut');
await session.enableGrid({ type: 'hex-pointy', cellsAcross: 100, pxPerCell: 18 });
await session.lockGrid({ tablePpi: 40 });
await session.applyFog({
    strokes: [{ mode: 'reveal', shape: 'round', size: 5, x: 260, y: 380 }],
});

// Record a specific feature action after the shared prerequisites are ready.
await session.saveRecording('dm-e2e-example.webm', 'player-e2e-example.webm');
```

The session exposes `dm` and `player` Playwright pages for the small number of
feature-specific interactions that need them. Prefer its semantic methods when
one exists:

| Scenario area | Available methods |
| --- | --- |
| Lifecycle | `instantiate`, `hold`, `saveRecording`, `close` |
| Scenes | `prepareScene`, `selectScene`, `publishScene`, `setSceneViewport`, `clearScene` |
| Grid | `enableGrid`, `setGridSize`, `setGridType`, `setGridUnits`, `calibrateGrid`, `lockGrid`, `unlockGrid` |
| Fog | `applyFog`, `revealFog`, `reapplyFog`, `setFogEditing`, `clearFog` |
| Whiteboard | `openWhiteboard`, `hideWhiteboard`, `configureWhiteboard`, `drawWhiteboardStroke`, `drawWhiteboardShape`, `undoWhiteboard`, `clearWhiteboard` |
| Pointer | `setPointerColor`, `placePointer`, `clearPointers` |
| Dice | `configureDice`, `performPrivateRoll`, `performPublicRoll`, `closeDiceResults`, `openRollHistory` |
| Initiative | `populateInitiative`, `startInitiative`, `advanceTurn`, `setCombatantDefeated`, `collapseInitiative`, `exitInitiative` |
| Status | `sendStatus`, `sendQuickStatus`, `clearStatus` |
| Effects | `startMeasurement`, `placeTemporaryShape`, `placePersistentShape`, `deleteEffect`, `clearEffects` |
| Escape hatch | `showCard`, `patchDmState` |

`patchDmState` is the deliberate escape hatch for deterministic,
user-reachable setup that has no semantic helper yet. Add a new helper only
when two or more workflows would benefit from the same named action. This
keeps the factory useful without turning it into a second copy of every
feature's implementation.

## Step 3: use or add shared helpers

[`e2e/docs-media/helpers.js`](../../e2e/docs-media/helpers.js) provides the common, deliberately safe pieces:

| Helper | Use |
| --- | --- |
| `imageFixtureDataUrl(name)` | Reads PNG, JPEG, WebP, AVIF, GIF, or SVG from `docs/media/resources/` as a MIME-correct data URL. |
| `documentationAssetPath(name)` | Produces a validated output path for a declared `.webp` or `.webm` asset. |
| `mountDmScene(page, source)` | Loads a scene into DM mode and applies its geometry. |
| `mountPlayerScene(page, source)` | Loads a scene into Player mode and waits for image fit/rendering. |
| `saveRecordedVideo(video, name)` | Renames a finalized Playwright video to its stable WebM filename. |

Add behavior to `helpers.js` only when two or more recipes genuinely need it or it represents a reusable application setup boundary. Keep feature-specific actions in the feature’s own recipe.

## Step 4: register the recipe

Import the new export and add it to `documentationCaptures` in `e2e/docs-media/index.js`:

```js
import { initiativeCapture } from './captures/initiative.js';

export const documentationCaptures = Object.freeze([
    sceneOverviewCapture,
    fogRevealCapture,
    initiativeCapture,
]);
```

The registry validates IDs and filenames. IDs must be unique lowercase kebab-case values. Every asset must be listed, use a unique lowercase kebab-case filename, and end in `.webp` or `.webm`. Prefix every filename with `dm-` or `player-` to make its viewpoint explicit; `dm-grid-calibration.webp` and `player-grid-application.webp` are the expected pattern. That list is the recipe’s write contract.

## Step 5: record a WebM when motion matters

For video, enable `recordVideo` on the browser context. Record to `outputDirectory`, perform one short before/after interaction, close the page and context, then rename Playwright’s generated file. The close is essential: Playwright finalizes the WebM only after the page is closed.

```js
import { outputDirectory, saveRecordedVideo } from '../helpers.js';

const context = await browser.newContext({
    viewport: { width: 900, height: 700 },
    recordVideo: { dir: outputDirectory, size: { width: 900, height: 700 } },
});
const page = await context.newPage();

// Navigate and establish initial state.
await page.waitForTimeout(700); // Keep a clear before-state in the finished clip.
// Perform one visible action.
await page.waitForTimeout(900); // Keep the resulting state long enough to read.

const video = page.video();
await page.close();
await context.close();
await saveRecordedVideo(video, 'initiative-advance.webm');
```

List `initiative-advance.webm` in `assets`. Keep waits purposeful and short. If a transition has a known completion event, prefer that event or a visible assertion over an arbitrary delay.

## Step 6: expose, review, and validate

Generated media has no value until a reader can reach it. Add the WebP/WebM to the relevant `docs/knowledge-base/` guide and optionally to `docs/media-gallery.md`. Use meaningful alt text; video must not be the only source of essential instructions.

Run:

```sh
npm run docs:media
npm test
npm run test:e2e
npm run build
git diff --check
```

Open every changed WebP and WebM before committing. Confirm the final diff includes the recipe, registry entry, fixture (if any), generated media, and documentation reference together.

## Durability checklist

- Freeze viewport, sample data, and timing; never capture a live account, current date, random roll, or external-service response.
- Assert at least one state the reader relies on before taking a screenshot or beginning a recorded action.
- Keep one feature and one teaching objective per asset.
- Use a fixture only where its visual content matters; do not hide product behavior behind a fake image.
- Renaming an existing output requires updating every Markdown reference in the same change.
- If a visual is unstable, first fix or explicitly control the source of instability. Do not commit a lucky run.

See [the pipeline overview](README.md) for directory ownership and troubleshooting, and [AGENTS.md](../../AGENTS.md) for the project-wide requirements around JSDoc, tests, accessibility, performance, and documentation.
