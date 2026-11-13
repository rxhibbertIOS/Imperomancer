import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvasContext, createChannel, loadBrowserScript, plain, prepareFeature } from './helpers/browser.js';

function setup(file, extras = {}) {
    const channel = createChannel();
    const syncCalls = [];
    const context = loadBrowserScript(file, {
        MODE: 'dm', channel,
        syncState: state => syncCalls.push(state),
        systemLog: { info() {}, success() {}, warn() {}, danger() {} },
        ...extras,
    });
    return { context, channel, syncCalls };
}

test('fog: records only permitted strokes and synchronizes completed drawing', () => {
    const { context, syncCalls } = setup('public/js/features/fog.js');
    const feature = prepareFeature(context.fogFeature(), {
        screenToScene: (x, y) => ({ x: x / 2, y: y / 2 }),
        saveSelectedScene() { this.saved = true; },
        drawFog() { this.draws = (this.draws || 0) + 1; },
    });
    assert.equal(feature.fogPointerStart({ button: 2 }), false);
    feature.fogEnabled = true;
    feature.fogEditing = true;
    feature.fogTool = 'reveal';
    feature.fogBrush = 'square';
    feature.fogBrushCells = 3;
    assert.equal(feature.fogPointerStart({ button: 0, clientX: 20, clientY: 40 }), true);
    assert.deepEqual({ ...feature.fogStrokes[0] }, { mode: 'reveal', shape: 'square', size: 3, x: 10, y: 20 });
    feature.fogPointerEnd();
    assert.equal(feature._fogDrawing, false);
    assert.equal(feature.saved, true);
    assert.equal(syncCalls.length, 1);
    feature.clearFog();
    assert.equal(feature.fogEnabled, false);
    feature.resetFog();
    assert.equal(feature.fogEnabled, true);
    assert.equal(feature.fogEditing, true);
});

test('fog: converts colors defensively and renders reveal strokes without crashing', () => {
    const { context } = setup('public/js/features/fog.js');
    const { calls, context: canvasContext } = createCanvasContext();
    const feature = prepareFeature(context.fogFeature(), {
        fogEnabled: true, fogColor: '#abc', scenePxPerCell: 100,
        sceneToStage: (x, y) => ({ x, y }),
    });
    assert.deepEqual({ ...feature.fogRgb() }, { r: 170, g: 187, b: 204 });
    feature.fogColor = 'invalid';
    assert.deepEqual({ ...feature.fogRgb() }, { r: 62, g: 67, b: 78 });
    feature.fogColor = '#334455';
    feature.fogStrokes = [{ mode: 'reveal', shape: 'round', size: 1, x: 30, y: 30 }];
    feature._fogCanvas = { isConnected: true, clientWidth: 100, clientHeight: 80, width: 0, height: 0, getContext: () => canvasContext };
    feature._drawFog();
    assert.ok(calls.some(call => call[0] === 'fillRect'));
    assert.ok(calls.some(call => call[0] === 'arc'));
    assert.equal(canvasContext.globalCompositeOperation, 'source-over');
});

test('whiteboard: normalizes points, commits strokes, and does not permit player drawing', () => {
    const { context, syncCalls } = setup('public/js/features/whiteboard.js');
    const feature = prepareFeature(context.whiteboardFeature(), {
        getWhiteboardCanvas: () => ({ getBoundingClientRect: () => ({ left: 10, top: 20, width: 100, height: 200 }) }),
        drawWhiteboard() {},
    });
    assert.deepEqual({ ...feature.whiteboardPoint({ clientX: -10, clientY: 500 }) }, { x: 0, y: 1 });
    feature.whiteboardActive = true;
    feature.whiteboardTool = 'line';
    feature.whiteboardPointerDown({ button: 0, clientX: 20, clientY: 40, pointerId: 1, currentTarget: { setPointerCapture() {} } });
    feature.whiteboardPointerMove({ clientX: 90, clientY: 180 });
    feature.whiteboardPointerUp({ currentTarget: { releasePointerCapture() {} }, pointerId: 1 });
    assert.equal(feature.whiteboardStrokes.length, 1);
    assert.equal(feature.whiteboardStrokes[0].tool, 'line');
    assert.equal(feature.whiteboardStrokes[0].points.length, 2);
    assert.ok(syncCalls.length >= 1);

    context.MODE = 'player';
    feature.whiteboardPointerDown({ button: 0, clientX: 20, clientY: 40, pointerId: 2, currentTarget: {} });
    assert.equal(feature.whiteboardStrokes.length, 1);
});

test('whiteboard: toggling hides without erasing while clear removes all strokes', () => {
    const { context, syncCalls } = setup('public/js/features/whiteboard.js');
    const feature = prepareFeature(context.whiteboardFeature(), { drawWhiteboard() {} });
    feature.whiteboardStrokes = [{ points: [{ x: 0, y: 0 }] }];
    feature.setWhiteboardActive(true);
    feature.setWhiteboardActive(false);
    assert.equal(feature.whiteboardStrokes.length, 1);
    feature.clearWhiteboard();
    assert.deepEqual(plain(feature.whiteboardStrokes), []);
    assert.ok(syncCalls.length >= 3);
});
