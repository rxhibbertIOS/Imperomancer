import { expect } from '@playwright/test';
import { imageFixtureDataUrl, mountDmScene, outputDirectory, saveRecordedVideo } from './helpers.js';

/** Shared canvas for matched DM/Player videos intended to play side by side. */
export const pairedWorkflowViewport = Object.freeze({ width: 1280, height: 720 });

/** Holds before/after states long enough for readers to understand a workflow. */
export const workflowPacing = Object.freeze({ before: 700, action: 650, after: 900 });

/**
 * Opens a synchronized, simultaneously recorded DM/Player session with a
 * publishable initial scene. Both pages use one BrowserContext so the product's
 * actual BroadcastChannel transport drives the Player recording.
 *
 * @param {import('@playwright/test').Browser} browser Playwright browser.
 * @param {'Arcane_Cathedral.png'|'Dwarven_Forge.png'} [fixture='Dwarven_Forge.png'] Initial scene fixture.
 * @returns {Promise<{context: import('@playwright/test').BrowserContext, dm: import('@playwright/test').Page, player: import('@playwright/test').Page, arcane: string, forge: string}>} Recorded paired session.
 */
export async function openPairedWorkflow(browser, fixture = 'Dwarven_Forge.png') {
    const context = await browser.newContext({
        viewport: pairedWorkflowViewport,
        recordVideo: { dir: outputDirectory, size: pairedWorkflowViewport },
    });
    const dm = await context.newPage();
    const player = await context.newPage();
    await Promise.all([
        dm.goto('http://127.0.0.1:4173/?mode=dm'),
        player.goto('http://127.0.0.1:4173/?mode=player'),
    ]);
    await expect(dm.locator('#dmApp')).toBeVisible();
    await expect(player.locator('#playerApp')).toBeVisible();

    const [arcane, forge] = await Promise.all([
        imageFixtureDataUrl('Arcane_Cathedral.png'),
        imageFixtureDataUrl('Dwarven_Forge.png'),
    ]);
    await mountDmScene(dm, fixture === 'Arcane_Cathedral.png' ? arcane : forge);
    await dm.evaluate(() => {
        const state = Alpine.$data(document.querySelector('#dmApp'));
        state.publishTransition = 'cut';
        state.publishSelectedScene();
    });
    await expect.poll(() => player.evaluate(() => Alpine.$data(document.querySelector('#playerApp')).currentImage)).toBe(fixture === 'Arcane_Cathedral.png' ? arcane : forge);
    return { context, dm, player, arcane, forge };
}

/** Applies a visible DM state patch and broadcasts it through the real channel. @param {import('@playwright/test').Page} dm DM page. @param {Record<string, unknown>} patch State changes. @returns {Promise<void>} */
export async function updateDmAndSync(dm, patch) {
    await dm.evaluate(async ({ changes }) => {
        const state = Alpine.$data(document.querySelector('#dmApp'));
        Object.assign(state, changes);
        await new Promise(resolve => state.$nextTick(resolve));
        state.drawGrid?.(); state.drawFog?.(); state.drawWhiteboard?.();
        window.syncState(state);
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }, { changes: patch });
}

/** Opens one DM control card without depending on its accordion animation. @param {import('@playwright/test').Page} dm DM page. @param {string} card Feature card identifier. @returns {Promise<void>} */
export async function showDmCard(dm, card) {
    await dm.evaluate(async ({ cardName }) => {
        const state = Alpine.$data(document.querySelector('#dmApp'));
        state.openCard = cardName;
        await new Promise(resolve => state.$nextTick(resolve));
    }, { cardName: card });
}

/** Waits on both paired recordings so the visible actions remain time-aligned. @param {import('@playwright/test').Page} dm DM page. @param {import('@playwright/test').Page} player Player page. @param {number} milliseconds Duration to hold. @returns {Promise<void>} */
export async function holdPaired(dm, player, milliseconds) {
    await Promise.all([dm.waitForTimeout(milliseconds), player.waitForTimeout(milliseconds)]);
}

/** Finalizes both recordings at nearly the same instant and writes stable names. @param {{context: import('@playwright/test').BrowserContext,dm: import('@playwright/test').Page,player: import('@playwright/test').Page}} session Paired session. @param {string} dmFilename DM output filename. @param {string} playerFilename Player output filename. @returns {Promise<void>} */
export async function savePairedWorkflow(session, dmFilename, playerFilename) {
    const dmVideo = session.dm.video();
    const playerVideo = session.player.video();
    await session.context.close();
    await Promise.all([
        saveRecordedVideo(dmVideo, dmFilename),
        saveRecordedVideo(playerVideo, playerFilename),
    ]);
}
