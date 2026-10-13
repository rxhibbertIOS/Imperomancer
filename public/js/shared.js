// ============================================================
// SHARED UTILITIES – no modules, just globals
// ============================================================

window.LOG = function(...args) {
    console.log(`[${window.MODE?.toUpperCase() || '??'}]`, ...args);
};
window.WARN = function(...args) {
    console.warn(`[${window.MODE?.toUpperCase() || '??'}]`, ...args);
};
window.ERR = function(...args) {
    console.error(`[${window.MODE?.toUpperCase() || '??'}]`, ...args);
};

window.channel = new BroadcastChannel('dnd-hud');

window.uid = function() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
};

window.roll = function(sides) {
    return Math.floor(Math.random() * sides) + 1;
};

/**
 * Deep clone that strips out anything non-serialisable
 * (Three.js objects, canvases, audio, DOM nodes).
 */
window.clone = function(obj) {
    return JSON.parse(JSON.stringify(obj, (key, value) => {
        if (value && typeof value === 'object') {
            // Three.js objects
            if (value.isObject3D || value.isVector3 || value.isQuaternion ||
                value.isEuler || value.isMatrix4 || value.isMaterial ||
                value.isScene || value.isCamera || value.isWebGLRenderer) {
                return undefined;
            }
            // DOM
            if (typeof HTMLCanvasElement !== 'undefined' && value instanceof HTMLCanvasElement) return undefined;
            if (typeof HTMLAudioElement  !== 'undefined' && value instanceof HTMLAudioElement)  return undefined;
            if (typeof HTMLElement      !== 'undefined' && value instanceof HTMLElement)      return undefined;
            if (typeof Node             !== 'undefined' && value instanceof Node)             return undefined;
            // Functions
            if (typeof value === 'function') return undefined;
        }
        return value;
    }));
};

/**
 * The only fields we want to broadcast between tabs.
 * Prevents the dice box / Three.js objects from being stringified.
 */
window.pickSyncState = function(data) {
    return {
        currentImage:   data.currentImage   ?? null,
        mediaType:      data.mediaType      ?? 'image',
        zoom:           data.zoom           ?? 1,
        panX:           data.panX           ?? 0,
        panY:           data.panY           ?? 0,
        transition:     data.transition     ?? 'none',
        combatants:     data.combatants     ?? [],
        currentTurn:    data.currentTurn    ?? 0,
        round:          data.round          ?? 1,
        showInitiative: data.showInitiative !== false,
        initiative360:         data.initiative360         === true,
        initiativeCollapsed:   data.initiativeCollapsed   === true,
        edges: {
            top:    data.edges?.top    !== false,
            right:  data.edges?.right  !== false,
            bottom: data.edges?.bottom !== false,
            left:   data.edges?.left   !== false,
        },
        transition:     data.transition     ?? 'none',
        isLive:         true
    };
};

window.defaultState = window.pickSyncState({});

/**
 * Sync only the whitelisted fields — never the whole `$data`.
 */
window.syncState = function(state) {
    window.channel.postMessage({
        type: 'sync',
        state: window.clone(window.pickSyncState(state)),
    });
};

/**
 * Parse simple dice notation like "2d6+3", "1d20", "4d6-1"
 */
window.parseNotation = function(notation) {
    if (!notation) return null;
    const m = String(notation).trim().match(/^(\d+)d(\d+)(?:\s*([+-])\s*(\d+))?$/i);
    if (!m) return null;
    const count = parseInt(m[1], 10);
    const sides = parseInt(m[2], 10);
    if (count < 1 || count > 100 || sides < 2 || sides > 1000) return null;
    let mod = 0;
    if (m[4]) mod = parseInt(m[4], 10) * (m[3] === '-' ? -1 : 1);
    return { count, sides, mod };
};

LOG('✅ shared.js loaded');