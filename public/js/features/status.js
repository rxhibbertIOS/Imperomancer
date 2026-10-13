window.statusFeature = function() {
    return {
        statusMessage: '⚔️ Roll for initiative!',
        statusText: '',
        statusVisible: false,
        _statusTimer: null,
        _statusDuration: 4500,

        // ---- Sending (DM only) ----
        sendStatus() {
            const msg = (this.statusMessage || '').trim();
            if (!msg) return;
            channel.postMessage({ type: 'status', message: msg });
            this.showStatus(msg);
        },

        clearStatus() {
            channel.postMessage({ type: 'status', message: '' });
            this.hideStatus();
        },

        focusEffect(effect) {
            channel.postMessage({ type: 'focus', effect });
        },

        // ---- Displaying (DM and player share this) ----
        showStatus(message) {
            if (!message) { this.hideStatus(); return; }
            // Newest wins: replace current text, reset the dismiss timer.
            this.statusText = message;
            this.statusVisible = true;
            clearTimeout(this._statusTimer);
            this._statusTimer = setTimeout(() => {
                this.statusVisible = false;
            }, this._statusDuration);
        },

        hideStatus() {
            clearTimeout(this._statusTimer);
            this.statusVisible = false;
        },

        showFocus(effect) {
            const map = {
                critical: '💥 CRITICAL HIT!',
                fail:     '💀 CRITICAL FAIL!',
                combat:   '⚔️ COMBAT START!',
                victory:  '🏆 VICTORY!',
            };
            if (!map[effect]) return;
            this.showStatus(map[effect]);
        },
    };
};