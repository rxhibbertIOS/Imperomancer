import test from 'node:test';
import assert from 'node:assert/strict';
import { createChannel, loadBrowserScript, plain, prepareFeature } from './helpers/browser.js';

function featureContext(file, extra = {}) {
    const channel = createChannel();
    const syncCalls = [];
    const context = loadBrowserScript(file, {
        MODE: 'dm',
        channel,
        uid: (() => { let number = 0; return () => `id-${++number}`; })(),
        uuid: (() => { let number = 0; return () => `uuid-${++number}`; })(),
        sync: state => syncCalls.push(state),
        syncState: state => syncCalls.push(state),
        systemLog: { debug() {}, info() {}, success() {}, warn() {}, danger() {}, error() {} },
        ...extra,
    });
    return { context, channel, syncCalls };
}

test('initiative: starts sorted combat, skips a defeated lead, and synchronizes', async () => {
    const { context, syncCalls } = featureContext('public/js/features/initiative.js', { roll: () => 12 });
    const feature = prepareFeature(context.initiativeFeature({ editable: true }));
    feature.initiativeRows = [
        { id: 'a', name: 'Skeleton', initiative: 18, bonus: '', isPlayer: false, isDead: true },
        { id: 'b', name: 'Rogue', initiative: 16, bonus: '', isPlayer: true, isDead: false },
        { id: 'c', name: 'Wizard', initiative: '', bonus: '3', isPlayer: true, isDead: false },
        { id: 'blank', name: ' ', initiative: '', bonus: '', isPlayer: false, isDead: false },
    ];

    await feature.enterInitiative();

    assert.equal(feature.initiativeActive, true);
    assert.deepEqual(plain(feature.combatants.map(({ name, initiative }) => ({ name, initiative }))), [
        { name: 'Skeleton', initiative: 18 }, { name: 'Rogue', initiative: 16 }, { name: 'Wizard', initiative: 15 },
    ]);
    assert.equal(feature.currentTurn, 1, 'the defeated first combatant is skipped');
    assert.equal(syncCalls.length, 1);
});

test('initiative: refuses empty combat, preserves an active roster, and wraps rounds', () => {
    const { context } = featureContext('public/js/features/initiative.js');
    const feature = prepareFeature(context.initiativeFeature({ editable: true }));
    feature.enterInitiative();
    assert.equal(feature.initiativeActive, false);

    feature.initiativeRows = [{ id: 'a', name: 'Kept', initiative: 10, bonus: '', isPlayer: false, isDead: false }];
    feature.initiativeActive = true;
    feature.clearInitiativeRows();
    assert.equal(feature.initiativeRows.length, 1, 'active combat cannot clear the editor');

    feature.combatants = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }];
    feature.currentTurn = 1;
    feature.round = 2;
    feature.nextTurn();
    assert.equal(feature.currentTurn, 0);
    assert.equal(feature.round, 3);
    feature.prevTurn();
    assert.equal(feature.currentTurn, 1);
    assert.equal(feature.round, 2);
});

test('initiative: parses malformed bonuses safely and restores live getters', () => {
    const { context } = featureContext('public/js/features/initiative.js');
    const feature = prepareFeature(context.initiativeFeature({ editable: true }));
    assert.equal(feature._parseBonus(' +12 goblins'), 12);
    assert.equal(feature._parseBonus('no bonus'), 0);
    assert.equal(feature._parseBonus(null), 0);
    feature.combatants = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }];
    feature.currentTurn = 1;
    context.attachInitiativeGetters(feature);
    assert.equal(feature.currentCombatant.name, 'B');
    assert.deepEqual(plain(feature.upcomingCombatants.map(item => item.name)), ['C', 'A']);
});

test('status: sends trimmed messages, ignores blanks, and maps named focus effects', () => {
    const { context, channel } = featureContext('public/js/features/status.js');
    const feature = prepareFeature(context.statusFeature());
    feature.statusMessage = '  Roll initiative  ';
    feature.sendStatus();
    assert.deepEqual(plain(channel.messages), [{ type: 'status', message: 'Roll initiative' }]);
    assert.equal(feature.statusText, 'Roll initiative');
    assert.equal(feature.statusVisible, true);
    feature.statusMessage = '  ';
    feature.sendStatus();
    assert.equal(channel.messages.length, 1);
    feature.showFocus('critical');
    assert.match(feature.statusText, /CRITICAL HIT/);
    feature.showFocus('unknown');
    assert.match(feature.statusText, /CRITICAL HIT/);
    feature.clearStatus();
    assert.equal(feature.statusVisible, false);
    assert.deepEqual(plain(channel.messages.at(-1)), { type: 'status', message: '' });
});

test('history: recovers from corrupt storage, filters results, and caps persisted records', () => {
    const storage = new Map([['dmhub.rollHistory', '{bad json']]);
    const { context } = featureContext('public/js/features/history.js', {
        localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    });
    const feature = prepareFeature(context.historyFeature());
    feature.loadHistory();
    assert.deepEqual(plain(feature.rollHistory), []);
    for (let index = 0; index < 51; index += 1) feature.addToHistory({ id: index, rollMode: index % 2 ? 'public' : 'private', critical: index === 1, fail: index === 2 });
    assert.equal(feature.rollHistory.length, 50);
    feature.historyFilter = 'public';
    assert.ok(feature.filteredHistory().every(item => item.rollMode === 'public'));
    feature.historyFilter = 'crits';
    assert.equal(feature.filteredHistory().length, 1);
    feature.clearHistory();
    assert.equal(storage.has('dmhub.rollHistory'), false);
});

test('pointer: validates colors, snapshots ping colors, and clears synchronized pings', () => {
    const { context, syncCalls } = featureContext('public/js/features/pointer.js');
    const feature = prepareFeature(context.pointerFeature(), {
        sceneToStage: (x, y) => ({ x, y }), screenToScene: () => ({ x: 4, y: 8 }),
    });
    feature.setPointerColor('');
    assert.equal(feature.pointerColor, '#ffcc00');
    feature.setPointerColor('#FF0000');
    feature.placeFocusPing(10, 20);
    feature.setPointerColor('#00ff00');
    assert.equal(feature.focusPings[0].color, '#ff0000');
    assert.ok(syncCalls.length >= 2);
    feature.handleFocusClick({ button: 0, preventDefault() {}, stopPropagation() {} });
    assert.equal(feature.focusPings.length, 1, 'clicking is inert until pointer mode is active');
    feature.toggleFocusMode();
    feature.handleFocusClick({ button: 0, preventDefault() {}, stopPropagation() {} });
    assert.equal(feature.focusPings.length, 2);
    feature.clearFocusPings();
    assert.deepEqual(plain(feature.focusPings), []);
});
