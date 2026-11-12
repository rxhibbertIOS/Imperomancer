/** Creates persistent, filterable dice-roll history state. @returns {object} Alpine-compatible history feature. */
window.historyFeature = function() {
    return {
        rollHistory: [],
        historyFilter: 'all',
        historyFilters: ['all', 'public', 'private', 'crits', 'fails'],

        /** Restores saved history, tolerating corrupt local storage. @returns {void} */
        loadHistory() {
            try {
                this.rollHistory = JSON.parse(localStorage.getItem('dmhub.rollHistory') || '[]');
            } catch {
                this.rollHistory = [];
            }
        },

        /** Prepends and persists one history entry, retaining the newest 50. @param {object} entry @returns {void} */
        addToHistory(entry) {
            this.rollHistory.unshift(entry);
            if (this.rollHistory.length > 50) this.rollHistory.length = 50;
            localStorage.setItem('dmhub.rollHistory', JSON.stringify(this.rollHistory));
        },

        /** Clears in-memory and persisted history. @returns {void} */
        clearHistory() {
            this.rollHistory = [];
            localStorage.removeItem('dmhub.rollHistory');
        },

        /** Returns rolls matching the active filter. @returns {object[]} */
        filteredHistory() {
            const f = this.historyFilter;
            if (f === 'public')  return this.rollHistory.filter(r => r.rollMode === 'public');
            if (f === 'private') return this.rollHistory.filter(r => r.rollMode === 'private');
            if (f === 'crits')   return this.rollHistory.filter(r => r.critical);
            if (f === 'fails')   return this.rollHistory.filter(r => r.fail);
            return this.rollHistory;
        },

        /** Formats a timestamp for a compact history row. @param {number|string|Date} ts @returns {string} */
        formatTime(ts) {
            return new Date(ts).toTimeString().slice(0, 8);
        },

        /** Formats a complete, accessible roll-history description. @param {object} r @returns {string} */
        formatHistoryLine(r) {
            const priv = r.rollMode === 'public' ? '🔊' : '🔒';
            const name = r.name ? `${r.name}: ` : '';
            return `${this.formatTime(r.time)} · ${r.roller} · ${priv} · ${name}${r.total} (${r.notation})`;
        },
    };
};
