import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

/**
 * Loads a browser script into an isolated VM with the minimum web APIs needed
 * by feature-level tests. The helper intentionally keeps the mocks small: a
 * test should supply a richer fake when it exercises a browser integration.
 *
 * @param {string} relativePath Path relative to the repository root.
 * @param {object} [overrides] Extra globals for the script under test.
 * @returns {object} The sandbox/global object.
 */
export function loadBrowserScript(relativePath, overrides = {}) {
    const timers = [];
    const context = {
        console,
        Math,
        Date,
        JSON,
        Promise,
        Number,
        String,
        Boolean,
        Object,
        Array,
        Set,
        Map,
        RegExp,
        Error,
        URLSearchParams,
        performance: { now: () => 1000 },
        navigator: { platform: 'Linux', userAgent: 'Node test' },
        location: { search: '', hostname: 'test.local' },
        document: {
            readyState: 'complete',
            addEventListener() {},
            removeEventListener() {},
            querySelector: () => null,
            querySelectorAll: () => [],
            createElement: () => ({ style: {}, setAttribute() {}, append() {} }),
            activeElement: null,
        },
        requestAnimationFrame: callback => {
            timers.push(callback);
            return timers.length;
        },
        cancelAnimationFrame() {},
        setTimeout: callback => {
            timers.push(callback);
            return timers.length;
        },
        clearTimeout() {},
        setInterval: callback => {
            timers.push(callback);
            return timers.length;
        },
        clearInterval() {},
        CustomEvent: class CustomEvent {
            constructor(type, options = {}) { this.type = type; Object.assign(this, options); }
        },
        ...overrides,
    };
    context.window = context;
    context.globalThis = context;
    context.__runScheduled = () => {
        while (timers.length) timers.shift()();
    };
    vm.createContext(context);
    const source = fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
    vm.runInContext(source, context, { filename: relativePath });
    return context;
}

/** Creates a recording BroadcastChannel-like transport. @returns {{messages: object[], postMessage: function(object): void}} */
export function createChannel() {
    return {
        messages: [],
        postMessage(message) { this.messages.push(message); },
    };
}

/** Creates the common Alpine hooks and synchronization spies for a feature. @param {object} feature @param {object} [extra] @returns {object} */
export function prepareFeature(feature, extra = {}) {
    Object.assign(feature, {
        $data: feature,
        $watch() {},
        $nextTick(callback) { callback(); },
        ...extra,
    });
    return feature;
}

/** Returns a canvas context stub that records operations for rendering assertions. @returns {{calls: Array, context: object}} */
export function createCanvasContext() {
    const calls = [];
    const context = new Proxy({
        calls,
        save: () => calls.push(['save']), restore: () => calls.push(['restore']),
        beginPath: () => calls.push(['beginPath']), closePath: () => calls.push(['closePath']),
        moveTo: (...args) => calls.push(['moveTo', ...args]), lineTo: (...args) => calls.push(['lineTo', ...args]),
        arc: (...args) => calls.push(['arc', ...args]), rect: (...args) => calls.push(['rect', ...args]),
        fill: () => calls.push(['fill']), stroke: () => calls.push(['stroke']), clip: () => calls.push(['clip']),
        drawImage: (...args) => calls.push(['drawImage', ...args]),
        fillRect: (...args) => calls.push(['fillRect', ...args]), strokeRect: (...args) => calls.push(['strokeRect', ...args]),
        clearRect: (...args) => calls.push(['clearRect', ...args]), setTransform: (...args) => calls.push(['setTransform', ...args]),
        setLineDash: (...args) => calls.push(['setLineDash', ...args]),
        strokeText: (...args) => calls.push(['strokeText', ...args]), fillText: (...args) => calls.push(['fillText', ...args]),
        createLinearGradient: () => ({ addColorStop() {} }),
    }, { get(target, property) { return property in target ? target[property] : undefined; }, set(target, property, value) { calls.push(['set', property, value]); target[property] = value; return true; } });
    return { calls, context };
}

/** Converts values created in a VM realm to plain host-realm JSON data. @param {*} value @returns {*} */
export function plain(value) {
    return JSON.parse(JSON.stringify(value));
}
