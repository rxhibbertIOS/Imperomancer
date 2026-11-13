import { captureWebp, freezeChronicleTime, openDmCard, openPreparedDm, openPreparedPlayer, patchPlayerState } from '../capture-utils.js';

/** Captures status announcements and Chronicle opening, filtering, and search references. @type {import('../index.js').DocumentationCapture} */
export const sessionToolsCapture = {
    id: 'session-tools',
    title: 'captures status announcements and Chronicle references',
    assets: ['player-status-announcement.webp', 'dm-chronicle-open.webp', 'dm-chronicle-filter.webp', 'dm-chronicle-search.webp'],
    async run({ browser }) {
        const player = await openPreparedPlayer(browser);
        await patchPlayerState(player.page, { statusText: '⚔️ COMBAT START!', statusVisible: true });
        await captureWebp(player.page, 'player-status-announcement.webp');
        await player.context.close();

        const dm = await openPreparedDm(browser);
        await freezeChronicleTime(dm.page);
        await dm.page.evaluate(() => {
            systemLog.info('scene', 'publish', 'Published Arcane Cathedral');
            systemLog.success('initiative', 'start', 'Initiative order set for 4 combatants');
            systemLog.warn('fog', 'reapply', 'Fog restored across the table');
            document.querySelector('[data-system-log-toggle]').click();
        });
        await captureWebp(dm.page, 'dm-chronicle-open.webp');
        await dm.page.locator('[data-log-level="warn"]').click();
        await captureWebp(dm.page, 'dm-chronicle-filter.webp');
        await dm.page.locator('[data-system-log-feature]').fill('initiative');
        await captureWebp(dm.page, 'dm-chronicle-search.webp');
        await dm.context.close();
    },
};
