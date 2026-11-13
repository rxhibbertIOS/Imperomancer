import assert from 'node:assert/strict';
import test from 'node:test';
import { documentationCaptures, validateDocumentationCaptures } from '../e2e/docs-media/index.js';
import { imageFixtureDataUrl, imageFixtureMimeType } from '../e2e/docs-media/helpers.js';

test('documentation media registry: registers unique capture recipes with declared stable outputs', () => {
    assert.doesNotThrow(() => validateDocumentationCaptures(documentationCaptures));
    const assets = documentationCaptures.map(capture => capture.assets).flat();
    assert.equal(new Set(assets).size, assets.length);
    assert.ok(assets.includes('dm-scene-preparation.webp'));
    assert.ok(assets.includes('dm-grid-calibration.webp'));
    assert.ok(assets.includes('player-fog-application.webp'));
    assert.ok(assets.includes('player-whiteboard-full-stage.webp'));
    assert.ok(assets.includes('player-focus-pointer.webp'));
    assert.ok(assets.includes('dm-dice-roll-history.webp'));
    assert.ok(assets.includes('player-initiative-tracker.webp'));
    assert.ok(assets.includes('dm-chronicle-search.webp'));
    assert.ok(assets.includes('dm-shape-tools.webp'));
});

test('documentation media registry: rejects duplicate, malformed, and incomplete capture contracts', () => {
    const run = async () => {};

    assert.throws(
        () => validateDocumentationCaptures([{ id: 'valid', title: 'First', assets: ['dm-shared.webp'], run }, { id: 'valid', title: 'Second', assets: ['player-unique.webm'], run }]),
        /unique kebab-case/u,
    );
    assert.throws(
        () => validateDocumentationCaptures([{ id: 'bad id', title: 'Bad', assets: ['valid.webp'], run }]),
        /unique kebab-case/u,
    );
    assert.throws(
        () => validateDocumentationCaptures([{ id: 'bad-file', title: 'Bad', assets: ['Invalid.png'], run }]),
        /unique lowercase DM\/Player-prefixed WebP\/WebM/u,
    );
    assert.throws(
        () => validateDocumentationCaptures([{ id: 'no-viewpoint', title: 'Bad', assets: ['reference.webp'], run }]),
        /unique lowercase DM\/Player-prefixed WebP\/WebM/u,
    );
    assert.throws(
        () => validateDocumentationCaptures([{ id: 'missing-runner', title: 'Broken', assets: ['broken.webp'] }]),
        /must define title, assets, and run/u,
    );
});

test('documentation media fixtures: recognizes supported image formats and rejects unsafe or unsupported names', async () => {
    assert.equal(imageFixtureMimeType('scene.png'), 'image/png');
    assert.equal(imageFixtureMimeType('scene.JPG'), 'image/jpeg');
    assert.equal(imageFixtureMimeType('scene.webp'), 'image/webp');
    assert.equal(imageFixtureMimeType('scene.avif'), 'image/avif');
    assert.equal(imageFixtureMimeType('scene.gif'), 'image/gif');
    assert.equal(imageFixtureMimeType('scene.svg'), 'image/svg+xml');
    assert.equal(imageFixtureMimeType('scene.pdf'), undefined);
    await assert.rejects(() => imageFixtureDataUrl('../private-map.png'), /supported image basename/u);
    await assert.rejects(() => imageFixtureDataUrl('scene.pdf'), /supported image basename/u);
    await assert.rejects(() => imageFixtureDataUrl('missing-scene.webp'), /Documentation image fixture is missing/u);
});
