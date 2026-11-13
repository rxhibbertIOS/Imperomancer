import { captureWebp, openDmCard, openPreparedDm, openPreparedPlayer, patchDmState, patchPlayerState } from '../capture-utils.js';

const shapes = [
    { id: 'wall-of-force', geometry: { kind: 'line', anchor: { x: 260, y: 260 }, endpoint: { x: 760, y: 260 } }, color: '#3b82f6', opacity: .9, label: 'Wall of Force', visibility: 'public', persistent: true, showDistance: true },
    { id: 'fireball', geometry: { kind: 'circle', anchor: { x: 1050, y: 420 }, endpoint: { x: 1250, y: 420 } }, color: '#ef4444', opacity: .45, label: 'Fireball', visibility: 'public', persistent: true, showDistance: true },
    { id: 'ward', geometry: { kind: 'square', anchor: { x: 520, y: 650 }, endpoint: { x: 680, y: 760 } }, color: '#22c55e', opacity: .38, label: 'Ward', visibility: 'public', persistent: true, showDistance: false },
    { id: 'cone', geometry: { kind: 'cone', anchor: { x: 1280, y: 720 }, endpoint: { x: 1000, y: 520 }, widthEndpoint: { x: 900, y: 640 } }, color: '#a855f7', opacity: .35, label: 'Breath', visibility: 'public', persistent: true, showDistance: true },
];

/** Captures DM shape-tool controls and Player-visible tactical geometry. @type {import('../index.js').DocumentationCapture} */
export const shapesCapture = {
    id: 'shapes',
    title: 'captures shape-tool controls and table geometry references',
    assets: ['dm-shape-tools.webp', 'player-shape-tools.webp'],
    async run({ browser }) {
        const dm = await openPreparedDm(browser);
        await patchDmState(dm.page, {
            gridVisible: true, locked: true, scenePxPerCell: 100, effects: shapes,
            selectedEffectId: 'fireball', effectDraft: { color: '#ef4444', opacity: .45, label: 'Fireball', visibility: 'public', persistent: true, showDistance: true },
            shapeMenu: { x: 810, y: 110, sceneX: 900, sceneY: 220 },
        });
        await openDmCard(dm.page, 'effects');
        await captureWebp(dm.page, 'dm-shape-tools.webp');
        await dm.context.close();

        const player = await openPreparedPlayer(browser);
        await patchPlayerState(player.page, { gridVisible: true, locked: true, scenePxPerCell: 100, effects: shapes });
        await captureWebp(player.page, 'player-shape-tools.webp');
        await player.context.close();
    },
};
