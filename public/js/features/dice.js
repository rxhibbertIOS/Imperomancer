/**
 * DM-side dice: notation input, private rolls (silent), public rolls
 * (delegated to the player tab), result modal, and history writes.
 *
 * Depends on historyFeature() for addToHistory().
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
                theme: { mode: 'dark' },
                labels: { title: 'Dice Notation' },
                callbacks: {
                    onAccept: (notation) => {
                        this.diceNotation = notation;
                        LOG('✅ DieBuilder accepted notation:', notation);
                    },
                },
            });
            builder.attachTo('#diceNotationInput', {
                popup: { trigger: 'focus', width: '560px' },
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

            if (!result || result.error) {
                this.lastResult = {
                    notation,
                    total: '?',
                    breakdown: result?.errorMessage || result?.resultString || 'Invalid notation',
                    rollMode: 'private',
                };
                this.showResultModal = true;
                return;
            }

            const total     = result.resultTotal ?? 0;
            const breakdown = result.resultString || `${notation} = ${total}`;
            const { critical, fail } = detectCritFail(notation, result);

            this.lastResult = {
                notation, total, breakdown,
                message: this.diceMessage,
                critical, fail,
                rollMode: 'private',
            };
            this.showResultModal = true;

            this.addToHistory({
                id:       uuid(),
                time:     Date.now(),
                rollMode: 'private',
                roller:   'DM',
                name:     this.diceMessage || '',
                notation,
                total,
                critical,
                fail,
            });
            this.diceMessage = '';
            LOG(`🔒 Private roll: ${notation} = ${total}`);
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

            const { notation = '?', total = 0, breakdown = '', message = '',
                    critical = false, fail = false, tag = 'Roll' } = data || {};

            this.lastResult = { notation, total, breakdown, message, critical, fail,
                                rollMode: 'public', tag };
            this.showResultModal = true;

            this.addToHistory({
                id:       uuid(),
                time:     Date.now(),
                rollMode: 'public',
                roller:   'DM',
                name:     message || '',
                notation,
                total,
                critical,
                fail,
            });

            LOG('DM modal opened with:', this.lastResult);
            clearTimeout(this._dmModalTimer);
            this._dmModalTimer = setTimeout(() => { this.showResultModal = false; }, 2500);
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
    };
};