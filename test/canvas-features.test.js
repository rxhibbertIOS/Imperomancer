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
    feature.whiteboardPreview = { tool: 'pencil', points: [{ x: 0, y: 0 }] };
    feature.setWhiteboardActive(true);
    feature.setWhiteboardActive(false);
    assert.equal(feature.whiteboardStrokes.length, 1);
    assert.equal(feature.whiteboardPreview, null);
    feature.whiteboardPreview = { tool: 'pencil', points: [{ x: 0, y: 0 }] };
    feature.clearWhiteboard();
    assert.deepEqual(plain(feature.whiteboardStrokes), []);
    assert.equal(feature.whiteboardPreview, null);
    assert.ok(syncCalls.length >= 3);
});

test('whiteboard: supports safe tool and colour selection, arrows, highlighters, and undo', () => {
    const { context, syncCalls } = setup('public/js/features/whiteboard.js');
    const { calls, context: canvasContext } = createCanvasContext();
    const feature = prepareFeature(context.whiteboardFeature(), { drawWhiteboard() {} });

    assert.equal(feature.setWhiteboardTool('arrow'), true);
    assert.equal(feature.whiteboardTool, 'arrow');
    assert.equal(feature.setWhiteboardTool('text'), false);
    assert.equal(feature.whiteboardTool, 'arrow');
    assert.equal(feature.setWhiteboardColor('#EF4444'), true);
    assert.equal(feature.whiteboardColor, '#ef4444');
    assert.equal(feature.setWhiteboardColor('rgba(0,0,0,1)'), false);

    feature.whiteboardDrawStroke(canvasContext, {
        tool: 'arrow', color: '#ef4444', size: 8,
        points: [{ x: 0.1, y: 0.2 }, { x: 0.8, y: 0.7 }],
    }, 1000, 600);
    feature.whiteboardDrawStroke(canvasContext, {
        tool: 'highlighter', color: '#eab308', size: 12,
        points: [{ x: 0.1, y: 0.1 }, { x: 0.4, y: 0.3 }],
    }, 1000, 600);
    assert.ok(calls.filter(call => call[0] === 'lineTo').length >= 4);
    assert.ok(calls.some(call => call[0] === 'set' && call[1] === 'globalAlpha' && call[2] === 0.35));

    feature.whiteboardStrokes = [{ tool: 'pencil' }, { tool: 'line' }];
    assert.equal(feature.undoWhiteboard(), true);
    assert.deepEqual(plain(feature.whiteboardStrokes), [{ tool: 'pencil' }]);
    assert.equal(feature.undoWhiteboard(), true);
    assert.equal(feature.undoWhiteboard(), false);
    assert.ok(syncCalls.length >= 2);
});

test('whiteboard: maintains a private DM brush cursor with the rendered stroke size', () => {
    const { context } = setup('public/js/features/whiteboard.js');
    const feature = prepareFeature(context.whiteboardFeature(), {
        getWhiteboardCanvas: () => ({
            clientWidth: 1200,
            getBoundingClientRect: () => ({ left: 100, top: 50, width: 1200, height: 600 }),
        }),
    });
    feature.whiteboardActive = true;
    feature.whiteboardSize = 10;
    feature.whiteboardColor = '#3b82f6';
    assert.equal(feature.updateWhiteboardCursor({ clientX: 700, clientY: 350 }), true);
    assert.deepEqual(plain(feature.whiteboardCursor), { x: 0.5, y: 0.5 });
    assert.deepEqual(plain(feature.whiteboardCursorStyle()), {
        left: '50%', top: '50%', width: '12px', height: '12px', '--whiteboard-cursor-colour': '#3b82f6',
    });
    feature.hideWhiteboardCursor();
    assert.equal(feature.whiteboardCursor, null);
    context.MODE = 'player';
    assert.equal(feature.updateWhiteboardCursor({ clientX: 700, clientY: 350 }), false);
    assert.equal(feature.whiteboardCursor, null);
});
