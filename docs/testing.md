# Testing Imperomancer

Imperomancer has two complementary automated test layers:

- **Node feature tests** exercise application state, geometry, synchronization, rendering commands, and failure handling quickly with small browser API mocks.
- **Playwright browser tests** run the actual application in Chromium. They verify the rendered DOM, real `BroadcastChannel` synchronization between DM and Player tabs, and viewport-dependent behavior such as portrait-map fitting.

Run both layers before submitting a change that affects JavaScript, CSS layout, synchronization, or scene rendering.

If you are new to the repository, read the [no-assumptions feature development guide](development-workflow.md) first. It shows where testing fits alongside implementation, end-user documentation, and repeatable WebP/WebM capture work.

## Quick reference

| Command | Purpose |
| --- | --- |
| `npm test` | Run the fast Node regression suite. |
| `npm run test:watch` | Re-run Node tests as test or source files change. |
| `npm run test:e2e` | Run the Playwright Chromium browser suite. |
| `npm run docs:media` | Generate the committed WebP/WebM documentation assets. |
| `npm run docs:media:playlists` | Generate all short, numbered paired DM/Player media chapters. |
| `npm run docs:media:feature-steps` | Generate numbered paired chapters for non-Scene features; filter with `DOCS_MEDIA_STEP_FEATURES=dice`. |
| `npm run build` | Verify the production build and included component output. |

The normal pre-handoff check is:

```sh
npm test
npm run test:e2e
npm run build
git diff --check
```

## Prerequisites

Install project dependencies once:

```sh
npm install
```

The browser suite also needs Playwright's Chromium binary. Install it once per machine, or again after a Playwright version upgrade:

```sh
npx playwright install chromium
```

`npm run test:e2e` starts a local Vite server automatically at `http://127.0.0.1:4173`. Do not start a second server on that port while the suite is running. If a compatible Vite server is already running, Playwright reuses it in local development.

`npm run docs:media` uses the same browser foundation to run the tagged, deterministic capture tests. It is intentionally separate from the normal regression command because it overwrites committed documentation media. See the [documentation media pipeline](media/README.md) for fixture and review rules.

To add a capture for a new feature, use the recipe and registry workflow in [Extending the documentation media pipeline](media/extending.md); do not add feature-specific setup directly to the generic test harness.

## Node regression tests

The Node suite lives in [`test/`](../test). It uses the built-in `node:test` runner, so it has no DOM framework dependency and normally completes in a few seconds.

### What it covers

The suite tests first-party JavaScript only. It covers, among other things:

- scene sizing, panning, zoom bounds, publication, and portrait-map fitting;
- grid units, calibration, persistence, and locking;
- fog and whiteboard state plus canvas drawing behavior;
- effect placement, SVG escaping, selection, and expiry;
- initiative, dice, history, status, pointer, focus trap, and shortcuts;
- DM/player lifecycle state, packet ordering, and view acknowledgements;
- legacy state synchronization, IDs, Chronicle logging, and landing-page initialization.

Third-party minified bundles in `public/js/libraries/` are treated as external dependencies. Their behavior is covered through the application boundaries that use them; do not add unit tests that inspect their minified internals.

### Browser mocks

[`test/helpers/browser.js`](../test/helpers/browser.js) loads classic browser scripts into an isolated VM context. It provides deliberately small stand-ins for APIs such as `window`, `document`, animation frames, timers, and broadcast channels.

This design keeps state and error-path tests fast. It also means DOM layout, CSS rendering, and genuine cross-tab behavior belong in Playwright tests, not VM tests.

When comparing an object created inside a VM, use the helper's `plain(value)` function. It serializes the value into the host JavaScript realm, avoiding false failures caused by different `Array` or `Object` prototypes.

### Write a Node test

Place a new file in `test/` using the `*.test.js` suffix. Use the built-in runner and strict assertions:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadBrowserScript, prepareFeature } from './helpers/browser.js';

test('feature: rejects invalid input without changing state', () => {
    const context = loadBrowserScript('public/js/features/example.js', {
        MODE: 'dm',
        systemLog: { warn() {}, error() {} },
    });
    const feature = prepareFeature(context.exampleFeature());

    feature.applyValue('not valid');

    assert.equal(feature.value, 'default');
});
```

Each behavior change should generally include at least:

1. A positive case proving the intended result.
2. A negative or malformed-input case proving it fails safely.
3. A boundary case when values are capped, rounded, timed, synchronized, or persisted.

Test observable behavior rather than private variable names where possible. A private helper may be tested directly when it has meaningful standalone logic, such as coordinate conversion or normalization.

## Playwright browser tests

Browser tests live in [`e2e/`](../e2e) and are configured by [`playwright.config.js`](../playwright.config.js). They run Chromium at desktop dimensions by default.

### What browser tests are for

Use a browser test when correctness depends on one or more of these:

- real CSS layout, clipping, transforms, canvas size, or viewport ratio;
- Alpine reactivity and rendered DOM state;
- native browser APIs such as `BroadcastChannel`, `ResizeObserver`, focus, or media loading;
- an interaction that crosses the DM and Player application boundary.

The portrait-map regression test is the model example: a pure state test can verify the fit calculation, but only a real browser can prove that the transformed image reaches the top and bottom of the player viewport without clipping.

### Run and inspect a single test

Use Playwright's title filter:

```sh
npx playwright test -g "portrait scene"
```

Use the list reporter for explicit per-test output:

```sh
npm run test:e2e -- --reporter=list
```

Run headed Chromium to watch the interaction:

```sh
npx playwright test --headed
```

Use Playwright UI mode to select, rerun, and inspect tests interactively:

```sh
npx playwright test --ui
```

### Failure artifacts

On failure, Playwright writes evidence to `test-results/`:

- a screenshot of the failed page;
- an error-context Markdown file containing the locator, assertion, call log, and accessibility snapshot;
- a `trace.zip` file when tracing is enabled for the failed test.

These directories are ignored by Git. Inspect a saved trace with:

```sh
npx playwright show-trace test-results/<failed-test>/trace.zip
```

The trace viewer shows DOM snapshots, network activity, console messages, and each Playwright action. Read the generated `error-context.md` first: it often identifies whether a selector was too broad, a visual state did not settle, or the application behavior actually regressed.

### Write a browser test

Use semantic locators whenever the rendered accessibility contract supports them:

```js
import { expect, test } from '@playwright/test';

test('DM can enable the pointer', async ({ page }) => {
    await page.goto('/?mode=dm');
    await page.getByRole('button', { name: /pointer/i }).first().click();
    await page.getByRole('button', { name: /enable pointer/i }).click();
    await expect(page.getByRole('button', { name: /pointer active/i })).toBeVisible();
});
```

Scope selectors to the correct application root whenever both DM and Player markup are present in `index.html`:

```js
const playerScene = page.locator('#playerApp [data-grid-scene]');
```

This matters because the non-active application may still exist in the DOM with `x-cloak` or mode-specific CSS. A broad selector such as `[data-grid-scene]` can match both the hidden DM image and the active Player image.

For a real DM/Player test, open separate browser pages in the same Playwright context. They then share the application's origin and can use the real `BroadcastChannel` implementation:

```js
test('DM publishes to Player', async ({ browser }) => {
    const context = await browser.newContext();
    const dm = await context.newPage();
    const player = await context.newPage();
    await dm.goto('/?mode=dm');
    await player.goto('/?mode=player');

    // Perform DM action, then wait for observable Player state.
    await expect.poll(() => player.evaluate(() => {
        return Alpine.$data(document.querySelector('#playerApp')).currentImage;
    })).toBe('expected source');

    await context.close();
});
```

Always close manually created browser contexts. This prevents a test from leaking pages into a later test.

## Diagnosing common failures

### A Playwright locator matches two elements

The page contains both mode roots. Scope the locator to `#dmApp` or `#playerApp`; do not solve this by blindly calling `.first()` unless the first match is intentionally part of the contract.

### An image-load test times out

Attach the handler before waiting, but tolerate cached data URLs:

```js
if (!image.complete) {
    await new Promise((resolve, reject) => {
        image.addEventListener('load', resolve, { once: true });
        image.addEventListener('error', reject, { once: true });
    });
}
```

After changing reactive state, wait for Alpine's next tick before querying newly created template content.

### A Node assertion reports identical objects are not equal

The value likely came from the VM sandbox. Compare `plain(value)` with the expected host object.

### A test passes locally but fails after a resize

Use a browser test with the actual target viewport dimensions. The DM and Player can intentionally have different viewport sizes; view fitting must use the player-stage geometry, not the DM panel size or physical screen metadata.

## Test design checklist

Before considering a change covered, ask:

- Does the happy path work?
- Are invalid, absent, stale, or malformed inputs harmless?
- Are limits and edges covered: zero values, empty collections, first/last items, and timeouts?
- Does a DM-visible change synchronize correctly to Player?
- Does the Player behave correctly at a different viewport ratio?
- Does the browser test assert a user-observable outcome rather than an implementation detail?
- Do `npm test`, `npm run test:e2e`, and `npm run build` all pass?

## Current boundaries

The suite deliberately does not test the internals of bundled third-party libraries such as Three.js, Cannon, GSAP, the dice renderer, or DieBuilder. Their integration points are tested instead. New external integrations should follow the same rule: test our configuration, error handling, and user-visible result.

Native browser and display hardware behavior can still differ from headless Chromium. For a release affecting a physical table display, perform one short manual verification on the target display in addition to the automated suite.
