import { openPairedWorkflow, workflowPacing } from '../paired-workflows.js';

/** Physical chapter pairs for the scene workflow, suitable for synchronized playlists. @type {import('../index.js').DocumentationCapture} */
export const sceneStepsCapture = {
    id: 'scene-steps',
    title: 'captures synchronized numbered scene workflow chapters',
    assets: ['dm-e2e-scenes-01-select-scene-1.webm', 'player-e2e-scenes-01-select-scene-1.webm', 'dm-e2e-scenes-02-publish-scene-1.webm', 'player-e2e-scenes-02-publish-scene-1.webm', 'dm-e2e-scenes-03-select-scene-2.webm', 'player-e2e-scenes-03-select-scene-2.webm', 'dm-e2e-scenes-04-publish-fade.webm', 'player-e2e-scenes-04-publish-fade.webm'],
    async run({ browser }) {
        const steps = [
            ['01-select-scene-1', async (session) => { await session.showCard('scene'); await session.hold(workflowPacing.action); }],
            ['02-publish-scene-1', async (session) => { await session.showCard('scene'); await session.publishScene('Dwarven Forge'); await session.hold(workflowPacing.action); }],
            ['03-select-scene-2', async (session) => { await session.showCard('scene'); await session.prepareScene('Arcane Cathedral', 'Arcane_Cathedral.png'); await session.hold(workflowPacing.action); }],
            ['04-publish-fade', async (session) => { await session.showCard('scene'); await session.publishScene('Arcane Cathedral', 'fade'); await session.hold(1500); }],
        ];
        for (const [id, play] of steps) {
            const session = await openPairedWorkflow(browser);
            await session.hold(workflowPacing.before);
            await play(session);
            await session.hold(workflowPacing.after);
            await session.saveRecording(`dm-e2e-scenes-${id}.webm`, `player-e2e-scenes-${id}.webm`);
        }
    },
};
