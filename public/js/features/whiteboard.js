// ============================================================
// SHARED WHITEBOARD
// Strokes are stored in normalized coordinates so the same drawing scales to
// the DM preview and the player display without transferring bitmap data.
// ============================================================
const WHITEBOARD_TOOLS = Object.freeze(['pencil', 'highlighter', 'line', 'arrow', 'rectangle', 'ellipse', 'eraser']);
const WHITEBOARD_DEFAULT_COLOR = '#1e293b';

/** Returns whether a value is a supported, persistable whiteboard tool. @param {unknown} tool Candidate tool. @returns {boolean} Whether the tool is supported. */
function isWhiteboardTool(tool) {
    return WHITEBOARD_TOOLS.includes(tool);
}

/** Returns whether a value is a safe CSS hexadecimal drawing colour. @param {unknown} color Candidate colour. @returns {boolean} Whether the colour is valid. */
function isWhiteboardColor(color) {
    return typeof color === 'string' && /^#[0-9a-f]{6}$/iu.test(color);
}

/** Creates a resolution-independent collaborative whiteboard feature. @returns {object} Alpine-compatible whiteboard feature. */
function whiteboardFeature() {
    return {
        whiteboardActive: false,
        whiteboardTool: 'pencil',
        whiteboardColor: WHITEBOARD_DEFAULT_COLOR,
        whiteboardSize: 5,
        whiteboardStrokes: [],
        whiteboardPreview: null,
        whiteboardCursor: null,
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

        /**
         * Chooses the next DM drawing tool without modifying the shared drawing.
         *
         * @param {string} tool - One of the supported tool identifiers.
         * @returns {boolean} Whether the tool was accepted.
         */
        setWhiteboardTool(tool) {
            if (!isWhiteboardTool(tool)) return false;
            this.whiteboardTool = tool;
            return true;
        },

        /**
         * Chooses the colour applied to subsequently created non-eraser strokes.
         *
         * @param {string} color - Six-digit hexadecimal colour from the picker or a preset.
         * @returns {boolean} Whether the colour was accepted.
         */
        setWhiteboardColor(color) {
            if (!isWhiteboardColor(color)) return false;
            this.whiteboardColor = color.toLowerCase();
            return true;
        },

        setWhiteboardActive(active) {
            this.whiteboardActive = active === true;
            if (!this.whiteboardActive) {
                this._whiteboardDraft = null;
                this.whiteboardPreview = null;
                this.whiteboardCursor = null;
            }
            this.drawWhiteboard();
            if (window.MODE === 'dm') window.syncState?.(this.$data);
            systemLog.info('whiteboard', 'toggle', this.whiteboardActive ? 'Whiteboard enabled' : 'Whiteboard disabled');
        },

        clearWhiteboard() {
            this.whiteboardStrokes = [];
            this._whiteboardDraft = null;
            this.whiteboardPreview = null;
            this.drawWhiteboard();
            if (window.MODE === 'dm') window.syncState?.(this.$data);
            systemLog.danger('whiteboard', 'clear', 'Whiteboard strokes cleared');
        },

        /**
         * Removes the latest committed stroke while leaving earlier shared marks intact.
         *
         * @returns {boolean} Whether a stroke was available to remove.
         */
        undoWhiteboard() {
            if (!this.whiteboardStrokes.length) return false;
            this.whiteboardStrokes = this.whiteboardStrokes.slice(0, -1);
            this.drawWhiteboard();
            if (window.MODE === 'dm') window.syncState?.(this.$data);
            systemLog.info('whiteboard', 'undo', 'Latest whiteboard stroke removed');
            return true;
        },

        /**
         * Reports whether a tool stores a continuous sequence of pointer points.
         *
         * @param {string} tool - Tool identifier to inspect.
         * @returns {boolean} Whether the tool is freehand.
         */
        whiteboardIsFreehandTool(tool) {
            return tool === 'pencil' || tool === 'highlighter' || tool === 'eraser';
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

        /**
         * Updates the DM-only pointer preview without synchronizing high-frequency cursor movement.
         *
         * @param {PointerEvent} event - Pointer event positioned over the whiteboard canvas.
         * @returns {boolean} Whether a cursor position was recorded.
         */
        updateWhiteboardCursor(event) {
            if (window.MODE !== 'dm' || !this.whiteboardActive) return false;
            const point = this.whiteboardPoint(event);
            if (!point) return false;
            this.whiteboardCursor = point;
            return true;
        },

        /** Clears the private DM cursor preview when the pointer leaves the board. @returns {void} */
        hideWhiteboardCursor() {
            this.whiteboardCursor = null;
        },

        /**
         * Produces the inline style for a cursor ring whose diameter matches the rendered brush width.
         *
         * @returns {Record<string, string>} CSS properties for the cursor-preview element.
         */
        whiteboardCursorStyle() {
            const cursor = this.whiteboardCursor;
            const canvas = this.getWhiteboardCanvas();
            if (!cursor || !canvas?.clientWidth) return {};
            const size = Math.max(1, (Number(this.whiteboardSize) || 5) * canvas.clientWidth / 1000);
            const color = isWhiteboardColor(this.whiteboardColor) ? this.whiteboardColor : WHITEBOARD_DEFAULT_COLOR;
            return {
                left: `${cursor.x * 100}%`,
                top: `${cursor.y * 100}%`,
                width: `${size}px`,
                height: `${size}px`,
                '--whiteboard-cursor-colour': color,
            };
        },

        whiteboardPointerDown(event) {
            if (window.MODE !== 'dm' || !this.whiteboardActive || event.button !== 0) return;
            const point = this.whiteboardPoint(event);
            if (!point) return;
            this.whiteboardCursor = point;
            event.currentTarget.setPointerCapture?.(event.pointerId);
            this._whiteboardDraft = {
                tool: isWhiteboardTool(this.whiteboardTool) ? this.whiteboardTool : 'pencil',
                color: isWhiteboardColor(this.whiteboardColor) ? this.whiteboardColor : WHITEBOARD_DEFAULT_COLOR,
                size: Number(this.whiteboardSize) || 5,
                points: [point],
            };
            this.whiteboardPreview = this._whiteboardDraft;
            this.syncWhiteboardPreview(true);
            this.drawWhiteboard();
        },

        whiteboardPointerMove(event) {
            this.updateWhiteboardCursor(event);
            const draft = this._whiteboardDraft;
            if (!draft) return;
            const point = this.whiteboardPoint(event);
            if (!point) return;
            if (this.whiteboardIsFreehandTool(draft.tool)) draft.points.push(point);
            else draft.points[1] = point;
            this.whiteboardPreview = { ...draft, points: [...draft.points] };
            this.syncWhiteboardPreview();
            this.drawWhiteboard();
        },

        whiteboardPointerUp(event) {
            const draft = this._whiteboardDraft;
            if (!draft) return;
            const point = this.whiteboardPoint(event);
            if (point && this.whiteboardIsFreehandTool(draft.tool)) draft.points.push(point);
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
            const lineWidth = Math.max(1, (Number(stroke.size) || 5) * width / 1000);
            context.lineWidth = lineWidth;
            context.globalAlpha = stroke.tool === 'highlighter' ? 0.35 : 1;
            context.strokeStyle = stroke.tool === 'eraser' ? '#fff' : (isWhiteboardColor(stroke.color) ? stroke.color : WHITEBOARD_DEFAULT_COLOR);
            context.fillStyle = context.strokeStyle;
            if (this.whiteboardIsFreehandTool(stroke.tool)) {
                context.beginPath();
                context.moveTo(start.x, start.y);
                for (let index = 1; index < points.length; index += 1) {
                    const next = point(points[index]);
                    context.lineTo(next.x, next.y);
                }
                context.stroke();
            } else if (stroke.tool === 'line') {
                context.beginPath(); context.moveTo(start.x, start.y); context.lineTo(end.x, end.y); context.stroke();
            } else if (stroke.tool === 'arrow') {
                const angle = Math.atan2(end.y - start.y, end.x - start.x);
                const headLength = Math.max(10, lineWidth * 3.5);
                context.beginPath();
                context.moveTo(start.x, start.y);
                context.lineTo(end.x, end.y);
                context.lineTo(end.x - (headLength * Math.cos(angle - Math.PI / 6)), end.y - (headLength * Math.sin(angle - Math.PI / 6)));
                context.moveTo(end.x, end.y);
                context.lineTo(end.x - (headLength * Math.cos(angle + Math.PI / 6)), end.y - (headLength * Math.sin(angle + Math.PI / 6)));
                context.stroke();
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
