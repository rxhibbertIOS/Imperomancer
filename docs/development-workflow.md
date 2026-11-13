# Adding an Imperomancer feature: the no-assumptions guide

This guide is for people and AI assistants who need to add a feature but do
not already know the project, Playwright, WebM, or the DM/Player model. Work
through it in order. A feature is not complete until its behaviour,
documentation, tests, and visual media all describe the same thing.

Read the [root README](../README.md) for the project overview and
[AGENTS.md](../AGENTS.md) for the engineering rules. This guide explains how
to carry those rules out in practical, copy-and-pasteable steps.

## 1. Start the project

### What you need

- A current Node.js installation. Node 20 or later is recommended.
- npm, normally installed with Node.js.
- A terminal opened in the project root: the folder containing `package.json`.

### First-time setup

Run these commands once after cloning the repository, and again after a
dependency or Playwright version upgrade:

```sh
npm install
npx playwright install chromium
```

`npm install` downloads the project packages. The Playwright command downloads
the Chromium browser needed for automated browser tests and documentation
captures. The Chromium download can take a few minutes.

### Open the application locally

```sh
npm run dev
```

Vite prints a local address, usually `http://localhost:5173/`. Open that in a
browser for the DM view. Add `?mode=player` to the end of the address for a
Player display, for example `http://localhost:5173/?mode=player`.

Leave the development-server terminal running while manually checking a
feature. Press `Ctrl+C` there when finished. Do not run another server on the
same port; it can prevent Playwright from starting its own test server.

## 2. Define the feature before coding

Write one sentence from the user’s point of view. For example:

> A DM can place a public range ring on a locked grid, while a private
> measurement ruler never appears on the table.

This is the feature contract. It gives the implementation, documentation, and
tests a single shared target.

### Decide who sees what

| Kind | Meaning | Example |
| --- | --- | --- |
| DM-only | Player must never receive it. | Private roll, measurement ruler, edit controls. |
| Player-only | Local Player-display behaviour. | Display-only accessibility preference. |
| Shared | DM creates it; Player sees the intentional public result. | Published scene, public roll, status. |

For shared behaviour, list the exact public fields the Player needs. Never send
a larger private object “because it is easier.” The synchronization boundary is
maintained in [`public/js/core/channel.js`](../public/js/core/channel.js).

### Find a similar feature

```text
public/js/features/       feature state and behaviour
public/js/dm.js           DM application composition
public/js/player.js       Player application composition
public/styles/features/   feature CSS
src/components/           reusable HTML components
test/                     fast logic and safety tests
e2e/                      actual-browser tests
docs/knowledge-base/      end-user guides
e2e/docs-media/captures/  repeatable documentation captures
```

For an overlay, inspect fog, whiteboard, pointer, and effects before making a
new coordinate or synchronization pattern.

## 3. Implement safely

Build the smallest complete version: DM controls, Player result when shared,
and a safe default. Prefer a feature factory in `public/js/features/` and
compose it into `dm.js` or `player.js`; do not grow either root into one large
feature file.

Add JSDoc to factories, public methods, and non-obvious helpers. It should say
what goes in, what comes out, what is public, and how failure is handled:

```js
/**
 * Returns only range rings permitted on the Player display.
 * Private measurement data stays in the DM feature state.
 *
 * @param {RangeRing[]} rings Candidate range rings.
 * @returns {RangeRing[]} Serializable public rings.
 */
function publicRangeRings(rings) {
    return rings.filter((ring) => ring.visibility === 'public');
}
```

Use inline comments to explain a decision: a visibility rule, coordinate
conversion, timing choice, or browser workaround. Do not comment syntax that
is already clear from the code.

Before polishing the interface, confirm:

- DM can create, edit, and remove the state.
- Player sees the public result and cannot see private data.
- Empty, invalid, stale, or cancelled input is harmless.
- Scene data persists with the intended scene; session data does not reset accidentally.
- Resizable overlays use scene/normalized coordinates rather than device pixels.
- Rapid interactions use `requestAnimationFrame` batching and do not broadcast
  every raw pointer event.

## 4. Write the end-user documentation

Create or update the relevant file in [`docs/knowledge-base/`](knowledge-base/).
Write it for a DM, not a JavaScript reader. Explain:

1. What problem the tool solves.
2. What the DM does, in order.
3. What the Player sees.
4. What persists with a scene and what does not.
5. Limitations and useful table advice.

Write “Select **Publish to Table**,” not “set `publishedScene`.” Update the
root [README](../README.md) for a new user-facing capability. Update
[`docs/media-gallery.md`](media-gallery.md) when useful media is created.

## 5. Test at the correct layer

### Node tests: logic and failure paths

Add a `*.test.js` file under [`test/`](../test) for parsing, state changes,
geometry, persistence, serialization, and defensive error handling. Each
material behaviour normally needs:

1. A positive test proving the normal action works.
2. A negative test proving invalid, empty, stale, or malformed input is safe.
3. A boundary test for zero, maximum, first/last item, timer, or resize when relevant.

Run while developing:

```sh
npm test
```

Use automatic reruns while editing:

```sh
npm run test:watch
```

### Playwright: real browser and two-screen behaviour

Add an `e2e/` Playwright test when correctness depends on layout, canvas size,
focus, media, Alpine rendering, viewport ratio, or real DM-to-Player syncing.

```js
import { expect, test } from '@playwright/test';

test('DM publishes a public range ring to the Player', async ({ browser }) => {
    const context = await browser.newContext();
    const dm = await context.newPage();
    const player = await context.newPage();
    await dm.goto('/?mode=dm');
    await player.goto('/?mode=player');

    await dm.getByRole('button', { name: /add range ring/i }).click();
    await expect(player.locator('[data-range-ring]')).toBeVisible();
    await context.close();
});
```

Prefer `getByRole`, visible labels, and stable `data-*` hooks. Scope locators
to `#dmApp` or `#playerApp` where both roots exist. Run one test by title:

```sh
npx playwright test -g "publishes a public range ring"
```

On failure, open `test-results/<failed-test>/error-context.md` first. Replay a
browser trace with:

```sh
npx playwright show-trace test-results/<failed-test>/trace.zip
```

See [Testing Imperomancer](testing.md) for the full test and debugging guide.

## 6. Create reproducible screenshots and video

### Put files in the right folders

Source art for a capture belongs in:

```text
docs/media/resources/
```

Use a stable name such as `frozen-citadel.png`. PNG, JPEG, WebP, AVIF, GIF,
and SVG are supported. Do not use a remote URL, private campaign material, or
art you are not allowed to publish.

Generated output belongs in:

```text
docs/assets/media/
```

Never hand-create output there. A capture recipe must generate every committed
image or video so another contributor can recreate it.

### Add a recipe

1. Create `e2e/docs-media/captures/<feature-name>.js`.
2. Give it a stable ID, title, declared output filenames, and `run` function.
3. Register the export in [`e2e/docs-media/index.js`](../e2e/docs-media/index.js).
4. Link resulting assets from a knowledge-base guide and/or the media gallery.

Name output by viewer first:

```text
dm-range-ring-configuration.webp
player-range-ring-result.webp
dm-e2e-range-ring-01-configure.webm
player-e2e-range-ring-01-configure.webm
```

The registry enforces these rules: every filename starts `dm-` or `player-`,
uses lowercase kebab-case, is unique, and ends `.webp` or `.webm`.

Set an explicit viewport and `deviceScaleFactor: 1` in every recipe. Assert the
state before capturing. A video needs a readable before-state, one visible
action, and a readable result afterwards. Matched DM/Player videos need the
same number and order of numbered clips.

Use [Extending the documentation media pipeline](media/extending.md) for
complete recipe templates and helper descriptions.

### Choose the capture command

| You changed | Command |
| --- | --- |
| normal screenshots or short clips | `npm run docs:media` |
| only short motion clips | `npm run docs:media:motion` |
| complete long paired workflow | `npm run docs:media:e2e` |
| all numbered paired chapters | `npm run docs:media:playlists` |
| Scenes numbered chapters only | `npm run docs:media:steps` |
| one non-Scene numbered workflow | `DOCS_MEDIA_STEP_FEATURES=dice npm run docs:media:feature-steps` |

Capture commands overwrite named media. That is expected. Open every changed
WebP and WebM before committing. Check legibility, DM/Player viewpoint, no
private data, and enough lead-in and hold around actions.

## 7. Validate and hand off

After implementation, documentation, tests, and media are ready, run:

```sh
npm test
npm run test:e2e
npm run build
git diff --check
```

| Command | Success looks like | First response to failure |
| --- | --- | --- |
| `npm test` | all tests pass | Fix the first assertion failure. |
| `npm run test:e2e` | every Playwright test passes | Inspect error context, screenshot, then trace. |
| `npm run build` | Vite finishes with `built in …` | Treat errors as blockers; review warnings. |
| `git diff --check` | no output | Remove reported whitespace problems. |

Run `git status --short` afterwards. The change should include implementation,
relevant docs, tests, and named generated media together. Do not commit
`test-results/`, traces, opaque `page@…` recordings, or unrelated worktree
changes.

For a display-affecting change, manually open DM and Player views at the
expected sizes. Check portrait and landscape framing, readable text, keyboard
access, and—most importantly—that the Player sees only the public result.

## Copy-and-paste handoff checklist

```md
- [ ] Wrote the user-facing contract and decided DM/private/public visibility.
- [ ] Added implementation and JSDoc for public or non-obvious contracts.
- [ ] Confirmed private information is not sent to Player.
- [ ] Updated end-user documentation and README where needed.
- [ ] Added Node success, failure, and boundary tests.
- [ ] Added Playwright coverage where browser/layout/sync behaviour matters.
- [ ] Added registered, reproducible WebP/WebM media when visual explanation helps.
- [ ] Reviewed generated media and linked it from a guide or gallery.
- [ ] Ran `npm test`, `npm run test:e2e`, `npm run build`, and `git diff --check`.
- [ ] Manually checked DM and Player views for presentation-affecting changes.
```

## Quick recovery table

| Problem | First thing to do |
| --- | --- |
| npm cannot find a package | Run `npm install` in the project root. |
| Playwright cannot find Chromium | Run `npx playwright install chromium`. |
| Vite cannot start for a browser test | Stop an existing dev server, then rerun the test. |
| A capture is skipped | Use an `npm run docs:media…` command. |
| A media filename is rejected | Check prefix, lowercase kebab-case, extension, and recipe declaration. |
| A video is empty or missing | Close its page and browser context before saving the video. |
| Player result is wrong | Inspect `public/js/core/channel.js`, then add a Player-facing test. |
| A Playwright test leaves artifacts | Read `error-context.md`, then open the trace. |

When uncertain, make the smallest safe change, test it at the layer where it
actually runs, and record the outcome in the relevant documentation.
