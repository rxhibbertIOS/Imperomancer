import { expect } from '@playwright/test';
import { imageFixtureDataUrl, mountPlayerScene, outputDirectory, saveRecordedVideo } from '../helpers.js';
import { playerViewport } from '../capture-utils.js';

// Every clip pauses on an intelligible state before and after the action so
// embedded players never cut off the context or the resulting information.
const PRE_ACTION_MS = 700;
const POST_ACTION_MS = 900;

/** Opens a recorded Player/table page with a deterministic fixture mounted. @param {import('@playwright/test').Browser} browser @param {'Arcane_Cathedral.png'|'Dwarven_Forge.png'} fixture @returns {Promise<{context: import('@playwright/test').BrowserContext, page: import('@playwright/test').Page}>} */
async function openRecordedTable(browser, fixture = 'Arcane_Cathedral.png') {
    const context = await browser.newContext({
        viewport: playerViewport,
        recordVideo: { dir: outputDirectory, size: playerViewport },
    });
    const page = await context.newPage();
    await page.goto('/?mode=player');
    await expect(page.locator('#playerApp')).toBeVisible();
    await mountPlayerScene(page, await imageFixtureDataUrl(fixture));
    return { context, page };
}

/** Finalizes and saves a recorded clip under its stable documentation filename. @param {import('@playwright/test').BrowserContext} context @param {import('@playwright/test').Page} page @param {string} filename @returns {Promise<void>} */
async function saveMotion(context, page, filename) {
    const video = page.video();
    await page.close();
    await context.close();
    await saveRecordedVideo(video, filename);
}

/** Applies a serializable Player state update and gives canvas/Alpine rendering two frames. @param {import('@playwright/test').Page} page @param {Record<string, unknown>} patch @returns {Promise<void>} */
async function updateTable(page, patch) {
    await page.evaluate(async ({ patch: statePatch }) => {
        const state = Alpine.$data(document.querySelector('#playerApp'));
        Object.assign(state, statePatch);
        await new Promise(resolve => state.$nextTick(resolve));
        state.drawGrid?.(); state.drawFog?.(); state.drawWhiteboard?.();
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }, { patch });
}

/** Captures dynamic table-facing documentation clips. @type {import('../index.js').DocumentationCapture} */
export const motionCapture = {
    id: 'motion',
    title: 'captures scene, fog, whiteboard, pointer, initiative, dice, and status motion clips',
    assets: ['player-scene-fade-transition.webm', 'player-fog-reapply.webm', 'player-whiteboard-drawing.webm', 'player-focus-pointer.webm', 'player-initiative-turn.webm', 'player-dice-public-roll.webm', 'player-status-announcement.webm'],
    async run({ browser }) {
        {
            const { context, page } = await openRecordedTable(browser, 'Dwarven_Forge.png');
            await page.waitForTimeout(PRE_ACTION_MS);
            const destination = await imageFixtureDataUrl('Arcane_Cathedral.png');
            await page.evaluate(async ({ source }) => {
                const state = Alpine.$data(document.querySelector('#playerApp'));
                state._onSync({
                    revision: 1,
                    scenePublished: true,
                    transition: 'fade',
                    currentImage: source,
                    mediaType: 'image',
                    view: { ...state.view },
                    gridVisible: true,
                    gridType: 'square',
                    scenePxPerCell: 100,
                    fogEnabled: true,
                    fogStrokes: [{ mode: 'reveal', shape: 'round', size: 3, x: 850, y: 470 }],
                    whiteboardActive: false,
                    whiteboardStrokes: [],
                    combatants: [],
                    edges: {},
                });
            }, { source: destination });
            await page.waitForTimeout(POST_ACTION_MS);
            await saveMotion(context, page, 'player-scene-fade-transition.webm');
        }
        {
            const { context, page } = await openRecordedTable(browser, 'Dwarven_Forge.png');
            await updateTable(page, { fogEnabled: true, fogStrokes: [{ mode: 'reveal', shape: 'round', size: 3, x: 650, y: 430 }] });
            await page.waitForTimeout(PRE_ACTION_MS);
            await updateTable(page, { fogStrokes: [] });
            await page.waitForTimeout(POST_ACTION_MS);
            await updateTable(page, { fogStrokes: [{ mode: 'reveal', shape: 'round', size: 3, x: 1120, y: 480 }] });
            await page.waitForTimeout(POST_ACTION_MS);
            await saveMotion(context, page, 'player-fog-reapply.webm');
        }
        {
            const { context, page } = await openRecordedTable(browser);
            await updateTable(page, { whiteboardActive: true, whiteboardStrokes: [] });
            await page.waitForTimeout(PRE_ACTION_MS);
            await updateTable(page, { whiteboardStrokes: [{ tool: 'highlighter', color: '#eab308', size: 42, points: [{ x: .12, y: .18 }, { x: .75, y: .18 }] }] });
            await page.waitForTimeout(500);
            await updateTable(page, { whiteboardStrokes: [
                { tool: 'highlighter', color: '#eab308', size: 42, points: [{ x: .12, y: .18 }, { x: .75, y: .18 }] },
                { tool: 'arrow', color: '#3b82f6', size: 13, points: [{ x: .18, y: .38 }, { x: .7, y: .62 }] },
            ] });
            await page.waitForTimeout(POST_ACTION_MS);
            await saveMotion(context, page, 'player-whiteboard-drawing.webm');
        }
        {
            const { context, page } = await openRecordedTable(browser);
            await page.waitForTimeout(PRE_ACTION_MS);
            await updateTable(page, { focusPings: [{ id: 'motion-ping', sceneX: 850, sceneY: 470, color: '#ffcc00', createdAt: Date.now() }] });
            await page.waitForTimeout(POST_ACTION_MS);
            await saveMotion(context, page, 'player-focus-pointer.webm');
        }
        {
            const { context, page } = await openRecordedTable(browser);
            const combatants = [
                { id: 'aria', name: 'Aria Vale', initiative: 22, isPlayer: true, isDead: false },
                { id: 'guard', name: 'Forge Guard', initiative: 18, isPlayer: false, isDead: false },
                { id: 'wraith', name: 'Mire Wraith', initiative: 14, isPlayer: false, isDead: false },
            ];
            await updateTable(page, { combatants, currentTurn: 0, round: 2, showInitiative: true });
            await page.waitForTimeout(PRE_ACTION_MS);
            await updateTable(page, { combatants, currentTurn: 1, round: 2, showInitiative: true });
            await page.waitForTimeout(POST_ACTION_MS);
            await saveMotion(context, page, 'player-initiative-turn.webm');
        }
        {
            const { context, page } = await openRecordedTable(browser);
            await page.waitForTimeout(PRE_ACTION_MS);
            await updateTable(page, {
                lastResult: { tag: 'Public Roll', notation: '4d6kh3+2', total: 17, breakdown: '6 + 5 + 4 + 2 = 17', diceResults: [{ value: 6 }, { value: 5 }, { value: 4 }], message: 'Arcane blast', critical: false, fail: false },
                showResultModal: true,
            });
            await page.waitForTimeout(POST_ACTION_MS);
            await saveMotion(context, page, 'player-dice-public-roll.webm');
        }
        {
            const { context, page } = await openRecordedTable(browser);
            await page.waitForTimeout(PRE_ACTION_MS);
            await updateTable(page, { statusText: '⚔️ COMBAT START!', statusVisible: true });
            await page.waitForTimeout(POST_ACTION_MS);
            await saveMotion(context, page, 'player-status-announcement.webm');
        }
    },
};
