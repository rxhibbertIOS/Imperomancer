import { createScenarioSession, scenarioViewport } from './scenario-session.js';

/** Shared canvas for matched DM/Player videos intended to play side by side. */
export const pairedWorkflowViewport = scenarioViewport;

/** Holds before/after states long enough for readers to understand a workflow. */
export const workflowPacing = Object.freeze({ before: 700, action: 650, after: 900 });

/**
 * Opens a recorded ScenarioSession with both standard fixtures prepared and one
 * initial scene published. New recipes should prefer `createScenarioSession`
 * directly; this compatibility helper keeps existing recipes concise.
 *
 * @param {import('@playwright/test').Browser} browser Playwright browser.
 * @param {'Arcane_Cathedral.png'|'Dwarven_Forge.png'} [fixture='Dwarven_Forge.png'] Initial scene fixture.
 * @returns {Promise<import('./scenario-session.js').ScenarioSession & {arcane: string, forge: string}>} Ready recorded session.
 */
export async function openPairedWorkflow(browser, fixture = 'Dwarven_Forge.png') {
    const session = await createScenarioSession(browser).instantiate();
    const arcane = await session.prepareScene('Arcane Cathedral', 'Arcane_Cathedral.png');
    const forge = await session.prepareScene('Dwarven Forge', 'Dwarven_Forge.png');
    const initial = fixture === 'Arcane_Cathedral.png' ? arcane : forge;
    await session.publishScene(initial.name, 'cut');
    return Object.assign(session, { arcane: arcane.source, forge: forge.source });
}

/**
 * Applies a visible DM state patch and broadcasts it through the real channel.
 * Kept for existing capture modules; new recipes should call `session.patchDmState`.
 *
 * @param {import('@playwright/test').Page} dm DM page.
 * @param {Record<string, unknown>} patch State changes.
 * @returns {Promise<void>}
 */
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

/** Waits on both paired recordings so visible actions remain time-aligned. @param {import('@playwright/test').Page} dm DM page. @param {import('@playwright/test').Page} player Player page. @param {number} milliseconds Duration to hold. @returns {Promise<void>} */
export async function holdPaired(dm, player, milliseconds) {
    await Promise.all([dm.waitForTimeout(milliseconds), player.waitForTimeout(milliseconds)]);
}

/** Finalizes both recordings under stable names. @param {import('./scenario-session.js').ScenarioSession} session Paired scenario session. @param {string} dmFilename DM output filename. @param {string} playerFilename Player output filename. @returns {Promise<void>} */
export async function savePairedWorkflow(session, dmFilename, playerFilename) {
    await session.saveRecording(dmFilename, playerFilename);
}
