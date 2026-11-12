// ============================================================
// DM COMPOSITION ROOT
// ============================================================

function dmApp() {
    const channel = window.channel;
    const sync    = window.syncState;

    const component = {
        // ---- Mixins ----
        ...initiativeFeature({ editable: true }),
        ...sceneFeature(),
        ...historyFeature(),
        ...statusFeature(),
        ...diceFeature(),
        ...gridFeature(),
        ...fogFeature(),
        ...whiteboardFeature(),
        ...pointerFeature(),
        ...shapesFeature(),

        // ---- Shell-only UI state ----
        openCard: 'dice',
        isLive: false,
        isConnecting: false,
        _playerConnectTimer: null,
        _playerHeartbeatTimer: null,
        _lastPlayerPongAt: 0,
        _playerWindow: null,
        _suppressPlayerReconnect: false,
        showShortcutGlossary: false,
        gridVisible: false,
        sidebarOpen: true,

        init() {
            if (window.MODE !== 'dm') {
                LOG('⏭️ dmApp skipped (mode = ' + window.MODE + ')');
                return;
            }
            LOG('✅ DM App initializing…');

            this.loadHistory();
            if (!this.initiativeRows.length) this.addInitiativeRow();
            this.initDiceNotationBuilder();
            this.initGrid();
            this.initFog();
            this.initWhiteboard();
            this.initScenes();
            this.initResizeClamp();
            this.initStageObserver();
            this.initPointer()

            window.onViewPortReady = () => this.markPlayerConnected();
            window.onViewPortPong = () => { this._lastPlayerPongAt = Date.now(); };
            window.addEventListener('message', (event) => {
                if (event.origin !== window.location.origin ||
                    event.data?.type !== 'requestViewPort' || !event.source ||
                    typeof MessageChannel === 'undefined') return;
                if (this._suppressPlayerReconnect) {
                    event.source.postMessage({ type: 'viewDisconnect' }, event.origin);
                    return;
                }

                this._playerWindow = event.source;
                this.isLive = false;
                this.isConnecting = true;
                clearTimeout(this._playerConnectTimer);
                clearInterval(this._playerHeartbeatTimer);
                const ports = new MessageChannel();
                window.attachViewPort(ports.port1);
                event.source.postMessage({ type: 'viewPort' }, event.origin, [ports.port2]);
                this._playerConnectTimer = setTimeout(() => {
                    if (this.isConnecting) this.disconnectPlayer();
                }, 10000);
            });

            channel.onmessage = (e) => {
                const d = e.data;
                if (d.type !== 'viewAck') LOG('📩 DM received:', d.type, d);
                if (d.type === 'requestSync') {
                    window.resetViewSync?.();
                    if (window.broadcastScene) {
                        window.broadcastScene(
                            this.$data,
                            this.publishedScene,
                            this.publishedScene?.transition || 'none'
                        );
                    }
                    else sync(this.$data);
                } else if (d.type === 'viewAck') {
                    window.acknowledgeView?.(d.sequence);
                } else if (d.type === 'publicRollResult') {
                    LOG('📩 DM publicRollResult payload:', d);
                    this.onPublicResult(d);
                }
                if (d.type === 'displayInfo') {
                    this.onDisplayInfo(d);
                    this.onPlayerStage(d);
                }
            };

            this._stateSyncTimer = setInterval(() => {
                if (this.isLive || this.isConnecting) sync(this.$data);
            }, 1000);
            setTimeout(() => sync(this.$data), 500);

            this.$watch('showResultModal', (open) => {
                if (open) this.openResultModalTrap();
                else this.closeResultModalTrap();
            });

            this.shortcuts = window.createShortcuts(this);
            this.shortcuts.attach();
        },

        destroy() {
            this.shortcuts?.detach();
            clearInterval(this._stateSyncTimer);
            clearInterval(this._playerHeartbeatTimer);
            clearTimeout(this._playerConnectTimer);
            this._stageRO?.disconnect();
            this._fogResizeObserver?.disconnect();
            this._whiteboardResizeObserver?.disconnect();
            if (this._gridBeforeUnload) window.removeEventListener('beforeunload', this._gridBeforeUnload);
            clearTimeout(this._shapeLongPressTimer);
        },

        // --- dialog state (used by shortcuts to gate non-Escape keys) ---
        isDialogOpen() {
            return this.showResultModal || this.showShortcutGlossary;
        },

        // --- card helpers ---
        openCardByName(name) {
            if (this.openCard !== name) this.toggleCard(name);
        },
        toggleHistoryCard()    { this.toggleCard('history'); },
        toggleInitiativeCard() { this.toggleCard('initiative'); },

        // --- focus helpers ---
        focusStatusMessage() {
            this.openCardByName('status');
            this.$nextTick(() => document.getElementById('statusMessage')?.focus());
        },
        focusDiceNotation() {
            this.openCardByName('dice');
            this.$nextTick(() => document.getElementById('diceNotationInput')?.focus());
        },

        // --- display helpers ---
        toggleFullscreen() {
            if (document.fullscreenElement) document.exitFullscreen();
            else document.documentElement.requestFullscreen();
        },
        toggleGrid() {
            // Wire to grid overlay once that exists.
            this.gridVisible = !this.gridVisible;
        },
        toggleLockShortcut() {
            if (!this.canLock()) return;
            this.locked = !this.locked;
            this.toggleLock();
        },

        // --- glossary + dialog closing ---
        openShortcutGlossary() { this.showShortcutGlossary = true; },
        closeActiveDialog() {
            if (this.focusMode)                 this.focusMode = false;
            if (this.dragShape || this.pendingShapeKind) { this.cancelShapeDrag(); return; }
            if (this.shapeMenu) { this.shapeMenu = null; return; }
            if (this.showShortcutGlossary)      this.showShortcutGlossary = false;
            else if (this.showResultModal)      this.showResultModal = false;
        },

        // --- glossary rendering helpers (for the modal) ---
        shortcutList()   { return this.shortcuts ? this.shortcuts.list() : []; },
        shortcutGroups() {
            const groups = new Set(this.shortcutList().map(i => i.group));
            const order = ['Session', 'Combat', 'Dice', 'Display', 'Help'];
            return [
                ...order.filter(g => groups.has(g)),
                ...[...groups].filter(g => !order.includes(g)),
            ];
        },

        openResultModalTrap() {
            this.$nextTick(() => {
                const modal = this.$root.querySelector('.result-modal');
                if (!modal) return;
                this._modalTrap = window.createFocusTrap(modal);
                this._modalTrap.activate({ initialFocus: '.btn' });
                modal.addEventListener('focus-trap:escape', () => {
                    this.showResultModal = false;
                }, { once: true });
            });
        },

        closeResultModalTrap() {
            if (this._modalTrap) {
                this._modalTrap.deactivate();
                this._modalTrap = null;
            }
        },

        exitCardInteraction(card) {
            if (card === 'pointer') this.focusMode = false;
            if (card === 'fog') this.setFogEditing?.(false);
            if (card === 'effects') this.effectSelectMode = false;
            if (card === 'whiteboard' && this.whiteboardActive) this.setWhiteboardActive?.(false);
        },

        toggleCard(name) {
            const previousCard = this.openCard;
            if (previousCard) this.exitCardInteraction(previousCard);
            this.openCard = this.openCard === name ? null : name;
            if (this.openCard !== 'dice') this.showNotationPopup = false;
        },

        toggleLive() {
            if (this.isLive || this.isConnecting) {
                this.disconnectPlayer(true);
                return;
            }

            const baseUrl = window.location.href.split('?')[0];
            const playerUrl = `${baseUrl}?mode=player`;
            this._suppressPlayerReconnect = false;
            const playerWindow = window.open(playerUrl, '_blank');
            if (!playerWindow) {
                this.isConnecting = false;
                WARN('Player window could not be opened');
                return;
            }

            this.isConnecting = true;
            this._playerConnectTimer = setTimeout(() => {
                if (this.isConnecting) this.disconnectPlayer();
            }, 10000);
            sync(this.$data);
        },

        markPlayerConnected() {
            clearTimeout(this._playerConnectTimer);
            this.isConnecting = false;
            this.isLive = true;
            this._lastPlayerPongAt = Date.now();
            clearInterval(this._playerHeartbeatTimer);
            this._playerHeartbeatTimer = setInterval(() => {
                if (!window.viewPort || Date.now() - this._lastPlayerPongAt > 5000) {
                    this.disconnectPlayer();
                    return;
                }
                try {
                    window.viewPort.postMessage({ type: 'viewPing' });
                } catch (_) {
                    this.disconnectPlayer();
                }
            }, 1000);
            sync(this.$data);
        },

        disconnectPlayer(notifyPlayer = false) {
            if (notifyPlayer) this._suppressPlayerReconnect = true;
            clearTimeout(this._playerConnectTimer);
            clearInterval(this._playerHeartbeatTimer);
            this._playerConnectTimer = null;
            this._playerHeartbeatTimer = null;
            if (notifyPlayer && window.viewPort) {
                try { window.viewPort.postMessage({ type: 'viewDisconnect' }); } catch (_) {}
            }
            if (notifyPlayer && this._playerWindow) {
                try {
                    this._playerWindow.postMessage({ type: 'viewDisconnect' }, window.location.origin);
                } catch (_) {}
            }
            window.resetViewSync?.();
            window.viewPort?.close();
            window.viewPort = null;
            if (notifyPlayer) this._playerWindow = null;
            this.isConnecting = false;
            this.isLive = false;
            sync(this.$data);
        },

        sync() { sync(this.$data); },
    };

    return window.attachInitiativeGetters(component);
}

window.dmApp = dmApp;
LOG('✅ dm.js loaded');
