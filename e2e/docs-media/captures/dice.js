import { captureWebp, openDmCard, openPreparedDm, patchDmState } from '../capture-utils.js';

const history = [
    { id: 'docs-private', time: '2024-01-01T20:14:03Z', rollMode: 'private', roller: 'DM', name: 'Ancient ward', notation: '4d6+3', total: 19, critical: false, fail: false },
    { id: 'docs-public', time: '2024-01-01T20:13:12Z', rollMode: 'public', roller: 'DM', name: 'Perception', notation: '1d20+5', total: 23, critical: false, fail: false },
    { id: 'docs-crit', time: '2024-01-01T20:11:49Z', rollMode: 'private', roller: 'DM', name: 'Saving throw', notation: '1d20', total: 20, critical: true, fail: false },
];

/** Captures public/private dice presentation, notation entry, and roll history. @type {import('../index.js').DocumentationCapture} */
export const diceCapture = {
    id: 'dice',
    title: 'captures dice visibility, notation, and history references',
    assets: ['dm-dice-public-roll.webp', 'dm-dice-private-roll.webp', 'dm-dice-notation.webp', 'dm-dice-roll-history.webp'],
    async run({ browser }) {
        const dm = await openPreparedDm(browser);
        await openDmCard(dm.page, 'dice');
        await patchDmState(dm.page, {
            rollMode: 'public', diceNotation: '4d6kh3+2', diceMessage: 'Arcane blast',
            lastResult: { tag: 'Public Roll', notation: '4d6kh3+2', total: 17, breakdown: '6 + 5 + 4 + 2 = 17', diceResults: [{ value: 6 }, { value: 5 }, { value: 4 }], message: 'Arcane blast', critical: false, fail: false },
        });
        await captureWebp(dm.page, 'dm-dice-public-roll.webp');
        await patchDmState(dm.page, {
            rollMode: 'private', diceNotation: '1d20+7', diceMessage: 'Hidden perception check',
            lastResult: { tag: 'Private Roll', notation: '1d20+7', total: 24, breakdown: '17 + 7 = 24', diceResults: [{ value: 17 }], message: 'Hidden perception check', critical: false, fail: false },
        });
        await captureWebp(dm.page, 'dm-dice-private-roll.webp');
        await patchDmState(dm.page, { rollMode: 'public', diceNotation: '8d6kh5+3', diceMessage: '' });
        await dm.page.locator('#diceNotationInput').click();
        await captureWebp(dm.page, 'dm-dice-notation.webp');
        await patchDmState(dm.page, { rollHistory: history, historyFilter: 'all' });
        await dm.page.locator('.history-details').evaluate(details => { details.open = true; });
        await captureWebp(dm.page, 'dm-dice-roll-history.webp');
        await dm.context.close();
    },
};
