// js/features/grid.js

function gridFeature() {
    return {
        // ---- Visibility + type ----
        gridVisible: false,
        gridType: 'square',           // 'square' | 'hex-pointy' | 'hex-flat'
        gridShowLabels: false,
        gridLabelEvery: 5,
        gridOpacity: 0.5,
        gridLineWidth: 1,
        gridColor: '#ffffff',
        locked: false,

        gridTypes: [
            { value: 'square',     label: 'Square' },
            { value: 'hex-pointy', label: 'Pointy Hex' },
            { value: 'hex-flat',   label: 'Flat Hex' },
        ],

        // ---- Per-scene metadata ----
        scenePxPerCell: 100,
        sceneGridOriginX: 0,
        sceneGridOriginY: 0,
        gridCellsAcross: 30,
        cellUnits: 5,                    // how many units one cell represents
        unitNameSingular: 'foot',
        unitNamePlural: 'feet',

        // ---- Table display (the TV) ----
        tableDiagonal: 55,
        tableAspectW: 16,
        tableAspectH: 9,
        tableCorrection: 1,
        playerStageW: 0,
        playerStageH: 0,

        // Published by the player window on startup
        tableScreenWidth: 1920,
        tableScreenHeight: 1080,

        // Received from the DM's sync payload
        tablePpi: 40,

        // Calibration square visibility on the table display
        showCalibrationSquare: false,

        // ---- Internal ----
        _gridCanvas: null,
        _gridCtx: null,
        _gridRaf: null,

        initGrid() {
            this.loadGridSettings();
            this.loadCalibration();

            // Redraw whenever anything affecting the overlay changes.
            const redraw = () => this.drawGrid();
            [
                'gridType', 'gridShowLabels', 'gridLabelEvery', 'gridOpacity',
                'scenePxPerCell', 'sceneGridOriginX', 'sceneGridOriginY',
            ].forEach(prop => {
                if (prop in this) this.$watch(prop, redraw);
            });


            ['tableDiagonal', 'tableAspectW', 'tableAspectH', 'tableCorrection']
            .forEach(prop => {
                this.$watch(prop, () => {
                    if (window.MODE === 'dm') {
                        this.tablePpi = this.computeTablePpi();
                        this.reevalLock();
                    }
                });
            });

            this.$watch('gridVisible', (v) => {
                if (v) this.startGridLoop();
                this.drawGrid();
            });

            window.addEventListener('resize', redraw);

            // Continuously redraw while the grid is visible — cheap enough,
            // and it sidesteps every "did state finish applying?" race.
            this.startGridLoop();
        },

        startGridLoop() {
            if (this._gridRaf) return;
            const loop = () => {
                if (!this.gridVisible) {
                    this._gridRaf = null;
                    return;
                }
                this.drawGrid();
                this._gridRaf = requestAnimationFrame(loop);
            };
            this._gridRaf = requestAnimationFrame(loop);
        },

        // ============================================================
        //  GRID SETTINGS PERSISTENCE
        // ============================================================
        loadGridSettings() {
            try {
                const s = JSON.parse(localStorage.getItem('dm.grid') || '{}');
                if (s.gridType) this.gridType = s.gridType;
                if (typeof s.gridShowLabels === 'boolean') this.gridShowLabels = s.gridShowLabels;
                if (s.gridOpacity != null) this.gridOpacity = s.gridOpacity;
                if (s.gridLabelEvery) this.gridLabelEvery = s.gridLabelEvery;
                if (s.cellUnits != null)        this.cellUnits        = s.cellUnits;
                if (s.unitNameSingular != null) this.unitNameSingular = s.unitNameSingular;
                if (s.unitNamePlural != null)   this.unitNamePlural   = s.unitNamePlural;
            } catch (_) { /* ignore */ }
        },

        saveGridSettings() {
            localStorage.setItem('dm.grid', JSON.stringify({
                gridType: this.gridType,
                gridShowLabels: this.gridShowLabels,
                gridOpacity: this.gridOpacity,
                gridLabelEvery: this.gridLabelEvery,
                cellUnits:        this.cellUnits,
                unitNameSingular: this.unitNameSingular,
                unitNamePlural:   this.unitNamePlural,
            }));
        },
        onScenePxPerCellChange() {
            const img = this.getSceneEl();
            if (!img) return;
            const w = img.naturalWidth || img.videoWidth;
            if (!w) return;
            this.gridCellsAcross = Math.max(1, Math.round(w / this.scenePxPerCell));
            this.drawGrid();
            if (this.locked) this.reevalLock();
        },
        applyCellsAcross() {
            const img = this.getSceneEl();
            if (!img) return;
            const w = img.naturalWidth || img.videoWidth;
            if (!w || !this.gridCellsAcross) return;
            this.scenePxPerCell = w / this.gridCellsAcross;
            this.drawGrid();
        },

        applyPxPerCell() {
            const img = this.getSceneEl();
            if (!img || !this.scenePxPerCell) return;
            const w = img.naturalWidth || img.videoWidth;
            if (!w) return;
            this.gridCellsAcross = Math.round(w / this.scenePxPerCell);
            this.drawGrid();
        },

        // scene px -> cells
        pxToCells(scenePx) {
            return scenePx / this.scenePxPerCell;
        },

        // Format for a tooltip given scene-pixel distance
        describeDistance(scenePx) {
            return this.formatDistance(this.pxToCells(scenePx));
        },

        resetGridOrigin() {
            this.sceneGridOriginX = 0;
            this.sceneGridOriginY = 0;
            this.drawGrid();
        },
        // ============================================================
        //  CALIBRATION
        // ============================================================
        loadCalibration() {
            // Migrate old shape if present
            try {
                const old = JSON.parse(localStorage.getItem('dm.calibration') || 'null');
                if (old && !localStorage.getItem('dm.tableDisplay')) {
                    localStorage.setItem('dm.tableDisplay', JSON.stringify({
                        tableDiagonal:     old.displayDiagonal  ?? 55,
                        tableAspectW:      old.displayAspectW   ?? 16,
                        tableAspectH:      old.displayAspectH   ?? 9,
                        tableCorrection:   old.displayCorrection ?? 1,
                    }));
                }
            } catch (_) {}

            try {
                const s = JSON.parse(localStorage.getItem('dm.tableDisplay') || '{}');
                if (s.tableDiagonal   != null) this.tableDiagonal   = s.tableDiagonal;
                if (s.tableAspectW    != null) this.tableAspectW    = s.tableAspectW;
                if (s.tableAspectH    != null) this.tableAspectH    = s.tableAspectH;
                if (s.tableCorrection != null) this.tableCorrection = s.tableCorrection;
            } catch (_) {}
        },

        saveCalibration() {
            localStorage.setItem('dm.tableDisplay', JSON.stringify({
                tableDiagonal:   this.tableDiagonal,
                tableAspectW:    this.tableAspectW,
                tableAspectH:    this.tableAspectH,
                tableCorrection: this.tableCorrection,
            }));
        },

        // On the DM side this computes from calibration + the player-reported
        // screen width. On the player side, `tablePpi` arrives via sync.
        computeTablePpi() {
            const diag = Math.hypot(this.tableAspectW, this.tableAspectH);
            const physW = this.tableDiagonal * this.tableAspectW / diag;
            if (!physW || !this.tableScreenWidth) return 40;
            return (this.tableScreenWidth / physW) * this.tableCorrection;
        },

        effectivePpi() {
            // Prefer the synced value if present (player side always has it;
            // DM side updates it locally on calibration change).
            return this.tablePpi || this.computeTablePpi();
        },

        cellPx() {
            return this.effectivePpi();
        },

        // DM measures the on-screen reference, we scale by 1/measured
        calibrate(measuredInches) {
            const m = parseFloat(measuredInches);
            if (!m || m <= 0) return;
            this.tableCorrection /= m;
            this.tablePpi = this.computeTablePpi();
            this.saveCalibration();
            this.drawGrid();
            if (window.syncState && window.MODE === 'dm') window.syncState(this.$data);
        },

        resetCalibration() {
            this.tableCorrection = 1;
            this.tablePpi = this.computeTablePpi();
            this.saveCalibration();
            this.drawGrid();
            if (window.syncState && window.MODE === 'dm') window.syncState(this.$data);
        },

        toggleCalibrationSquare() {
            this.showCalibrationSquare = !this.showCalibrationSquare;
            if (window.syncState && window.MODE === 'dm') window.syncState(this.$data);
        },

        onDisplayInfo(info) {
            // Called by the DM when the player reports its screen
            this.tableScreenWidth  = info.screenWidth  || this.tableScreenWidth;
            this.tableScreenHeight = info.screenHeight || this.tableScreenHeight;
            this.tablePpi = this.computeTablePpi();
            this.drawGrid();
            if (window.syncState && window.MODE === 'dm') window.syncState(this.$data);
        },

        // ============================================================
        //  LOCK (1 inch per cell)
        // ============================================================
        lockedSceneW() {
            const { nw } = this.naturalSize?.() || { nw: 0 };
            const cell = this.scenePxPerCell;
            const ppi  = this.effectivePpi();
            const playerW = this.playerStageW || 0;
            if (!nw || !cell || cell < 2 || !ppi || !playerW) return NaN;
            // 1 cell = 1 physical inch on the table:
            //   scale = ppi / cell   (CSS px per scene px)
            //   sceneW = playerStageW / scale
            return playerW * cell / ppi;
        },

        canLock() {
            const sw = this.lockedSceneW();
            return isFinite(sw) && sw > 0;
        },

        enterLock() {
            const sw = this.lockedSceneW();
            if (!isFinite(sw) || sw <= 0) {
                LOG('⚠️ Cannot lock: missing display info or scene metadata');
                this.locked = false;
                return;
            }
            this.animateSceneW(sw);
        },

        exitLock() {
            this.drawGrid();
            if (window.syncState && window.MODE === 'dm') window.syncState(this.$data);
        },

        animateSceneW(target) {
            const apply = (sceneW) => {
                this.view = { ...this.view, sceneW };
                if (this.clampView) this.clampView();
                // Let the rAF loop redraw. If gridVisible is off, call drawGrid() directly.
                if (!this.gridVisible && this.drawGrid) this.drawGrid();
            };

            if (typeof gsap === 'undefined') {
                apply(target);
                if (window.syncState && window.MODE === 'dm') window.syncState(this.$data);
                return;
            }

            const proxy = { sceneW: this.view.sceneW };
            gsap.killTweensOf(proxy);
            gsap.to(proxy, {
                sceneW: target,
                duration: 0.35,
                ease: 'power2.out',
                onUpdate: () => apply(proxy.sceneW),
                onComplete: () => {
                    apply(target);
                    if (window.syncState && window.MODE === 'dm') window.syncState(this.$data);
                },
            });
        },

        // Toggle handler, called from the UI checkbox
        toggleLock() {
            if (this.locked) {
                this.enterLock();
            } else {
                this.exitLock();
            }
        },

        onPlayerStage(info) {
            if (info.stageW) this.playerStageW = info.stageW;
            if (info.stageH) this.playerStageH = info.stageH;
            this.reevalLock();
            if (window.syncState && window.MODE === 'dm') window.syncState(this.$data);
        },

        // Recompute if locked and an input changed (grid size, calibration, etc.)
        reevalLock() {
            if (!this.locked) return;
            const sw = this.lockedSceneW();
            if (!isFinite(sw) || sw <= 0) return;
            if (Math.abs(sw - this.view.sceneW) < 0.5) return;
            this.animateSceneW(sw);
        },

        // ============================================================
        //  RENDER
        // ============================================================
        getSceneEl() {
            return this.$root.querySelector('[data-grid-scene]');
        },

        getGridCanvas() {
            if (this._gridCanvas && this._gridCanvas.isConnected) return this._gridCanvas;
            const c = this.$root.querySelector('[data-grid-canvas]');
            if (!c) return null;
            this._gridCanvas = c;
            this._gridCtx = c.getContext('2d');
            return c;
        },

        drawGrid() {
            const canvas = this.getGridCanvas();
            if (!canvas) return;

            const dpr = window.devicePixelRatio || 1;
            const W = canvas.clientWidth;
            const H = canvas.clientHeight;
            if (W === 0 || H === 0) return;

            if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
                canvas.width = Math.round(W * dpr);
                canvas.height = Math.round(H * dpr);
            }

            const ctx = this._gridCtx;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, W, H);

            if (!this.gridVisible) return;

            // Derive from view state instead of getBoundingClientRect
            const { nw, nh } = this.naturalSize ? this.naturalSize() : { nw: 0, nh: 0 };
            if (!nw || !nh) return;

            const { W: stageW } = this.stageSize();
            if (!stageW) return;

            const scale = stageW / this.view.sceneW;
            const sx = scale;
            const sy = scale;
            const ox = stageW / 2 - this.view.cx * scale;
            const oy = (canvas.clientHeight) / 2 - this.view.cy * scale;

            const cell = this.scenePxPerCell;
            if (!cell || cell < 2) return;

            // --- Image rectangle in canvas (CSS px) coords ---
            const imgX0 = ox;
            const imgY0 = oy;
            const imgW  = nw * sx;
            const imgH  = nh * sy;

            // Clip grid drawing (lines + labels) to the image bounds so
            // nothing spills onto the letterboxed area when zoomed out.
            ctx.save();
            ctx.beginPath();
            ctx.rect(imgX0, imgY0, imgW, imgH);
            ctx.clip();

            ctx.strokeStyle = this.gridColor;
            ctx.globalAlpha = this.gridOpacity;
            ctx.lineWidth = this.gridLineWidth;

            if (this.gridType === 'square') {
                this.drawSquare(ctx, W, H, nw, nh, ox, oy, sx, sy, cell);
            } else {
                this.drawHex(ctx, W, H, ox, oy, sx, sy, cell,
                            this.gridType === 'hex-pointy');
            }

            ctx.restore();
            ctx.globalAlpha = 1;
        },

        drawSquare(ctx, W, H, srcW, srcH, ox, oy, sx, sy, cell) {
            const gx = this.sceneGridOriginX;
            const gy = this.sceneGridOriginY;

            // Columns: image x = gx + n*cell, for n such that x is within [0, srcW]
            const nMin = Math.floor(-gx / cell) - 1;
            const nMax = Math.ceil((srcW - gx) / cell) + 1;
            const mMin = Math.floor(-gy / cell) - 1;
            const mMax = Math.ceil((srcH - gy) / cell) + 1;

            ctx.beginPath();
            for (let n = nMin; n <= nMax; n++) {
                const xC = Math.round(ox + (gx + n * cell) * sx) + 0.5;
                if (xC < -1 || xC > W + 1) continue;
                ctx.moveTo(xC, 0);
                ctx.lineTo(xC, H);
            }
            for (let m = mMin; m <= mMax; m++) {
                const yC = Math.round(oy + (gy + m * cell) * sy) + 0.5;
                if (yC < -1 || yC > H + 1) continue;
                ctx.moveTo(0, yC);
                ctx.lineTo(W, yC);
            }
            ctx.stroke();

            if (!this.gridShowLabels) return;

            ctx.font = '11px system-ui, sans-serif';
            ctx.textBaseline = 'top';
            ctx.textAlign = 'left';
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'rgba(0,0,0,0.75)';
            ctx.fillStyle = this.gridColor;
            ctx.globalAlpha = Math.min(1, this.gridOpacity + 0.35);

            for (let n = nMin; n <= nMax; n++) {
                if (n % this.gridLabelEvery !== 0) continue;
                for (let m = mMin; m <= mMax; m++) {
                    if (m % this.gridLabelEvery !== 0) continue;
                    const xC = ox + (gx + n * cell) * sx + 3;
                    const yC = oy + (gy + m * cell) * sy + 3;
                    if (xC < -20 || xC > W || yC < -12 || yC > H) continue;

                    const label = this.colLabel(n) + (m + 1);
                    ctx.strokeText(label, xC, yC);
                    ctx.fillText(label, xC, yC);
                }
            }
        },

        drawHex(ctx, W, H, ox, oy, sx, sy, cell, pointy) {
            // cell = flat-to-flat size in image pixels.
            // R = circumradius, R = cell / sqrt(3)
            const s3 = Math.sqrt(3);
            const Rimg = cell / s3;

            // Convert to canvas coords:
            const Rx = Rimg * sx;
            const Ry = Rimg * sy;

            const gx = this.sceneGridOriginX;
            const gy = this.sceneGridOriginY;

            ctx.beginPath();

            if (pointy) {
                // pointy-top hexes: centers on rows spaced 1.5*R vertically,
                // columns spaced sqrt(3)*R horizontally, odd rows offset by sqrt(3)*R/2.
                // Convert from image coords: (r = row index, q = column index)
                const rowH = 1.5 * Ry;
                const colW = s3 * Rx;

                const rMin = Math.floor((-oy - Ry) / rowH) - 1;
                const rMax = Math.ceil((H - oy + Ry) / rowH) + 1;

                for (let r = rMin; r <= rMax; r++) {
                    const cyImg = gy + r * (1.5 * Rimg);
                    const cyC = oy + cyImg * sy;

                    const qMin = Math.floor((-ox - Rx) / colW) - 2;
                    const qMax = Math.ceil((W - ox + Rx) / colW) + 2;

                    for (let q = qMin; q <= qMax; q++) {
                        const cxImg = gx + q * (s3 * Rimg) + (Math.abs(r) % 2 ? (s3 * Rimg) / 2 : 0);
                        const cxC = ox + cxImg * sx;
                        this.hexPath(ctx, cxC, cyC, Rx, Ry, true);
                    }
                }
            } else {
                // flat-top: columns spaced 1.5*R horizontally, rows spaced sqrt(3)*R,
                // odd columns offset by sqrt(3)*R/2.
                const colW = 1.5 * Rx;
                const rowH = s3 * Ry;

                const qMin = Math.floor((-ox - Rx) / colW) - 1;
                const qMax = Math.ceil((W - ox + Rx) / colW) + 1;

                for (let q = qMin; q <= qMax; q++) {
                    const cxImg = gx + q * (1.5 * Rimg);
                    const cxC = ox + cxImg * sx;

                    const rMin = Math.floor((-oy - Ry) / rowH) - 2;
                    const rMax = Math.ceil((H - oy + Ry) / rowH) + 2;

                    for (let r = rMin; r <= rMax; r++) {
                        const cyImg = gy + r * (s3 * Rimg) + (Math.abs(q) % 2 ? (s3 * Rimg) / 2 : 0);
                        const cyC = oy + cyImg * sy;
                        this.hexPath(ctx, cxC, cyC, Rx, Ry, false);
                    }
                }
            }
            ctx.stroke();

            if (!this.gridShowLabels) return;

            // Hex labels: use offset coords, every Nth
            ctx.font = '10px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'rgba(0,0,0,0.75)';
            ctx.fillStyle = this.gridColor;
            ctx.globalAlpha = Math.min(1, this.gridOpacity + 0.35);

            const s3c = Math.sqrt(3);
            const RimgC = cell / s3c;

            if (pointy) {
                const rowH = 1.5 * (RimgC * sy);
                const colW = s3c * (RimgC * sx);
                const rMin = Math.floor((-oy - Ry) / rowH) - 1;
                const rMax = Math.ceil((H - oy + Ry) / rowH) + 1;
                for (let r = rMin; r <= rMax; r++) {
                    if (r % this.gridLabelEvery !== 0) continue;
                    const cyImg = gy + r * 1.5 * RimgC;
                    const cyC = oy + cyImg * sy;
                    for (let q = Math.floor((-ox - Rx) / colW) - 1; q <= Math.ceil((W - ox + Rx) / colW) + 1; q++) {
                        if (q % this.gridLabelEvery !== 0) continue;
                        const cxImg = gx + q * s3c * RimgC + (Math.abs(r) % 2 ? s3c * RimgC / 2 : 0);
                        const cxC = ox + cxImg * sx;
                        const label = this.colLabel(q) + (r + 1);
                        ctx.strokeText(label, cxC, cyC);
                        ctx.fillText(label, cxC, cyC);
                    }
                }
            } else {
                const colW = 1.5 * (RimgC * sx);
                const rowH = s3c * (RimgC * sy);
                const qMin = Math.floor((-ox - Rx) / colW) - 1;
                const qMax = Math.ceil((W - ox + Rx) / colW) + 1;
                for (let q = qMin; q <= qMax; q++) {
                    if (q % this.gridLabelEvery !== 0) continue;
                    const cxImg = gx + q * 1.5 * RimgC;
                    const cxC = ox + cxImg * sx;
                    for (let r = Math.floor((-oy - Ry) / rowH) - 1; r <= Math.ceil((H - oy + Ry) / rowH) + 1; r++) {
                        if (r % this.gridLabelEvery !== 0) continue;
                        const cyImg = gy + r * s3c * RimgC + (Math.abs(q) % 2 ? s3c * RimgC / 2 : 0);
                        const cyC = oy + cyImg * sy;
                        const label = this.colLabel(q) + (r + 1);
                        ctx.strokeText(label, cxC, cyC);
                        ctx.fillText(label, cxC, cyC);
                    }
                }
            }
        },

        hexPath(ctx, cx, cy, rx, ry, pointy) {
            const start = pointy ? Math.PI / 6 : 0;
            for (let i = 0; i < 6; i++) {
                const a = start + i * Math.PI / 3;
                const x = cx + rx * Math.cos(a);
                const y = cy + ry * Math.sin(a);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
        },

        // Excel-style column labels: 0 → A, 25 → Z, 26 → AA
        colLabel(i) {
            let s = '';
            let n = i + 1;
            while (n > 0) {
                const r = (n - 1) % 26;
                s = String.fromCharCode(65 + r) + s;
                n = Math.floor((n - 1) / 26);
            }
            return s;
        },

        // ============================================================
        //  UI HELPERS
        // ============================================================
        gridTypeLabel() {
            if (!this.gridVisible) return 'Off';
            const t = this.gridTypes.find(x => x.value === this.gridType);
            return t ? t.label : 'Grid';
        },

        setGridType(v) {
            this.gridType = v;
            this.saveGridSettings();
            this.drawGrid();
        },

        onGridVisibleChange() {
            this.saveGridSettings();
            if (this.gridVisible) this.startGridLoop();
            this.drawGrid();
            if (window.syncState) window.syncState(this.$data);
        },

        onGridShowLabelsChange() {
            this.saveGridSettings();
            this.drawGrid();
        },
        // ============================================================
        //  GRID UNITS
        // ============================================================
        setGridUnits(perCell, singular, plural) {
            this.cellUnits        = perCell;
            this.unitNameSingular = singular;
            this.unitNamePlural   = plural;
            this.onGridUnitsChange();
        },

        onGridUnitsChange() {
            // Guard against empty/invalid input from the number field
            const n = Number(this.cellUnits);
            if (!isFinite(n) || n < 0) this.cellUnits = 0;

            // Keep names non-empty so the summary never looks broken
            if (!this.unitNameSingular.trim()) this.unitNameSingular = 'unit';
            if (!this.unitNamePlural.trim())   this.unitNamePlural   = this.unitNameSingular + 's';

            this.saveGridSettings();
            if (window.syncState && window.MODE === 'dm') window.syncState(this.$data);
        },

        // "foot" / "feet" based on a quantity
        unitNounFor(qty) {
            const n = Number(qty);
            const singular = n === 1;
            return singular ? this.unitNameSingular : this.unitNamePlural;
        },

        // "1 cell = 5 feet"  (or "1 cell = 1 league")
        unitSummary() {
            const per = Number(this.cellUnits) || 0;
            const noun = this.unitNounFor(per);
            if (!per) return '—';
            return `1 cell = ${per} ${noun}`;
        },

        // Distance formatter — handy for Phase 2 tooltips and any future
        // measurement UI. Returns e.g. "30 feet" or "3 leagues".
        formatDistance(cells) {
            const per = Number(this.cellUnits) || 0;
            if (!per) return '';
            const total = cells * per;
            // Trim trailing zeros on whole numbers; keep one decimal otherwise.
            const rounded = Math.round(total * 10) / 10;
            const shown = Number.isInteger(rounded) ? rounded : rounded.toFixed(1);
            return `${shown} ${this.unitNounFor(rounded)}`;
        },
    };
}

window.gridFeature = gridFeature;