# Imperomancer engineering standards

These instructions define the expected delivery standard for human and AI contributors. They apply in addition to higher-priority platform, repository, and user instructions.

## Core principle

Build features that make live tabletop play clearer and calmer. Prefer predictable, accessible, testable behavior over cleverness. The DM controls private preparation; the Player display presents intentional shared information.

## Required work for every feature or behavior change

### Understand the affected boundary

Before editing, identify whether the change affects DM-only, Player-only, or synchronized state; prepared-scene or session-level data; source-scene, player-stage, or physical-display coordinates; accessibility; or an external integration.

Do not transmit private state to the Player simply because it is convenient. Preserve the serialization allowlist in `public/js/core/channel.js` and filter visibility-aware data at the synchronization boundary.

### Document it properly

Every material feature needs both forms of documentation where applicable:

1. **Maintenance documentation**: JSDoc for public factories, functions, parameters, return values, non-obvious invariants, synchronization rules, and failure handling.
2. **End-user documentation**: update or create a guide in `docs/knowledge-base/` explaining purpose, workflow, player-visible behavior, limitations, and practical table advice.

Update the root `README.md` when a user-facing capability is introduced or substantially changed. Update `docs/media-gallery.md` if the feature has a useful visual demonstration. Use clear, task-focused language; do not expose implementation jargon to end users unless it supports an operational decision.

### Test positive, negative, and boundary paths

Add tests in proportion to the change risk.

- Add or update **Node tests** under `test/` for state changes, parsing, geometry, serialization, fallbacks, limits, persistence, and defensive error handling.
- Add or update **Playwright tests** under `e2e/` when the result depends on DOM layout, Alpine reactivity, media loading, canvas size, browser APIs, focus, viewport ratio, or DM-to-Player synchronization.
- Test at least one success case and one safe failure case. Include boundary values for empty inputs, zero/invalid sizes, first/last list entries, stale revisions, failed media, timers, or reconnects when relevant.
- For DM/Player features, test whether the Player sees the correct public result and does **not** see private data.

Use `test/helpers/browser.js` for fast classic-browser-script tests. Normalize VM-created values with `plain()` before strict deep comparison. Use Playwright for actual rendering; do not try to prove CSS clipping or cross-tab browser behavior with VM mocks. Read [the testing guide](docs/testing.md) before designing a new test layer.

### Keep performance and maintainability in balance

- Prefer `requestAnimationFrame` batching for canvas drawing and rapid visual updates.
- Throttle cross-window view synchronization; do not broadcast every pointer move without back-pressure or a justified rate limit.
- Store overlays in scene or normalized coordinates, not device pixels, so they survive resize and differing display resolutions.
- Reuse feature factories and shared helpers instead of duplicating state logic in DM and Player roots.
- Keep external-library wrappers small. Do not modify vendor-minified files unless explicitly requested.
- Use descriptive names and concise comments to explain *why*, especially around coordinates, timing, visibility, and fallbacks.

Performance improvements must not obscure ownership, testability, accessibility, or synchronization correctness. Reproduce or measure a bottleneck before introducing complexity.

### Preserve JSDoc quality

Use JSDoc on externally consumed globals, feature factories, public methods, and helpers with non-trivial contracts. Include `@param`, `@returns`, and useful object shapes. Inline comments should explain a decision, invariant, or browser/library workaround—not restate obvious syntax.

### Validate before handoff

Run the relevant new test first, then run `npm test`, `npm run test:e2e`, `npm run build`, and `git diff --check`. If browser tests require initial setup, document `npx playwright install chromium`. Report commands run and relevant non-failing build warnings. Never claim a check passed unless it ran for the current change.

For a meaningful visual change, run `npm run docs:media`, then review the result before committing it.

## Documentation media procedure

Documentation imagery is reproducible product output, not an ad-hoc screenshot collection.

- Put deterministic source fixtures in `docs/media/resources/` using descriptive, stable filenames.
- Add one focused recipe in `e2e/docs-media/captures/`, then register it in `e2e/docs-media/index.js`; keep `e2e/docs-media.spec.js` as the generic harness.
- Write generated WebP and WebM assets to `docs/assets/media/` with stable, human-readable filenames.
- Do not check in Playwright failure artifacts (`test-results/`, traces, or reports).
- Link generated assets from a guide or `docs/media-gallery.md`; do not leave orphaned media files.
- Review every regenerated image/video for legibility, privacy, correct viewport composition, and current UI text before committing.

## Change scope and safety

- Preserve user changes in a dirty worktree. Do not rewrite unrelated files.
- Avoid destructive Git or filesystem operations unless explicitly requested and the exact target is known.
- Treat user content, campaign media, private layer data, and browser storage as sensitive session data.
- Prefer reversible changes and explicit migration handling for local-storage schema updates.

## Definition of done

A feature is complete only when its implementation, relevant JSDoc, end-user guidance, tests, and validation all agree with the same user-visible behavior. A partial implementation, untested UI path, or undocumented synchronized behavior is not done.
