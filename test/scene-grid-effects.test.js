import test from 'node:test';
import assert from 'node:assert/strict';
import { loadBrowserScript, plain, prepareFeature } from './helpers/browser.js';

function setup(file, extras = {}) {
    const syncCalls = [];
    const context = loadBrowserScript(file, {
        MODE: 'dm',
        syncState: state => syncCalls.push(state),
        systemLog: { info() {}, success() {}, warn() {}, danger() {} },
        localStorage: { getItem: () => null, setItem() {} },
        ...extras,
    });
    return { context, syncCalls };
}

test('grid: formats labels and units, rejects invalid units, and calculates calibration', () => {
    const { context, syncCalls } = setup('public/js/features/grid.js');
    const feature = prepareFeature(context.gridFeature(), { drawGrid() {}, saveGridSettings() {} });
    assert.equal(feature.colLabel(0), 'A');
    assert.equal(feature.colLabel(25), 'Z');
    assert.equal(feature.colLabel(26), 'AA');
    feature.setGridUnits(5, 'foot', 'feet');
    assert.equal(feature.unitSummary(), '1 cell = 5 feet');
    assert.equal(feature.formatDistance(2.5), '12.5 feet');
    feature.setGridUnits(-1, '', '');
    assert.equal(feature.cellUnits, 0);
    assert.equal(feature.unitNameSingular, 'unit');
    assert.equal(feature.unitNamePlural, 'units');
    feature.tableDiagonal = 55;
    feature.tableAspectW = 16;
    feature.tableAspectH = 9;
    feature.tableScreenWidth = 1920;
    feature.tableCorrection = 1;
    const original = feature.computeTablePpi();
    feature.calibrate(2);
    assert.equal(feature.tablePpi, original / 2);
    assert.ok(syncCalls.length >= 1);
    feature.resetCalibration();
    assert.equal(feature.tableCorrection, 1);
});

test('grid: explains unavailable locking and locks only with valid scene/display metadata', () => {
    const { context } = setup('public/js/features/grid.js');
    const feature = prepareFeature(context.gridFeature(), {
        drawGrid() {}, clearEffects() {},
        naturalSize: () => ({ nw: 1000, nh: 500 }),
        view: { cx: 500, cy: 250, sceneW: 1000 },
    });
    assert.match(feature.lockUnavailableReason(), /Connect the player display/);
    feature.playerStageW = 1000;
    feature.scenePxPerCell = 100;
    feature.tablePpi = 100;
    assert.equal(feature.canLock(), true);
    assert.equal(feature.lockedSceneW(), 1000);
    feature.locked = true;
    feature.toggleLock();
    assert.equal(feature.view.sceneW, 1000);
    feature.locked = false;
    feature.toggleLock();
    assert.ok(feature.saved === undefined, 'unlock is safe without optional scene hooks');
});

test('scene: captures/restores settings without leaking effects between prepared scenes', () => {
    const { context } = setup('public/js/features/scene.js', { crypto: { randomUUID: () => 'scene-id' } });
    const feature = prepareFeature(context.sceneFeature(), {
        gridVisible: true, gridType: 'hex-flat', gridShowLabels: true, gridLabelEvery: 2, gridOpacity: 0.7,
        scenePxPerCell: 80, sceneGridOriginX: 4, sceneGridOriginY: 5, locked: true,
        fogEnabled: true, fogColor: '#123456', fogStrokes: [{ x: 1 }], effects: [{ id: 'persisted' }], flashShapes: [{ id: 'flash' }],
        view: { cx: 50, cy: 60, sceneW: 700 },
        $nextTick(callback) { callback(); }, ensureScenePlayback() {}, drawGrid() {}, reevalLock() {},
    });
    const saved = feature.captureSceneSettings();
    assert.equal(saved.gridType, 'hex-flat');
    assert.equal(saved.fogStrokes.length, 1);
    feature.scenes = [{ id: 'one', name: 'One', ...saved }];
    feature.selectedSceneId = 'one';
    feature.restoreSelectedScene();
    assert.deepEqual(plain(feature.effects), [], 'effects are intentionally scoped to a newly restored board');
    assert.deepEqual(plain(feature.flashShapes), []);
    assert.equal(feature.fogEnabled, true);
});

test('scene: portrait fit follows the actual player viewport, not the physical screen ratio', () => {
    const { context } = setup('public/js/features/scene.js');
    const feature = prepareFeature(context.sceneFeature(), {
        stageOuter: { W: 1200, H: 900 },
        tableScreenWidth: 1920,
        tableScreenHeight: 1080,
        playerStageW: 0,
        playerStageH: 0,
        view: { cx: 500, cy: 1000, sceneW: 2000 * (16 / 9) },
        naturalSize: () => ({ nw: 1000, nh: 2000 }),
        isSelectedPublishedScene: () => false,
        drawGrid() {},
        drawFog() {},
    });

    assert.deepEqual(plain(feature.stageSize()), { W: 1200, H: 675 });
    feature.playerStageW = 1200;
    feature.playerStageH = 900;
    feature.onPlayerStageAspectChanged(0, 0);
    assert.deepEqual(plain(feature.stageSize()), { W: 1200, H: 900 });
    assert.equal(feature.view.sceneW, 2000 * (4 / 3));
    const transform = feature.sceneTransform();
    assert.equal(transform.scale * 2000, 900, 'the player now sees the portrait image from top to bottom');

    feature.view = { cx: 400, cy: 900, sceneW: 1200 };
    feature.onPlayerStageAspectChanged(1200, 900);
    assert.equal(feature.view.sceneW, 1200, 'a deliberate zoom is never overwritten');
});

test('grid: forwards real player-stage dimensions to the scene aspect handler', () => {
    const { context } = setup('public/js/features/grid.js');
    const calls = [];
    const feature = prepareFeature(context.gridFeature(), {
        onPlayerStageAspectChanged: (...args) => calls.push(args), reevalLock() {}, drawGrid() {},
    });
    feature.playerStageW = 800;
    feature.playerStageH = 600;
    feature.onPlayerStage({ stageW: 1200, stageH: 900 });
    assert.deepEqual(calls, [[800, 600]]);
    assert.equal(feature.playerStageW, 1200);
    assert.equal(feature.playerStageH, 900);
});

test('grid: persists valid settings, migrates calibration, and ignores unusable image metadata', () => {
    const store = new Map([['dm.calibration', JSON.stringify({ displayDiagonal: 42, displayAspectW: 4, displayAspectH: 3, displayCorrection: 1.2 })]]);
    const { context } = setup('public/js/features/grid.js', {
        localStorage: { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) },
    });
    const feature = prepareFeature(context.gridFeature(), { drawGrid() {}, reevalLock() {} });
    feature.loadCalibration();
    assert.equal(feature.tableDiagonal, 42);
    assert.equal(feature.tableAspectW, 4);
    assert.equal(feature.tableCorrection, 1.2);
    feature.getSceneEl = () => ({ naturalWidth: 1000 });
    feature.gridCellsAcross = 20;
    feature.applyCellsAcross();
    assert.equal(feature.scenePxPerCell, 50);
    feature.scenePxPerCell = 125;
    feature.applyPxPerCell();
    assert.equal(feature.gridCellsAcross, 8);
    assert.equal(feature.describeDistance(250), '10 feet');
    feature.flushGridSettings();
    assert.equal(JSON.parse(store.get('dm.grid')).scenePxPerCell, undefined, 'per-scene grid size is never persisted globally');
    feature.getSceneEl = () => ({ naturalWidth: 0 });
    feature.gridCellsAcross = 0;
    feature.applyCellsAcross();
    assert.equal(feature.gridCellsAcross, 0, 'invalid source media is ignored');
});

test('effects: sanitize persistent layers, select topmost geometry, and escape labels in SVG markup', () => {
    const { context, syncCalls } = setup('public/js/features/shapes.js', {
        effectGeometry: { snapToCellCenter: point => point, distance: () => 0, squareEndpoint: () => ({}), coneWidth: () => 0 },
    });
    const feature = prepareFeature(context.shapesFeature(), {
        scenePxPerCell: 100,
        effectDraft: { color: '#123456', opacity: 3, label: '<unsafe>', visibility: 'private', persistent: true, showDistance: true },
        sceneToStage: (x, y) => ({ x, y }),
        formatDistance: () => '5 feet',
        saveSelectedScene() {},
        screenToScene: () => ({ x: 100, y: 0 }),
    });
    feature.addEffect({ geometry: { kind: 'line', anchor: { x: 0, y: 0 }, endpoint: { x: 100, y: 0 } } });
    assert.equal(feature.effects[0].opacity, 1);
    assert.equal(feature.effects[0].visibility, 'private');
    assert.match(feature.shapeLayerMarkup(), /&lt;unsafe&gt;/);
    assert.doesNotMatch(feature.shapeLayerMarkup(), /<unsafe>/);
    const bottom = feature.effects[0];
    feature.effects = [...feature.effects, { ...bottom, id: 'top', visibility: 'public' }];
    feature.effectSelectMode = true;
    feature.selectEffectAt({ clientX: 0, clientY: 0 });
    assert.equal(feature.selectedEffectId, 'top', 'reverse scan selects the visually topmost matching layer');
    feature.deleteSelectedEffect();
    assert.equal(feature.effects.length, 1);
    assert.ok(syncCalls.length >= 2);
});

test('scene: publishes a clean snapshot, clears focus pings, and guards invalid uploads', () => {
    const published = [];
    const { context } = setup('public/js/features/scene.js', {
        clone: value => JSON.parse(JSON.stringify(value)),
        broadcastScene: (...args) => published.push(args),
        crypto: { randomUUID: () => 'new-scene' },
    });
    const feature = prepareFeature(context.sceneFeature(), {
        selectedSceneId: 'one', publishedSceneId: null, publishTransition: 'fade', focusPings: [{ id: 'ping' }],
        scenes: [{ id: 'one', name: 'Crypt', dirty: true, currentImage: 'map', mediaType: 'image', view: { cx: 1, cy: 2, sceneW: 3 } }],
        captureSceneSettings() { return { currentImage: 'map', mediaType: 'image', view: { cx: 1, cy: 2, sceneW: 3 } }; },
    });
    feature.publishSelectedScene();
    assert.equal(feature.publishedScene.name, 'Crypt');
    assert.equal(feature.publishedScene.transition, 'fade');
    assert.equal(feature.scenes[0].dirty, false);
    assert.deepEqual(plain(feature.focusPings), []);
    assert.equal(published.length, 1);

    const input = { files: [{ type: 'application/pdf', size: 10 }], value: 'file' };
    feature.handleImageUpload({ target: input });
    assert.match(feature.sceneUploadError, /image or video/i);
    assert.equal(input.value, '');
});

test('shapes: only opens when the grid is locked and handles cancellation without publishing', () => {
    const { context } = setup('public/js/features/shapes.js', {
        effectGeometry: { snapToCellCenter: point => point, distance: () => 0, squareEndpoint: () => ({}), coneWidth: () => 0 },
    });
    const feature = prepareFeature(context.shapesFeature(), {
        gridVisible: true, locked: false,
        getStageInnerEl: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }), querySelector: () => null }),
        screenToScene: () => ({ x: 5, y: 6 }), snapShapePoint: point => point,
    });
    feature.openEffectsPalette();
    assert.equal(feature.shapeMenu, null);
    feature.locked = true;
    feature.openEffectsPalette();
    assert.deepEqual({ ...feature.shapeMenu }, { x: 50, y: 50, sceneX: 5, sceneY: 6 });
    feature.pendingShapeKind = 'line';
    feature.dragShape = { kind: 'line' };
    feature.cancelShapeDrag();
    assert.equal(feature.pendingShapeKind, null);
    assert.equal(feature.dragShape, null);
});
