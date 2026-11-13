import { imageFixtureDataUrl, outputDirectory, saveRecordedVideo } from '../helpers.js';
import { captureWebp, openDmCard, openPreparedDm, openPreparedPlayer, patchDmState } from '../capture-utils.js';

/** Captures scene preparation, publication, and transition configuration references. @type {import('../index.js').DocumentationCapture} */
export const scenesCapture = {
    id: 'scenes',
    title: 'captures scene preparation, publishing, and transition references',
    assets: ['dm-scene-preparation.webp', 'dm-scene-publishing.webp', 'dm-scene-transition.webp'],
    async run({ browser }) {
        const { context, page, source } = await openPreparedDm(browser);
        await openDmCard(page, 'scene');
        await patchDmState(page, {
            sceneNameDraft: 'Arcane Cathedral', pendingImage: await imageFixtureDataUrl('Dwarven_Forge.png'),
            pendingMediaType: 'image', publishTransition: 'fade',
        });
        await captureWebp(page, 'dm-scene-preparation.webp');
        await patchDmState(page, {
            pendingImage: null, pendingMediaType: null, publishedSceneId: 'cathedral-docs',
            publishedScene: { id: 'cathedral-docs', name: 'Arcane Cathedral', image: source, mediaType: 'image', transition: 'fade' },
        });
        await captureWebp(page, 'dm-scene-publishing.webp');
        await captureWebp(page, 'dm-scene-transition.webp');
        await context.close();
    },
};
