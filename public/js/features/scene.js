window.sceneFeature = function() {
    return {
        currentImage: null,
        mediaType: 'image',
        pendingImage: null,
        pendingMediaType: null,
        sceneUploadError: '',
        sceneMediaSource: '',
        transition: 'none',
        publishTransition: 'cut',
        scenes: [],
        selectedSceneId: null,
        publishedSceneId: null,
        publishedScene: null,
        sceneNameDraft: '',
        _restoringScene: false,
        isAnimating: false,
        _playbackVideo: null,
        _playbackPromise: null,

        // Scene-absolute view
        view: { cx: 0, cy: 0, sceneW: 0 },
        sceneMediaSize: { source: null, nw: 0, nh: 0 },

        // Reactive copy of the outer stage dims (updated by ResizeObserver)
        stageOuter: { W: 0, H: 0 },         

        // Pan interaction
        isPanning: false,
        panStartX: 0, panStartY: 0,
        panStartCx: 0, panStartCy: 0,
        _lastSyncAt: 0,

        handleImageUpload(event) {
            const file = event.target.files[0];
            if (!file) return;
            this.sceneUploadError = '';
            const allowed = file.type.startsWith('image/') || file.type.startsWith('video/');
            const isVideo = file.type.startsWith('video/');
            const maxBytes = (isVideo ? 50 : 25) * 1024 * 1024;
            if (!allowed || file.size > maxBytes) {
                this.pendingImage = null;
                this.pendingMediaType = null;
                this.sceneUploadError = !allowed ? 'Choose an image or video file.' : `That ${isVideo ? 'video' : 'image'} is larger than ${isVideo ? 50 : 25} MB. Use a smaller or compressed file.`;
                event.target.value = '';
                return;
            }
            const reader = new FileReader();
            reader.onload = (e) => {
                this.pendingImage = e.target.result;
                this.pendingMediaType = isVideo ? 'video' : 'image';
            };
            reader.onerror = () => { this.sceneUploadError = 'The selected file could not be read.'; };
            reader.readAsDataURL(file);
        },

        initScenes() {
            if (window.MODE !== 'dm') return;

            const id = this.createSceneId();
            const initialScene = {
                id,
                name: 'Scene 1',
                dirty: false,
                ...this.captureSceneSettings(),
            };
            this.scenes = [initialScene];
            this.selectedSceneId = id;
            this.publishedSceneId = id;
            this.publishedScene = this.copyScene(initialScene);
            this.sceneNameDraft = initialScene.name;

            [
                'currentImage', 'mediaType', 'view', 'gridVisible', 'gridType',
                'gridShowLabels', 'gridLabelEvery', 'gridOpacity', 'scenePxPerCell',
                'sceneGridOriginX', 'sceneGridOriginY', 'locked',
                'effects',
                'fogEnabled', 'fogColor', 'fogStrokes',
            ].forEach(property => {
                this.$watch(property, () => this.saveSelectedScene(true));
            });
        },

        createSceneId() {
            return window.crypto?.randomUUID?.() || `scene-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        },

        copyScene(scene) {
            return window.clone ? window.clone(scene) : JSON.parse(JSON.stringify(scene));
        },

        captureSceneSettings() {
            return {
                currentImage: this.currentImage,
                mediaType: this.mediaType,
                sceneMediaSource: this.sceneMediaSource || '',
                view: { ...this.view },
                gridVisible: this.gridVisible,
                gridType: this.gridType,
                gridShowLabels: this.gridShowLabels,
                gridLabelEvery: this.gridLabelEvery,
                gridOpacity: this.gridOpacity,
                scenePxPerCell: this.scenePxPerCell,
                sceneGridOriginX: this.sceneGridOriginX,
                sceneGridOriginY: this.sceneGridOriginY,
                locked: this.locked,
                fogEnabled: this.fogEnabled,
                fogColor: this.fogColor || '#3e434e',
                fogStrokes: this.fogStrokes || [],
                effects: this.effects || [],
            };
        },

        getSelectedScene() {
            return this.scenes.find(scene => scene.id === this.selectedSceneId) || null;
        },

        isSelectedPublishedScene() {
            return Boolean(this.selectedSceneId && this.selectedSceneId === this.publishedSceneId);
        },

        syncLiveScene() {
            if (this._restoringScene || !this.isSelectedPublishedScene()) return;
            this._throttledSync();
        },

        saveSelectedScene(markDirty = false, force = false) {
            if ((this._restoringScene && !force) || window.MODE !== 'dm' || !this.selectedSceneId) return;
            const scene = this.getSelectedScene();
            if (!scene) return;
            const settings = this.captureSceneSettings();
            Object.assign(scene, settings);
            if (this.isSelectedPublishedScene()) {
                scene.dirty = false;
                this.publishedScene = {
                    ...this.publishedScene,
                    id: scene.id,
                    name: scene.name,
                    ...settings,
                    transition: this.publishedScene?.transition || 'none',
                };
                this.syncLiveScene();
            } else if (markDirty) {
                scene.dirty = true;
            }
        },

        restoreSelectedScene() {
            const scene = this.getSelectedScene();
            if (!scene) return;

            this._restoringScene = true;
            this.sceneNameDraft = scene.name;
            this.pendingImage = null;
            this.pendingMediaType = null;
            Object.assign(this, this.captureSceneSettingsFrom(scene));
            // Effects are deliberately scoped to the current locked board,
            // not carried between scenes.
            this.effects = [];
            this.flashShapes = [];
            this.selectedEffectId = null;
            this.$nextTick(() => {
                this._restoringScene = false;
                this.ensureScenePlayback();
                this.drawGrid?.();
                if (this.locked) this.reevalLock?.();
            });
        },

        ensureScenePlayback() {
            if (this.mediaType !== 'video') return Promise.resolve(true);
            const video = this.$root?.querySelector('[data-grid-scene]');
            if (!video || typeof video.play !== 'function') return Promise.resolve(false);
            video.muted = true;
            video.loop = true;
            video.playsInline = true;

            if (this._playbackVideo === video && this._playbackPromise) {
                return this._playbackPromise;
            }

            this._playbackVideo = video;
            const playbackPromise = new Promise(resolve => {
                let settled = false;
                const finish = played => {
                    if (settled) return;
                    settled = true;
                    resolve(played);
                };
                const startPlayback = () => {
                    if (!video.isConnected || this.mediaType !== 'video') {
                        finish(false);
                        return;
                    }
                    if (!video.paused && !video.ended) {
                        this.waitForVideoFrame(video).then(() => finish(true));
                        return;
                    }
                    try {
                        Promise.resolve(video.play()).then(
                            () => this.waitForVideoFrame(video).then(() => finish(true)),
                            error => {
                                if (error.name !== 'AbortError') systemLog.warn('scene', 'playVideo', 'Scene video playback failed', error.stack);
                                finish(false);
                            }
                        );
                    } catch (error) {
                        if (error.name !== 'AbortError') systemLog.warn('scene', 'playVideo', 'Scene video playback failed', error.stack);
                        finish(false);
                    }
                };

                if (video.readyState >= 2) startPlayback();
                else {
                    video.addEventListener('loadeddata', startPlayback, { once: true });
                    video.addEventListener('error', () => finish(false), { once: true });
                }
            });
            this._playbackPromise = playbackPromise;
            playbackPromise.finally(() => {
                if (this._playbackPromise === playbackPromise) this._playbackPromise = null;
            });
            return playbackPromise;
        },

        onSceneMediaReady(event) {
            const media = event?.currentTarget || this.getSceneEl();
            const nw = media?.naturalWidth || media?.videoWidth || 0;
            const nh = media?.naturalHeight || media?.videoHeight || 0;
            if (nw && nh) {
                const sourceChanged = !this.sceneMediaSource;
                const source = this.sceneMediaSource || this.createSceneId();
                this.sceneMediaSource = source;
                this.sceneMediaSize = { source, nw, nh };
                if (sourceChanged || !this.view?.sceneW) {
                    this.resetView();
                    this.saveSelectedScene(true, true);
                }
            }
            this.ensureScenePlayback();
            this.drawGrid?.();
            this.drawFog?.();
        },

        captureSceneSettingsFrom(scene) {
            const {
                currentImage, mediaType, sceneMediaSource, view, gridVisible, gridType,
                gridShowLabels, gridLabelEvery, gridOpacity, scenePxPerCell,
                sceneGridOriginX, sceneGridOriginY, locked, effects, fogEnabled, fogColor, fogStrokes,
            } = scene;
            return {
                currentImage: currentImage ?? null,
                mediaType: mediaType || 'image',
                sceneMediaSource: sceneMediaSource || '',
                view: { ...(view || { cx: 0, cy: 0, sceneW: 0 }) },
                gridVisible: gridVisible === true,
                gridType: gridType || 'square',
                gridShowLabels: gridShowLabels === true,
                gridLabelEvery: gridLabelEvery ?? 5,
                gridOpacity: gridOpacity ?? 0.5,
                scenePxPerCell: scenePxPerCell ?? 100,
                sceneGridOriginX: sceneGridOriginX ?? 0,
                sceneGridOriginY: sceneGridOriginY ?? 0,
                locked: locked === true,
                effects: effects || [],
                fogEnabled: fogEnabled === true, fogColor: fogColor || '#3e434e', fogStrokes: fogStrokes || [],
            };
        },

        selectScene(id) {
            if (id === this.selectedSceneId) return;
            this.flushGridSettings?.();
            this.saveSelectedScene();
            this.selectedSceneId = id;
            this.restoreSelectedScene();
            systemLog.info('scene', 'select', 'Scene selected');
        },

        createScene() {
            this.saveSelectedScene();
            const id = this.createSceneId();
            const scene = {
                id,
                name: `Scene ${this.scenes.length + 1}`,
                dirty: true,
                ...this.captureSceneSettings(),
                currentImage: null,
                mediaType: 'image',
                sceneMediaSource: '',
                view: { cx: 0, cy: 0, sceneW: 0 },
                locked: false,
            };
            this.scenes = [...this.scenes, scene];
            this.selectedSceneId = id;
            this.restoreSelectedScene();
            systemLog.success('scene', 'create', `Created ${scene.name}`);
        },

        renameSelectedScene() {
            const name = this.sceneNameDraft.trim();
            if (!name) {
                this.sceneNameDraft = this.getSelectedScene()?.name || '';
                return;
            }
            const scene = this.getSelectedScene();
            if (scene) {
                scene.name = name;
                scene.dirty = true;
            }
            this.sceneNameDraft = name;
            this.saveSelectedScene();
        },

        deleteSelectedScene() {
            if (this.scenes.length <= 1) return;
            const index = this.scenes.findIndex(scene => scene.id === this.selectedSceneId);
            const nextScene = this.scenes[index === 0 ? 1 : index - 1];
            this.scenes = this.scenes.filter(scene => scene.id !== this.selectedSceneId);
            this.selectedSceneId = nextScene.id;
            this.restoreSelectedScene();
            systemLog.danger('scene', 'delete', 'Scene deleted');
        },

        clearScene() {
            const isPublished = this.isSelectedPublishedScene();
            this.currentImage = null;
            this.mediaType = 'image';
            this.sceneMediaSource = '';
            this.pendingImage = null;
            this.pendingMediaType = null;
            this.view = { cx: 0, cy: 0, sceneW: 0 };
            this.locked = false;
            this.saveSelectedScene(true, true);
            this.drawGrid?.();
            if (isPublished) this.publishSelectedScene();
        },

        publishSelectedScene() {
            this.saveSelectedScene(false, true);
            const selected = this.getSelectedScene();
            if (!selected) return;
            const transition = this.publishTransition === 'fade' ? 'fade' : 'none';
            selected.dirty = false;
            this.publishedScene = { ...this.copyScene(selected), transition };
            this.publishedSceneId = selected.id;
            this.transition = transition;
            this.focusPings = [];
            if (window.broadcastScene) {
                window.broadcastScene(this.$data, this.publishedScene, transition);
            }
            systemLog.success('scene', 'publish', `Published ${selected.name}`);
        },

        applyImage() {
            if (!this.pendingImage) return;
            this.currentImage = this.pendingImage;
            this.mediaType = this.pendingMediaType || 'image';
            this.sceneMediaSource = '';
            this.pendingImage = null;
            this.pendingMediaType = null;
            this.$nextTick(() => {
                this.resetView();
                this.saveSelectedScene(true, true);
                this.ensureScenePlayback();
                this.animateImageChange();
                if (this.isSelectedPublishedScene()) this.publishSelectedScene();
            });
        },

        waitForVideoFrame(video) {
            return new Promise(resolve => {
                let settled = false;
                let fallbackTimer;
                const finish = () => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(fallbackTimer);
                    resolve();
                };

                fallbackTimer = setTimeout(finish, 500);
                if (typeof video.requestVideoFrameCallback === 'function') {
                    try {
                        video.requestVideoFrameCallback(finish);
                        return;
                    } catch (_) {}
                }
                if (typeof requestAnimationFrame === 'function') {
                    requestAnimationFrame(() => requestAnimationFrame(finish));
                } else {
                    finish();
                }
            });
        },

        animateImageChange() {
            this.isAnimating = true;
            const els = [
                this.$root.querySelector('.scene img'),
                this.$root.querySelector('.scene video'),
            ].filter(Boolean);
            if (!els.length) { this.isAnimating = false; return; }

            const tl = gsap.timeline({ onComplete: () => { this.isAnimating = false; } });
            switch (this.transition) {
                case 'fade':
                    els.forEach(el => tl.to(el, { opacity: 0, duration: 0.25 }, 0));
                    tl.set(els, { opacity: 1 });
                    break;
                case 'slide':
                    els.forEach(el => tl.fromTo(el, { x: 60, opacity: 0 }, { x: 0, opacity: 1, duration: 0.4 }, 0));
                    break;
                case 'zoom':
                    els.forEach(el => tl.fromTo(el, { scale: 1.15, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.45 }, 0));
                    break;
                case 'blur':
                    els.forEach(el => tl.to(el, { filter: 'blur(12px)', opacity: 0, duration: 0.25 }, 0));
                    tl.set(els, { filter: 'blur(0px)', opacity: 1 });
                    break;
                default: this.isAnimating = false;
            }
        },

        // ------- geometry -------
        getStageEl() {
            return this.$root?.querySelector('[data-stage]');
        },
        getStageInnerEl() {
            return this.$root?.querySelector('[data-stage-inner]') || this.getStageEl();
        },
        getSceneEl() {
            return this.$root?.querySelector('[data-grid-scene]');
        },
        naturalSize() {
            const cached = this.sceneMediaSize;
            const cachedSource = this.sceneMediaSource;
            const el = this.getSceneEl();
            if (!el) return { nw: 0, nh: 0 };
            const nw = el.naturalWidth || el.videoWidth || 0;
            const nh = el.naturalHeight || el.videoHeight || 0;
            if (nw && nh) return { nw, nh };
            if (cached?.source === cachedSource) {
                return { nw: cached.nw, nh: cached.nh };
            }
            return { nw: 0, nh: 0 };
        },
        stageSize() {
            const { W: OW, H: OH } = this.stageOuter;
            if (!OW || !OH) return { W: 0, H: 0 };

            // Player is the table display itself — full viewport, no letterbox.
            if (window.MODE === 'player') return { W: OW, H: OH };

            // DM: letterbox to the table's aspect ratio.
            const ar = (this.tableScreenWidth || 16) / (this.tableScreenHeight || 9);
            if (!isFinite(ar) || ar <= 0) return { W: OW, H: OH };
            if (OW / OH > ar) return { W: Math.round(OH * ar), H: OH };
            return { W: OW, H: Math.round(OW / ar) };
        },

        sceneTransform() {
            const { W, H } = this.stageSize();
            const v = this.view;
            if (!W || !H || !v.sceneW) return { scale: 1, tx: 0, ty: 0 };
            const scale = W / v.sceneW;
            return {
                scale,
                tx: W / 2 - v.cx * scale,
                ty: H / 2 - v.cy * scale,
            };
        },

        // ============================================================
        //  COORDINATE CONVERSION
        //  Viewport (client) coords <-> scene-image pixel coords.
        //  Everything that needs to know "where on the image did the
        //  user click?" goes through these.
        // ============================================================
        screenToScene(clientX, clientY) {
            const inner = this.getStageInnerEl();
            if (!inner) return null;
            const { W, H } = this.stageSize();
            if (!W || !H || !this.view?.sceneW) return null;
            const rect = inner.getBoundingClientRect();
            const px = clientX - rect.left;
            const py = clientY - rect.top;
            const { scale, tx, ty } = this.sceneTransform();
            if (!scale) return null;
            return { x: (px - tx) / scale, y: (py - ty) / scale };
        },

        // Inverse: scene px -> stage-local px (relative to [data-stage-inner]).
        // Use this to position absolutely-positioned overlays (pings, measurements)
        // that live inside .overlay-layer.
        sceneToStage(sceneX, sceneY) {
            const { scale, tx, ty } = this.sceneTransform();
            if (!scale) return null;
            return { x: tx + sceneX * scale, y: ty + sceneY * scale };
        },

        sceneStyle() {
            const { nw, nh } = this.naturalSize();
            const { scale, tx, ty } = this.sceneTransform();
            return {
                position: 'absolute',
                top: '0',
                left: '0',
                width:  nw + 'px',
                height: nh + 'px',
                maxWidth: 'none',
                maxHeight: 'none',
                transformOrigin: 'top left',
                transform: `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`,
                willChange: window.MODE === 'player' ? 'transform' : 'auto',
            };
        },

        // ------- bounds -------
        minSceneW() {
            const { nw, nh } = this.naturalSize();
            const { W, H } = this.stageSize();
            if (!nw || !nh || !W || !H) return nw || 100;
            const sceneAspect = nw / nh;
            const stageAspect = W / H;
            return sceneAspect >= stageAspect
                ? nw                 // scene wider than stage → fit by width
                : nh * stageAspect;  // scene taller than stage → fit by height
        },
        maxSceneW() { return this.minSceneW() / 5; },

        clampView() {
            const { nw, nh } = this.naturalSize();
            const { W, H } = this.stageSize();
            const v = this.view;
            if (!nw || !nh || !W || !H || !v.sceneW) return;

            const sceneH = v.sceneW * (H / W);

            const cx = v.sceneW >= nw
                ? nw / 2
                : Math.max(v.sceneW / 2, Math.min(nw - v.sceneW / 2, v.cx));

            const cy = sceneH >= nh
                ? nh / 2
                : Math.max(sceneH / 2, Math.min(nh - sceneH / 2, v.cy));

            if (cx === v.cx && cy === v.cy) return;
            this.view = { ...v, cx, cy };
        },

        _throttledSync() {
            if (window.MODE !== 'dm' || !this.isSelectedPublishedScene()) return;
            const now = performance.now();
            if (now - this._lastSyncAt < 33) return;   // 30 Hz
            this._lastSyncAt = now;
            if (window.syncView) window.syncView(this);
            else if (window.syncState) window.syncState(this.$data);
        },

        // ------- view ops -------
        resetView() {
            const { nw, nh } = this.naturalSize();
            if (!nw || !nh) return;
            if (this.locked) this.locked = false;
            const sw = this.minSceneW();
            this.view = { cx: nw / 2, cy: nh / 2, sceneW: sw }; 
            this.clampView();
        },

        zoomBy(factor, cursor) {
            if (this.locked) return;
            const { W, H } = this.stageSize();
            const v = this.view;
            if (!W || !H || !v.sceneW) return;

            const newSceneW = Math.max(this.maxSceneW(), Math.min(this.minSceneW(), v.sceneW / factor));
            if (newSceneW === v.sceneW) return;

            const oldScale = W / v.sceneW;
            const newScale = W / newSceneW;
            const px = cursor ? cursor.x : W / 2;
            const py = cursor ? cursor.y : H / 2;

            // Scene point under the cursor before
            const sceneX = v.cx + (px - W / 2) / oldScale;
            const sceneY = v.cy + (py - H / 2) / oldScale;

            this.view = {
                cx: sceneX - (px - W / 2) / newScale,
                cy: sceneY - (py - H / 2) / newScale,
                sceneW: newSceneW,
            };
            this.clampView();
        },

        zoomImage(delta) {
            this.zoomBy(1 + delta, null);
            this._throttledSync();
        },

        zoomPercent() {
            const { nw } = this.naturalSize();
            if (!nw || !this.view.sceneW) return 100;
            return Math.round((nw / this.view.sceneW) * 100);
        },

        onWheel(e) {
            e.preventDefault();
            const inner = this.getStageInnerEl();
            if (!inner) return;
            const rect = inner.getBoundingClientRect();
            this.zoomBy(
                e.deltaY < 0 ? 1.1 : 1 / 1.1,
                { x: e.clientX - rect.left, y: e.clientY - rect.top }
            );
            this._throttledSync();
        },

        startPan(e) {
            this.isPanning = true;
            this.panStartX = e.clientX;
            this.panStartY = e.clientY;
            this.panStartCx = this.view.cx;
            this.panStartCy = this.view.cy;
        },

        pan(e) {
            if (!this.isPanning) return;
            const { W } = this.stageSize();
            if (!W || !this.view.sceneW) return;
            const scale = W / this.view.sceneW;
            const dx = e.clientX - this.panStartX;
            const dy = e.clientY - this.panStartY;
            let cx = this.panStartCx - dx / scale;
            let cy = this.panStartCy - dy / scale;

            if (this.locked && this.scenePxPerCell >= 2) {
                const cell = this.scenePxPerCell;
                const gx = this.sceneGridOriginX || 0;
                const gy = this.sceneGridOriginY || 0;
                cx = gx + Math.round((cx - gx) / cell) * cell;
                cy = gy + Math.round((cy - gy) / cell) * cell;
            }

            this.view = { ...this.view, cx, cy };
            this.clampView();
            this.drawGrid?.();
            this._throttledSync();
        },

        endPan() {
            if (!this.isPanning) return;
            this.isPanning = false;
            if (window.MODE !== 'dm' || !this.isSelectedPublishedScene()) return;
            if (window.syncView) window.syncView(this);
            else if (window.syncState) window.syncState(this.$data);
        },

        // Legacy alias — the sidebar still calls resetZoom
        resetZoom() { this.resetView(); this._throttledSync(); },

        // For DM stage letterbox
        stageInnerStyle() {
            const { W, H } = this.stageSize();
            if (!W || !H) return {};
            return { width: W + 'px', height: H + 'px' };
        },

        stageContextStyle() {
            const { nw, nh } = this.naturalSize();
            const { W: stageW, H: stageH } = this.stageOuter;
            const { W: innerW, H: innerH } = this.stageSize();
            const v = this.view;
            if (!nw || !nh || !stageW || !stageH || !innerW || !innerH || !v.sceneW) {
                return { display: 'none' };
            }

            const scale = innerW / v.sceneW;
            const ox = (stageW - innerW) / 2;
            const oy = (stageH - innerH) / 2;
            const tx = ox + innerW / 2 - v.cx * scale;
            const ty = oy + innerH / 2 - v.cy * scale;

            return {
                position: 'absolute',
                top: '0',
                left: '0',
                width:  nw + 'px',
                height: nh + 'px',
                maxWidth: 'none',
                maxHeight: 'none',
                transformOrigin: 'top left',
                transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
                pointerEvents: 'none',
            };
        },

        initResizeClamp() {
            window.addEventListener('resize', () => {
                if (this.clampView) this.clampView();
                if (this.drawGrid) this.drawGrid();
                if (this.drawFog) this.drawFog();
            });
        },

        toggleOverlay(key) {
            this[key] = !this[key];
            sync(this.$data);
        },

        initStageObserver() {
            this.$nextTick(() => {
                const main = this.getStageEl();
                if (!main) return;
                const update = () => {
                    this.stageOuter = { W: main.clientWidth, H: main.clientHeight };
                };
                update();
                if (typeof ResizeObserver !== 'undefined') {
                    if (this._stageRO) this._stageRO.disconnect();
                    this._stageRO = new ResizeObserver(update);
                    this._stageRO.observe(main);
                } else {
                    window.addEventListener('resize', update);
                }
            });
        },
    };
};
