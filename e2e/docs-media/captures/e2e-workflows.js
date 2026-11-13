import { holdPaired, openPairedWorkflow, savePairedWorkflow, showDmCard, updateDmAndSync, workflowPacing } from '../paired-workflows.js';

const combatants = [
    { id: 'lyra', name: 'Lyra Dawnwhisper', initiative: 21, bonus: 4, isPlayer: true, isDead: false },
    { id: 'ogre', name: 'Ogre Brute', initiative: 17, bonus: 1, isPlayer: false, isDead: false },
    { id: 'wraith', name: 'Mire Wraith', initiative: 14, bonus: 3, isPlayer: false, isDead: false },
    { id: 'kobold', name: 'Kobold Hexer', initiative: 9, bonus: 2, isPlayer: false, isDead: false },
];

/** Runs a deterministic, paired DM/Player end-to-end story. @param {import('@playwright/test').Browser} browser Browser. @param {string} id Workflow identifier. @param {(session: Awaited<ReturnType<typeof openPairedWorkflow>>) => Promise<void>} play Scenario actions. @returns {Promise<void>} */
async function recordWorkflow(browser, id, play) {
    const session = await openPairedWorkflow(browser);
    await holdPaired(session.dm, session.player, workflowPacing.before);
    await play(session);
    await holdPaired(session.dm, session.player, workflowPacing.after);
    await savePairedWorkflow(session, `dm-e2e-${id}.webm`, `player-e2e-${id}.webm`);
}

/** Long-form synchronized recordings for the core DM-to-Player workflows. @type {import('../index.js').DocumentationCapture} */
export const e2eWorkflowsCapture = {
    id: 'e2e-workflows',
    title: 'captures synchronized DM and Player end-to-end workflow recordings',
    assets: ['dm-e2e-scenes.webm', 'player-e2e-scenes.webm', 'dm-e2e-dice.webm', 'player-e2e-dice.webm', 'dm-e2e-fog.webm', 'player-e2e-fog.webm', 'dm-e2e-grid.webm', 'player-e2e-grid.webm', 'dm-e2e-whiteboard.webm', 'player-e2e-whiteboard.webm', 'dm-e2e-initiative.webm', 'player-e2e-initiative.webm', 'dm-e2e-pointer.webm', 'player-e2e-pointer.webm', 'dm-e2e-status.webm', 'player-e2e-status.webm', 'dm-e2e-shapes.webm', 'player-e2e-shapes.webm'],
    async run({ browser }) {
        const requested = new Set((process.env.DOCS_MEDIA_WORKFLOWS || 'all').split(','));
        const shouldRecord = id => requested.has('all') || requested.has(id);
        if (shouldRecord('scenes')) await recordWorkflow(browser, 'scenes', async ({ dm, player, arcane }) => {
            await showDmCard(dm, 'scene');
            await holdPaired(dm, player, workflowPacing.action);
            await dm.evaluate(async ({ source }) => {
                const state = Alpine.$data(document.querySelector('#dmApp'));
                state.currentImage = source; state.mediaType = 'image'; state.sceneMediaSource = 'e2e-scene-2'; state.sceneNameDraft = 'Arcane Cathedral'; state.publishTransition = 'fade';
                await new Promise(resolve => state.$nextTick(resolve));
                const image = document.querySelector('#dmApp [data-grid-scene]');
                if (!image.complete) await new Promise(resolve => image.addEventListener('load', resolve, { once: true }));
                state.onSceneMediaReady({ currentTarget: image }); state.publishSelectedScene();
            }, { source: arcane });
            await holdPaired(dm, player, 1800);
        });

        if (shouldRecord('fog')) await recordWorkflow(browser, 'fog', async ({ dm, player }) => {
            await showDmCard(dm, 'fog');
            await updateDmAndSync(dm, { fogEnabled: true, fogEditing: true, fogTool: 'reveal', fogBrush: 'round', fogBrushCells: 5, fogStrokes: [] });
            await holdPaired(dm, player, workflowPacing.action);
            await updateDmAndSync(dm, { fogStrokes: [{ mode: 'reveal', shape: 'round', size: 5, x: 260, y: 380 }, { mode: 'reveal', shape: 'round', size: 5, x: 480, y: 480 }] });
            await holdPaired(dm, player, workflowPacing.action);
            await updateDmAndSync(dm, { fogTool: 'paint', fogStrokes: [{ mode: 'paint', shape: 'round', size: 5, x: 260, y: 380 }, { mode: 'paint', shape: 'round', size: 5, x: 480, y: 480 }] });
        });

        if (shouldRecord('grid')) await recordWorkflow(browser, 'grid', async ({ dm, player }) => {
            await showDmCard(dm, 'grid');
            await updateDmAndSync(dm, { gridVisible: true, gridType: 'hex-pointy', scenePxPerCell: 18, gridCellsAcross: 100 });
            await holdPaired(dm, player, workflowPacing.action);
            await updateDmAndSync(dm, { locked: true, tablePpi: 40 });
        });

        if (shouldRecord('whiteboard')) await recordWorkflow(browser, 'whiteboard', async ({ dm, player }) => {
            await showDmCard(dm, 'whiteboard');
            await dm.evaluate(() => Alpine.$data(document.querySelector('#dmApp')).setWhiteboardActive(true));
            await holdPaired(dm, player, workflowPacing.action);
            await updateDmAndSync(dm, { whiteboardStrokes: [{ tool: 'arrow', color: '#3b82f6', size: 10, points: [{ x: .15, y: .2 }, { x: .68, y: .62 }] }, { tool: 'ellipse', color: '#ef4444', size: 9, points: [{ x: .58, y: .3 }, { x: .8, y: .6 }] }] });
            await holdPaired(dm, player, workflowPacing.action);
            await dm.evaluate(() => Alpine.$data(document.querySelector('#dmApp')).setWhiteboardActive(false));
            await holdPaired(dm, player, workflowPacing.action);
            await dm.evaluate(() => { const s = Alpine.$data(document.querySelector('#dmApp')); s.setWhiteboardActive(true); s.clearWhiteboard(); s.setWhiteboardActive(false); });
        });

        if (shouldRecord('initiative')) await recordWorkflow(browser, 'initiative', async ({ dm, player }) => {
            await showDmCard(dm, 'initiative');
            await updateDmAndSync(dm, { gridVisible: true, locked: true, scenePxPerCell: 100, initiativeRows: combatants, combatants, initiativeActive: true, currentTurn: 0, round: 1, showInitiative: true });
            await holdPaired(dm, player, workflowPacing.action);
            await dm.evaluate(() => { const s = Alpine.$data(document.querySelector('#dmApp')); s.toggleCollapse(); s.nextTurn(); });
            await holdPaired(dm, player, workflowPacing.action);
            await dm.evaluate(() => { const s = Alpine.$data(document.querySelector('#dmApp')); s.toggleDead(s.combatants[s.currentTurn].id); s.nextTurn(); s.exitInitiative(); });
        });

        if (shouldRecord('pointer')) await recordWorkflow(browser, 'pointer', async ({ dm, player }) => {
            await showDmCard(dm, 'pointer');
            await dm.evaluate(() => Alpine.$data(document.querySelector('#dmApp')).placeFocusPing(430, 330));
            await holdPaired(dm, player, workflowPacing.action);
            await dm.evaluate(() => { const s = Alpine.$data(document.querySelector('#dmApp')); s.setPointerColor('#a855f7'); s.placeFocusPing(1040, 560); });
        });

        if (shouldRecord('status')) await recordWorkflow(browser, 'status', async ({ dm, player }) => {
            await showDmCard(dm, 'status');
            await updateDmAndSync(dm, { combatants, initiativeActive: true, currentTurn: 0, round: 1, showInitiative: true });
            await dm.evaluate(() => window.channel.postMessage({ type: 'focus', effect: 'combat' }));
            await holdPaired(dm, player, 1200);
            await dm.evaluate(() => { const s = Alpine.$data(document.querySelector('#dmApp')); s.nextTurn(); s.statusMessage = 'Critical Miss'; s.sendStatus(); });
        });

        if (shouldRecord('shapes')) await recordWorkflow(browser, 'shapes', async ({ dm, player }) => {
            await showDmCard(dm, 'effects');
            await updateDmAndSync(dm, { gridVisible: true, locked: true, scenePxPerCell: 100, measurement: { kind: 'line', anchor: { x: 240, y: 270 }, endpoint: { x: 700, y: 270 } } });
            await holdPaired(dm, player, workflowPacing.action);
            await updateDmAndSync(dm, { measurement: null, flashShapes: [{ id: 'cone-cold', geometry: { kind: 'cone', anchor: { x: 780, y: 650 }, endpoint: { x: 920, y: 400 }, widthEndpoint: { x: 1040, y: 520 } }, color: '#60a5fa', opacity: .4, label: 'Cone of Cold', visibility: 'public', showDistance: true }] });
            await holdPaired(dm, player, workflowPacing.action);
            await updateDmAndSync(dm, { effects: [{ id: 'silence', geometry: { kind: 'circle', anchor: { x: 1080, y: 370 }, endpoint: { x: 1220, y: 370 } }, color: '#000000', opacity: .45, label: 'Silence', visibility: 'public', persistent: true, showDistance: true }] });
            await holdPaired(dm, player, workflowPacing.action);
            await updateDmAndSync(dm, { effects: [] });
        });

        // Dice uses the Player's real public-roll channel; its special renderer
        // is intentionally left to the browser integration rather than mocked.
        if (shouldRecord('dice')) await recordWorkflow(browser, 'dice', async ({ dm, player }) => {
            await showDmCard(dm, 'dice');
            await updateDmAndSync(dm, { rollMode: 'private', diceNotation: '1d20+7', diceMessage: 'Hidden perception', showResultModal: true, lastResult: { tag: 'Private Roll', notation: '1d20+7', total: 24, breakdown: '17 + 7 = 24', diceResults: [{ value: 17 }], message: 'Hidden perception', critical: false, fail: false } });
            await holdPaired(dm, player, workflowPacing.action);
            await updateDmAndSync(dm, { showResultModal: false, diceNotation: '2d100kh1+10d20cs>19+4d6', rollMode: 'public', diceMessage: 'Arcane barrage' });
            await holdPaired(dm, player, workflowPacing.action);
            await dm.evaluate(() => window.channel.postMessage({ type: 'publicRoll', notation: '2d100kh1+10d20cs>19+4d6', message: 'Arcane barrage', tag: 'Public Roll' }));
            await holdPaired(dm, player, 1600);
            await dm.evaluate(() => { const s = Alpine.$data(document.querySelector('#dmApp')); s.showResultModal = false; s.rollHistory = [{ id: 'e2e-roll', time: 1700000000000, rollMode: 'public', roller: 'DM', name: 'Arcane barrage', notation: s.diceNotation, total: 42, critical: false, fail: false }]; });
        });
    },
};
