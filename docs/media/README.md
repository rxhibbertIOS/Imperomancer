# Documentation media pipeline

This directory defines reproducible inputs for documentation imagery and video. It keeps screenshots and clips consistent with the current application rather than relying on manually captured browser windows.

## Source resources

[`resources/`](resources/) contains named, deterministic fixtures used by the capture suite. Do not replace a resource silently: a renamed or materially changed fixture changes the visual contract of every image that uses it.

| File | Purpose |
| --- | --- |
| [`portrait-ruins.svg`](resources/portrait-ruins.svg) | Portrait scene fixture for player-fit, fog, and table-display media. |

SVG is intentional: it is versionable, quick to load, has a known natural size, and avoids copyright or campaign-specific art in the repository.

## Generated assets

The capture command writes these named assets to [`../assets/media/`](../assets/media/):

| File | Format | Use |
| --- | --- | --- |
| `dm-scene-control.webp` | WebP | DM scene-management overview. |
| `player-portrait-table.webp` | WebP | Player/table view with a portrait map. |
| `fog-reveal.webm` | WebM | Short before/after fog-reveal demonstration. |

These filenames are stable so Markdown pages, website content, and future publishing tooling can link to them without finding an opaque timestamped artifact.

## Generate or refresh media

Install dependencies and Playwright Chromium once:

```sh
npm install
npx playwright install chromium
```

Then run:

```sh
npm run docs:media
```

The command starts a local Vite server, runs only the tagged documentation-media tests, and overwrites the named files above. Review each updated asset before committing it: generated media is product documentation, not a disposable test artifact.

## Use assets in Markdown

Reference a screenshot with normal Markdown:

```md
![Player display showing a portrait scene](../assets/media/player-portrait-table.webp)
```

Use HTML video for WebM because standard Markdown has no portable video syntax:

```html
<video controls loop muted playsinline>
  <source src="../assets/media/fog-reveal.webm" type="video/webm">
  Your browser does not support embedded video.
</video>
```

The companion [media gallery](../media-gallery.md) is a working reference for these paths.

## Architecture and file locations

The pipeline deliberately separates inputs, output, reusable code, and feature-specific code:

```text
docs/media/resources/             deterministic, publishable source fixtures
docs/assets/media/                committed WebP and WebM output files
e2e/docs-media.spec.js            generic tagged Playwright harness
e2e/docs-media/helpers.js         shared fixture, mounting, path, and video helpers
e2e/docs-media/index.js           explicit capture registry and validation
e2e/docs-media/captures/          one focused recipe module per feature/story
docs/media/extending.md           detailed recipe authoring guide
```

[`e2e/docs-media.spec.js`](../../e2e/docs-media.spec.js) never contains feature-specific behavior. It validates the registry, creates a serial Playwright test for each registered recipe, and stays disabled unless `CAPTURE_DOCS_MEDIA=true`. The `docs:media` npm script supplies that variable; ordinary `npm run test:e2e` runs safely without overwriting committed documentation assets.

Each recipe owns its complete list of output filenames. The registry rejects duplicate IDs, duplicate filenames, malformed IDs, and any output name that is not lowercase kebab-case WebP/WebM before Playwright opens a browser. Stable output names are part of the documentation API: Markdown, a future website, and publishing tooling can safely link to them.

## Adding a feature capture

The extension workflow is intentionally small:

1. Put a fixed, safe-to-publish fixture in [`resources/`](resources/) when the capture needs one. Prefer versionable SVG or small data fixtures over external URLs, campaign content, or random media.
2. Create one recipe in [`e2e/docs-media/captures/`](../../e2e/docs-media/captures/). It declares an ID, title, output names, and an async `run` method.
3. Import and register the recipe in [`e2e/docs-media/index.js`](../../e2e/docs-media/index.js).
4. Reference the named output from an appropriate knowledge-base page and/or [media gallery](../media-gallery.md).
5. Run `npm run docs:media`, visually inspect every changed asset, then run the normal regression checks.

Use a fresh browser context with an explicit viewport and `deviceScaleFactor: 1` in every recipe. Assert that the intended state is visible before capturing. Keep each recipe to one feature and one teaching objective; use separate DM and Player assets when that explains the workflow more clearly.

For the exact recipe contract, WebP and WebM templates, shared-helper reference, output naming rules, review checklist, and troubleshooting, read [Extending the documentation media pipeline](extending.md).

## Contributor safeguards

- Never create output files by hand; a registered recipe must own them.
- Never capture private campaign data, account information, local paths, unlicensed art, remote-site content, or random/time-dependent state.
- Keep videos brief, deliberate, and focused on one visible action. Use WebP for a stable state and WebM only when motion explains the feature.
- Do not add one-off logic to `docs-media.spec.js`; use a focused capture module, and promote logic to `helpers.js` only when it is genuinely reusable.
- Review composition, legibility, current UI labels, Player/DM visibility boundaries, and documentation links before committing.
