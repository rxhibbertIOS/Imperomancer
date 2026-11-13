import { test } from '@playwright/test';
import { documentationCaptures, validateDocumentationCaptures } from './docs-media/index.js';
import { ensureOutputDirectory } from './docs-media/helpers.js';

const mediaCaptureEnabled = process.env.CAPTURE_DOCS_MEDIA === 'true';

validateDocumentationCaptures(documentationCaptures);

test.describe('documentation media @docs-media', () => {
    test.skip(!mediaCaptureEnabled, 'Documentation media is generated only by npm run docs:media.');
    test.describe.configure({ mode: 'serial' });

    test.beforeAll(async () => { await ensureOutputDirectory(); });

    for (const capture of documentationCaptures) {
        test(capture.title, async ({ browser }) => {
            await capture.run({ browser });
        });
    }
});
