import { expect } from '@playwright/test';
import { imageFixtureDataUrl, mountDmScene, outputDirectory, saveRecordedVideo } from './helpers.js';

/** Shared canvas for paired DM/Player scenarios that will be played side by side. */
export const scenarioViewport = Object.freeze({ width: 1280, height: 720 });

/** @typedef {{name: string, fixture: string, source: string}} PreparedScenarioScene */

/**
 * Creates a reusable DM/Player scenario controller for browser tests and media
 * recipes. The controller uses the product's real BroadcastChannel transport;
 * state helpers only establish deterministic, user-reachable starting points.
 *
 * @param {import('@playwright/test').Browser} browser Playwright browser instance.
 * @param {{recordVideo?: boolean, viewport?: {width: number, height: number}}} [options] Session options.
 * @returns {ScenarioSession} Uninstantiated scenario controller.
 */
export function createScenarioSession(browser, options = {}) {
    return new ScenarioSession(browser, options);
}

/**
 * Reusable two-channel scenario session.
 *
 * Call {@link instantiate} once before any action, then use semantic helpers to
 * establish the required state for a test or recording. `patchDmState` remains
 * available for feature-specific state that does not warrant a first-class
 * scenario action yet.
 */
export class ScenarioSession {
    /**
     * @param {import('@playwright/test').Browser} browser Playwright browser instance.
     * @param {{recordVideo?: boolean, viewport?: {width: number, height: number}}} [options] Session options.
     */
    constructor(browser, options = {}) {
        this.browser = browser;
        this.options = { recordVideo: true, viewport: scenarioViewport, ...options };
        /** @type {Map<string, PreparedScenarioScene>} */
        this.scenes = new Map();
        /** @type {import('@playwright/test').BrowserContext|undefined} */
        this.context = undefined;
        /** @type {import('@playwright/test').Page|undefined} */
        this.dm = undefined;
        /** @type {import('@playwright/test').Page|undefined} */
        this.player = undefined;
    }

    /**
     * Opens connected DM and Player pages. It is safe to call only once.
     *
     * @returns {Promise<ScenarioSession>} This ready-to-use session.
     * @throws {Error} If a caller attempts to instantiate the same session twice.
     */
    async instantiate() {
        if (this.context) throw new Error('Scenario session has already been instantiated. Create a new session for another recording.');
        const { viewport, recordVideo } = this.options;
        this.context = await this.browser.newContext({
            viewport,
            deviceScaleFactor: 1,
            ...(recordVideo ? { recordVideo: { dir: outputDirectory, size: viewport } } : {}),
        });
        this.dm = await this.context.newPage();
        this.player = await this.context.newPage();
        await Promise.all([
            this.dm.goto('http://127.0.0.1:4173/?mode=dm'),
            this.player.goto('http://127.0.0.1:4173/?mode=player'),
        ]);
        await expect(this.dm.locator('#dmApp')).toBeVisible();
        await expect(this.player.locator('#playerApp')).toBeVisible();
        return this;
    }

    /**
     * Prepares named image media on the DM stage without publishing it. The
     * fixture name must refer to a safe file in `docs/media/resources/`.
     *
     * @param {string} name Stable scenario name used by {@link publishScene}.
     * @param {string} fixture Documentation fixture basename, such as `Dwarven_Forge.png`.
     * @returns {Promise<PreparedScenarioScene>} The prepared scene descriptor.
     */
    async prepareScene(name, fixture) {
        this._assertReady();
        if (!name?.trim()) throw new Error('A prepared scenario scene needs a non-empty name.');
        const source = await imageFixtureDataUrl(fixture);
        await mountDmScene(this.dm, source);
        await this.dm.evaluate(async ({ sceneName }) => {
            const state = Alpine.$data(document.querySelector('#dmApp'));
            state.sceneNameDraft = sceneName;
            state.sceneMediaSource = `scenario-${sceneName.toLowerCase().replace(/[^a-z0-9]+/gu, '-')}`;
            state.mediaType = 'image';
            await new Promise(resolve => state.$nextTick(resolve));
        }, { sceneName: name });
        const scene = { name, fixture, source };
        this.scenes.set(name, scene);
        return scene;
    }

    /**
     * Publishes a prepared scene to the Player display using the requested
     * transition, then waits for the Player to receive the new image.
     *
     * @param {string} name Name passed to {@link prepareScene}.
     * @param {'cut'|'fade'} [transition='cut'] Publish transition.
     * @returns {Promise<void>}
     */
    async publishScene(name, transition = 'cut') {
        this._assertReady();
        const scene = this.scenes.get(name);
        if (!scene) throw new Error(`Scenario scene "${name}" has not been prepared. Call prepareScene(name, fixture) first.`);
        if (!['cut', 'fade'].includes(transition)) throw new Error(`Unsupported scene transition: ${transition}`);
        await mountDmScene(this.dm, scene.source);
        await this.dm.evaluate(async ({ sceneName, selectedTransition }) => {
            const state = Alpine.$data(document.querySelector('#dmApp'));
            state.sceneNameDraft = sceneName;
            state.publishTransition = selectedTransition;
            state.mediaType = 'image';
            await new Promise(resolve => state.$nextTick(resolve));
            state.publishSelectedScene();
        }, { sceneName: scene.name, selectedTransition: transition });
        await expect.poll(() => this.player.evaluate(() => Alpine.$data(document.querySelector('#playerApp')).currentImage)).toBe(scene.source);
    }

    /** Opens one DM control card without depending on its accordion animation. @param {string} card Feature card identifier. @returns {Promise<void>} */
    async showCard(card) {
        this._assertReady();
        await this.dm.evaluate(async ({ cardName }) => {
            const state = Alpine.$data(document.querySelector('#dmApp'));
            state.openCard = cardName;
            await new Promise(resolve => state.$nextTick(resolve));
        }, { cardName: card });
    }

    /** Enables and configures a visible grid, then synchronizes it to Player. @param {{type?: 'square'|'hex-pointy'|'hex-flat', cellsAcross?: number, pxPerCell?: number}} [params] Grid configuration. @returns {Promise<void>} */
    async enableGrid(params = {}) {
        await this.patchDmState({
            gridVisible: true,
            gridType: params.type ?? 'square',
            gridCellsAcross: params.cellsAcross ?? 20,
            scenePxPerCell: params.pxPerCell ?? 50,
        });
    }

    /** Changes grid sizing while preserving the grid's current visibility/type. @param {{cellsAcross?: number, pxPerCell?: number}} params Grid-size values. @returns {Promise<void>} */
    async setGridSize(params) {
        this._assertReady();
        if (!params || (!Number.isFinite(params.cellsAcross) && !Number.isFinite(params.pxPerCell))) {
            throw new Error('setGridSize requires a finite cellsAcross or pxPerCell value.');
        }
        const patch = {};
        if (Number.isFinite(params.cellsAcross)) patch.gridCellsAcross = params.cellsAcross;
        if (Number.isFinite(params.pxPerCell)) patch.scenePxPerCell = params.pxPerCell;
        await this.patchDmState(patch);
    }

    /** Locks the configured grid, optionally setting the physical table PPI. @param {{tablePpi?: number}} [params] Lock configuration. @returns {Promise<void>} */
    async lockGrid(params = {}) {
        await this.patchDmState({ locked: true, ...(Number.isFinite(params.tablePpi) ? { tablePpi: params.tablePpi } : {}) });
    }

    /** Enables fog and applies deterministic fog configuration/strokes. @param {{tool?: 'reveal'|'paint', brush?: 'round'|'square', brushCells?: number, strokes?: object[]}} [params] Fog configuration. @returns {Promise<void>} */
    async applyFog(params = {}) {
        await this.patchDmState({
            fogEnabled: true,
            fogEditing: true,
            fogTool: params.tool ?? 'reveal',
            fogBrush: params.brush ?? 'round',
            fogBrushCells: params.brushCells ?? 5,
            ...(params.strokes ? { fogStrokes: params.strokes } : {}),
        });
    }

    /** Selects a previously prepared scene in the DM workspace without publishing it. @param {string} name Prepared scene name. @returns {Promise<void>} */
    async selectScene(name) {
        this._assertReady();
        const scene = this.scenes.get(name);
        if (!scene) throw new Error(`Scenario scene "${name}" has not been prepared.`);
        await mountDmScene(this.dm, scene.source);
        await this.dm.evaluate(async ({ sceneName }) => {
            const state = Alpine.$data(document.querySelector('#dmApp'));
            state.sceneNameDraft = sceneName;
            await new Promise(resolve => state.$nextTick(resolve));
        }, { sceneName: name });
    }

    /** Sets scene-space camera framing and synchronizes it to Player. @param {{cx: number, cy: number, sceneW: number}} view Scene viewport values. @returns {Promise<void>} */
    async setSceneViewport(view) {
        if (!view || ![view.cx, view.cy, view.sceneW].every(Number.isFinite)) throw new Error('setSceneViewport requires finite cx, cy, and sceneW values.');
        await this.patchDmState({ view: { ...view } });
    }

    /** Clears media and overlays from the selected DM scene. @returns {Promise<void>} */
    async clearScene() {
        this._assertReady();
        await this.dm.evaluate(() => Alpine.$data(document.querySelector('#dmApp')).clearScene());
    }

    /** Changes grid type while preserving the existing grid setup. @param {'square'|'hex-pointy'|'hex-flat'} type Grid type. @returns {Promise<void>} */
    async setGridType(type) {
        if (!['square', 'hex-pointy', 'hex-flat'].includes(type)) throw new Error(`Unsupported grid type: ${type}`);
        this._assertReady();
        await this.dm.evaluate(({ nextType }) => {
            const state = Alpine.$data(document.querySelector('#dmApp'));
            state.setGridType(nextType);
            window.syncState(state);
        }, { nextType: type });
    }

    /** Sets the distance represented by one grid cell. @param {{perCell: number, singular: string, plural: string}} units Grid unit labels. @returns {Promise<void>} */
    async setGridUnits(units) {
        if (!units || !Number.isFinite(units.perCell) || !units.singular || !units.plural) throw new Error('setGridUnits requires perCell, singular, and plural values.');
        this._assertReady();
        await this.dm.evaluate(({ values }) => {
            const state = Alpine.$data(document.querySelector('#dmApp'));
            state.setGridUnits(values.perCell, values.singular, values.plural);
        }, { values: units });
    }

    /** Applies a measured calibration-square size in inches. @param {number} measuredInches Physical measured size. @returns {Promise<void>} */
    async calibrateGrid(measuredInches) {
        if (!Number.isFinite(measuredInches) || measuredInches <= 0) throw new Error('calibrateGrid requires a positive measured-inch value.');
        this._assertReady();
        await this.dm.evaluate(({ measurement }) => Alpine.$data(document.querySelector('#dmApp')).calibrate(measurement), { measurement: measuredInches });
    }

    /** Unlocks the grid and exits physical-table lock state. @returns {Promise<void>} */
    async unlockGrid() { await this.patchDmState({ locked: false }); }

    /** Adds reveal strokes to enabled fog. @param {object[]} strokes Scene-coordinate fog strokes. @returns {Promise<void>} */
    async revealFog(strokes) { await this.applyFog({ tool: 'reveal', strokes }); }

    /** Adds paint strokes that reapply fog to a revealed region. @param {object[]} strokes Scene-coordinate fog strokes. @returns {Promise<void>} */
    async reapplyFog(strokes) { await this.applyFog({ tool: 'paint', strokes }); }

    /** Disables fog and removes all fog strokes. @returns {Promise<void>} */
    async clearFog() {
        this._assertReady();
        await this.dm.evaluate(() => Alpine.$data(document.querySelector('#dmApp')).clearFog());
    }

    /** Enables or disables interactive fog editing without changing existing fog. @param {boolean} enabled Editing state. @returns {Promise<void>} */
    async setFogEditing(enabled) {
        this._assertReady();
        await this.dm.evaluate(({ value }) => Alpine.$data(document.querySelector('#dmApp')).setFogEditing(value), { value: enabled });
    }

    /** Opens the shared whiteboard. @returns {Promise<void>} */
    async openWhiteboard() { await this._setWhiteboardActive(true); }

    /** Hides the shared whiteboard while preserving its marks. @returns {Promise<void>} */
    async hideWhiteboard() { await this._setWhiteboardActive(false); }

    /** Sets the next whiteboard tool and optional stroke colour/size. @param {{tool: string, color?: string, size?: number}} options Whiteboard tool settings. @returns {Promise<void>} */
    async configureWhiteboard(options) {
        if (!options?.tool) throw new Error('configureWhiteboard requires a tool.');
        this._assertReady();
        await this.dm.evaluate(({ settings }) => {
            const state = Alpine.$data(document.querySelector('#dmApp'));
            if (!state.setWhiteboardTool(settings.tool)) throw new Error(`Unsupported whiteboard tool: ${settings.tool}`);
            if (settings.color && !state.setWhiteboardColor(settings.color)) throw new Error(`Unsupported whiteboard color: ${settings.color}`);
            if (Number.isFinite(settings.size)) state.whiteboardSize = settings.size;
        }, { settings: options });
    }

    /** Appends a normalized whiteboard stroke and synchronizes it. @param {object} stroke Persistable whiteboard stroke. @returns {Promise<void>} */
    async drawWhiteboardStroke(stroke) {
        if (!stroke || !Array.isArray(stroke.points) || !stroke.points.length) throw new Error('drawWhiteboardStroke requires a stroke with points.');
        this._assertReady();
        await this.dm.evaluate(({ nextStroke }) => {
            const state = Alpine.$data(document.querySelector('#dmApp'));
            state.whiteboardStrokes = [...state.whiteboardStrokes, nextStroke];
            state.drawWhiteboard(); window.syncState(state);
        }, { nextStroke: stroke });
    }

    /** Alias for a geometric whiteboard stroke such as line, arrow, rectangle, or ellipse. @param {object} shape Normalized shape stroke. @returns {Promise<void>} */
    async drawWhiteboardShape(shape) { await this.drawWhiteboardStroke(shape); }

    /** Clears all whiteboard marks but leaves the board's visibility unchanged. @returns {Promise<void>} */
    async clearWhiteboard() {
        this._assertReady();
        await this.dm.evaluate(() => Alpine.$data(document.querySelector('#dmApp')).clearWhiteboard());
    }

    /** Removes the newest whiteboard mark. @returns {Promise<boolean>} Whether a mark was removed. */
    async undoWhiteboard() {
        this._assertReady();
        return this.dm.evaluate(() => Alpine.$data(document.querySelector('#dmApp')).undoWhiteboard());
    }

    /** Chooses the colour for subsequently placed focus pointers. @param {string} color CSS hex colour. @returns {Promise<void>} */
    async setPointerColor(color) {
        this._assertReady();
        await this.dm.evaluate(({ nextColor }) => Alpine.$data(document.querySelector('#dmApp')).setPointerColor(nextColor), { nextColor: color });
    }

    /** Places one focus pointer in scene coordinates. @param {{x: number, y: number}} point Pointer position. @returns {Promise<void>} */
    async placePointer(point) {
        if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) throw new Error('placePointer requires finite x and y values.');
        this._assertReady();
        await this.dm.evaluate(({ position }) => Alpine.$data(document.querySelector('#dmApp')).placeFocusPing(position.x, position.y), { position: point });
    }

    /** Clears all focus pointers. @returns {Promise<void>} */
    async clearPointers() {
        this._assertReady();
        await this.dm.evaluate(() => Alpine.$data(document.querySelector('#dmApp')).clearFocusPings());
    }

    /** Configures a dice roll without rolling it. @param {{notation: string, mode?: 'private'|'public', message?: string}} roll Dice settings. @returns {Promise<void>} */
    async configureDice(roll) {
        if (!roll?.notation?.trim()) throw new Error('configureDice requires a non-empty notation.');
        if (roll.mode && !['private', 'public'].includes(roll.mode)) throw new Error(`Unsupported roll mode: ${roll.mode}`);
        await this.patchDmState({ diceNotation: roll.notation, rollMode: roll.mode ?? 'private', diceMessage: roll.message ?? '' });
    }

    /** Performs the configured private roll using the application’s real dice path. @returns {Promise<void>} */
    async performPrivateRoll() { await this._performDiceRoll('private'); }

    /** Performs the configured public roll using the application’s real Player channel. @returns {Promise<void>} */
    async performPublicRoll() { await this._performDiceRoll('public'); }

    /** Closes the DM dice-result modal. @returns {Promise<void>} */
    async closeDiceResults() { await this.patchDmState({ showResultModal: false }); }

    /** Opens the DM roll-history card. @returns {Promise<void>} */
    async openRollHistory() { await this.showCard('history'); }

    /** Replaces initiative-entry rows with deterministic combatants. @param {Array<{id?: string, name: string, initiative?: number, bonus?: number|string, isPlayer?: boolean, isDead?: boolean}>} combatants Initiative entries. @returns {Promise<void>} */
    async populateInitiative(combatants) {
        if (!Array.isArray(combatants) || !combatants.length) throw new Error('populateInitiative requires at least one combatant.');
        const rows = combatants.map((combatant, index) => ({ id: combatant.id ?? `scenario-combatant-${index}`, name: combatant.name, initiative: combatant.initiative ?? '', bonus: String(combatant.bonus ?? ''), isPlayer: combatant.isPlayer === true, isDead: combatant.isDead === true }));
        await this.patchDmState({ initiativeRows: rows });
    }

    /** Enters initiative using populated rows and returns the application-generated combatants. @returns {Promise<object[]>} Active combatants, including stable runtime IDs. */
    async startInitiative() {
        this._assertReady();
        return this.dm.evaluate(async () => {
            const state = Alpine.$data(document.querySelector('#dmApp'));
            await state.enterInitiative();
            return state.combatants;
        });
    }

    /** Advances initiative by one eligible combatant. @returns {Promise<void>} */
    async advanceTurn() {
        this._assertReady();
        await this.dm.evaluate(() => Alpine.$data(document.querySelector('#dmApp')).nextTurn());
    }

    /** Marks a combatant defeated or restored. @param {string} id Combatant ID. @param {boolean} defeated Desired state. @returns {Promise<void>} */
    async setCombatantDefeated(id, defeated) {
        this._assertReady();
        await this.dm.evaluate(({ combatantId, target }) => {
            const state = Alpine.$data(document.querySelector('#dmApp'));
            const combatant = state.combatants.find(item => item.id === combatantId);
            if (!combatant) throw new Error(`Unknown combatant: ${combatantId}`);
            if (combatant.isDead !== target) state.toggleDead(combatantId);
        }, { combatantId: id, target: defeated });
    }

    /** Sets whether the table initiative tracker is collapsed. @param {boolean} collapsed Desired state. @returns {Promise<void>} */
    async collapseInitiative(collapsed = true) {
        this._assertReady();
        await this.dm.evaluate(({ target }) => { const state = Alpine.$data(document.querySelector('#dmApp')); if (state.initiativeCollapsed !== target) state.toggleCollapse(); }, { target: collapsed });
    }

    /** Leaves initiative and hides the Player tracker. @returns {Promise<void>} */
    async exitInitiative() {
        this._assertReady();
        await this.dm.evaluate(() => Alpine.$data(document.querySelector('#dmApp')).exitInitiative());
    }

    /** Sends a visible status message to both channels. @param {string} message Message to show. @returns {Promise<void>} */
    async sendStatus(message) {
        if (!message?.trim()) throw new Error('sendStatus requires a non-empty message.');
        this._assertReady();
        await this.dm.evaluate(({ text }) => { const state = Alpine.$data(document.querySelector('#dmApp')); state.statusMessage = text; state.sendStatus(); }, { text: message });
    }

    /** Sends one supported quick status effect. @param {'critical'|'fail'|'combat'|'victory'} effect Named status effect. @returns {Promise<void>} */
    async sendQuickStatus(effect) {
        if (!['critical', 'fail', 'combat', 'victory'].includes(effect)) throw new Error(`Unsupported quick status: ${effect}`);
        this._assertReady();
        await this.dm.evaluate(({ nextEffect }) => Alpine.$data(document.querySelector('#dmApp')).focusEffect(nextEffect), { nextEffect: effect });
    }

    /** Clears the visible DM and Player status banners. @returns {Promise<void>} */
    async clearStatus() {
        this._assertReady();
        await this.dm.evaluate(() => Alpine.$data(document.querySelector('#dmApp')).clearStatus());
    }

    /** Shows a private measurement overlay. @param {object} measurement Measurement geometry. @returns {Promise<void>} */
    async startMeasurement(measurement) { await this.patchDmState({ measurement }); }

    /** Adds a temporary public shape with an optional lifetime. @param {object} shape Shape payload. @param {number} [duration=4000] Lifetime in milliseconds. @returns {Promise<void>} */
    async placeTemporaryShape(shape, duration = 4000) {
        if (!shape?.geometry) throw new Error('placeTemporaryShape requires geometry.');
        this._assertReady();
        await this.dm.evaluate(({ nextShape, lifetime }) => {
            const state = Alpine.$data(document.querySelector('#dmApp'));
            state.addTemporaryShape({ ...nextShape, id: nextShape.id ?? `scenario-shape-${Date.now()}`, visibility: nextShape.visibility ?? 'public' }, lifetime);
            window.syncState(state);
        }, { nextShape: shape, lifetime: duration });
    }

    /** Adds a persistent effect layer and returns its stable ID. @param {object} effect Effect payload containing geometry. @returns {Promise<string>} Created ID. */
    async placePersistentShape(effect) {
        if (!effect?.geometry) throw new Error('placePersistentShape requires geometry.');
        this._assertReady();
        return this.dm.evaluate(({ nextEffect }) => {
            const state = Alpine.$data(document.querySelector('#dmApp'));
            const id = nextEffect.id ?? `scenario-effect-${Date.now()}`;
            state.effects = [...state.effects, { color: '#ffd166', opacity: .5, label: '', visibility: 'public', showDistance: true, persistent: true, ...nextEffect, id }];
            state.selectedEffectId = id; window.syncState(state); return id;
        }, { nextEffect: effect });
    }

    /** Deletes one persistent effect by ID. @param {string} id Effect ID. @returns {Promise<void>} */
    async deleteEffect(id) { await this.patchDmState({ effects: await this._effectsWithout(id) }); }

    /** Clears measurements, temporary shapes, and persistent effects. @returns {Promise<void>} */
    async clearEffects() {
        this._assertReady();
        await this.dm.evaluate(() => Alpine.$data(document.querySelector('#dmApp')).clearEffects());
    }

    /** Applies a serializable DM state patch, redraws relevant layers, and broadcasts the result. @param {Record<string, unknown>} patch State to apply. @returns {Promise<void>} */
    async patchDmState(patch) {
        this._assertReady();
        await this.dm.evaluate(async ({ changes }) => {
            const state = Alpine.$data(document.querySelector('#dmApp'));
            Object.assign(state, changes);
            await new Promise(resolve => state.$nextTick(resolve));
            state.drawGrid?.(); state.drawFog?.(); state.drawWhiteboard?.();
            window.syncState(state);
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        }, { changes: patch });
    }

    /** Holds both paired pages for a readable, synchronized duration. @param {number} milliseconds Duration to wait. @returns {Promise<void>} */
    async hold(milliseconds) {
        this._assertReady();
        await Promise.all([this.dm.waitForTimeout(milliseconds), this.player.waitForTimeout(milliseconds)]);
    }

    /** Finalizes a recording pair under stable output names. @param {string} dmFilename DM WebM filename. @param {string} playerFilename Player WebM filename. @returns {Promise<void>} */
    async saveRecording(dmFilename, playerFilename) {
        this._assertReady();
        if (!this.options.recordVideo) throw new Error('This scenario session was created with recordVideo: false.');
        const dmVideo = this.dm.video();
        const playerVideo = this.player.video();
        await this.context.close();
        await Promise.all([saveRecordedVideo(dmVideo, dmFilename), saveRecordedVideo(playerVideo, playerFilename)]);
        this.context = undefined;
    }

    /** Closes an unfinished session without saving media. @returns {Promise<void>} */
    async close() {
        if (this.context) await this.context.close();
        this.context = undefined;
    }

    /** @param {boolean} active Whiteboard visibility. @returns {Promise<void>} @private */
    async _setWhiteboardActive(active) {
        this._assertReady();
        await this.dm.evaluate(({ value }) => Alpine.$data(document.querySelector('#dmApp')).setWhiteboardActive(value), { value: active });
    }

    /** @param {'private'|'public'} mode Roll visibility. @returns {Promise<void>} @private */
    async _performDiceRoll(mode) {
        this._assertReady();
        await this.dm.evaluate(({ rollMode }) => {
            const state = Alpine.$data(document.querySelector('#dmApp'));
            state.rollMode = rollMode;
            state.rollDice();
        }, { rollMode: mode });
    }

    /** @param {string} id Effect to omit. @returns {Promise<object[]>} Remaining effects. @private */
    async _effectsWithout(id) {
        this._assertReady();
        return this.dm.evaluate(({ effectId }) => {
            const state = Alpine.$data(document.querySelector('#dmApp'));
            if (!state.effects.some(effect => effect.id === effectId)) throw new Error(`Unknown effect: ${effectId}`);
            return state.effects.filter(effect => effect.id !== effectId);
        }, { effectId: id });
    }

    /** @returns {void} @private */
    _assertReady() {
        if (!this.context || !this.dm || !this.player) throw new Error('Call session.instantiate() before using scenario actions.');
    }
}
