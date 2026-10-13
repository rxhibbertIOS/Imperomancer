window.channel = new BroadcastChannel('dnd-hud');

/**
 * Deep clone that strips out anything non-serialisable
 * (Three.js objects, canvases, audio, DOM nodes).
 */
window.clone = function(obj) {
    return JSON.parse(JSON.stringify(obj, (key, value) => {
        if (value && typeof value === 'object') {
            if (value.isObject3D || value.isVector3 || value.isQuaternion ||
                value.isEuler || value.isMatrix4 || value.isMaterial ||
                value.isScene || value.isCamera || value.isWebGLRenderer) {
                return undefined;
            }
            if (typeof HTMLCanvasElement !== 'undefined' && value instanceof HTMLCanvasElement) return undefined;
            if (typeof HTMLAudioElement  !== 'undefined' && value instanceof HTMLAudioElement)  return undefined;
            if (typeof HTMLElement      !== 'undefined' && value instanceof HTMLElement)      return undefined;
            if (typeof Node             !== 'undefined' && value instanceof Node)             return undefined;
            if (typeof value === 'function') return undefined;
        }
        return value;
    }));
};

function computeTablePpi(data) {
    const diag = Math.hypot(data.tableAspectW || 16, data.tableAspectH || 9);
    const physW = (data.tableDiagonal || 55) * (data.tableAspectW || 16) / diag;
    const w = data.tableScreenWidth || 1920;
    if (!physW) return 40;
    return (w / physW) * (data.tableCorrection || 1);
}

/**
 * The only fields we want to broadcast between tabs.
 * Prevents the dice box / Three.js objects from being stringified.
 */
window.pickSyncState = function(data, opts = {}) {
    const includeScene = opts.includeScene === true;
    const editingPublishedScene = data.selectedSceneId &&
        data.selectedSceneId === data.publishedSceneId;
    const scene = opts.scene || (editingPublishedScene ? null : data.publishedScene);
    const source = scene ? { ...data, ...scene } : data;
    const out = {
        mediaType:      source.mediaType      ?? 'image',

        view: {
            cx:     source.view?.cx     ?? 0,
            cy:     source.view?.cy     ?? 0,
            sceneW: source.view?.sceneW ?? 0,
        },
        playerStageW: data.playerStageW ?? 0,
        playerStageH: data.playerStageH ?? 0,

        transition:     opts.transition ?? source.transition ?? 'none',
        combatants:     data.combatants     ?? [],
        currentTurn:    data.currentTurn    ?? 0,
        round:          data.round          ?? 1,
        showInitiative: data.showInitiative !== false,
        initiative360:       data.initiative360       === true,
        initiativeCollapsed: data.initiativeCollapsed === true,
        edges: {
            top:    data.edges?.top    !== false,
            right:  data.edges?.right  !== false,
            bottom: data.edges?.bottom !== false,
            left:   data.edges?.left   !== false,
        },

        gridVisible:      source.gridVisible      === true,
        gridType:         source.gridType         ?? 'square',
        gridShowLabels:   source.gridShowLabels   === true,
        gridLabelEvery:   source.gridLabelEvery   ?? 5,
        gridOpacity:      source.gridOpacity      ?? 0.5,
        scenePxPerCell:   source.scenePxPerCell   ?? 100,
        sceneGridOriginX: source.sceneGridOriginX ?? 0,
        sceneGridOriginY: source.sceneGridOriginY ?? 0,
        locked: source.locked === true,
        tablePpi:            computeTablePpi(data),
        tableDiagonal:       data.tableDiagonal   ?? 55,
        tableAspectW:        data.tableAspectW    ?? 16,
        tableAspectH:        data.tableAspectH    ?? 9,
        tableCorrection:     data.tableCorrection ?? 1,
        showCalibrationSquare: data.showCalibrationSquare === true,
        focusPings: data.focusPings ?? [],
        flashShapes: (data.flashShapes || []).filter(s => s.visibility !== 'private'),
        isLive: true,
    };

    if (includeScene) {
        out.currentImage = source.currentImage ?? null;
        out.scenePublished = opts.scenePublished === true;
    }
    return out;
};

window.defaultState = window.pickSyncState({});

window.syncState = function(state, opts) {
    window.channel.postMessage({
        type: 'sync',
        state: window.clone(window.pickSyncState(state, opts)),
    });
};

let viewSequence = 0;
let inFlightViewSequence = null;
let latestView = null;

window.attachViewPort = function(port) {
    window.resetViewSync();
    window.viewPort?.close();
    window.viewPort = port;
    port.onmessage = ({ data }) => {
        if (data?.type === 'viewAck') window.acknowledgeView(data.sequence);
        else if (data?.type === 'viewReady') window.onViewPortReady?.();
        else if (data?.type === 'viewPong') window.onViewPortPong?.();
    };
    port.start?.();
};

function sendLatestView() {
    if (inFlightViewSequence !== null || !latestView) return;
    const view = latestView;
    latestView = null;
    const sequence = ++viewSequence;
    inFlightViewSequence = sequence;
    const transport = window.viewPort || window.channel;
    transport.postMessage({ type: 'view', sequence, view });
}

window.syncView = function(data) {
    latestView = {
        cx: data.view?.cx ?? 0,
        cy: data.view?.cy ?? 0,
        sceneW: data.view?.sceneW ?? 0,
    };
    sendLatestView();
};

window.acknowledgeView = function(sequence) {
    if (sequence !== inFlightViewSequence) return;
    inFlightViewSequence = null;
    sendLatestView();
};

window.resetViewSync = function() {
    inFlightViewSequence = null;
    latestView = null;
};

// Publish the selected scene and its display settings to the player.
window.broadcastScene = function(state, scene, transition = 'none') {
    window.resetViewSync();
    window.channel.postMessage({
        type: 'sync',
        state: window.clone(window.pickSyncState(state, {
            includeScene: true,
            scene,
            transition,
            scenePublished: true,
        })),
    });
};

window.sync = window.syncState;