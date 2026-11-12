// ============================================================
// SHARED WHITEBOARD
// Strokes are stored in normalized coordinates so the same drawing scales to
// the DM preview and the player display without transferring bitmap data.
// ============================================================
function whiteboardFeature() {
    return {
        whiteboardActive: false,
        whiteboardTool: 'pencil',
        whiteboardColor: '#1e293b',
        whiteboardSize: 5,
        whiteboardStrokes: [],
        whiteboardPreview: null,
        _whiteboardDraft: null,
        _whiteboardLastSync: 0,
        _whiteboardCanvas: null,
        _whiteboardRaf: null,
        _whiteboardResizeObserver: null,

        initWhiteboard() {
            ['whiteboardActive', 'whiteboardStrokes'].forEach(key => this.$watch?.(key, () => this.drawWhiteboard()));
            this.$nextTick?.(() => {
                const canvas = this.getWhiteboardCanvas();
                if (!canvas) return;
                if (typeof ResizeObserver !== 'undefined') {
                    this._whiteboardResizeObserver?.disconnect();
                    this._whiteboardResizeObserver = new ResizeObserver(() => this.drawWhiteboard());
                    this._whiteboardResizeObserver.observe(canvas);
                }
                this.drawWhiteboard();
            });
        },

        getWhiteboardCanvas() {
            if (this._whiteboardCanvas?.isConnected) return this._whiteboardCanvas;
            this._whiteboardCanvas = this.$root?.querySelector('[data-whiteboard-canvas]') || null;
            return this._whiteboardCanvas;
        },

        setWhiteboardActive(active) {
            this.whiteboardActive = active === true;
            if (!this.whiteboardActive) this._whiteboardDraft = null;
            this.drawWhiteboard();
            if (window.MODE === 'dm') window.syncState?.(this.$data);
            systemLog.info('whiteboard', 'toggle', this.whiteboardActive ? 'Whiteboard enabled' : 'Whiteboard disabled');
        },

        clearWhiteboard() {
            this.whiteboardStrokes = [];
            this._whiteboardDraft = null;
            this.drawWhiteboard();
            if (window.MODE === 'dm') window.syncState?.(this.$data);
            systemLog.danger('whiteboard', 'clear', 'Whiteboard strokes cleared');
        },

        whiteboardPoint(event) {
            const canvas = this.getWhiteboardCanvas();
            const rect = canvas?.getBoundingClientRect();
            if (!rect?.width || !rect?.height) return null;
            return {
                x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
                y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
            };
        },

        whiteboardPointerDown(event) {
            if (window.MODE !== 'dm' || !this.whiteboardActive || event.button !== 0) return;
            const point = this.whiteboardPoint(event);
            if (!point) return;
            event.currentTarget.setPointerCapture?.(event.pointerId);
            this._whiteboardDraft = {
                tool: this.whiteboardTool,
                color: this.whiteboardColor,
                size: Number(this.whiteboardSize) || 5,
                points: [point],
            };
            this.whiteboardPreview = this._whiteboardDraft;
            this.syncWhiteboardPreview(true);
            this.drawWhiteboard();
        },

        whiteboardPointerMove(event) {
            const draft = this._whiteboardDraft;
            if (!draft) return;
            const point = this.whiteboardPoint(event);
            if (!point) return;
            if (draft.tool === 'pencil' || draft.tool === 'eraser') draft.points.push(point);
            else draft.points[1] = point;
            this.whiteboardPreview = { ...draft, points: [...draft.points] };
            this.syncWhiteboardPreview();
            this.drawWhiteboard();
        },

        whiteboardPointerUp(event) {
            const draft = this._whiteboardDraft;
            if (!draft) return;
            const point = this.whiteboardPoint(event);
            if (point && (draft.tool === 'pencil' || draft.tool === 'eraser')) draft.points.push(point);
            else if (point) draft.points[1] = point;
            if (draft.points.length === 1) draft.points.push({ ...draft.points[0] });
            this.whiteboardStrokes = [...this.whiteboardStrokes, draft];
            this._whiteboardDraft = null;
            this.whiteboardPreview = null;
            this.drawWhiteboard();
            window.syncState?.(this.$data);
        },

        syncWhiteboardPreview(force = false) {
            if (window.MODE !== 'dm') return;
            const now = performance.now();
            if (!force && now - this._whiteboardLastSync < 50) return;
            this._whiteboardLastSync = now;
            window.syncState?.(this.$data);
        },

        drawWhiteboard() {
            if (this._whiteboardRaf) return;
            this._whiteboardRaf = requestAnimationFrame(() => {
                this._whiteboardRaf = null;
                this._drawWhiteboard();
            });
        },

        whiteboardDrawStroke(context, stroke, width, height) {
            const points = stroke.points || [];
            if (!points.length) return;
            const point = value => ({ x: value.x * width, y: value.y * height });
            const start = point(points[0]);
            const end = point(points[points.length - 1]);
            context.save();
            context.lineCap = 'round';
            context.lineJoin = 'round';
            context.lineWidth = Math.max(1, (Number(stroke.size) || 5) * width / 1000);
            context.strokeStyle = stroke.tool === 'eraser' ? '#fff' : (stroke.color || '#1e293b');
            context.fillStyle = context.strokeStyle;
            if (stroke.tool === 'pencil' || stroke.tool === 'eraser') {
                context.beginPath();
                context.moveTo(start.x, start.y);
                for (let index = 1; index < points.length; index += 1) {
                    const next = point(points[index]);
                    context.lineTo(next.x, next.y);
                }
                context.stroke();
            } else if (stroke.tool === 'line') {
                context.beginPath(); context.moveTo(start.x, start.y); context.lineTo(end.x, end.y); context.stroke();
            } else if (stroke.tool === 'rectangle') {
                context.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
            } else if (stroke.tool === 'ellipse') {
                context.beginPath();
                context.ellipse((start.x + end.x) / 2, (start.y + end.y) / 2, Math.abs(end.x - start.x) / 2, Math.abs(end.y - start.y) / 2, 0, 0, Math.PI * 2);
                context.stroke();
            }
            context.restore();
        },

        _drawWhiteboard() {
            const canvas = this.getWhiteboardCanvas();
            if (!canvas) return;
            const width = canvas.clientWidth;
            const height = canvas.clientHeight;
            if (!width || !height) return;
            const dpr = window.devicePixelRatio || 1;
            if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
                canvas.width = Math.round(width * dpr);
                canvas.height = Math.round(height * dpr);
            }
            const context = canvas.getContext('2d');
            context.setTransform(dpr, 0, 0, dpr, 0, 0);
            context.clearRect(0, 0, width, height);
            context.fillStyle = '#fff';
            context.fillRect(0, 0, width, height);
            [...this.whiteboardStrokes, this.whiteboardPreview || this._whiteboardDraft].filter(Boolean).forEach(stroke => this.whiteboardDrawStroke(context, stroke, width, height));
        },
    };
}

window.whiteboardFeature = whiteboardFeature;
