import assert from 'node:assert/strict';
import test from 'node:test';
import { documentationCaptures, validateDocumentationCaptures } from '../e2e/docs-media/index.js';

test('documentation media registry: registers unique capture recipes with declared stable outputs', () => {
    assert.doesNotThrow(() => validateDocumentationCaptures(documentationCaptures));
    assert.deepEqual(
        documentationCaptures.map(capture => capture.assets).flat(),
        ['dm-scene-control.webp', 'player-portrait-table.webp', 'fog-reveal.webm'],
    );
});

test('documentation media registry: rejects duplicate, malformed, and incomplete capture contracts', () => {
    const run = async () => {};

    assert.throws(
        () => validateDocumentationCaptures([{ id: 'valid', title: 'First', assets: ['shared.webp'], run }, { id: 'valid', title: 'Second', assets: ['unique.webm'], run }]),
        /unique kebab-case/u,
    );
    assert.throws(
        () => validateDocumentationCaptures([{ id: 'bad id', title: 'Bad', assets: ['valid.webp'], run }]),
        /unique kebab-case/u,
    );
    assert.throws(
        () => validateDocumentationCaptures([{ id: 'bad-file', title: 'Bad', assets: ['Invalid.png'], run }]),
        /unique lowercase WebP\/WebM/u,
    );
    assert.throws(
        () => validateDocumentationCaptures([{ id: 'missing-runner', title: 'Broken', assets: ['broken.webp'] }]),
        /must define title, assets, and run/u,
    );
});
