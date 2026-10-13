// js/features/pointer.js

// Preset swatches shown in the scrollable picker.
// Order matters — first entry is used as the initial default.
const POINTER_COLOR_PRESETS = [
    '#ffcc00', // gold  ← default
    '#ff3b30', // red
    '#ff9500', // orange
    '#ffd60a', // yellow
    '#34c759', // green
    '#00c7be', // teal
    '#30b0c7', // cyan
    '#007aff', // blue
    '#5856d6', // indigo
    '#af52de', // purple
    '#ff2d55', // pink
    '#4ecdc4', // mint
    '#a8e6cf', // pastel green
    '#dda0dd', // plum
    '#ffffff', // white
    '#c7c7cc', // light grey
    '#8e8e93', // grey
    '#000000', // black
];

const DEFAULT_POINTER_COLOR = '#ffcc00';

function pointerFeature() {
    return {
        focusMode: false,
        focusPings: [],

        // NEW: current colour + presets + fallback
        pointerColor: DEFAULT_POINTER_COLOR,
        pointerColorPresets: POINTER_COLOR_PRESETS,
        defaultPointerColor: DEFAULT_POINTER_COLOR,

        initPointer() {},

        toggleFocusMode() {
            this.focusMode = !this.focusMode;
        },

        // NEW: called by swatches, the <input type="color">, and the reset button
        setPointerColor(color) {
            if (typeof color !== 'string' || !color) return;
            const next = color.toLowerCase();
            if (this.pointerColor === next) return;
            this.pointerColor = next;
            if (window.syncState && window.MODE === 'dm') {
                window.syncState(this.$data);
            }
        },

        handleFocusClick(ev) {
            if (!this.focusMode || ev.button !== 0) return;
            ev.preventDefault();
            ev.stopPropagation();
            const pt = this.screenToScene(ev.clientX, ev.clientY);
            if (!pt) return;
            this.placeFocusPing(pt.x, pt.y);
        },

        placeFocusPing(sceneX, sceneY) {
            const ping = {
                id: `ping-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
                sceneX, sceneY,
                // NEW: snapshot the colour at drop time so existing pings
                // keep their colour even if the DM changes the picker later.
                color: this.pointerColor,
                createdAt: Date.now(),
            };
            this.focusPings = [...this.focusPings, ping];
            if (window.syncState && window.MODE === 'dm') {
                window.syncState(this.$data);
            }
        },

        removeFocusPing(id) {
            if (!this.focusPings.some(p => p.id === id)) return;
            this.focusPings = this.focusPings.filter(p => p.id !== id);
        },

        clearFocusPings() {
            this.focusPings = [];
            if (window.syncState && window.MODE === 'dm') {
                window.syncState(this.$data);
            }
        },

        focusPingStyle(ping) {
            const pt = this.sceneToStage(ping.sceneX, ping.sceneY);
            if (!pt) return {};
            // Use the ping's own colour (works on player side too, since it's
            // serialised through syncState). Falls back to the DM's current pick.
            const color = ping.color || this.pointerColor || this.defaultPointerColor;
            return {
                left: pt.x + 'px',
                top: pt.y + 'px',
                '--ping-color': color,
                '--ping-rgb': hexToRgbTriplet(color),
            };
        },
    };
}

// Small helper — turns '#ffcc00' into '255, 204, 0' for rgba() usage in CSS.
function hexToRgbTriplet(hex) {
    if (typeof hex !== 'string') return '255, 204, 0';
    let h = hex.replace('#', '').trim();
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    if (h.length !== 6) return '255, 204, 0';
    const n = parseInt(h, 16);
    if (Number.isNaN(n)) return '255, 204, 0';
    return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

window.pointerFeature = pointerFeature;