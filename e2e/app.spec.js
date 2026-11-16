import { expect, test } from '@playwright/test';

const portraitMap = `data:image/svg+xml,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="2000" viewBox="0 0 1000 2000">
  <rect width="1000" height="2000" fill="#24405b"/>
  <rect y="0" width="1000" height="80" fill="#e0b25f"/>
  <rect y="1920" width="1000" height="80" fill="#e05f5f"/>
</svg>`)}`;

test('player renders a fitted portrait scene from top to bottom', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 900 });
    await page.goto('/?mode=player');
    await expect(page.locator('#playerApp')).toBeVisible();
    await page.evaluate(async ({ source }) => {
        const state = Alpine.$data(document.querySelector('#playerApp'));
        state.currentImage = source;
        state.mediaType = 'image';
        await new Promise(resolve => state.$nextTick(resolve));
        const image = document.querySelector('#playerApp [data-grid-scene]');
        if (!image.complete) {
            await new Promise((resolve, reject) => {
                image.addEventListener('load', resolve, { once: true });
                image.addEventListener('error', reject, { once: true });
            });
        }
        state.onSceneMediaReady({ currentTarget: image });
    }, { source: portraitMap });

    const geometry = await page.locator('#playerApp [data-grid-scene]').evaluate(image => {
        const rect = image.getBoundingClientRect();
        return { top: rect.top, bottom: rect.bottom, height: rect.height, naturalHeight: image.naturalHeight };
    });
    expect(geometry.naturalHeight).toBe(2000);
    expect(geometry.top).toBeCloseTo(0, 0);
    expect(geometry.bottom).toBeCloseTo(900, 0);
    expect(geometry.height).toBeCloseTo(900, 0);
});

test('player accepts a published state and clamps stale viewport packets by revision', async ({ page }) => {
    await page.goto('/?mode=player');
    await expect(page.locator('#playerApp')).toBeVisible();
    await page.evaluate(({ source }) => {
        const state = Alpine.$data(document.querySelector('#playerApp'));
        state._onSync({
            revision: 4, scenePublished: true, currentImage: source, mediaType: 'image',
            view: { cx: 500, cy: 1000, sceneW: 2666.6666667 },
            gridVisible: true, gridType: 'square', scenePxPerCell: 100,
            fogEnabled: true, fogStrokes: [{ mode: 'reveal', shape: 'round', size: 1, x: 500, y: 1000 }],
            whiteboardActive: true, whiteboardStrokes: [], combatants: [], edges: {},
        });
        state._onSync({ revision: 3, currentImage: 'stale', currentTurn: 99 });
    }, { source: portraitMap });
    await expect(page.locator('#playerApp [data-grid-scene]')).toHaveAttribute('src', portraitMap);
    await expect.poll(() => page.evaluate(() => Alpine.$data(document.querySelector('#playerApp'))._lastStateRevision)).toBe(4);
    await expect.poll(() => page.evaluate(() => Alpine.$data(document.querySelector('#playerApp')).currentImage)).toBe(portraitMap);
});

test('DM repaint restores the original fog field while Player fog remains opaque', async ({ browser }) => {
    const context = await browser.newContext();
    const dm = await context.newPage();
    const player = await context.newPage();
    await dm.goto('/?mode=dm');
    await player.goto('/?mode=player');
    await expect(dm.locator('#dmApp')).toBeVisible();
    await expect(player.locator('#playerApp')).toBeVisible();
    const sampleFog = page => page.evaluate(() => {
        const state = Alpine.$data(document.querySelector(window.MODE === 'dm' ? '#dmApp' : '#playerApp'));
        state.fogEnabled = true;
        state.fogColor = '#3e434e';
        state.scenePxPerCell = 100;
        state.sceneToStage = (x, y) => ({ x, y });
        const canvas = state.getFogCanvas();
        state.fogStrokes = [];
        state._drawFog();
        const untouched = [...canvas.getContext('2d').getImageData(150, 150, 1, 1).data];
        state.fogStrokes = [
            { mode: 'reveal', shape: 'round', size: 1, x: 150, y: 150 },
            { mode: 'paint', shape: 'round', size: 1, x: 150, y: 150 },
        ];
        state._drawFog();
        const repainted = [...canvas.getContext('2d').getImageData(150, 150, 1, 1).data];
        return { untouched, repainted };
    });

    const dmFog = await sampleFog(dm);
    const playerFog = await sampleFog(player);
    expect(dmFog.repainted).toEqual(dmFog.untouched);
    expect(playerFog.repainted).toEqual(playerFog.untouched);
    expect(dmFog.untouched[3]).toBeGreaterThanOrEqual(170);
    expect(dmFog.untouched[3]).toBeLessThanOrEqual(176);
    expect(playerFog.untouched[3]).toBe(255);
    await context.close();
});

test('player fades the old composition to black before applying a published scene and its overlays', async ({ page }) => {
    const nextScene = `data:image/svg+xml,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
  <rect width="1600" height="900" fill="#692f77"/>
</svg>` )}`;
    await page.goto('/?mode=player');
    await expect(page.locator('#playerApp')).toBeVisible();
    await page.evaluate(({ oldScene }) => {
        const state = Alpine.$data(document.querySelector('#playerApp'));
        state._onSync({
            revision: 10, scenePublished: true, transition: 'none', currentImage: oldScene,
            mediaType: 'image', view: { cx: 500, cy: 1000, sceneW: 2666.6666667 },
            gridVisible: false, fogEnabled: false, fogStrokes: [], whiteboardActive: false,
            whiteboardStrokes: [], combatants: [], edges: {},
        });
    }, { oldScene: portraitMap });
    await expect(page.locator('#playerApp [data-grid-scene]')).toHaveAttribute('src', portraitMap);

    await page.evaluate(({ source }) => {
        const state = Alpine.$data(document.querySelector('#playerApp'));
        state._onSync({
            revision: 11, scenePublished: true, transition: 'fade', currentImage: source,
            mediaType: 'image', view: { cx: 800, cy: 450, sceneW: 1600 },
            gridVisible: true, gridType: 'square', scenePxPerCell: 100,
            fogEnabled: true, fogStrokes: [{ mode: 'reveal', shape: 'round', size: 2, x: 800, y: 450 }],
            whiteboardActive: false, whiteboardStrokes: [], combatants: [], edges: {},
        });
    }, { source: nextScene });

    const curtain = page.locator('#playerApp .scene-transition-curtain');
    await expect(curtain).toHaveClass(/active/);
    await expect(page.locator('#playerApp [data-grid-scene]')).toHaveAttribute('src', portraitMap);
    await expect.poll(() => page.evaluate(() => Alpine.$data(document.querySelector('#playerApp')).currentImage)).toBe(nextScene);
    await expect.poll(() => page.evaluate(() => {
        const state = Alpine.$data(document.querySelector('#playerApp'));
        return state.gridVisible && state.fogEnabled;
    })).toBe(true);
    await expect(curtain).not.toHaveClass(/active/);
});

test('DM publishes a portrait scene to a real player tab without clipping it', async ({ browser }) => {
    const context = await browser.newContext();
    const dm = await context.newPage();
    const player = await context.newPage();
    await dm.setViewportSize({ width: 1440, height: 900 });
    await player.setViewportSize({ width: 1200, height: 900 });
    await dm.goto('/?mode=dm');
    await player.goto('/?mode=player');
    await expect(dm.locator('#dmApp')).toBeVisible();
    await expect(player.locator('#playerApp')).toBeVisible();

    await dm.evaluate(({ source }) => {
        const state = Alpine.$data(document.querySelector('#dmApp'));
        state.currentImage = source;
        state.mediaType = 'image';
        state.sceneMediaSource = 'e2e-portrait';
        state.view = { cx: 500, cy: 1000, sceneW: 2666.6666667 };
        const scene = state.getSelectedScene();
        Object.assign(scene, state.captureSceneSettings());
        state.publishSelectedScene();
    }, { source: portraitMap });

    await expect.poll(() => player.evaluate(() => Alpine.$data(document.querySelector('#playerApp')).currentImage)).toBe(portraitMap);
    await expect(player.locator('#playerApp [data-grid-scene]')).toHaveAttribute('src', portraitMap);
    const rect = await player.locator('#playerApp [data-grid-scene]').evaluate(image => image.getBoundingClientRect().toJSON());
    expect(rect.top).toBeCloseTo(0, 0);
    expect(rect.bottom).toBeCloseTo(900, 0);
    await context.close();
});

test('DM card controls keep pointer mode and normal map interaction mutually exclusive', async ({ page }) => {
    await page.goto('/?mode=dm');
    await expect(page.locator('#dmApp')).toBeVisible();
    const pointerCard = page.getByRole('button', { name: /pointer/i }).first();
    await pointerCard.click();
    await page.getByRole('button', { name: /enable pointer/i }).click();
    await expect(page.getByRole('button', { name: /pointer active/i })).toBeVisible();
    await page.getByRole('button', { name: /dice/i }).first().click();
    await expect(page.getByRole('button', { name: /enable pointer/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /pointer active/i })).toHaveCount(0);
});

test('whiteboard fills both stages and synchronizes a DM drawing to the Player', async ({ browser }) => {
    const context = await browser.newContext();
    const dm = await context.newPage();
    const player = await context.newPage();
    await dm.setViewportSize({ width: 1440, height: 900 });
    await player.setViewportSize({ width: 1200, height: 900 });
    await dm.goto('/?mode=dm');
    await player.goto('/?mode=player');
    await expect(dm.locator('#dmApp')).toBeVisible();
    await expect(player.locator('#playerApp')).toBeVisible();

    await dm.getByRole('button', { name: /whiteboard/i }).first().click();
    await dm.getByRole('button', { name: /^show whiteboard$/i }).click();
    await expect(dm.locator('#dmApp .whiteboard-panel.active')).toBeVisible();
    await expect.poll(() => player.evaluate(() => Alpine.$data(document.querySelector('#playerApp')).whiteboardActive)).toBe(true);

    const dmGeometry = await dm.locator('#dmApp .whiteboard-panel.active').evaluate(panel => {
        const board = panel.getBoundingClientRect();
        const stage = panel.parentElement.getBoundingClientRect();
        return { board: board.toJSON(), stage: stage.toJSON() };
    });
    expect(dmGeometry.board.left).toBeCloseTo(dmGeometry.stage.left, 0);
    expect(dmGeometry.board.top).toBeCloseTo(dmGeometry.stage.top, 0);
    expect(dmGeometry.board.width).toBeCloseTo(dmGeometry.stage.width, 0);
    expect(dmGeometry.board.height).toBeCloseTo(dmGeometry.stage.height, 0);

    const canvas = dm.locator('#dmApp [data-whiteboard-canvas]');
    const box = await canvas.boundingBox();
    await canvas.hover({ position: { x: box.width * 0.25, y: box.height * 0.3 } });
    await expect(dm.locator('#dmApp .whiteboard-cursor')).toBeVisible();
    await expect(player.locator('#playerApp .whiteboard-cursor')).toHaveCount(0);
    await dm.mouse.move(box.x + (box.width * 0.25), box.y + (box.height * 0.3));
    await dm.mouse.down();
    await dm.mouse.move(box.x + (box.width * 0.7), box.y + (box.height * 0.65));
    await dm.mouse.up();
    await expect.poll(() => player.evaluate(() => Alpine.$data(document.querySelector('#playerApp')).whiteboardStrokes.length)).toBe(1);
    await expect(player.locator('#playerApp .whiteboard-panel.active')).toBeVisible();
    await context.close();
});
