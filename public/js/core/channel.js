/** Cross-window synchronization transport for the DM and player views. @type {BroadcastChannel} */
window.channel = new BroadcastChannel('dnd-hud');

/**
 * Deep clone that strips out anything non-serialisable
 * (Three.js objects, canvases, audio, DOM nodes).
 */
/** Produces a JSON-safe clone, omitting DOM and rendering objects. @param {*} obj @returns {*} */
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

/** Derives table-display pixels per physical inch from calibration settings. @param {object} data @returns {number} */
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
/** Selects the serializable state that the player window needs. @param {object} data @param {{includeScene?:boolean,scene?:object,transition?:string,scenePublished?:boolean}} [opts] @returns {object} */
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
        fogEnabled: source.fogEnabled === true,
        fogColor: source.fogColor || '#3e434e',
        fogStrokes: source.fogStrokes || [],
        whiteboardActive: data.whiteboardActive === true,
        whiteboardStrokes: data.whiteboardStrokes || [],
        whiteboardPreview: data.whiteboardPreview || null,
        gridType:         source.gridType         ?? 'square',
        gridShowLabels:   source.gridShowLabels   === true,
        gridLabelEvery:   source.gridLabelEvery   ?? 5,
        gridOpacity:      source.gridOpacity      ?? 0.5,
        scenePxPerCell:   source.scenePxPerCell   ?? 100,
        sceneGridOriginX: source.sceneGridOriginX ?? 0,
        sceneGridOriginY: source.sceneGridOriginY ?? 0,
        cellUnits: source.cellUnits ?? data.cellUnits ?? 5,
        unitNameSingular: source.unitNameSingular ?? data.unitNameSingular ?? 'foot',
        unitNamePlural: source.unitNamePlural ?? data.unitNamePlural ?? 'feet',
        locked: source.locked === true,
        tablePpi:            computeTablePpi(data),
        tableDiagonal:       data.tableDiagonal   ?? 55,
        tableAspectW:        data.tableAspectW    ?? 16,
        tableAspectH:        data.tableAspectH    ?? 9,
        tableCorrection:     data.tableCorrection ?? 1,
        showCalibrationSquare: data.showCalibrationSquare === true,
        focusPings: data.focusPings ?? [],
        effects: (source.effects || []).filter(effect => effect.visibility !== 'private'),
        flashShapes: (data.flashShapes || []).filter(s => s.visibility !== 'private'),
        shapePreview: data.dragShape && data.effectDraft?.visibility !== 'private' ? data.dragShape : null,
        isLive: true,
    };

    if (includeScene) {
        out.currentImage = source.currentImage ?? null;
        out.scenePublished = opts.scenePublished === true;
    }
    return out;
};

window.defaultState = window.pickSyncState({});

let stateRevision = 0;

/** Broadcasts a monotonically versioned player-state snapshot. @param {object} state @param {object} [opts] @returns {void} */
window.syncState = function(state, opts) {
    const payload = window.pickSyncState(state, opts);
    payload.revision = ++stateRevision;
    window.channel.postMessage({
        type: 'sync',
        state: window.clone(payload),
    });
};

let viewSequence = 0;
let inFlightViewSequence = null;
let latestView = null;

/** Attaches a dedicated MessagePort for acknowledged, back-pressure-aware view updates. @param {MessagePort} port @returns {void} */
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

/** Sends the newest pending view only when no previous view awaits acknowledgement. @returns {void} */
function sendLatestView() {
    if (inFlightViewSequence !== null || !latestView) return;
    const view = latestView;
    latestView = null;
    const sequence = ++viewSequence;
    inFlightViewSequence = sequence;
    const transport = window.viewPort || window.channel;
    transport.postMessage({ type: 'view', sequence, view });
}

/** Queues a viewport update, collapsing intermediate frames. @param {object} data @returns {void} */
window.syncView = function(data) {
    latestView = {
        cx: data.view?.cx ?? 0,
        cy: data.view?.cy ?? 0,
        sceneW: data.view?.sceneW ?? 0,
    };
    sendLatestView();
};

/** Releases the next queued viewport update after matching an acknowledgement. @param {number} sequence @returns {void} */
window.acknowledgeView = function(sequence) {
    if (sequence !== inFlightViewSequence) return;
    inFlightViewSequence = null;
    sendLatestView();
};

/** Clears pending viewport delivery state, usually after transport replacement. @returns {void} */
window.resetViewSync = function() {
    inFlightViewSequence = null;
    latestView = null;
};

// Publish the selected scene and its display settings to the player.
/** Publishes a selected scene and display configuration to the player. @param {object} state @param {object} scene @param {string} [transition='none'] @returns {void} */
window.broadcastScene = function(state, scene, transition = 'none') {
    window.resetViewSync();
    const payload = window.pickSyncState(state, {
        includeScene: true,
        scene,
        transition,
        scenePublished: true,
    });
    payload.revision = ++stateRevision;
    window.channel.postMessage({
        type: 'sync',
        state: window.clone(payload),
    });
};

window.sync = window.syncState;
