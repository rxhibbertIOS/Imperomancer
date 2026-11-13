import { captureWebp, openPreparedPlayer, patchPlayerState } from '../capture-utils.js';

/** Captures the full-table whiteboard with representative drawing tools. @type {import('../index.js').DocumentationCapture} */
export const whiteboardCapture = {
    id: 'whiteboard',
    title: 'captures the full-stage whiteboard reference',
    assets: ['player-whiteboard-full-stage.webp'],
    async run({ browser }) {
        const { context, page } = await openPreparedPlayer(browser);
        await patchPlayerState(page, {
            whiteboardActive: true,
            whiteboardStrokes: [
                { tool: 'highlighter', color: '#eab308', size: 42, points: [{ x: .12, y: .16 }, { x: .75, y: .16 }] },
                { tool: 'arrow', color: '#3b82f6', size: 13, points: [{ x: .16, y: .32 }, { x: .68, y: .58 }] },
                { tool: 'rectangle', color: '#ef4444', size: 10, points: [{ x: .12, y: .64 }, { x: .39, y: .84 }] },
                { tool: 'pencil', color: '#1e293b', size: 8, points: [{ x: .53, y: .67 }, { x: .58, y: .61 }, { x: .63, y: .7 }, { x: .69, y: .64 }] },
            ],
        });
        await captureWebp(page, 'player-whiteboard-full-stage.webp');
        await context.close();
    },
};
