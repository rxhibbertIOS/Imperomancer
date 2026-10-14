/**
 * DM-side dice: notation input, private rolls (silent), public rolls
 * (delegated to the player tab), result modal, and history writes.
 *
 * Depends on:
 *   - historyFeature() for addToHistory()
 *   - normalizeDiceResult() from shared/dice-result.js
 */
window.diceFeature = function() {
    return {
        diceNotation: '1d20',
        diceMessage: '',
        rollMode: 'public',
        showNotationPopup: false,
        diceRolling: false,

        showResultModal: false,
        lastResult: null,

        _publicRollTimeout: null,
        _dmModalTimer: null,

        /* ---------- NOTATION BUILDER ---------- */
        initDiceNotationBuilder() {
            if (typeof DieBuilder === 'undefined') {
                WARN('DieBuilder not loaded — notation popup disabled');
                return;
            }

            const builder = new DieBuilder({
                theme: {
                    mode: 'dark',
                    colors: {
                        primary:      'var(--gold)',
                        primaryHover: 'var(--gold-2)',
                        primaryRing:  'var(--gold-glow)',
                        background:   '#151a22',
                        surface:      '#1a202a',
                        surfaceHover: '#232a36',
                        text:         'var(--text)',
                        textMuted:    'var(--text-2)',
                        textSubtle:   'var(--text-3)',
                        border:       'var(--border-2)',
                        borderHover:  'var(--gold-dim)',
                        borderSubtle: 'var(--border)',
                        inputBg:      'rgba(0, 0, 0, 0.4)',
                        shadow:       'var(--shadow-lg)',
                        fontFamily:   'inherit',
                    },
                },
                labels: { title: 'Dice Notation' },
                callbacks: {
                    onAccept: (notation) => {
                        this.diceNotation = notation;
                        LOG('✅ DieBuilder accepted notation:', notation);
                    },
                },
                popup: {
                    placement: 'right',
                    offset: 20
                }
            });

            builder.attachTo('#diceNotationInput', {
                popup: {
                    trigger: 'both',
                    width: '520px',
                },
            });
        },

        appendDie(d) {
            this.diceNotation = this.diceNotation
                ? this.diceNotation + '+' + '1' + d
                : '1' + d;
        },

        appendModifier(m) {
            this.diceNotation = (this.diceNotation || '1d20') + m;
        },

        quickRoll(notation, message) {
            this.diceNotation = notation;
            this.diceMessage = message || '';
            this.rollDice();
        },

        /* ---------- DISPATCH ---------- */
        rollDice() {
            const notation = (this.diceNotation || '').trim();
            if (!notation) return;
            if (this.rollMode === 'private') {
                this.performPrivateRoll(notation);
            } else {
                this.performPublicRoll(notation);
            }
        },

        /* ---------- PRIVATE ROLL ---------- */
        async performPrivateRoll(notation) {
            this.diceRolling = true;

            let result = null;
            try {
                if (typeof DICE !== 'undefined' && typeof DICE.rollSilent === 'function') {
                    result = await DICE.rollSilent(notation);
                } else {
                    result = this._fallbackRoll(notation);
                }
            } catch (err) {
                WARN('rollSilent rejected:', err);
                result = err && err.error ? err : this._fallbackRoll(notation);
            }

            this.diceRolling = false;

            // detectCritFail supplies crit/fail for legacy notations the library
            // may not self-report (e.g. bare d20 = 20).
            const { critical, fail } = detectCritFail(notation, result || {});

            this.lastResult = normalizeDiceResult(
                Object.assign({}, result, { critical, fail }),
                {
                    notation,
                    rollMode: 'private',
                    message: this.diceMessage,
                    tag: 'Private Roll',
                }
            );
            this.showResultModal = true;

            this.addToHistory({
                id:       uuid(),
                time:     Date.now(),
                rollMode: 'private',
                roller:   'DM',
                name:     this.lastResult.message,
                notation: this.lastResult.notation,
                total:    this.lastResult.total,
                critical: this.lastResult.critical,
                fail:     this.lastResult.fail,
            });
            this.diceMessage = '';
            LOG(`🔒 Private roll: ${notation} = ${this.lastResult.total}`);
        },

        /* ---------- PUBLIC ROLL (hands off to player) ---------- */
        performPublicRoll(notation) {
            this.diceRolling = true;

            channel.postMessage({
                type: 'publicRoll',
                notation,
                message: this.diceMessage || '',
                tag: 'Roll',
            });

            LOG(`🔊 Public roll sent: ${notation}`);

            clearTimeout(this._publicRollTimeout);
            this._publicRollTimeout = setTimeout(() => {
                if (this.diceRolling) {
                    WARN('Public roll timed out – unlocking');
                    this.diceRolling = false;
                }
            }, 8000);
        },

        onPublicResult(data) {
            LOG('📩 onPublicResult called with:', data);
            clearTimeout(this._publicRollTimeout);
            this.diceRolling = false;

            this.lastResult = normalizeDiceResult(data, {
                notation: data?.notation,
                rollMode: 'public',
                message:  data?.message,
                tag:      data?.tag || 'Roll',
            });
            this.showResultModal = true;

            this.addToHistory({
                id:       uuid(),
                time:     Date.now(),
                rollMode: 'public',
                roller:   'DM',
                name:     this.lastResult.message,
                notation: this.lastResult.notation,
                total:    this.lastResult.total,
                critical: this.lastResult.critical,
                fail:     this.lastResult.fail,
            });

            LOG('DM modal opened with:', this.lastResult);
            clearTimeout(this._dmModalTimer);
            this._dmModalTimer = setTimeout(() => { this.showResultModal = false; }, 3500);
        },

        /* ---------- FALLBACK ---------- */
        _fallbackRoll(notation) {
            const parsed = window.parseNotation(notation);
            if (!parsed) return null;
            const results = [];
            for (let i = 0; i < parsed.count; i++) results.push(window.roll(parsed.sides));
            const sum   = results.reduce((a, b) => a + b, 0);
            const total = sum + parsed.mod;
            const resultString = parsed.count > 1
                ? `${results.join(' + ')}${parsed.mod ? ` ${parsed.mod > 0 ? '+' : ''}${parsed.mod}` : ''} = ${total}`
                : `${results[0]}${parsed.mod ? ` ${parsed.mod > 0 ? '+' : ''}${parsed.mod}` : ''} = ${total}`;
            return { resultTotal: total, resultString, result: results, constant: parsed.mod };
        },

        /* ---------- HEADER SUMMARY ---------- */
        lastRollLabel() {
            if (!this.lastResult) return '';
            const notation = this.lastResult.notation || '?';
            const total    = this.lastResult.total ?? '?';
            return `${notation}: ${total}`;
        },

        /* ---------- NOTATION POPUP ---------- */
        openNotationBuilder() {
            const input = document.getElementById('diceNotationInput');
            if (!input) return;
            input.focus();
        },
    };
};