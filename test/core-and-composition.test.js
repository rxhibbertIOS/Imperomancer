import test from 'node:test';
import assert from 'node:assert/strict';
import { loadBrowserScript } from './helpers/browser.js';

test('focus trap: focuses requested content, cycles tabs, emits Escape, and restores focus', () => {
    const listeners = new Map();
    const previous = { focusCalls: 0, focus() { this.focusCalls += 1; } };
    const first = { focusCalls: 0, hasAttribute: () => false, focus() { this.focusCalls += 1; } };
    const last = { focusCalls: 0, hasAttribute: () => false, focus() { this.focusCalls += 1; } };
    const events = [];
    const context = loadBrowserScript('public/js/core/focus-trap.js', {
        document: {
            activeElement: previous,
            addEventListener(type, handler) { listeners.set(type, handler); },
            removeEventListener(type) { listeners.delete(type); },
        },
    });
    const root = {
        querySelectorAll: () => [first, last], querySelector: selector => selector === '.first' ? first : null,
        contains: item => item === first || item === last,
        dispatchEvent(event) { events.push(event); }, hasAttribute: () => false, setAttribute() {}, focus() {},
    };
    const trap = context.createFocusTrap(root);
    trap.activate({ initialFocus: '.first' });
    context.__runScheduled();
    assert.equal(first.focusCalls, 1);
    let prevented = false;
    listeners.get('keydown')({ key: 'Tab', shiftKey: false, preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
    assert.equal(first.focusCalls, 2, 'Tab from outside enters the first focusable item');
    listeners.get('keydown')({ key: 'Escape' });
    assert.equal(events[0].type, 'focus-trap:escape');
    trap.deactivate();
    assert.equal(previous.focusCalls, 1);
    assert.equal(listeners.has('keydown'), false);
});

test('shortcuts: ignores editable fields, observes guards, and dispatches matching actions', () => {
    let keydown;
    const context = loadBrowserScript('public/js/core/shortcuts.js', {
        MODE: 'dm',
        document: { addEventListener(type, handler) { if (type === 'keydown') keydown = handler; }, removeEventListener() {} },
        systemLog: { warn() {}, error() {} },
    });
    let toggles = 0;
    const shortcuts = context.createShortcuts({ isDialogOpen: false, toggleLive() { toggles += 1; } });
    shortcuts.attach();
    const event = { key: 'l', code: 'KeyL', altKey: true, ctrlKey: false, metaKey: false, shiftKey: false, isComposing: false, target: { tagName: 'DIV' }, preventDefault() {}, stopPropagation() {} };
    keydown(event);
    assert.equal(toggles, 1);
    keydown({ ...event, target: { tagName: 'INPUT', type: 'text' } });
    assert.equal(toggles, 1, 'typing never invokes a global shortcut');
    assert.ok(shortcuts.list().some(item => item.description === 'Toggle Live mode'));
});

test('DM and player composition roots expose their feature contracts without browser initialization', () => {
    const feature = name => () => ({ [`${name}Feature`]: true });
    const base = {
        MODE: 'dm', channel: { addEventListener() {}, removeEventListener() {} }, syncState() {},
        initiativeFeature: feature('initiative'), sceneFeature: feature('scene'), historyFeature: feature('history'), statusFeature: feature('status'), diceFeature: feature('dice'), gridFeature: feature('grid'), fogFeature: feature('fog'), whiteboardFeature: feature('whiteboard'), pointerFeature: feature('pointer'), shapesFeature: feature('shapes'),
        attachInitiativeGetters: component => component, createShortcuts: () => ({ attach() {}, detach() {}, list: () => [] }),
        createFocusTrap: () => ({ activate() {}, deactivate() {} }), systemLog: { debug() {}, info() {}, warn() {}, success() {} },
    };
    const dmContext = loadBrowserScript('public/js/dm.js', base);
    const dm = dmContext.dmApp();
    assert.equal(dm.initiativeFeature, true);
    assert.equal(dm.shapesFeature, true);

    const playerContext = loadBrowserScript('public/js/player.js', { ...base, MODE: 'player' });
    const player = playerContext.playerApp();
    assert.equal(player.sceneFeature, true);
    assert.equal(player.pointerFeature, true);
});
