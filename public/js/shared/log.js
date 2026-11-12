/**
 * Structured application logger and expandable in-app system tray.
 * @module system-log
 */
(() => {
    const MAX_ENTRIES = 500;
    const LEVELS = new Set(['debug', 'info', 'success', 'warn', 'danger', 'error']);
    const isDevelopment = new URLSearchParams(location.search).has('debug') || ['localhost', '127.0.0.1', '::1'].includes(location.hostname);
    const entries = [];
    let tray, list, count, filters, summary, activeLevel = 'all', featureFilter = '';

    /** Converts errors and arbitrary values into safe, readable details. @param {*} value @returns {{message:string,stack:string}} */
    function describe(value) {
        if (value instanceof Error) return { message: value.message, stack: value.stack || '' };
        if (typeof value === 'string') return { message: value, stack: '' };
        if (value === undefined) return { message: '', stack: '' };
        try { return { message: JSON.stringify(value), stack: '' }; } catch { return { message: String(value), stack: '' }; }
    }
    /** Normalizes all accepted logging call shapes into a renderable entry. @param {string} level @param {string|object} feature @param {string} action @param {*} message @param {string} stack @returns {object} */
    function normalise(level, feature, action, message, stack) {
        if (feature && typeof feature === 'object' && !(feature instanceof Error)) ({ feature = 'system', action = 'event', message = '', stack = '' } = feature);
        const detail = describe(message);
        return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, level: LEVELS.has(level) ? level : 'info', feature: String(feature || 'system'), action: String(action || 'event'), message: detail.message, stack: stack || detail.stack, timestamp: new Date() };
    }
    /** Escapes arbitrary text before inserting it into generated log markup. @param {*} value @returns {string} */
    function escapeHtml(value) { const element = document.createElement('span'); element.textContent = value; return element.innerHTML; }
    /** Makes camelCase operation names readable without changing the logging API. @param {string} action @returns {string} */
    function formatAction(action) { return String(action).replace(/([a-z])([A-Z])/g, '$1 $2'); }
    /** Resolves a log-level icon asset name. @param {string} level @returns {string} */
    function iconFor(level) { return ({ debug: 'bug', info: 'info', success: 'success', warn: 'warning', danger: 'danger', error: 'error' })[level]; }
    /** Updates the expanded console and the compact latest-entry ticker. @param {boolean} [animateLatest=false] @returns {void} */
    function render(animateLatest = false) {
        if (!list) return;
        const visible = entries.filter(entry => (activeLevel === 'all' || entry.level === activeLevel) && (!featureFilter || entry.feature.toLowerCase().includes(featureFilter)));
        list.replaceChildren(...visible.map(entry => {
            const row = document.createElement('article');
            row.className = `system-log__entry system-log__entry--${entry.level}${animateLatest && entry === entries.at(-1) ? ' system-log__entry--new' : ''}`;
            const icon = `/assets/icons/${iconFor(entry.level)}.svg`;
            row.innerHTML = `<img class="app-icon system-log__icon" src="${icon}" alt="" aria-hidden="true"><div class="system-log__content"><div class="system-log__meta"><time>${entry.timestamp.toLocaleTimeString()}</time><span>${escapeHtml(entry.feature)}</span><span>${escapeHtml(formatAction(entry.action))}</span></div><p>${escapeHtml(entry.message)}</p>${entry.stack ? `<pre>${escapeHtml(entry.stack)}</pre>` : ''}</div>`;
            return row;
        }));
        if (!visible.length) list.innerHTML = '<p class="system-log__empty">No matching log entries.</p>';
        const countLabel = entries.length > 99 ? '99+' : String(entries.length);
        count.querySelector('span').textContent = countLabel;
        count.setAttribute('aria-label', `${entries.length} log ${entries.length === 1 ? 'entry' : 'entries'}`);
        renderSummary(entries.at(-1), animateLatest);
        if (animateLatest && tray.classList.contains('is-expanded')) list.scrollTop = list.scrollHeight;
    }
    /** Renders the most recent entry in the compact tray preview. @param {object|undefined} entry @param {boolean} animate @returns {void} */
    function renderSummary(entry, animate) {
        if (!entry) {
            summary.innerHTML = '<p class="system-log__placeholder">No system activity yet.</p>';
            return;
        }
        const prior = summary.querySelector('.system-log__preview-entry');
        if (animate && prior) {
            const departing = prior.cloneNode(true);
            departing.classList.add('is-leaving');
            summary.replaceChildren(departing);
            setTimeout(() => departing.remove(), 250);
        } else summary.replaceChildren();
        const preview = document.createElement('div');
        preview.className = `system-log__preview-entry system-log__entry--${entry.level}`;
        if (!animate) preview.style.animation = 'none';
        const icon = `/assets/icons/${iconFor(entry.level)}.svg`;
        preview.innerHTML = `<img class="app-icon system-log__preview-icon" src="${icon}" alt="" aria-hidden="true"><div class="system-log__content"><div class="system-log__meta"><time>${entry.timestamp.toLocaleTimeString()}</time><span>${escapeHtml(entry.feature)}</span><span>${escapeHtml(formatAction(entry.action))}</span></div><p class="system-log__preview-text">${escapeHtml(entry.message)}</p></div>`;
        summary.append(preview);
    }
    /** Finds system-tray elements and binds its filtering, clearing, and toggle controls. @returns {void} */
    function bindTray() {
        tray = document.querySelector('[data-system-tray]');
        if (!tray) return;
        list = tray.querySelector('[data-system-log-list]'); count = tray.querySelector('[data-system-log-count]'); summary = tray.querySelector('[data-system-log-summary]'); filters = tray.querySelector('[data-system-log-filters]');
        tray.querySelectorAll('[data-system-log-toggle]').forEach(toggle => toggle.addEventListener('click', () => {
            const open = tray.classList.toggle('is-expanded');
            tray.querySelectorAll('[data-system-log-toggle]').forEach(button => {
                button.setAttribute('aria-expanded', String(open));
                button.setAttribute('aria-label', open ? 'Collapse Chronicle' : 'Expand Chronicle');
            });
            if (open) list.scrollTop = list.scrollHeight;
        }));
        tray.querySelector('[data-system-log-clear]').addEventListener('click', () => { entries.length = 0; render(); });
        filters.addEventListener('click', event => { const button = event.target.closest('[data-log-level]'); if (!button) return; activeLevel = button.dataset.logLevel; filters.querySelectorAll('button').forEach(item => item.classList.toggle('is-active', item === button)); render(); });
        tray.querySelector('[data-system-log-feature]').addEventListener('input', event => { featureFilter = event.target.value.trim().toLowerCase(); render(); });
        if (!isDevelopment) tray.querySelector('[data-log-level="debug"]').hidden = true;
        render();
    }
    const api = {
        isDevelopment,
        /** Records, mirrors, and renders a structured log entry. @param {string} level @param {string|object} feature @param {string} action @param {*} message @param {string} stack @returns {object|null} */
        log(level, feature, action, message, stack) {
            if (level === 'debug' && !isDevelopment) return null;
            const entry = normalise(level, feature, action, message, stack); entries.push(entry); if (entries.length > MAX_ENTRIES) entries.shift();
            console[level === 'danger' ? 'warn' : level === 'success' ? 'info' : level](`[${entry.feature}:${entry.action}] ${entry.message}`, entry.stack || ''); render(true); return entry;
        },
        debug(feature, action, message, stack) { return api.log('debug', feature, action, message, stack); }, info(feature, action, message, stack) { return api.log('info', feature, action, message, stack); }, success(feature, action, message, stack) { return api.log('success', feature, action, message, stack); }, warn(feature, action, message, stack) { return api.log('warn', feature, action, message, stack); }, danger(feature, action, message, stack) { return api.log('danger', feature, action, message, stack); }, error(feature, action, message, stack) { return api.log('error', feature, action, message, stack); }, entries: () => [...entries], clear() { entries.length = 0; render(); },
    };
    window.systemLog = api;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindTray, { once: true }); else bindTray();
})();
