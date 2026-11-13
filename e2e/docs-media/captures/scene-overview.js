import { expect } from '@playwright/test';
import {
    documentationAssetPath,
    imageFixtureDataUrl,
    mountDmScene,
    mountPlayerScene,
} from '../helpers.js';

/**
 * Captures the standard DM and Player scene-reference images from the Arcane Cathedral fixture.
 *
 * @type {import('../index.js').DocumentationCapture}
 */
export const sceneOverviewCapture = {
    id: 'scene-overview',
    title: 'captures named DM and player WebP reference images',
    assets: ['dm-scene-control.webp', 'player-scene-table.webp'],
    async run({ browser }) {
        const source = await imageFixtureDataUrl('Arcane_Cathedral.png');
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
        await player.screenshot({ path: documentationAssetPath('player-scene-table.webp'), type: 'webp', quality: 86 });
        await playerContext.close();
    },
};
