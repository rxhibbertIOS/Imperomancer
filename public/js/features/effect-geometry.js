/* Geometry helpers shared by effect tools and tests. */
(function(root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) root.effectGeometry = api;
})(typeof window !== 'undefined' ? window : globalThis, function() {
    const SQRT3 = Math.sqrt(3);
    const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

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

    function distance(a, b) { return Math.hypot(number(b?.x) - number(a?.x), number(b?.y) - number(a?.y)); }
    function squareEndpoint(origin, point) {
        const dx = number(point?.x) - number(origin?.x), dy = number(point?.y) - number(origin?.y);
        const side = Math.max(Math.abs(dx), Math.abs(dy));
        return { x: number(origin?.x) + (dx < 0 ? -side : side), y: number(origin?.y) + (dy < 0 ? -side : side), side };
    }
    function coneWidth(origin, axisEnd, point) {
        const dx = number(axisEnd?.x) - number(origin?.x), dy = number(axisEnd?.y) - number(origin?.y), length = Math.hypot(dx, dy);
        if (!length) return 0;
        return 2 * Math.abs((number(point?.x) - number(origin?.x)) * -dy / length + (number(point?.y) - number(origin?.y)) * dx / length);
    }
    return { snapToCellCenter, distance, squareEndpoint, coneWidth };
});
