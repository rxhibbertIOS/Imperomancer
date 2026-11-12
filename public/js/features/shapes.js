// js/features/shapes.js
//
// Stage-drawing primitives. Phase 1: line tool, flash-only.
// (Persistent shapes and the other geometry kinds come next.)

function shapesFeature() {
    return {
        // ---- Anchor menu ----
        shapeMenu: null,          // { x, y, sceneX, sceneY } | null

        // ---- Drag state ----
        pendingShapeKind: null,   // 'line' after menu pick
        dragShape: null,          // { kind, anchor, endpoint, visibility } | null
        dragPointer: { x: 0, y: 0 },  // stage-local, for tooltip positioning
        _shapeAnchor: null,       // { x, y } scene px — private, non-reactive

        // ---- Committed flash shapes ----
        flashShapes: [],          // { id, geometry, visibility, createdAt }
        effects: [],              // persistent, editable scene effects
        selectedEffectId: null,
        effectSelectMode: false,
        effectDraft: { color: '#ffd166', opacity: 0.5, label: '', visibility: 'public', persistent: false, showDistance: true },
        _shapeLongPressTimer: null,
        _coneAxis: null,
        measurement: null,        // DM-only range ruler; never synchronised
        _temporaryEffectTimers: {},
        tableShapePreview: null,
        _lastShapePreviewSyncAt: 0,

        // ============================================================
        //  CONTEXT MENU
        // ============================================================
        handleStageContextMenu(ev) {
            if (this.focusMode) { this.focusMode = false; return; }
            if (this.dragShape || this.pendingShapeKind) { this.cancelShapeDrag(); return; }
            if (this.shapeMenu) { this.shapeMenu = null; return; }
            this.openShapeMenu(ev);
        },
        openEffectsPalette() {
            if (!this.locked || !this.gridVisible) return;
            const inner = this.getStageInnerEl();
            if (!inner) return;
            const rect = inner.getBoundingClientRect();
            this.openShapeMenu({ clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 });
            this.$nextTick?.(() => inner.querySelector('.shape-menu button')?.focus());
        },

        // A long press intentionally opens the same palette as a secondary
        // click, making the existing workflow usable on touch displays.
        beginShapeLongPress(ev) {
            if (!this.locked || !this.gridVisible || ev.touches?.length !== 1) return;
            const touch = ev.touches[0];
            clearTimeout(this._shapeLongPressTimer);
            this._shapeLongPressTimer = setTimeout(() => {
                if (!this.shapeMenu && !this.pendingShapeKind) {
                    this.openShapeMenu({ clientX: touch.clientX, clientY: touch.clientY });
                }
            }, 500);
        },
        endShapeLongPress() {
            clearTimeout(this._shapeLongPressTimer);
            this._shapeLongPressTimer = null;
        },

        openShapeMenu(ev) {
            const inner = this.getStageInnerEl();
            if (!inner) return;
            const scenePt = this.screenToScene(ev.clientX, ev.clientY);
            if (!scenePt) return;
            const rect = inner.getBoundingClientRect();
            this.shapeMenu = {
                x: ev.clientX - rect.left,
                y: ev.clientY - rect.top,
                sceneX: this.snapShapePoint(scenePt).x,
                sceneY: this.snapShapePoint(scenePt).y,
            };
            // Every new placement starts as a visible, manageable layer.
            this.effectDraft.persistent = true;
            this.effectDraft.visibility = 'public';
        },

        snapShapePoint(point) {
            if (!this.locked || !this.gridVisible) return point;
            return window.effectGeometry.snapToCellCenter(point, {
                type: this.gridType,
                cell: this.scenePxPerCell,
                originX: this.sceneGridOriginX,
                originY: this.sceneGridOriginY,
            });
        },

        pickShapeKind(kind) {
            if (!this.shapeMenu) return;
            this._shapeAnchor = { x: this.shapeMenu.sceneX, y: this.shapeMenu.sceneY };
            this.pendingShapeKind = kind;
            this._coneAxis = null;
            this.shapeMenu = null;
        },
        dropStatusEffect(label) {
            if (!this.shapeMenu) return;
            const shape = { geometry: { kind: 'status', anchor: { x: this.shapeMenu.sceneX, y: this.shapeMenu.sceneY }, label }, visibility: this.effectDraft.visibility, createdAt: Date.now() };
            if (this.effectDraft.persistent) this.addEffect(shape);
            else this.addTemporaryShape(shape, 8000);
            this.shapeMenu = null;
            if (window.syncState && window.MODE === 'dm') window.syncState(this.$data);
        },

        addEffect(shape) {
            const effect = {
                id: `fx-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
                geometry: shape.geometry,
                color: this.effectDraft.color || '#ffd166',
                opacity: Math.max(0, Math.min(1, Number(this.effectDraft.opacity) || .5)),
                label: String(this.effectDraft.label || '').slice(0, 48),
                showDistance: this.effectDraft.showDistance !== false,
                visibility: this.effectDraft.visibility === 'private' ? 'private' : 'public',
                persistent: true,
                createdAt: Date.now(),
            };
            this.effects = [...this.effects, effect];
            this.selectedEffectId = effect.id;
            this.saveSelectedScene?.(true, true);
            if (window.syncState && window.MODE === 'dm') window.syncState(this.$data);
        },

        selectedEffect() { return this.effects.find(effect => effect.id === this.selectedEffectId) || null; },
        selectEffect(id) {
            this.selectedEffectId = id;
            const effect = this.selectedEffect();
            if (effect) this.effectDraft = { color: effect.color, opacity: effect.opacity, label: effect.label, visibility: effect.visibility, persistent: true, showDistance: effect.showDistance !== false };
        },
        updateSelectedEffect() {
            const selected = this.selectedEffect();
            if (!selected) return;
            this.effects = this.effects.map(effect => effect.id !== selected.id ? effect : {
                ...effect, color: this.effectDraft.color || effect.color,
                opacity: Math.max(0, Math.min(1, Number(this.effectDraft.opacity) || 0)),
                label: String(this.effectDraft.label || '').slice(0, 48),
                showDistance: this.effectDraft.showDistance !== false,
                visibility: this.effectDraft.visibility === 'private' ? 'private' : 'public',
            });
            this.saveSelectedScene?.(true, true);
            if (window.syncState && window.MODE === 'dm') window.syncState(this.$data);
        },
        deleteSelectedEffect() {
            if (!this.selectedEffectId) return;
            this.effects = this.effects.filter(effect => effect.id !== this.selectedEffectId);
            this.selectedEffectId = null;
            this.saveSelectedScene?.(true, true);
            if (window.syncState && window.MODE === 'dm') window.syncState(this.$data);
        },
        clearEffects(sync = true) {
            Object.values(this._temporaryEffectTimers).forEach(timer => clearTimeout(timer));
            this._temporaryEffectTimers = {};
            this.effects = [];
            this.flashShapes = [];
            this.selectedEffectId = null;
            this.measurement = null;
            this.cancelShapeDrag();
            if (sync && window.MODE === 'dm') window.syncState?.(this.$data);
        },
        toggleEffectVisibility(id) {
            this.effects = this.effects.map(effect => effect.id === id ? { ...effect, visibility: effect.visibility === 'public' ? 'private' : 'public' } : effect);
            this.saveSelectedScene?.(true, true);
            window.syncState?.(this.$data);
        },
        focusEffect(id) {
            const effect = this.effects.find(item => item.id === id);
            const anchor = effect?.geometry?.anchor;
            if (!anchor) return;
            this.view = { ...this.view, cx: anchor.x, cy: anchor.y };
            this.clampView?.(); this.drawGrid?.(); this._throttledSync?.();
        },
        toggleEffectSelectMode() {
            this.effectSelectMode = !this.effectSelectMode;
            if (this.effectSelectMode) this.cancelShapeDrag();
        },
        selectEffectAt(ev) {
            if (!this.effectSelectMode) return;
            const point = this.screenToScene(ev.clientX, ev.clientY);
            if (!point) return;
            const tolerance = Math.max(12, (this.scenePxPerCell || 100) * .18);
            const segmentDistance = (p, a, b) => {
                const dx = b.x - a.x, dy = b.y - a.y;
                const length2 = dx * dx + dy * dy || 1;
                const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length2));
                return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
            };
            const hit = [...this.effects].reverse().find(effect => {
                const g = effect.geometry, a = g.anchor, b = g.endpoint;
                if (!a || !b) return false;
                if (g.kind === 'line') return segmentDistance(point, a, b) <= tolerance;
                if (g.kind === 'circle') return Math.abs(Math.hypot(point.x-a.x, point.y-a.y) - Math.hypot(b.x-a.x, b.y-a.y)) <= tolerance;
                if (g.kind === 'square') {
                    const side = Math.max(Math.abs(b.x-a.x), Math.abs(b.y-a.y));
                    return Math.max(Math.abs(Math.abs(point.x-a.x)-side), Math.abs(Math.abs(point.y-a.y)-side)) <= tolerance;
                }
                return segmentDistance(point, a, b) <= tolerance * 2;
            });
            if (hit) this.selectEffect(hit.id);
        },

        cancelShapeDrag() {
            this.dragShape = null;
            this.pendingShapeKind = null;
            this._shapeAnchor = null;
            this._coneAxis = null;
            if (window.MODE === 'dm') window.syncState?.(this.$data);
        },

        addTemporaryShape(shape, duration = 4000) {
            this.flashShapes = [...this.flashShapes, shape];
            this._temporaryEffectTimers[shape.id] = setTimeout(() => this.expireFlashShape(shape.id), duration);
        },

        // ============================================================
        //  DISPATCHERS (replace the inline handlers on [data-stage-inner])
        // ============================================================
        handleStageMouseDown(ev) {
            if (this.focusMode) return this.handleFocusClick(ev);
            if (this.effectSelectMode) return;
            if (this.pendingShapeKind) return this.commitShapeDrag(ev);
            return this.startPan(ev);
        },

        handleStageMouseMove(ev) {
            if (this.pendingShapeKind) return this.updateShapeDrag(ev);
            if (this.isPanning) return this.pan(ev);
        },

        handleStageMouseUp(ev) {
            if (this.isPanning) return this.endPan();
        },

        // ============================================================
        //  DRAG
        // ============================================================
        updateShapeDrag(ev) {
            const scenePt = this.screenToScene(ev.clientX, ev.clientY);
            if (!scenePt || !this._shapeAnchor) return;

            this.dragShape = {
                kind: this.pendingShapeKind,
                anchor: { ...this._shapeAnchor },
                endpoint: this._coneAxis || this.snapShapePoint(scenePt),
                widthEndpoint: this.pendingShapeKind === 'cone' && this._coneAxis ? this.snapShapePoint(scenePt) : null,
                visibility: this.effectDraft.visibility,
            };

            const inner = this.getStageInnerEl();
            if (inner) {
                const rect = inner.getBoundingClientRect();
                this.dragPointer = {
                    x: ev.clientX - rect.left,
                    y: ev.clientY - rect.top,
                };
            }
            if (window.MODE === 'dm') {
                const now = performance.now();
                if (now - this._lastShapePreviewSyncAt > 33) {
                    this._lastShapePreviewSyncAt = now;
                    window.syncState?.(this.$data);
                }
            }
        },

        shapeLayerMarkup() {
            const parts = [];

            const emit = (shape, cls = 'shape-stroke') => {
                const g = shape?.geometry;
                if (!g) return;
                const a = this.sceneToStage(g.anchor?.x, g.anchor?.y);
                if (!a) return;
                const p = g.endpoint && this.shapeStagePoints(g);
                const style = shape.color ? ` style="stroke:${shape.color};fill:${shape.color};opacity:${shape.opacity}"` : '';
                const label = String(shape.label || g.label || '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
                if (g.kind === 'status') {
                    parts.push(`<g class="effect-status"${style}><circle cx="${a.x}" cy="${a.y}" r="12"/><text x="${a.x}" y="${a.y - 20}">${label}</text></g>`);
                    return;
                }
                if (!p || !p.a || !p.b) return;
                if (g.kind === 'line' || g.kind === 'measure') parts.push(`<line x1="${p.a.x}" y1="${p.a.y}" x2="${p.b.x}" y2="${p.b.y}" class="${cls}"${style}/>`);
                if (g.kind === 'circle') parts.push(`<circle cx="${p.a.x}" cy="${p.a.y}" r="${Math.hypot(p.b.x - p.a.x, p.b.y - p.a.y)}" class="${cls} shape-fill"${style}/>`);
                if (g.kind === 'square') {
                    const side = Math.max(Math.abs(p.b.x - p.a.x), Math.abs(p.b.y - p.a.y));
                    parts.push(`<rect x="${p.a.x - side}" y="${p.a.y - side}" width="${side * 2}" height="${side * 2}" class="${cls} shape-fill"${style}/>`);
                }
                if (g.kind === 'cone') {
                    const dx = p.b.x - p.a.x, dy = p.b.y - p.a.y, length = Math.hypot(dx, dy);
                    if (!length) return;
                    const widthPoint = g.widthEndpoint && this.sceneToStage(g.widthEndpoint.x, g.widthEndpoint.y);
                    const width = widthPoint ? window.effectGeometry.coneWidth(p.a, p.b, widthPoint) : length;
                    const ux = dx / length, uy = dy / length, px = -uy * width / 2, py = ux * width / 2;
                    parts.push(`<path d="M ${p.a.x} ${p.a.y} L ${p.b.x + px} ${p.b.y + py} L ${p.b.x - px} ${p.b.y - py} Z" class="${cls} shape-fill"${style}/>`);
                }
                if (label) parts.push(`<text class="effect-label" x="${p.a.x}" y="${p.a.y - 14}"${style}>${label}</text>`);
                if (shape.showDistance) parts.push(`<text class="shape-distance-label" x="${(p.a.x + p.b.x) / 2}" y="${(p.a.y + p.b.y) / 2 - 10}">${this.shapeDistanceLabel(g)}</text>`);
            };

            (this.flashShapes || []).forEach(s => emit(s, 'shape-stroke flash-shape'));
            (this.effects || []).forEach(s => emit(s, `shape-stroke effect-stroke`));
            if (this.measurement) emit({ geometry: this.measurement }, 'shape-stroke measurement-stroke');
            const preview = this.tableShapePreview || this.dragShape;
            emit(preview ? { geometry: preview } : null);   // harmless when null
            if (preview?.anchor && preview?.endpoint) {
                const a = this.sceneToStage(preview.anchor.x, preview.anchor.y);
                const b = this.sceneToStage(preview.endpoint.x, preview.endpoint.y);
                if (a && b) parts.push(`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="shape-guide"/>`);
                const readout = this.shapeDistanceLabel(preview);
                if (readout) parts.push(`<text class="shape-distance-label" x="${(a.x + b.x) / 2}" y="${(a.y + b.y) / 2 - 10}">${readout}</text>`);
            }
            return parts.join('');
        },

        commitShapeDrag(ev) {
            if (!this.dragShape) return;

            const a = this.dragShape.anchor;
            const b = this.dragShape.endpoint;
            if (this.dragShape.kind === 'cone' && !this._coneAxis) {
                this._coneAxis = { ...b };
                this.dragShape = null;
                return;
            }
            // Reject click-without-drag — a 4px threshold is below the
            // resolution of any real measurement, so nothing is lost.
            if (Math.hypot(b.x - a.x, b.y - a.y) < 4) {
                this.cancelShapeDrag();
                ev?.preventDefault?.();
                return;
            }

            const shape = {
                id: `sh-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
                geometry: {
                    kind: this.dragShape.kind,
                    anchor: { ...a },
                    endpoint: { ...b },
                    widthEndpoint: this.dragShape.widthEndpoint ? { ...this.dragShape.widthEndpoint } : null,
                },
                visibility: this.dragShape.visibility,
                createdAt: Date.now(),
            };
            if (shape.geometry.kind === 'measure') {
                this.measurement = { kind: 'line', anchor: { ...a }, endpoint: { ...b } };
            } else if (this.effectDraft.persistent) this.addEffect(shape);
            else this.addTemporaryShape(shape);
            this.cancelShapeDrag();
            ev?.preventDefault?.();
            ev?.stopPropagation?.();

            if (window.syncState && window.MODE === 'dm') {
                window.syncState(this.$data);
            }
        },

        // Fires on @animationend. Idempotent so it's safe on both sides.
        expireFlashShape(id) {
            clearTimeout(this._temporaryEffectTimers[id]);
            delete this._temporaryEffectTimers[id];
            if (!this.flashShapes.some(s => s.id === id)) return;
            this.flashShapes = this.flashShapes.filter(s => s.id !== id);
            if (window.syncState && window.MODE === 'dm') {
                window.syncState(this.$data);
            }
        },

        // ============================================================
        //  RENDER HELPERS
        // ============================================================
        shapeStagePoints(geometry) {
            if (!geometry) return null;
            const a = this.sceneToStage(geometry.anchor.x, geometry.anchor.y);
            const b = this.sceneToStage(geometry.endpoint.x, geometry.endpoint.y);
            if (!a || !b) return null;
            return { a, b };
        },

        shapeDistanceLabel(geometry) {
            const dx = geometry.endpoint.x - geometry.anchor.x;
            const dy = geometry.endpoint.y - geometry.anchor.y;
            const cells = Math.hypot(dx, dy) / (this.scenePxPerCell || 1);
            return this.formatDistance(cells);
        },

        tooltipStyle() {
            return {
                left: (this.dragPointer.x + 14) + 'px',
                top:  (this.dragPointer.y + 14) + 'px',
            };
        },
    };
}

window.shapesFeature = shapesFeature;
