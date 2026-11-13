import test from 'node:test';
import assert from 'node:assert/strict';
import { createChannel, loadBrowserScript, plain, prepareFeature } from './helpers/browser.js';

test('identifiers: produces short IDs and uses crypto UUIDs with a safe fallback', () => {
    const uuidContext = loadBrowserScript('public/js/shared/ids.js', { crypto: { randomUUID: () => 'platform-uuid' } });
    assert.equal(uuidContext.uuid(), 'platform-uuid');
    assert.match(uuidContext.uid(), /^[a-z0-9]+[a-z0-9]{5}$/);
    const fallbackContext = loadBrowserScript('public/js/shared/ids.js', { crypto: {} });
    assert.match(fallbackContext.uuid(), /^\d+(?:\.\d+)?$/);
});

test('legacy shared bundle: strips browser objects, whitelists state, and broadcasts cloned data', () => {
    class BroadcastChannelMock { constructor() { this.messages = []; } postMessage(message) { this.messages.push(message); } }
    class Canvas {}
    const context = loadBrowserScript('public/js/shared.js', { BroadcastChannel: BroadcastChannelMock, HTMLCanvasElement: Canvas, systemLog: { debug() {} } });
    const cloned = context.clone({ kept: 1, canvas: new Canvas(), three: { isObject3D: true }, nested: { value: 2 } });
    assert.deepEqual(plain(cloned), { kept: 1, nested: { value: 2 } });
    const state = context.pickSyncState({ currentImage: 'map', panX: 20, unknown: 'excluded', edges: { top: false } });
    assert.equal(state.currentImage, 'map');
    assert.equal(state.edges.top, false);
    assert.equal('unknown' in state, false);
    context.syncState({ currentImage: 'map', unknown: () => {} });
    assert.equal(context.channel.messages[0].type, 'sync');
    assert.equal('unknown' in context.channel.messages[0].state, false);
});

test('system log: suppresses production debug, normalizes entries, limits retention, and clears', () => {
    const consoleCalls = [];
    const context = loadBrowserScript('public/js/shared/log.js', {
        console: { debug(...args) { consoleCalls.push(['debug', ...args]); }, info(...args) { consoleCalls.push(['info', ...args]); }, warn(...args) { consoleCalls.push(['warn', ...args]); }, error(...args) { consoleCalls.push(['error', ...args]); } },
    });
    assert.equal(context.systemLog.debug('test', 'hidden', 'nope'), null);
    const entry = context.systemLog.error('dice', 'rollFailed', new Error('boom'));
    assert.equal(entry.level, 'error');
    assert.equal(entry.message, 'boom');
    assert.match(entry.stack, /boom/);
    assert.equal(consoleCalls.length, 1);
    for (let index = 0; index < 501; index += 1) context.systemLog.info('test', 'event', String(index));
    assert.equal(context.systemLog.entries().length, 500);
    assert.equal(context.systemLog.entries()[0].message, '1');
    context.systemLog.clear();
    assert.equal(context.systemLog.entries().length, 0);
});

function playerContext(extra = {}) {
    const channel = createChannel();
    const context = loadBrowserScript('public/js/player.js', {
        MODE: 'player', channel,
        initiativeFeature: () => ({ _animateCarousel() {} }), gridFeature: () => ({}), fogFeature: () => ({}), whiteboardFeature: () => ({}), sceneFeature: () => ({}), pointerFeature: () => ({}), shapesFeature: () => ({}), statusFeature: () => ({}),
        attachInitiativeGetters: component => component,
        parseNotation: notation => notation === '1d20' ? { count: 1, sides: 20, mod: 0 } : null,
        roll: () => 20,
        formatDiceLog: () => 'roll', detectCritFail: () => ({ critical: true, fail: false }),
        systemLog: { debug() {}, info() {}, success() {}, warn() {}, error() {} },
        ...extra,
    });
    return { context, channel, player: prepareFeature(context.playerApp(), { view: { cx: 0, cy: 0, sceneW: 100 }, drawGrid() {}, drawFog() {}, drawWhiteboard() {}, ensureScenePlayback: async () => false }) };
}

test('player transport: rejects stale state, acknowledges view packets, and falls back safely for dice', () => {
    const { player, channel } = playerContext();
    player._onSync({ revision: 2, currentImage: 'new', view: { cx: 5, cy: 6, sceneW: 7 }, scenePublished: true, currentTurn: 2, edges: { left: false } });
    player._onSync({ revision: 1, currentImage: 'old', currentTurn: 0 });
    assert.equal(player.currentImage, 'new');
    assert.equal(player.currentTurn, 2);
    assert.equal(player.edges.left, false);
    const transport = createChannel();
    player.handleViewPacket({ type: 'view', sequence: 9, view: { cx: 9, cy: 8, sceneW: 7 } }, transport);
    assert.deepEqual(plain(transport.messages), [{ type: 'viewAck', sequence: 9 }]);
    player.pendingRoll = { message: 'attack', tag: 'Attack' };
    const fallback = player._fallbackResult('1d20');
    assert.equal(fallback.raw.resultTotal, 20);
    assert.equal(fallback.raw.critical, true);
    player._broadcastResult(fallback);
    assert.equal(channel.messages.at(-1).type, 'publicRollResult');
    assert.equal(player.pendingRoll, null);
    assert.equal(player.showResultModal, true);
});

test('DM helpers: safely toggle cards/dialogs, fullscreen, lock, and player lifecycle state', () => {
    const channel = createChannel();
    let requested = 0;
    let exited = 0;
    const context = loadBrowserScript('public/js/dm.js', {
        channel, syncState() {},
        initiativeFeature: () => ({}), sceneFeature: () => ({}), historyFeature: () => ({}), statusFeature: () => ({}), diceFeature: () => ({}), gridFeature: () => ({}), fogFeature: () => ({}), whiteboardFeature: () => ({}), pointerFeature: () => ({ focusMode: false }), shapesFeature: () => ({}),
        attachInitiativeGetters: value => value, createShortcuts: () => ({ list: () => [], attach() {}, detach() {} }), createFocusTrap: () => ({}),
        systemLog: { debug() {}, info() {}, success() {}, warn() {} },
        document: { fullscreenElement: null, documentElement: { requestFullscreen() { requested += 1; } }, exitFullscreen() { exited += 1; }, getElementById: () => null },
    });
    const dm = prepareFeature(context.dmApp(), { openCard: null, canLock: () => true, toggleLock() { this.lockedToggled = true; }, setFogEditing() {}, setWhiteboardActive() {} });
    dm.toggleCard('pointer');
    assert.equal(dm.openCard, 'pointer');
    assert.equal(dm.focusMode, false);
    dm.focusMode = true;
    dm.closeActiveDialog();
    assert.equal(dm.focusMode, false);
    dm.toggleFullscreen();
    assert.equal(requested, 1);
    context.document.fullscreenElement = {};
    dm.toggleFullscreen();
    assert.equal(exited, 1);
    dm.toggleLockShortcut();
    assert.equal(dm.lockedToggled, true);
    dm.disconnectPlayer();
    assert.equal(dm.isLive, false);
    assert.equal(dm.isConnecting, false);
});

test('landing runtime: initializes safely when optional landing-page elements are absent', () => {
    let observers = 0;
    const context = loadBrowserScript('public/js/core/landing.js', {
        IntersectionObserver: class IntersectionObserver { constructor() { observers += 1; } observe() {} unobserve() {} },
        document: { querySelector: () => null, querySelectorAll: () => [] },
        matchMedia: () => ({ matches: true }),
        addEventListener() {},
        scrollY: 0,
    });
    assert.equal(observers, 1);
    assert.equal(typeof context.__runScheduled, 'function');
});
