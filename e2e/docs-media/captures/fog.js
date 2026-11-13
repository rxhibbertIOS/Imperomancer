import { captureWebp, openDmCard, openPreparedDm, openPreparedPlayer, patchDmState, patchPlayerState } from '../capture-utils.js';

/** Captures the active fog view and the paired reapplication controls. @type {import('../index.js').DocumentationCapture} */
export const fogCapture = {
    id: 'fog',
    title: 'captures fog application and reapplication references',
    assets: ['player-fog-application.webp', 'dm-fog-reapplication.webp'],
    async run({ browser }) {
        const player = await openPreparedPlayer(browser, 'Dwarven_Forge.png');
        await patchPlayerState(player.page, {
            fogEnabled: true,
            fogStrokes: [
                { mode: 'reveal', shape: 'round', size: 3, x: 470, y: 420 },
                { mode: 'reveal', shape: 'round', size: 2.5, x: 1200, y: 510 },
            ],
        });
        await captureWebp(player.page, 'player-fog-application.webp');
        await player.context.close();

        const control = await openPreparedDm(browser);
        await openDmCard(control.page, 'fog');
        await patchDmState(control.page, { fogEnabled: true, fogEditing: true, fogTool: 'paint', fogBrush: 'square', fogBrushCells: 3 });
        await captureWebp(control.page, 'dm-fog-reapplication.webp');
        await control.context.close();
    },
};
