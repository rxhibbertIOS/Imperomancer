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

        // ============================================================
        //  CONTEXT MENU
        // ============================================================
        handleStageContextMenu(ev) {
            if (this.focusMode) { this.focusMode = false; return; }
            if (this.dragShape || this.pendingShapeKind) { this.cancelShapeDrag(); return; }
            if (this.shapeMenu) { this.shapeMenu = null; return; }
            this.openShapeMenu(ev);
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
                sceneX: scenePt.x,
                sceneY: scenePt.y,
            };
        },

        pickShapeKind(kind) {
            if (!this.shapeMenu) return;
            this._shapeAnchor = { x: this.shapeMenu.sceneX, y: this.shapeMenu.sceneY };
            this.pendingShapeKind = kind;
            this.shapeMenu = null;
        },

        cancelShapeDrag() {
            this.dragShape = null;
            this.pendingShapeKind = null;
            this._shapeAnchor = null;
        },

        // ============================================================
        //  DISPATCHERS (replace the inline handlers on [data-stage-inner])
        // ============================================================
        handleStageMouseDown(ev) {
            if (this.focusMode) return this.handleFocusClick(ev);
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
                endpoint: scenePt,
                visibility: 'public',
            };

            const inner = this.getStageInnerEl();
            if (inner) {
                const rect = inner.getBoundingClientRect();
                this.dragPointer = {
                    x: ev.clientX - rect.left,
                    y: ev.clientY - rect.top,
                };
            }
        },

        shapeLayerMarkup() {
            const parts = [];

            const emit = (shape, cls = 'shape-stroke') => {
                const g = shape?.geometry;
                if (!g || g.kind !== 'line') return;
                const p = this.shapeStagePoints(g);
                if (!p || !p.a || !p.b) return;
                parts.push(
                    `<line x1="${p.a.x}" y1="${p.a.y}" x2="${p.b.x}" y2="${p.b.y}" class="${cls}"/>`
                );
            };

            (this.flashShapes || []).forEach(s => emit(s));
            emit(this.dragShape);   // harmless when null
            return parts.join('');
        },

        commitShapeDrag(ev) {
            if (!this.dragShape) return;

            const a = this.dragShape.anchor;
            const b = this.dragShape.endpoint;
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
                },
                visibility: this.dragShape.visibility,
                createdAt: Date.now(),
            };
            this.flashShapes = [...this.flashShapes, shape];
            this.cancelShapeDrag();
            ev?.preventDefault?.();
            ev?.stopPropagation?.();

            if (window.syncState && window.MODE === 'dm') {
                window.syncState(this.$data);
            }
        },

        // Fires on @animationend. Idempotent so it's safe on both sides.
        expireFlashShape(id) {
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
            const scene = document.querySelector('[data-grid-scene]');
            if (!scene) return null;                 // stage isn't mounted yet
            const rect = scene.getBoundingClientRect();
            if (!rect || !rect.width || !rect.height) return null;
            
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