import { fogRevealCapture } from './captures/fog-reveal.js';
import { sceneOverviewCapture } from './captures/scene-overview.js';

/**
 * One executable documentation-media recipe.
 *
 * @typedef {object} DocumentationCapture
 * @property {string} id - Stable, lowercase kebab-case identifier used by the registry.
 * @property {string} title - Human-readable Playwright test title.
 * @property {string[]} assets - Stable WebP/WebM basenames written by this capture.
 * @property {(context: { browser: import('@playwright/test').Browser }) => Promise<void>} run - Capture procedure.
 */

/**
 * The single registry for documentation-media recipes. Add a new recipe here to make it runnable.
 * Keeping registration explicit prevents an accidental helper file from becoming a capture test.
 *
 * @type {readonly DocumentationCapture[]}
 */
export const documentationCaptures = Object.freeze([
    sceneOverviewCapture,
    fogRevealCapture,
]);

/**
 * Validates the registry before Playwright creates browser state, producing actionable setup errors.
 *
 * @param {readonly DocumentationCapture[]} captures - Recipes to validate.
 * @returns {void}
 * @throws {Error} If an identifier, runner, or output filename is duplicated or invalid.
 */
export function validateDocumentationCaptures(captures) {
    const ids = new Set();
    const assets = new Set();
    for (const capture of captures) {
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(capture.id) || ids.has(capture.id)) {
            throw new Error(`Documentation capture IDs must be unique kebab-case strings: ${capture.id}`);
        }
        if (typeof capture.title !== 'string' || !capture.title || typeof capture.run !== 'function' || !Array.isArray(capture.assets) || !capture.assets.length) {
            throw new Error(`Documentation capture "${capture.id}" must define title, assets, and run().`);
        }
        ids.add(capture.id);
        for (const asset of capture.assets) {
            if (!/^[a-z0-9][a-z0-9-]*\.(webp|webm)$/u.test(asset) || assets.has(asset)) {
                throw new Error(`Documentation capture assets must have unique lowercase WebP/WebM filenames: ${asset}`);
            }
            assets.add(asset);
        }
    }
}
