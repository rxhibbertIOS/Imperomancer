import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Absolute path to the repository root. */
export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** Directory containing deterministic source files for documentation captures. */
export const resourcesDirectory = path.join(projectRoot, 'docs', 'media', 'resources');

/** Directory containing the committed WebP and WebM documentation assets. */
export const outputDirectory = path.join(projectRoot, 'docs', 'assets', 'media');

/** MIME types accepted for source images in the documentation fixture directory. */
const imageFixtureMimeTypes = Object.freeze({
    '.avif': 'image/avif',
    '.gif': 'image/gif',
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
});

/**
 * Returns the MIME type associated with a supported documentation image filename.
 *
 * @param {string} filename - Image filename whose extension should be resolved.
 * @returns {string|undefined} Supported image MIME type, if any.
 */
export function imageFixtureMimeType(filename) {
    return imageFixtureMimeTypes[path.extname(filename).toLowerCase()];
}

/**
 * Reads a publishable image fixture and encodes it as a browser-safe data URL.
 * This accepts raster images as well as SVG, so contributors need not convert source artwork.
 *
 * @param {string} filename - Simple image basename in `docs/media/resources/`.
 * @returns {Promise<string>} A MIME-correct image data URL.
 * @throws {Error} If `filename` is not a supported image basename or cannot be read.
 */
export async function imageFixtureDataUrl(filename) {
    const mimeType = imageFixtureMimeType(filename);
    if (path.basename(filename) !== filename || !mimeType) {
        throw new Error(`Documentation fixture must be a supported image basename: ${filename}`);
    }
    let source;
    try {
        source = await fs.readFile(path.join(resourcesDirectory, filename));
    } catch (error) {
        if (error?.code === 'ENOENT') {
            throw new Error(`Documentation image fixture is missing: docs/media/resources/${filename}`);
        }
        throw error;
    }
    return `data:${mimeType};base64,${source.toString('base64')}`;
}

/**
 * Resolves a safe, stable output filename within the documentation asset directory.
 *
 * @param {string} filename - WebP or WebM basename declared by a capture recipe.
 * @returns {string} Absolute output path.
 * @throws {Error} If the name can escape the output directory or has an unsupported format.
 */
export function documentationAssetPath(filename) {
    if (path.basename(filename) !== filename || !/\.(webp|webm)$/u.test(filename)) {
        throw new Error(`Documentation asset must be a WebP/WebM basename: ${filename}`);
    }
    return path.join(outputDirectory, filename);
}

/** Ensures the output directory exists before a capture recipe writes an asset. */
export async function ensureOutputDirectory() {
    await fs.mkdir(outputDirectory, { recursive: true });
}

/**
 * Waits until the Player application's scene image has loaded, then fits it to its rendered stage.
 *
 * @param {import('@playwright/test').Page} page - A Player-mode Playwright page.
 * @param {string} source - Image source to mount.
 * @returns {Promise<void>}
 */
export async function mountPlayerScene(page, source) {
    await page.evaluate(async ({ source: imageSource }) => {
        const state = Alpine.$data(document.querySelector('#playerApp'));
        state.currentImage = imageSource;
        state.mediaType = 'image';
        await new Promise(resolve => state.$nextTick(resolve));
        const image = document.querySelector('#playerApp [data-grid-scene]');
        if (!image.complete) {
            await new Promise((resolve, reject) => {
                image.addEventListener('load', resolve, { once: true });
                image.addEventListener('error', reject, { once: true });
            });
        }
        state.onSceneMediaReady({ currentTarget: image });
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }, { source });
}

/**
 * Waits until the DM application's scene image has loaded and applies its presentation geometry.
 *
 * @param {import('@playwright/test').Page} page - A DM-mode Playwright page.
 * @param {string} source - Image source to mount.
 * @returns {Promise<void>}
 */
export async function mountDmScene(page, source) {
    await page.evaluate(async ({ source: imageSource }) => {
        const state = Alpine.$data(document.querySelector('#dmApp'));
        state.currentImage = imageSource;
        state.mediaType = 'image';
        await new Promise(resolve => state.$nextTick(resolve));
        const image = document.querySelector('#dmApp [data-grid-scene]');
        if (!image.complete) {
            await new Promise(resolve => image.addEventListener('load', resolve, { once: true }));
        }
        state.onSceneMediaReady({ currentTarget: image });
    }, { source });
}

/**
 * Replaces Playwright's generated video filename with the stable, documented filename.
 *
 * @param {import('@playwright/test').Video} video - Finalized recording from a closed page.
 * @param {string} filename - Declared WebM output basename.
 * @returns {Promise<void>}
 */
export async function saveRecordedVideo(video, filename) {
    const source = await video.path();
    const destination = documentationAssetPath(filename);
    await fs.rm(destination, { force: true });
    await fs.rename(source, destination);
}
