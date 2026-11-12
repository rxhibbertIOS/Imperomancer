// Canvas sits above the map/grid but below application overlays. Strokes use
// scene coordinates, so revealed areas remain aligned while the map is panned.
function fogFeature() {
    return {
        fogEnabled: false,
        fogColor: '#3e434e',
        fogEditing: false,
        fogTool: 'reveal',
        fogBrush: 'round',
        fogBrushCells: 2,
        fogStrokes: [],
        fogCursor: null,
        _fogDrawing: false,
        _fogCanvas: null,
        _fogRaf: null,
        _fogResizeObserver: null,

        initFog() {
            ['fogEnabled', 'fogColor', 'fogStrokes', 'view', 'scenePxPerCell'].forEach(key => {
                this.$watch?.(key, () => this.drawFog());
            });
            this.$nextTick?.(() => {
                const canvas = this.getFogCanvas();
                if (!canvas) return;
                this._fogResizeObserver?.disconnect();
                if (typeof ResizeObserver !== 'undefined') {
                    this._fogResizeObserver = new ResizeObserver(() => this.drawFog());
                    this._fogResizeObserver.observe(canvas);
                }
                this.drawFog();
            });
        },

        fogStroke(point) {
            return { mode: this.fogTool, shape: this.fogBrush, size: Number(this.fogBrushCells) || 1, x: point.x, y: point.y };
        },

        fogPointerStart(event) {
            if (!this.fogEnabled || !this.fogEditing || event.button !== 0) return false;
            this._fogDrawing = true;
            this.fogPointerMove(event);
            return true;
        },

        fogPointerMove(event) {
            if (!this._fogDrawing && (!this.fogEnabled || !this.fogEditing || window.MODE !== 'dm')) return;
            const point = this.screenToScene(event.clientX, event.clientY);
            if (!point) return;
            if (this.fogEnabled && this.fogEditing && window.MODE === 'dm') {
                this.fogCursor = this.fogStroke(point);
            }
            if (!this._fogDrawing) {
                this.drawFog();
                return;
            }
            this.fogStrokes = [...this.fogStrokes, this.fogStroke(point)];
            this.drawFog();
        },

        fogPointerEnd() {
            if (!this._fogDrawing) return;
            this._fogDrawing = false;
            this.saveSelectedScene?.(true, true);
            window.syncState?.(this.$data);
        },

        hideFogCursor() {
            if (!this.fogCursor) return;
            this.fogCursor = null;
            this.drawFog();
        },

        setFogEditing(editing) {
            this.fogEditing = editing === true;
            if (!this.fogEditing) this.hideFogCursor();
            systemLog.info('fog', 'edit', this.fogEditing ? 'Fog editing enabled' : 'Fog editing disabled');
        },

        clearFog() {
            this.fogStrokes = [];
            this.fogEnabled = false;
            this.setFogEditing(false);
            this.saveSelectedScene?.(true, true);
            window.syncState?.(this.$data);
            systemLog.danger('fog', 'clear', 'Fog and all reveal strokes cleared');
        },

        resetFog() {
            this.fogStrokes = [];
            this.fogEnabled = true;
            this.setFogEditing(true);
            this.saveSelectedScene?.(true, true);
            window.syncState?.(this.$data);
            systemLog.success('fog', 'reset', 'Fog reset and editing enabled');
        },

        getFogCanvas() {
            if (this._fogCanvas?.isConnected) return this._fogCanvas;
            this._fogCanvas = this.$root?.querySelector('[data-fog-canvas]') || null;
            return this._fogCanvas;
        },

        drawFog() {
            if (this._fogRaf) return;
            this._fogRaf = requestAnimationFrame(() => {
                this._fogRaf = null;
                this._drawFog();
            });
        },

        fogField(context, width, height, playerView) {
            const opacity = playerView ? 1 : 0.68;
            const { r, g, b } = this.fogRgb();
            const field = context.createLinearGradient(0, 0, width * 0.35, height);
            field.addColorStop(0, this.fogRgba(1.34, opacity, r, g, b));
            field.addColorStop(0.48, this.fogRgba(1, opacity, r, g, b));
            field.addColorStop(1, this.fogRgba(0.62, opacity, r, g, b));
            return field;
        },

        fogRgb() {
            const value = String(this.fogColor || '#3e434e').replace('#', '');
            const normalized = value.length === 3 ? value.split('').map(part => part + part).join('') : value;
            const integer = Number.parseInt(normalized, 16);
            if (!Number.isFinite(integer)) return { r: 62, g: 67, b: 78 };
            return { r: (integer >> 16) & 255, g: (integer >> 8) & 255, b: integer & 255 };
        },

        fogRgba(multiplier, alpha, r, g, b) {
            const shade = value => Math.max(0, Math.min(255, Math.round(value * multiplier)));
            return `rgba(${shade(r)}, ${shade(g)}, ${shade(b)}, ${alpha})`;
        },

        fogPaint(context, center, radius, shape, playerView) {
            const alpha = playerView ? 1 : 0.68;
            const { r, g, b } = this.fogRgb();
            const paint = this.fogRgba(1, alpha, r, g, b);
            const feather = Math.max(8, Math.min(28, radius * 0.22));
            context.globalCompositeOperation = 'source-over';

            // A blurred first pass blends repainted fog back into its surroundings.
            context.save();
            context.filter = `blur(${feather}px)`;
            context.fillStyle = paint;
            if (shape === 'square') context.fillRect(center.x - radius, center.y - radius, radius * 2, radius * 2);
            else {
                context.beginPath();
                context.arc(center.x, center.y, radius, 0, Math.PI * 2);
                context.fill();
            }
            context.restore();

            context.fillStyle = paint;
            if (shape === 'square') context.fillRect(center.x - radius * 0.78, center.y - radius * 0.78, radius * 1.56, radius * 1.56);
            else {
                context.beginPath();
                context.arc(center.x, center.y, radius * 0.78, 0, Math.PI * 2);
                context.fill();
            }
        },

        fogReveal(context, center, radius, shape) {
            context.globalCompositeOperation = 'destination-out';
            const feather = Math.max(8, Math.min(28, radius * 0.22));
            context.save();
            context.filter = `blur(${feather}px)`;
            context.fillStyle = '#000';
            if (shape === 'square') context.fillRect(center.x - radius * 0.86, center.y - radius * 0.86, radius * 1.72, radius * 1.72);
            else {
                context.beginPath();
                context.arc(center.x, center.y, radius * 0.86, 0, Math.PI * 2);
                context.fill();
            }
            context.restore();
            context.fillStyle = '#000';
            if (shape === 'square') context.fillRect(center.x - radius * 0.68, center.y - radius * 0.68, radius * 1.36, radius * 1.36);
            else {
                context.beginPath();
                context.arc(center.x, center.y, radius * 0.68, 0, Math.PI * 2);
                context.fill();
            }
        },

        drawFogCursor(context) {
            if (window.MODE !== 'dm' || !this.fogEditing || !this.fogCursor) return;
            const center = this.sceneToStage?.(this.fogCursor.x, this.fogCursor.y);
            const edge = this.sceneToStage?.(this.fogCursor.x + (this.fogCursor.size * (Number(this.scenePxPerCell) || 100)), this.fogCursor.y);
            if (!center || !edge) return;
            const radius = Math.max(1, Math.abs(edge.x - center.x));
            context.save();
            context.globalCompositeOperation = 'source-over';
            context.strokeStyle = this.fogCursor.mode === 'reveal' ? '#f4f7ff' : '#ffc95c';
            context.lineWidth = 2;
            context.setLineDash([7, 5]);
            if (this.fogCursor.shape === 'square') context.strokeRect(center.x - radius, center.y - radius, radius * 2, radius * 2);
            else {
                context.beginPath();
                context.arc(center.x, center.y, radius, 0, Math.PI * 2);
                context.stroke();
            }
            context.restore();
        },

        _drawFog() {
            const canvas = this.getFogCanvas();
            if (!canvas) return;
            const width = canvas.clientWidth;
            const height = canvas.clientHeight;
            if (!width || !height) return;

            const dpr = window.devicePixelRatio || 1;
            const pixelWidth = Math.round(width * dpr);
            const pixelHeight = Math.round(height * dpr);
            if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
                canvas.width = pixelWidth;
                canvas.height = pixelHeight;
            }

            const context = canvas.getContext('2d');
            context.setTransform(dpr, 0, 0, dpr, 0, 0);
            context.clearRect(0, 0, width, height);
            if (!this.fogEnabled) return;

            const playerView = window.MODE === 'player';
            context.fillStyle = this.fogField(context, width, height, playerView);
            context.fillRect(0, 0, width, height);

            for (const stroke of this.fogStrokes) {
                const center = this.sceneToStage?.(stroke.x, stroke.y);
                const edge = this.sceneToStage?.(stroke.x + ((Number(stroke.size) || 1) * (Number(this.scenePxPerCell) || 100)), stroke.y);
                if (!center || !edge) continue;
                const radius = Math.max(1, Math.abs(edge.x - center.x));
                if (stroke.mode === 'reveal') this.fogReveal(context, center, radius, stroke.shape);
                else this.fogPaint(context, center, radius, stroke.shape, playerView);
            }
            context.globalCompositeOperation = 'source-over';
            this.drawFogCursor(context);
        },
    };
}

window.fogFeature = fogFeature;
