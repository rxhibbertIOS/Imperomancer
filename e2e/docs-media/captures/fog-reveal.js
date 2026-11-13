import { expect } from '@playwright/test';
import { imageFixtureDataUrl, mountPlayerScene, outputDirectory, saveRecordedVideo } from '../helpers.js';

/**
 * Captures a short Player-display recording that demonstrates a fog reveal.
 *
 * @type {import('../index.js').DocumentationCapture}
 */
export const fogRevealCapture = {
    id: 'fog-reveal',
    title: 'captures a named WebM fog-reveal demonstration',
    assets: ['player-fog-reveal.webm'],
    async run({ browser }) {
        const source = await imageFixtureDataUrl('Dwarven_Forge.png');
        const context = await browser.newContext({
            viewport: { width: 900, height: 700 },
            recordVideo: { dir: outputDirectory, size: { width: 900, height: 700 } },
        });
        const page = await context.newPage();
        await page.goto('/?mode=player');
        await expect(page.locator('#playerApp')).toBeVisible();
        await mountPlayerScene(page, source);
        await page.evaluate(() => {
            const state = Alpine.$data(document.querySelector('#playerApp'));
            state.fogEnabled = true;
            state.fogStrokes = [];
            state.drawFog();
        });
        await page.waitForTimeout(500);
        await page.evaluate(() => {
            const state = Alpine.$data(document.querySelector('#playerApp'));
            state.fogStrokes = [{ mode: 'reveal', shape: 'round', size: 2.5, x: 836, y: 470 }];
            state.drawFog();
        });
        await page.waitForTimeout(1_200);
        const video = page.video();
        await page.close();
        await context.close();
        await saveRecordedVideo(video, 'player-fog-reveal.webm');
    },
};
