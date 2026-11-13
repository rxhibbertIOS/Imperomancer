import { captureWebp, openDmCard, openPreparedDm, openPreparedPlayer, patchDmState, patchPlayerState } from '../capture-utils.js';

const combatants = [
    { id: 'aria', name: 'Aria Vale', initiative: 22, bonus: 4, isPlayer: true, isDead: false },
    { id: 'forge', name: 'Forge Guard', initiative: 18, bonus: 2, isPlayer: false, isDead: false },
    { id: 'mire', name: 'Mire Wraith', initiative: 14, bonus: 3, isPlayer: false, isDead: false },
    { id: 'tovin', name: 'Tovin Ash', initiative: 11, bonus: 1, isPlayer: true, isDead: false },
];

/** Captures initiative population, entry, live tracking, editing, and defeated-state references. @type {import('../index.js').DocumentationCapture} */
export const initiativeCapture = {
    id: 'initiative',
    title: 'captures initiative setup, tracking, editing, and defeat references',
    assets: ['dm-initiative-population.webp', 'dm-initiative-entry.webp', 'player-initiative-tracker.webp', 'dm-initiative-editing.webp', 'dm-initiative-defeated.webp'],
    async run({ browser }) {
        const dm = await openPreparedDm(browser);
        await openDmCard(dm.page, 'initiative');
        await patchDmState(dm.page, { initiativeRows: combatants.map(row => ({ ...row, initiative: row.initiative })) });
        await captureWebp(dm.page, 'dm-initiative-population.webp');
        await patchDmState(dm.page, { initiativeActive: true, initiativeRows: [], combatants, currentTurn: 0, round: 1, showInitiative: true });
        await captureWebp(dm.page, 'dm-initiative-entry.webp');
        await patchDmState(dm.page, { initiativeEditing: true, initiativeRows: [...combatants.map(row => ({ ...row })), { id: 'blank', name: '', initiative: null, bonus: '', isPlayer: false, isDead: false }] });
        await captureWebp(dm.page, 'dm-initiative-editing.webp');
        await patchDmState(dm.page, { initiativeEditing: false, combatants: combatants.map(row => row.id === 'mire' ? { ...row, isDead: true } : row), currentTurn: 1 });
        await captureWebp(dm.page, 'dm-initiative-defeated.webp');
        await dm.context.close();

        const player = await openPreparedPlayer(browser);
        await patchPlayerState(player.page, { combatants, currentTurn: 1, round: 2, showInitiative: true, initiativeCollapsed: false, initiative360: false });
        await captureWebp(player.page, 'player-initiative-tracker.webp');
        await player.context.close();
    },
};
