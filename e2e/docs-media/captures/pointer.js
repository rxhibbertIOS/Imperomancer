import { captureWebp, openPreparedPlayer, patchPlayerState } from '../capture-utils.js';

/** Captures Player-visible focus pings over a prepared scene. @type {import('../index.js').DocumentationCapture} */
export const pointerCapture = {
    id: 'pointer',
    title: 'captures the table focus pointer reference',
    assets: ['player-focus-pointer.webp'],
    async run({ browser }) {
        const { context, page } = await openPreparedPlayer(browser);
        await patchPlayerState(page, {
            focusPings: [
                { id: 'docs-focus-blue', sceneX: 820, sceneY: 430, color: '#007aff', createdAt: Date.now() },
                { id: 'docs-focus-gold', sceneX: 1180, sceneY: 600, color: '#ffcc00', createdAt: Date.now() },
            ],
        });
        await captureWebp(page, 'player-focus-pointer.webp');
        await context.close();
    },
};
