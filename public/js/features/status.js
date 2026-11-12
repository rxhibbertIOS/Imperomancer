/** Creates reactive status-banner state and the DM/player messaging actions. @returns {object} Alpine-compatible status feature. */
window.statusFeature = function() {
    return {
        statusMessage: '⚔️ Roll for initiative!',
        statusText: '',
        statusVisible: false,
        _statusTimer: null,
        _statusDuration: 4500,

        // ---- Sending (DM only) ----
        /** Broadcasts the current non-empty DM status message. @returns {void} */
        sendStatus() {
            const msg = (this.statusMessage || '').trim();
            if (!msg) return;
            channel.postMessage({ type: 'status', message: msg });
            this.showStatus(msg);
            systemLog.info('status', 'send', 'Status message sent');
        },

        /** Clears the local and player status banners. @returns {void} */
        clearStatus() {
            channel.postMessage({ type: 'status', message: '' });
            this.hideStatus();
            systemLog.info('status', 'clear', 'Status message cleared');
        },

        /** Broadcasts a named status effect. @param {string} effect @returns {void} */
        focusEffect(effect) {
            channel.postMessage({ type: 'focus', effect });
        },

        // ---- Displaying (DM and player share this) ----
        /** Displays a message and restarts its automatic dismissal timer. @param {string} message @returns {void} */
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

        /** Immediately hides the banner and cancels pending dismissal. @returns {void} */
        hideStatus() {
            clearTimeout(this._statusTimer);
            this.statusVisible = false;
        },

        /** Maps a named focus effect to a user-facing banner message. @param {string} effect @returns {void} */
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
