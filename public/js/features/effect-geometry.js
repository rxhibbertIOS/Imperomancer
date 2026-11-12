/**
 * Geometry helpers shared by the effect authoring, rendering, and test layers.
 * @module effect-geometry
 */
(function(root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) root.effectGeometry = api;
})(typeof window !== 'undefined' ? window : globalThis, function() {
    const SQRT3 = Math.sqrt(3);
    /** Coerces a value to a finite number, or supplies a safe fallback. @param {*} value @param {number} [fallback=0] @returns {number} */
    const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

    /** Snaps a scene point to the centre of its containing square or hex cell. @param {{x:number,y:number}} point @param {{type?:string,cell?:number,originX?:number,originY?:number}} grid @returns {{x:number,y:number}} */
    function snapToCellCenter(point, grid) {
        const cell = number(grid?.cell);
        const input = { x: number(point?.x), y: number(point?.y) };
        if (cell < 2) return input;
        const x = number(grid?.originX), y = number(grid?.originY);
        if (grid?.type === 'hex-pointy') {
            const row = Math.round((input.y - y) / (SQRT3 * cell / 2));
            const offset = Math.abs(row) % 2 ? cell / 2 : 0;
            return { x: x + Math.round((input.x - x - offset) / cell) * cell + offset, y: y + row * SQRT3 * cell / 2 };
        }
        if (grid?.type === 'hex-flat') {
            const col = Math.round((input.x - x) / (SQRT3 * cell / 2));
            const offset = Math.abs(col) % 2 ? cell / 2 : 0;
            return { x: x + col * SQRT3 * cell / 2, y: y + Math.round((input.y - y - offset) / cell) * cell + offset };
        }
        return { x: x + (Math.floor((input.x - x) / cell) + .5) * cell, y: y + (Math.floor((input.y - y) / cell) + .5) * cell };
    }

    /** Calculates Euclidean distance between two scene points. @param {{x:number,y:number}} a @param {{x:number,y:number}} b @returns {number} */
    function distance(a, b) { return Math.hypot(number(b?.x) - number(a?.x), number(b?.y) - number(a?.y)); }
    /** Constrains a square-drag endpoint so both axes have the same extent. @param {{x:number,y:number}} origin @param {{x:number,y:number}} point @returns {{x:number,y:number,side:number}} */
    function squareEndpoint(origin, point) {
        const dx = number(point?.x) - number(origin?.x), dy = number(point?.y) - number(origin?.y);
        const side = Math.max(Math.abs(dx), Math.abs(dy));
        return { x: number(origin?.x) + (dx < 0 ? -side : side), y: number(origin?.y) + (dy < 0 ? -side : side), side };
    }
    /** Measures the perpendicular width of a cone at a dragged point. @param {{x:number,y:number}} origin @param {{x:number,y:number}} axisEnd @param {{x:number,y:number}} point @returns {number} */
    function coneWidth(origin, axisEnd, point) {
        const dx = number(axisEnd?.x) - number(origin?.x), dy = number(axisEnd?.y) - number(origin?.y), length = Math.hypot(dx, dy);
        if (!length) return 0;
        return 2 * Math.abs((number(point?.x) - number(origin?.x)) * -dy / length + (number(point?.y) - number(origin?.y)) * dx / length);
    }
    return { snapToCellCenter, distance, squareEndpoint, coneWidth };
});
