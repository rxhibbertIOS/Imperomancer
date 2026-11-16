import { expect, test } from '@playwright/test';
import { createScenarioSession } from './docs-media/scenario-session.js';

test('scenario session establishes reusable DM/Player scene, grid, and fog prerequisites', async ({ browser }) => {
    const session = createScenarioSession(browser, { recordVideo: false });

    await expect(session.enableGrid()).rejects.toThrow(/instantiate/u);

    await session.instantiate();
    try {
        const scene = await session.prepareScene('Forge', 'Dwarven_Forge.png');
        await session.publishScene('Forge', 'fade');
        await session.enableGrid({ type: 'hex-pointy', cellsAcross: 100, pxPerCell: 18 });
        await session.setGridSize({ cellsAcross: 80 });
        await session.lockGrid({ tablePpi: 40 });
        await session.applyFog({ strokes: [{ mode: 'reveal', shape: 'round', size: 5, x: 260, y: 380 }] });

        await expect.poll(() => session.dm.evaluate(() => Alpine.$data(document.querySelector('#dmApp')).gridCellsAcross)).toBe(80);
        await expect.poll(() => session.player.evaluate(() => {
            const state = Alpine.$data(document.querySelector('#playerApp'));
            return {
                currentImage: state.currentImage,
                gridType: state.gridType,
                locked: state.locked,
                fogEnabled: state.fogEnabled,
            };
        })).toEqual({
            currentImage: scene.source,
            gridType: 'hex-pointy',
            locked: true,
            fogEnabled: true,
        });
    } finally {
        await session.close();
    }
});

test('scenario session rejects an unknown scene and unsupported transition', async ({ browser }) => {
    const session = await createScenarioSession(browser, { recordVideo: false }).instantiate();
    try {
        await expect(session.publishScene('Missing')).rejects.toThrow(/has not been prepared/u);
        await session.prepareScene('Forge', 'Dwarven_Forge.png');
        await expect(session.publishScene('Forge', 'dissolve')).rejects.toThrow(/Unsupported scene transition/u);
    } finally {
        await session.close();
    }
});

test('scenario session composes shared whiteboard, pointer, initiative, status, and effect actions', async ({ browser }) => {
    const session = await createScenarioSession(browser, { recordVideo: false }).instantiate();
    try {
        await session.prepareScene('Forge', 'Dwarven_Forge.png');
        await session.publishScene('Forge');
        await session.openWhiteboard();
        await session.configureWhiteboard({ tool: 'arrow', color: '#3b82f6', size: 10 });
        await session.drawWhiteboardShape({ tool: 'arrow', color: '#3b82f6', size: 10, points: [{ x: .15, y: .2 }, { x: .68, y: .62 }] });
        await session.setPointerColor('#a855f7');
        await session.placePointer({ x: 430, y: 330 });
        await session.populateInitiative([{ id: 'aria', name: 'Aria Vale', initiative: 22, isPlayer: true }, { id: 'guard', name: 'Forge Guard', initiative: 18 }]);
        const activeCombatants = await session.startInitiative();
        await session.advanceTurn();
        const effectId = await session.placePersistentShape({ geometry: { kind: 'circle', anchor: { x: 500, y: 400 }, endpoint: { x: 620, y: 400 } }, color: '#000000', label: 'Silence' });
        await session.sendStatus('Critical Miss');

        await expect.poll(() => session.dm.evaluate(() => Alpine.$data(document.querySelector('#dmApp')).focusPings.length)).toBe(1);
        await expect.poll(() => session.player.evaluate(() => {
            const state = Alpine.$data(document.querySelector('#playerApp'));
            return {
                active: state.whiteboardActive,
                strokes: state.whiteboardStrokes.length,
                initiative: state.showInitiative,
                turn: state.currentTurn,
                status: state.statusText,
                effects: state.effects.map(effect => effect.label),
            };
        })).toEqual({ active: true, strokes: 1, initiative: true, turn: 1, status: 'Critical Miss', effects: ['Silence'] });

        await session.setCombatantDefeated(activeCombatants.find(combatant => combatant.name === 'Forge Guard').id, true);
        await session.collapseInitiative();
        await session.deleteEffect(effectId);
        await expect.poll(() => session.player.evaluate(() => {
            const state = Alpine.$data(document.querySelector('#playerApp'));
            return { collapsed: state.initiativeCollapsed, effects: state.effects.length };
        })).toEqual({ collapsed: true, effects: 0 });
    } finally {
        await session.close();
    }
});
