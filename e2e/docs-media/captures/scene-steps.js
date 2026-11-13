import { holdPaired, openPairedWorkflow, savePairedWorkflow, showDmCard, workflowPacing } from '../paired-workflows.js';

/** Physical chapter pairs for the scene workflow, suitable for synchronized playlists. @type {import('../index.js').DocumentationCapture} */
export const sceneStepsCapture = {
    id: 'scene-steps',
    title: 'captures synchronized numbered scene workflow chapters',
    assets: ['dm-e2e-scenes-01-select-scene-1.webm', 'player-e2e-scenes-01-select-scene-1.webm', 'dm-e2e-scenes-02-publish-scene-1.webm', 'player-e2e-scenes-02-publish-scene-1.webm', 'dm-e2e-scenes-03-select-scene-2.webm', 'player-e2e-scenes-03-select-scene-2.webm', 'dm-e2e-scenes-04-publish-fade.webm', 'player-e2e-scenes-04-publish-fade.webm'],
    async run({ browser }) {
        const steps = [
            ['01-select-scene-1', async ({ dm, player }) => { await showDmCard(dm, 'scene'); await holdPaired(dm, player, workflowPacing.action); }],
            ['02-publish-scene-1', async ({ dm, player }) => { await showDmCard(dm, 'scene'); await dm.evaluate(() => Alpine.$data(document.querySelector('#dmApp')).publishSelectedScene()); await holdPaired(dm, player, workflowPacing.action); }],
            ['03-select-scene-2', async ({ dm, player, arcane }) => { await showDmCard(dm, 'scene'); await dm.evaluate(async ({ source }) => { const s = Alpine.$data(document.querySelector('#dmApp')); s.currentImage = source; s.mediaType = 'image'; s.sceneNameDraft = 'Arcane Cathedral'; await new Promise(resolve => s.$nextTick(resolve)); }, { source: arcane }); await holdPaired(dm, player, workflowPacing.action); }],
            ['04-publish-fade', async ({ dm, player, arcane }) => { await showDmCard(dm, 'scene'); await dm.evaluate(async ({ source }) => { const s = Alpine.$data(document.querySelector('#dmApp')); s.currentImage = source; s.mediaType = 'image'; s.publishTransition = 'fade'; await new Promise(resolve => s.$nextTick(resolve)); const image = document.querySelector('#dmApp [data-grid-scene]'); if (!image.complete) await new Promise(resolve => image.addEventListener('load', resolve, { once: true })); s.onSceneMediaReady({ currentTarget: image }); s.publishSelectedScene(); }, { source: arcane }); await holdPaired(dm, player, 1500); }],
        ];
        for (const [id, play] of steps) {
            const session = await openPairedWorkflow(browser);
            await holdPaired(session.dm, session.player, workflowPacing.before);
            await play(session);
            await holdPaired(session.dm, session.player, workflowPacing.after);
            await savePairedWorkflow(session, `dm-e2e-scenes-${id}.webm`, `player-e2e-scenes-${id}.webm`);
        }
    },
};
