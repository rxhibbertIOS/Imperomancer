import test from 'node:test';
import assert from 'node:assert/strict';
import { createChannel, loadBrowserScript, plain, prepareFeature } from './helpers/browser.js';

test('dice result normalization: handles errors, targets, drops, and library totals', () => {
    const context = loadBrowserScript('public/js/features/dice-result.js');
    const invalid = context.normalizeDiceResult({ error: true, errorMessage: 'Bad die' }, { notation: 'nope' });
    assert.equal(invalid.error, true);
    assert.equal(invalid.total, '?');
    assert.equal(invalid.breakdown, 'Bad die');

    const result = context.normalizeDiceResult({
        resultTotal: 9,
        resultString: '6 + 3 = 9',
        successCount: 1,
        failureCount: 0,
        groups: [{ rules: [{ type: 'target-number' }] }],
        diceResults: [
            { value: 6, kept: true, critical: true, success: true },
            { value: 3, kept: false, failure: true },
        ],
        audit: [{ step: 2, phase: 'rules', description: 'Target applied' }],
    }, { notation: '2d6t5', rollMode: 'public', message: 'Check' });
    assert.equal(result.error, false);
    assert.equal(result.hasTarget, true);
    assert.equal(result.droppedCount, 1);
    assert.equal(result.successCount, 1, 'authoritative library count wins');
    assert.equal(result.critical, true);
    assert.equal(result.audit[0], 'Step 2 (rules): Target applied');
});

test('dice math: parses valid notation, rejects unsafe values, and detects classic criticals', () => {
    const context = loadBrowserScript('public/js/shared/dice-math.js');
    assert.deepEqual({ ...context.parseNotation(' 2d6 - 3 ') }, { count: 2, sides: 6, mod: -3 });
    assert.equal(context.parseNotation('2d1'), null);
    assert.equal(context.parseNotation('101d6'), null);
    assert.equal(context.parseNotation('2d6+banana'), null);
    assert.deepEqual({ ...context.detectCritFail('1d20', { resultTotal: 20 }) }, { critical: true, fail: false });
    assert.deepEqual({ ...context.detectCritFail('2d20', { resultTotal: 20 }) }, { critical: false, fail: false });
    assert.deepEqual({ ...context.detectCritFail('2d6', { diceResults: [{ critical: true, failure: true }] }) }, { critical: false, fail: true });
});

test('dice feature: private fallback returns an auditable total and public rolls broadcast once', () => {
    const channel = createChannel();
    const context = loadBrowserScript('public/js/features/dice.js', {
        channel,
        parseNotation: notation => notation === '2d6+1' ? { count: 2, sides: 6, mod: 1 } : null,
        roll: () => 4,
        normalizeDiceResult: raw => ({ notation: '2d6+1', total: raw.resultTotal, message: '', critical: false, fail: false }),
        formatDiceLog: () => 'roll',
        uuid: () => 'roll-id',
        systemLog: { warn() {}, error() {}, info() {}, success() {}, debug() {} },
    });
    const feature = prepareFeature(context.diceFeature(), { addToHistory(entry) { this.historyEntry = entry; } });
    const fallback = feature._fallbackRoll('2d6+1');
    assert.equal(fallback.resultTotal, 9);
    assert.match(fallback.resultString, /4 \+ 4 \+1 = 9/);
    assert.equal(feature._fallbackRoll('not dice'), null);
    feature.diceMessage = 'Fireball';
    feature.performPublicRoll('2d6+1');
    assert.equal(feature.diceRolling, true);
    assert.deepEqual(plain(channel.messages[0]), { type: 'publicRoll', notation: '2d6+1', message: 'Fireball', tag: 'Roll' });
});

test('channel: serializes only supported state and coalesces viewport updates until acknowledgement', () => {
    class BroadcastChannelMock {
        constructor() { this.messages = []; }
        postMessage(message) { this.messages.push(message); }
        close() {}
    }
    const context = loadBrowserScript('public/js/core/channel.js', { BroadcastChannel: BroadcastChannelMock });
    const state = {
        mediaType: 'image', view: { cx: 10, cy: 20, sceneW: 300 }, currentImage: 'map',
        effects: [{ visibility: 'public' }, { visibility: 'private' }], flashShapes: [{ visibility: 'private' }],
        diceBox: { unsafe: true }, tableScreenWidth: 1920, tableDiagonal: 55,
    };
    const sync = context.pickSyncState(state, { includeScene: true });
    assert.equal(sync.effects.length, 1);
    assert.equal(sync.flashShapes.length, 0);
    assert.equal(sync.currentImage, 'map');

    const port = { messages: [], start() {}, postMessage(message) { this.messages.push(message); } };
    context.attachViewPort(port);
    context.syncView({ view: { cx: 1, cy: 2, sceneW: 3 } });
    context.syncView({ view: { cx: 4, cy: 5, sceneW: 6 } });
    assert.equal(port.messages.length, 1);
    assert.deepEqual({ ...port.messages[0].view }, { cx: 1, cy: 2, sceneW: 3 });
    context.acknowledgeView(port.messages[0].sequence + 1);
    assert.equal(port.messages.length, 1, 'stale acknowledgements cannot release queued data');
    context.acknowledgeView(port.messages[0].sequence);
    assert.equal(port.messages.length, 2);
    assert.deepEqual({ ...port.messages[1].view }, { cx: 4, cy: 5, sceneW: 6 });
});
