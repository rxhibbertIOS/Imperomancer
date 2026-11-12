/** Unit coverage for the UMD geometry helpers used by scene effects. @module effect-geometry.test */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const context = { globalThis: {} };
vm.runInNewContext(fs.readFileSync(new URL('../public/js/features/effect-geometry.js', import.meta.url), 'utf8'), context);
const geometry = context.globalThis.effectGeometry;

test('snaps square points to cell centres', () => {
    assert.deepEqual({ ...geometry.snapToCellCenter({ x: 149, y: 251 }, { type: 'square', cell: 100 }) }, { x: 150, y: 250 });
});

test('snaps pointy and flat hexes to true hex centres', () => {
    assert.deepEqual({ ...geometry.snapToCellCenter({ x: 54, y: 89 }, { type: 'hex-pointy', cell: 100 }) }, { x: 50, y: Math.sqrt(3) * 50 });
    assert.deepEqual({ ...geometry.snapToCellCenter({ x: 89, y: 54 }, { type: 'hex-flat', cell: 100 }) }, { x: Math.sqrt(3) * 50, y: 50 });
});

test('keeps square effects square and calculates cone width perpendicular to the axis', () => {
    const square = geometry.squareEndpoint({ x: 100, y: 100 }, { x: 160, y: 225 });
    assert.equal(square.side, 125);
    assert.equal(Math.abs(square.x - 100), Math.abs(square.y - 100));
    assert.equal(geometry.coneWidth({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 25 }), 50);
});

test('handles invalid sizes and zero-length cones safely', () => {
    assert.deepEqual({ ...geometry.snapToCellCenter({ x: 12, y: 24 }, { cell: 0 }) }, { x: 12, y: 24 });
    assert.equal(geometry.coneWidth({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 5, y: 5 }), 0);
});
