import { expect } from '@playwright/test';
import { documentationAssetPath, imageFixtureDataUrl, mountDmScene, mountPlayerScene } from './helpers.js';

/** Standard desktop viewport used for DM control documentation. */
export const dmViewport = Object.freeze({ width: 1440, height: 1000 });

/** Standard landscape viewport used for Player/table documentation. */
export const playerViewport = Object.freeze({ width: 1200, height: 900 });

/**
 * Opens a fresh DM browser page with the Arcane Cathedral image prepared on the stage.
 *
 * @param {import('@playwright/test').Browser} browser - Playwright browser supplied by a recipe.
 * @returns {Promise<{context: import('@playwright/test').BrowserContext, page: import('@playwright/test').Page, source: string}>}
 */
export async function openPreparedDm(browser) {
    const context = await browser.newContext({ viewport: dmViewport, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await page.goto('/?mode=dm');
    await expect(page.locator('#dmApp')).toBeVisible();
    const source = await imageFixtureDataUrl('Arcane_Cathedral.png');
    await mountDmScene(page, source);
    return { context, page, source };
}

/**
 * Opens a fresh Player/table browser page with the requested fixture fitted to the stage.
 *
 * @param {import('@playwright/test').Browser} browser - Playwright browser supplied by a recipe.
 * @param {'Arcane_Cathedral.png'|'Dwarven_Forge.png'} [fixture='Arcane_Cathedral.png'] - Fixture to display.
 * @returns {Promise<{context: import('@playwright/test').BrowserContext, page: import('@playwright/test').Page, source: string}>}
 */
export async function openPreparedPlayer(browser, fixture = 'Arcane_Cathedral.png') {
    const context = await browser.newContext({ viewport: playerViewport, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await page.goto('/?mode=player');
    await expect(page.locator('#playerApp')).toBeVisible();
    const source = await imageFixtureDataUrl(fixture);
    await mountPlayerScene(page, source);
    return { context, page, source };
}

/**
 * Opens a named DM control card and waits for Alpine and CSS-layout work to settle.
 *
 * @param {import('@playwright/test').Page} page - DM page.
 * @param {string} card - Internal card name, such as `grid` or `initiative`.
 * @returns {Promise<void>}
 */
export async function openDmCard(page, card) {
    await page.evaluate(async ({ card: cardName }) => {
        const state = Alpine.$data(document.querySelector('#dmApp'));
        state.openCard = cardName;
        await new Promise(resolve => state.$nextTick(resolve));
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }, { card });
}

/**
 * Applies a serializable state patch to a DM page and redraws the relevant canvas layers.
 * Only documentation recipes should use this: it establishes a user-reachable state deterministically.
 *
 * @param {import('@playwright/test').Page} page - DM page.
 * @param {Record<string, unknown>} patch - State values to apply.
 * @returns {Promise<void>}
 */
export async function patchDmState(page, patch) {
    await page.evaluate(async ({ patch: statePatch }) => {
        const state = Alpine.$data(document.querySelector('#dmApp'));
        Object.assign(state, statePatch);
        await new Promise(resolve => state.$nextTick(resolve));
        state.drawGrid?.();
        state.drawFog?.();
        state.drawWhiteboard?.();
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }, { patch });
}

/**
 * Applies a serializable state patch to a Player page and redraws its rendered layers.
 *
 * @param {import('@playwright/test').Page} page - Player page.
 * @param {Record<string, unknown>} patch - State values to apply.
 * @returns {Promise<void>}
 */
export async function patchPlayerState(page, patch) {
    await page.evaluate(async ({ patch: statePatch }) => {
        const state = Alpine.$data(document.querySelector('#playerApp'));
        Object.assign(state, statePatch);
        await new Promise(resolve => state.$nextTick(resolve));
        state.drawGrid?.();
        state.drawFog?.();
        state.drawWhiteboard?.();
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }, { patch });
}

/**
 * Captures a complete documentation screenshot with the repository's stable output format.
 *
 * @param {import('@playwright/test').Page} page - Rendered page to capture.
 * @param {string} filename - Registered WebP output name.
 * @returns {Promise<void>}
 */
export async function captureWebp(page, filename) {
    // Panels such as the full-stage whiteboard and Chronicle deliberately fade in.
    // Capturing after that brief transition keeps committed reference images stable and legible.
    await page.waitForTimeout(220);
    await page.screenshot({ path: documentationAssetPath(filename), type: 'webp', quality: 86 });
}

/**
 * Makes Chronicle timestamps stable enough for useful visual diffs across documentation regenerations.
 *
 * @param {import('@playwright/test').Page} page - DM page hosting the Chronicle.
 * @returns {Promise<void>}
 */
export async function freezeChronicleTime(page) {
    await page.evaluate(() => {
        Date.prototype.toLocaleTimeString = () => '20:14:03';
    });
}
