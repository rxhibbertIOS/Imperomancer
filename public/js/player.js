// ============================================================
// PLAYER COMPOSITION ROOT
// ============================================================

function playerApp() {
    const channel = window.channel;

    let diceBox = null;
    let diceInitAttempted = false;

    const component = {
        // ---- Mixins ----
        ...initiativeFeature(), 
        ...gridFeature(),
        ...sceneFeature(), 
        ...pointerFeature(),
        ...shapesFeature(),
        ...statusFeature(),

        // ---- Dice ----
        diceRolling: false,
        pendingRoll: null,

        // ---- Result modal ----
        showResultModal: false,
        lastResult: null,
        _pendingView: null,
        _viewRenderPending: false,
        _viewAnimation: null,
        _viewAnimationRaf: null,
        _lastViewArrivalAt: 0,
        _viewPortRetryTimer: null,
        _viewPortReady: false,
        _viewPortManualDisconnect: false,
        _lastViewPingAt: 0,

        init() {
            if (window.MODE !== 'player') {
                LOG('⏭️ playerApp skipped (mode = ' + window.MODE + ')');
                return;
            }
            LOG('✅ Player App initializing…');

            this.connectViewPort();
            this.$nextTick(() => this.initDiceBox());
            this.initGrid();
            this.initStageObserver();

            this.$nextTick(() => {
                const stage = this.$root.querySelector('[data-stage]');
                if (!stage) return;

                const publish = () => {
                    const W = stage.clientWidth;
                    const H = stage.clientHeight;
                    if (!W || !H) return;   // don't broadcast zeros
                    channel.postMessage({
                        type: 'displayInfo',
                        screenWidth:  window.screen.width,
                        screenHeight: window.screen.height,
                        devicePixelRatio: window.devicePixelRatio || 1,
                        stageW: W,
                        stageH: H,
                    });
                };

                // Fire once now that layout is ready
                publish();

                // And re-fire whenever the stage size actually changes
                if (typeof ResizeObserver !== 'undefined') {
                    new ResizeObserver(publish).observe(stage);
                } else {
                    window.addEventListener('resize', publish);
                }
            });

            channel.onmessage = (e) => {
                const d = e.data;
                switch (d.type) {
                    case 'sync':      this._onSync(d.state); break;
                    case 'view':      this.handleViewPacket(d, channel); break;
                    case 'publicRoll': LOG('🔊 Public roll received:', d); this.triggerPublicRoll(d); break;
                    case 'status':    this.showStatus(d.message); break;
                    case 'focus':     this.showFocus(d.effect); break;
                }
            };

            setTimeout(() => channel.postMessage({ type: 'requestSync' }), 500);
        },

        connectViewPort() {
            window.addEventListener('message', (event) => {
                if (event.source !== window.opener ||
                    event.origin !== window.location.origin) return;
                if (event.data?.type === 'viewDisconnect') {
                    this.stopViewPortConnection();
                    return;
                }
                if (event.data?.type !== 'viewPort' || !event.ports?.[0]) return;

                window.viewPort?.close();
                window.viewPort = event.ports[0];
                this._viewPortReady = true;
                this._viewPortManualDisconnect = false;
                this._lastViewPingAt = Date.now();
                window.viewPort.onmessage = ({ data }) => {
                    if (data?.type === 'viewPing') {
                        this._lastViewPingAt = Date.now();
                        window.viewPort.postMessage({ type: 'viewPong' });
                    } else if (data?.type === 'viewDisconnect') {
                        this.stopViewPortConnection();
                    } else {
                        this.handleViewPacket(data, window.viewPort);
                    }
                };
                window.viewPort.start?.();
                window.viewPort.postMessage({ type: 'viewReady' });
            });

            const requestConnection = () => {
                if (!window.opener || window.opener === window || this._viewPortManualDisconnect) return;
                if (this._viewPortReady && Date.now() - this._lastViewPingAt < 5000) return;
                this._viewPortReady = false;
                window.opener.postMessage({ type: 'requestViewPort' }, window.location.origin);
            };
            requestConnection();
            this._viewPortRetryTimer = setInterval(requestConnection, 2000);
        },

        stopViewPortConnection() {
            this._viewPortManualDisconnect = true;
            this._viewPortReady = false;
            clearInterval(this._viewPortRetryTimer);
            this._viewPortRetryTimer = null;
            window.viewPort?.close();
            window.viewPort = null;
        },

        handleViewPacket(message, transport) {
            if (message?.type !== 'view') return;
            this._queueView(message.view);
            transport.postMessage({ type: 'viewAck', sequence: message.sequence });
        },

        _onSync(s) {
            const prevTurn = this.currentTurn;

            if (Object.prototype.hasOwnProperty.call(s, 'currentImage')) {
                this.currentImage = s.currentImage;
            }
            this.mediaType      = s.mediaType || 'image';
            if (s.view && typeof s.view.sceneW === 'number') {
                if (s.scenePublished) {
                    if (this._viewAnimationRaf !== null) {
                        cancelAnimationFrame(this._viewAnimationRaf);
                    }
                    this._viewAnimationRaf = null;
                    this._viewAnimation = null;
                    this.view = { cx: s.view.cx, cy: s.view.cy, sceneW: s.view.sceneW };
                } else {
                    this._queueView(s.view);
                }
            }
            this.combatants     = s.combatants || [];
            this.currentTurn    = s.currentTurn || 0;
            this.round          = s.round || 1;
            this.showInitiative = s.showInitiative !== false;
            this.initiative360       = s.initiative360 === true;
            this.initiativeCollapsed = s.initiativeCollapsed === true;
            this.edges = {
                top:    s.edges?.top    !== false,
                right:  s.edges?.right  !== false,
                bottom: s.edges?.bottom !== false,
                left:   s.edges?.left   !== false,
            };

            this.gridVisible      = s.gridVisible      === true;
            this.gridType         = s.gridType         ?? 'square';
            this.gridShowLabels   = s.gridShowLabels   === true;
            this.gridLabelEvery   = s.gridLabelEvery   ?? 5;
            this.gridOpacity      = s.gridOpacity      ?? 0.5;
            this.scenePxPerCell   = s.scenePxPerCell   ?? 100;
            this.sceneGridOriginX = s.sceneGridOriginX ?? 0;
            this.sceneGridOriginY = s.sceneGridOriginY ?? 0;
            this.focusPings = s.focusPings || [];
            this.flashShapes = s.flashShapes || [];
            this.locked = s.locked === true;

            if (typeof s.tablePpi === 'number') this.tablePpi = s.tablePpi;
            if (s.tableDiagonal   != null) this.tableDiagonal   = s.tableDiagonal;
            if (s.tableAspectW    != null) this.tableAspectW    = s.tableAspectW;
            if (s.tableAspectH    != null) this.tableAspectH    = s.tableAspectH;
            if (s.tableCorrection != null) this.tableCorrection = s.tableCorrection;
            this.showCalibrationSquare = s.showCalibrationSquare === true;

            this.transition = s.transition;
            if (s.scenePublished) {
                this.$nextTick(async () => {
                    const videoReady = await this.ensureScenePlayback();
                    if (videoReady) this.handleSceneTransition(this.transition);
                });
            }

            if (prevTurn !== this.currentTurn) {
                this._animateCarousel();
            }
        },

        _onView(view) {
            if (!view || typeof view.sceneW !== 'number') return;
            this.view = { cx: view.cx, cy: view.cy, sceneW: view.sceneW };
        },

        _queueView(view) {
            if (!view || typeof view.sceneW !== 'number') return;
            const now = performance.now();
            const previous = this._viewAnimation?.to || this.view;
            if (view.cx === previous.cx && view.cy === previous.cy && view.sceneW === previous.sceneW) return;

            this._viewAnimation = {
                from: { ...this.view },
                to: { cx: view.cx, cy: view.cy, sceneW: view.sceneW },
                start: now,
                duration: Math.min(220, Math.max(80, now - (this._lastViewArrivalAt || now))),
            };
            this._lastViewArrivalAt = now;
            if (this._viewAnimationRaf === null) {
                this._viewAnimationRaf = requestAnimationFrame(timestamp => this._renderViewAnimation(timestamp));
            }
        },

        _renderViewAnimation(timestamp) {
            const animation = this._viewAnimation;
            if (!animation) {
                this._viewAnimationRaf = null;
                return;
            }

            const progress = Math.min(1, (timestamp - animation.start) / animation.duration);
            const eased = 1 - Math.pow(1 - progress, 3);
            this._onView({
                cx: animation.from.cx + (animation.to.cx - animation.from.cx) * eased,
                cy: animation.from.cy + (animation.to.cy - animation.from.cy) * eased,
                sceneW: animation.from.sceneW + (animation.to.sceneW - animation.from.sceneW) * eased,
            });

            if (progress < 1) {
                this._viewAnimationRaf = requestAnimationFrame(timestamp => this._renderViewAnimation(timestamp));
            } else {
                this._viewAnimationRaf = null;
                this._viewAnimation = null;
            }
        },

        handleSceneTransition(transition) {
            if (!this.currentImage) return;
            LOG('✨ Applying scene transition on player:', transition);

            const el = this.$root?.querySelector(this.mediaType === 'video'
                ? '.scene video'
                : '.scene img');
            if (!el) return;

            switch (transition) {
                case 'fade':  gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.8 }); break;
                case 'slide': gsap.fromTo(el, { x: 100, opacity: 0 }, { x: 0, opacity: 1, duration: 0.6 }); break;
                case 'zoom':  gsap.fromTo(el, { scale: 1.15, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.6 }); break;
                case 'blur':  gsap.fromTo(el, { filter: 'blur(20px)', opacity: 0 }, { filter: 'blur(0px)', opacity: 1, duration: 0.6 }); break;
            }
        },

        initDiceBox() {
            if (diceInitAttempted) return;
            diceInitAttempted = true;

            const container = document.getElementById('playerDiceContainer');
            if (!container) { WARN('Player dice container missing'); return; }
            if (typeof DICE === 'undefined') { WARN('DICE library missing'); return; }

            if (DICE.dice_box && DICE.dice_box.prototype) {
                DICE.dice_box.prototype.playSound = function() {};
            }

            try {
                diceBox = new DICE.dice_box(container, {
                    scale: 1.0, lightIntensity: 0.9, gravity: 1.0,
                    throwForce: 3.0, friction: 0.3, restitution: 0.3,
                    color: '#ffd700', background: 'transparent',
                    fontColor: '#ffffff', borderColor: '#ffd700',
                    shadow: true, shadowColor: 'rgba(0,0,0,0.6)',
                    desk_opacity: 0,
                });
                LOG('✅ Player dice box ready');
            } catch (err) {
                ERR('Player dice box init failed:', err);
                diceBox = null;
            }
        },

        async triggerPublicRoll({ notation, message, tag }) {
            LOG('🎲 triggerPublicRoll:', notation, { message, tag });

            if (this.diceRolling) { WARN('Already rolling'); return; }

            this.pendingRoll = {
                notation,
                message: message || '',
                tag: tag || 'Roll',
            };

            if (!diceBox) {
                this._broadcastResult(this._fallbackResult(notation));
                return;
            }

            this.diceRolling = true;
            await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

            try {
                diceBox.setDice(notation);
                const result = await diceBox.start_throw();
                LOG('🎲 start_throw resolved:', result);

                if (!result || result.error) {
                    WARN('Dice roll returned an error – using fallback');
                    this.diceRolling = false;
                    this._broadcastResult(this._fallbackResult(notation));
                    return;
                }

                const total     = result.resultTotal ?? 0;
                const breakdown = result.resultString || `${notation} = ${total}`;
                const { critical, fail } = detectCritFail(notation, result);

                this.diceRolling = false;
                this._broadcastResult({
                    notation,
                    total,
                    breakdown,
                    message: this.pendingRoll?.message || '',
                    critical, fail,
                    tag: this.pendingRoll?.tag || 'Roll',
                });
            } catch (err) {
                ERR('start_throw threw:', err);
                this.diceRolling = false;
                this._broadcastResult(this._fallbackResult(notation));
            }
        },

        _broadcastResult(payload) {
            channel.postMessage({ type: 'publicRollResult', ...payload });
            LOG('📤 Result sent to DM:', payload);

            this.lastResult = payload;
            this.showResultModal = true;
            clearTimeout(this._modalTimer);
            this._modalTimer = setTimeout(() => { this.showResultModal = false; }, 2500);

            this.pendingRoll = null;
        },

        _fallbackResult(notation) {
            const parsed = window.parseNotation(notation);
            if (!parsed) {
                return {
                    notation, total: 0, breakdown: 'Invalid notation',
                    message: this.pendingRoll?.message || '',
                    critical: false, fail: false,
                    tag: this.pendingRoll?.tag || 'Roll',
                };
            }
            const results = [];
            for (let i = 0; i < parsed.count; i++) results.push(window.roll(parsed.sides));
            const sum = results.reduce((a, b) => a + b, 0);
            const total = sum + parsed.mod;
            const breakdown = `${results.join(' + ')}${parsed.mod ? ` ${parsed.mod > 0 ? '+' : ''}${parsed.mod}` : ''} = ${total}`;
            return {
                notation, total, breakdown,
                message: this.pendingRoll?.message || '',
                critical: parsed.sides === 20 && parsed.count === 1 && results[0] === 20,
                fail:     parsed.sides === 20 && parsed.count === 1 && results[0] === 1,
                tag: this.pendingRoll?.tag || 'Roll',
            };
        },
    };

    return window.attachInitiativeGetters(component);
}

window.playerApp = playerApp;
LOG('✅ player.js loaded');