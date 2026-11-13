import { captureWebp, openDmCard, openPreparedDm, openPreparedPlayer, patchDmState, patchPlayerState } from '../capture-utils.js';

/** Captures calibration, visible grid, and physical-cell locking references. @type {import('../index.js').DocumentationCapture} */
export const gridCapture = {
    id: 'grid',
    title: 'captures grid calibration, application, and locking references',
    assets: ['dm-grid-calibration.webp', 'player-grid-application.webp', 'dm-grid-locking.webp'],
    async run({ browser }) {
        const dm = await openPreparedDm(browser);
        await openDmCard(dm.page, 'grid');
        await patchDmState(dm.page, {
            gridVisible: true, gridType: 'square', scenePxPerCell: 100, gridShowLabels: true,
            gridLabelEvery: 5, tableScreenWidth: 1920, tableScreenHeight: 1080,
            tableDiagonal: 55, tableAspectW: 16, tableAspectH: 9,
        });
        await dm.page.locator('.grid-calibration').first().evaluate(details => { details.open = true; });
        await captureWebp(dm.page, 'dm-grid-calibration.webp');
        await patchDmState(dm.page, { locked: true, tablePpi: 40.05 });
        await captureWebp(dm.page, 'dm-grid-locking.webp');
        await dm.context.close();

        const player = await openPreparedPlayer(browser);
        await patchPlayerState(player.page, {
            gridVisible: true, gridType: 'square', scenePxPerCell: 100, gridShowLabels: true,
            gridLabelEvery: 5, gridOpacity: 0.7, sceneGridOriginX: 0, sceneGridOriginY: 0,
        });
        await captureWebp(player.page, 'player-grid-application.webp');
        await player.context.close();
    },
};
