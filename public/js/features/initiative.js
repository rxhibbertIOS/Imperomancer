// js/features/initiative.js

/** Creates initiative display state, optionally including DM roster editing and turn controls. @param {{editable?:boolean}} [options] @returns {object} Alpine-compatible initiative feature. */
window.initiativeFeature = function({ editable = false } = {}) {
    const view = {
        // ---- Shared read state ----
        combatants: [],
        currentTurn: 0,
        round: 1,
        showInitiative: true,
        initiative360: false,
        initiativeCollapsed: false,
        edges: { top: true, right: true, bottom: true, left: true },

        _animateCarousel() {
            if (typeof gsap === 'undefined') return;
            this.$nextTick(() => {
                document.querySelectorAll('.init-carousel').forEach(bar => {
                    if (!bar.offsetParent) return;
                    const cur   = bar.querySelector('.init-current');
                    const chips = bar.querySelectorAll('.upcoming-name');
                    if (cur) gsap.fromTo(cur,
                        { x: 40, opacity: 0 },
                        { x: 0, opacity: 1, duration: 0.32, ease: 'power2.out', overwrite: true });
                    if (chips.length) gsap.fromTo(chips,
                        { x: 32, opacity: 0 },
                        { x: 0, opacity: 1, duration: 0.36, ease: 'power2.out',
                          stagger: 0.06, overwrite: true });
                });
            });
        },
    };

    if (!editable) return view;

    // ---- DM-only: roster editing, rolling, turn tracking ----
    return {
        ...view,

        initiativeActive: false,
        initiativeEditing: false,
        initiativeRolling: false,
        initiativeRows: [],
        _deadHoldTimer: null,

        addInitiativeRow() {
            this.initiativeRows.push({
                id: uid(),
                name: '',
                isPlayer: false,
                initiative: null,
                bonus: '',
                isDead: false,
            });
        },

        ensureTrailingBlank() {
            if (!this.initiativeRows.length) { this.addInitiativeRow(); return; }
            const last = this.initiativeRows[this.initiativeRows.length - 1];
            const filled =
                (typeof last.name === 'string' && last.name.trim().length > 0) ||
                (last.initiative !== null && last.initiative !== undefined && last.initiative !== '') ||
                (typeof last.bonus === 'string' && last.bonus.trim() !== '' && last.bonus.trim() !== '0') ||
                last.isPlayer === true ||
                last.isDead === true;
            if (filled) this.addInitiativeRow();
        },

        removeInitiativeRow(id) {
            this.initiativeRows = this.initiativeRows.filter(r => r.id !== id);
            if (!this.initiativeRows.length) this.addInitiativeRow();
        },

        clearInitiativeRows() {
            if (this.initiativeActive) return;
            this.initiativeRows = [];
            this.addInitiativeRow();
        },

        validInitiativeRowCount() {
            return this.initiativeRows.filter(r => r.name && r.name.trim()).length;
        },

        _parseBonus(v) {
            if (v === null || v === undefined || v === '') return 0;
            const n = parseInt(String(v).replace(/[^0-9-]/g, ''), 10);
            return isNaN(n) ? 0 : n;
        },

        async _rollInitiativeFor(bonus) {
            let d20 = 10;
            try {
                if (typeof DICE !== 'undefined' && typeof DICE.rollSilent === 'function') {
                    const r = await DICE.rollSilent('1d20');
                    d20 = r?.resultTotal ?? r?.result?.[0] ?? 10;
                } else if (typeof window.roll === 'function') {
                    d20 = window.roll(20);
                }
            } catch (err) {
                systemLog.warn('initiative', 'roll', 'Initiative roll failed; using fallback', err.stack);
                d20 = Math.floor(Math.random() * 20) + 1;
            }
            return d20 + (bonus || 0);
        },

        async enterInitiative() {
            if (this.initiativeActive || this.initiativeRolling) return;
            const validRows = this.initiativeRows.filter(r => r.name && r.name.trim());
            if (!validRows.length) return;

            this.initiativeRolling = true;

            const combatants = [];
            for (const row of validRows) {
                const bonus = this._parseBonus(row.bonus);
                let init = (row.initiative === null || row.initiative === undefined || row.initiative === '')
                    ? null
                    : parseInt(row.initiative, 10);
                if (init === null || isNaN(init)) init = await this._rollInitiativeFor(bonus);
                combatants.push({
                    id: uid(),
                    name: row.name.trim(),
                    initiative: init,
                    bonus,
                    isPlayer: !!row.isPlayer,
                    isDead: !!row.isDead,
                });
            }

            combatants.sort((a, b) => b.initiative - a.initiative);
            this.combatants = combatants;
            this.currentTurn = 0;
            let guard = 0;
            while (this.combatants[this.currentTurn]?.isDead
                    && guard < this.combatants.length - 1) {
                this.currentTurn = (this.currentTurn + 1) % this.combatants.length;
                guard++;
            }
            this.round = 1;
            this.initiativeActive = true;
            this.initiativeRolling = false;
            this.initiativeCollapsed = false;
            if (this.initiative360) {
                this.edges = { top: true, right: true, bottom: true, left: true };
            }
            this.showInitiative = true;
            sync(this.$data);
            systemLog.success('initiative', 'start', `Initiative order set for ${combatants.length} combatants`);
        },

        exitInitiative() {
            if (!this.initiativeActive) return;
            this.initiativeActive = false;
            this.initiativeEditing = false;
            this.showInitiative = false;
            this.currentTurn = 0;
            this.round = 1;
            sync(this.$data);
            systemLog.info('initiative', 'end', 'Initiative ended');
        },

        startInitiativeEdit() {
            if (!this.initiativeActive || this.initiativeEditing) return;
            this.initiativeRows = this.combatants.map(c => ({
                id:       c.id,
                name:     c.name,
                isPlayer: !!c.isPlayer,
                initiative: c.initiative,
                bonus:    c.bonus !== undefined && c.bonus !== null ? String(c.bonus) : '',
                isDead:   !!c.isDead,
            }));
            if (!this.initiativeRows.length
                || this.initiativeRows[this.initiativeRows.length - 1].name.trim() !== '') {
                this.addInitiativeRow();
            }
            this.initiativeEditing = true;
            sync(this.$data);
            systemLog.info('initiative', 'edit', 'Initiative edit mode enabled');
        },

        cancelInitiativeEdit() {
            if (!this.initiativeEditing) return;
            this.initiativeEditing = false;
            this.initiativeRows = [];
            sync(this.$data);
            systemLog.info('initiative', 'edit', 'Initiative edit cancelled');
        },

        async saveInitiativeEdit() {
            if (!this.initiativeActive || !this.initiativeEditing) return;
            const validRows = this.initiativeRows.filter(r => r.name && r.name.trim());
            if (!validRows.length) return;

            this.initiativeRolling = true;
            const currentId = this.combatants[this.currentTurn]?.id ?? null;

            const combatants = [];
            for (const row of validRows) {
                const bonus = this._parseBonus(row.bonus);
                let init = (row.initiative === null || row.initiative === undefined || row.initiative === '')
                    ? null
                    : parseInt(row.initiative, 10);
                if (init === null || isNaN(init)) init = await this._rollInitiativeFor(bonus);
                combatants.push({
                    id:       row.id || uid(),
                    name:     row.name.trim(),
                    initiative: init,
                    bonus,
                    isPlayer: !!row.isPlayer,
                    isDead:   !!row.isDead,
                });
            }

            combatants.sort((a, b) => b.initiative - a.initiative);
            this.combatants = combatants;

            let newIdx = combatants.findIndex(c => c.id === currentId);
            if (newIdx === -1) {
                newIdx = 0;
                let guard = 0;
                while (combatants[newIdx]?.isDead && guard < combatants.length - 1) {
                    newIdx = (newIdx + 1) % combatants.length;
                    guard++;
                }
            }
            this.currentTurn = newIdx;
            this.initiativeEditing = false;
            this.initiativeRolling = false;
            sync(this.$data);
            systemLog.success('initiative', 'update', `Initiative updated for ${combatants.length} combatants`);
        },

        toggleDead(id) {
            const c = this.combatants.find(c => c.id === id);
            if (!c) return;
            c.isDead = !c.isDead;
            sync(this.$data);
        },

        nextTurn() {
            if (!this.initiativeActive || !this.combatants.length) return;
            clearTimeout(this._deadHoldTimer);
            this._advanceStep(this.combatants.length);
        },

        prevTurn() {
            if (!this.initiativeActive || !this.combatants.length) return;
            clearTimeout(this._deadHoldTimer);
            this._prevStep(this.combatants.length);
        },

        _advanceStep(stepsLeft) {
            this.currentTurn++;
            if (this.currentTurn >= this.combatants.length) {
                this.currentTurn = 0;
                this.round++;
            }
            this._animateCarousel();
            sync(this.$data);
            const cur = this.combatants[this.currentTurn];
            if (cur && cur.isDead && stepsLeft > 1) {
                this._deadHoldTimer = setTimeout(() => this._advanceStep(stepsLeft - 1), 250);
            }
        },

        _prevStep(stepsLeft) {
            this.currentTurn--;
            if (this.currentTurn < 0) {
                this.currentTurn = this.combatants.length - 1;
                if (this.round > 1) this.round--;
            }
            this._animateCarousel();
            sync(this.$data);
            const cur = this.combatants[this.currentTurn];
            if (cur && cur.isDead && stepsLeft > 1) {
                this._deadHoldTimer = setTimeout(() => this._prevStep(stepsLeft - 1), 250);
            }
        },

        removeCombatant(id) {
            const idx = this.combatants.findIndex(c => c.id === id);
            if (idx === -1) return;
            this.combatants.splice(idx, 1);
            if (!this.combatants.length) {
                this.currentTurn = 0;
                if (this.initiativeActive) this.exitInitiative();
            } else if (this.currentTurn >= this.combatants.length) {
                this.currentTurn = this.combatants.length - 1;
            } else if (idx < this.currentTurn) {
                this.currentTurn--;
            }
            sync(this.$data);
        },

        toggle360() {
            this.initiative360 = !this.initiative360;
            if (this.initiative360) {
                this.edges = { top: true, right: true, bottom: true, left: true };
                this.initiativeCollapsed = false;
            }
            sync(this.$data);
        },

        toggleCollapse() {
            this.initiativeCollapsed = !this.initiativeCollapsed;
            sync(this.$data);
        },

        toggleEdge(edge) {
            this.edges = { ...this.edges, [edge]: !this.edges[edge] };
            sync(this.$data);
        },
    };
};

/**
 * Spread flattens getters into plain values, so getters defined in
 * initiativeFeature() become frozen at spread time. Call this on the
 * final component object to reinstall them as live getters.
 *
 * MUST be defined outside initiativeFeature() — it's a file-level helper,
 * not a per-instance method.
 */
/** Restores live initiative getters after feature objects have been spread into a component. @param {object} component @returns {object} The same component. */
window.attachInitiativeGetters = function(component) {
    Object.defineProperties(component, {
        currentCombatant: {
            get() { return this.combatants[this.currentTurn] || null; },
            enumerable: true,
            configurable: true,
        },
        upcomingCombatants: {
            get() {
                if (this.combatants.length < 2) return [];
                const out = [];
                const count = Math.min(2, this.combatants.length - 1);
                for (let i = 1; i <= count; i++) {
                    const idx = (this.currentTurn + i) % this.combatants.length;
                    out.push(this.combatants[idx]);
                }
                return out;
            },
            enumerable: true,
            configurable: true,
        },
    });
    return component;
};
