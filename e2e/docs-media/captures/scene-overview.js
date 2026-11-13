import { expect } from '@playwright/test';
import {
    documentationAssetPath,
    mountDmScene,
    mountPlayerScene,
    svgFixtureDataUrl,
} from '../helpers.js';

/**
 * Captures the standard DM and Player scene-reference images from the portrait map fixture.
 *
 * @type {import('../index.js').DocumentationCapture}
 */
export const sceneOverviewCapture = {
    id: 'scene-overview',
    title: 'captures named DM and player WebP reference images',
    assets: ['dm-scene-control.webp', 'player-portrait-table.webp'],
    async run({ browser }) {
        const source = await svgFixtureDataUrl('portrait-ruins.svg');
        const dmContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
        const dm = await dmContext.newPage();
        await dm.goto('/?mode=dm');
        await expect(dm.locator('#dmApp')).toBeVisible();
        await mountDmScene(dm, source);
        await dm.screenshot({ path: documentationAssetPath('dm-scene-control.webp'), type: 'webp', quality: 86 });
        await dmContext.close();

        const playerContext = await browser.newContext({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1 });
        const player = await playerContext.newPage();
        await player.goto('/?mode=player');
        await expect(player.locator('#playerApp')).toBeVisible();
        await mountPlayerScene(player, source);
        await player.screenshot({ path: documentationAssetPath('player-portrait-table.webp'), type: 'webp', quality: 86 });
        await playerContext.close();
    },
};
