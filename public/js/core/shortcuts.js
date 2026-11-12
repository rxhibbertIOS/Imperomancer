// js/shared/shortcuts.js
//
// Declarative keyboard shortcut system.
//
// To add a shortcut:
//   1. Add an entry to SHORTCUT_DEFS below.
//   2. Add a method with the same name to the Alpine component (dm.js / player.js).
//   3. (Optional) Add aria-keyshortcuts="<key>" to the corresponding button in HTML.
//
// Combo syntax: 'alt+l', 'alt+shift+d', 'escape', '?', 'alt+arrowright'
// Modifiers: alt (option on mac), ctrl (control), meta (cmd), shift
//
// SAFETY: any combo that is a bare letter or number without a modifier is
// rejected at load time. Only Escape, ?, and F1–F12 are allowed standalone.

(() => {
  const isMac = (() => {
    if (navigator.userAgentData && navigator.userAgentData.platform) {
      return /mac/i.test(navigator.userAgentData.platform);
    }
    return /mac|iphone|ipad|ipod/i.test(navigator.platform);
  })();

  const MOD_LABEL   = isMac ? '⌘' : 'Ctrl';
  const ALT_LABEL   = isMac ? '⌥' : 'Alt';
  const SHIFT_LABEL = '⇧';

  // ================================================================
  //  SHORTCUT DEFINITIONS — edit here
  // ================================================================
  const SHORTCUT_DEFS = {
    // Session
    'alt+l': { group: 'Session', description: 'Toggle Live mode',    action: 'toggleLive' },
    'alt+s': { group: 'Session', description: 'Focus status message', action: 'focusStatusMessage' },
    'alt+h': { group: 'Session', description: 'Toggle roll history',  action: 'toggleHistoryCard' },

    // Combat
    'alt+i':          { group: 'Combat', description: 'Toggle initiative card', action: 'toggleInitiativeCard' },
    'alt+arrowright': { group: 'Combat', description: 'Next turn',    action: 'nextTurn', when: 'initiativeActive' },
    'alt+arrowleft':  { group: 'Combat', description: 'Previous turn', action: 'prevTurn', when: 'initiativeActive' },

    // Dice
    'alt+d': { group: 'Dice', description: 'Focus dice notation', action: 'focusDiceNotation' },

    // Display
    'alt+g': { group: 'Display', description: 'Toggle grid overlay', action: 'toggleGrid' },
    'alt+f': { group: 'Display', description: 'Toggle fullscreen',   action: 'toggleFullscreen' },
    'alt+k': { group: 'Display', description: 'Toggle zoom lock', action: 'toggleLockShortcut' },
    'alt+p': { group: 'Display', description: 'Toggle focus pointer', action: 'toggleFocusMode', when: () => window.MODE === 'dm' },
    'alt+e': { group: 'Display', description: 'Open effects palette', action: 'openEffectsPalette', when: () => window.MODE === 'dm' },

    // Help
    '?':      { group: 'Help', description: 'Show keyboard shortcuts', action: 'openShortcutGlossary' },
    'escape': { group: 'Help', description: 'Close open dialog',       action: 'closeActiveDialog' },
  };
  // ================================================================

  // Keys that are safe to use without a modifier (system/browser won't eat them)
  const SAFE_ALONE_KEYS = new Set([
    'escape', '?',
    'f1','f2','f3','f4','f5','f6','f7','f8','f9','f10','f11','f12',
  ]);

  // Symbols whose shift is baked into the key itself (so we don't require shift in the def)
  const SHIFT_IMPLIED_KEYS = new Set([
    '?','!','@','#','$','%','^','&','*','(',')','_','+','{','}','|',':','"','<','>','~',
  ]);

  // ---------- parsing ----------

  function parseCombo(combo) {
    const parts = combo.toLowerCase().split('+').map(s => s.trim()).filter(Boolean);
    const mods = { alt: false, ctrl: false, meta: false, shift: false };
    let key = null;
    for (const p of parts) {
      if (p === 'alt' || p === 'option')                        mods.alt   = true;
      else if (p === 'ctrl' || p === 'control')                  mods.ctrl  = true;
      else if (p === 'meta' || p === 'cmd' || p === 'command')   mods.meta  = true;
      else if (p === 'shift')                                    mods.shift = true;
      else key = p;
    }
    if (!key) throw new Error(`Shortcut "${combo}" has no key`);
    return { mods, key };
  }

  function validateCombo(combo, parsed) {
    const hasMod = parsed.mods.alt || parsed.mods.ctrl || parsed.mods.meta || parsed.mods.shift;
    if (hasMod) return true;
    if (SAFE_ALONE_KEYS.has(parsed.key)) return true;
    systemLog.warn('shortcuts', 'validate', `Ignored unsafe bare shortcut "${combo}"`);
    return false;
  }

  // ---------- matching ----------

  function keyMatches(expected, e) {
    if (e.key && e.key.toLowerCase() === expected) return true;
    // Fallback via e.code — needed on macOS where Alt+letter can produce composed keys
    if (expected.length === 1 && e.code) {
      const code = e.code.toLowerCase();
      if (/[a-z]/.test(expected) && code === 'key' + expected)   return true;
      if (/[0-9]/.test(expected) && code === 'digit' + expected) return true;
    }
    return false;
  }

  function matches(parsed, e) {
    if (!keyMatches(parsed.key, e)) return false;
    if (parsed.mods.alt   !== e.altKey)   return false;
    if (parsed.mods.ctrl  !== e.ctrlKey)  return false;
    if (parsed.mods.meta  !== e.metaKey)  return false;
    if (!SHIFT_IMPLIED_KEYS.has(parsed.key) && parsed.mods.shift !== e.shiftKey) return false;
    return true;
  }

  function isEditable(el) {
    if (!el) return false;
    const tag = el.tagName;
    if (tag === 'INPUT') {
      const type = (el.type || '').toLowerCase();
      return !['checkbox','radio','button','submit','reset','range'].includes(type);
    }
    if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
    return !!el.isContentEditable;
  }

  // ---------- display formatting ----------

  function prettyKey(key) {
    const named = {
      arrowright: '→', arrowleft: '←', arrowup: '↑', arrowdown: '↓',
      escape: 'Esc', ' ': 'Space', enter: 'Enter', tab: 'Tab',
      backspace: '⌫', delete: 'Del', home: 'Home', end: 'End',
      pageup: 'PgUp', pagedown: 'PgDn',
    };
    if (named[key]) return named[key];
    if (key.length === 1) return key.toUpperCase();
    return key.charAt(0).toUpperCase() + key.slice(1);
  }

  function formatCombo(parsed) {
    const parts = [];
    if (parsed.mods.ctrl)  parts.push(MOD_LABEL);
    if (parsed.mods.alt)   parts.push(ALT_LABEL);
    if (parsed.mods.shift) parts.push(SHIFT_LABEL);
    if (parsed.mods.meta)  parts.push(isMac ? '⌘' : 'Win');
    parts.push(prettyKey(parsed.key));
    return parts.join(isMac ? '' : '+');
  }

  // ---------- factory ----------

  function createShortcuts(component) {
    const bindings = Object.entries(SHORTCUT_DEFS)
      .map(([combo, def]) => {
        let parsed;
        try { parsed = parseCombo(combo); }
        catch (err) { systemLog.error('shortcuts', 'parse', err.message, err.stack); return null; }
        if (!validateCombo(combo, parsed)) return null;
        return { combo, ...def, parsed };
      })
      .filter(Boolean);

    const warned = new Set();

    function componentDialogOpen() {
      const c = component;
      if (typeof c.isDialogOpen === 'function') return c.isDialogOpen();
      if (typeof c.isDialogOpen === 'boolean')  return c.isDialogOpen;
      return false;
    }

    function onKeydown(e) {
      if (e.isComposing || e.key === 'Dead' || e.key === 'Unidentified') return;
      if (isEditable(e.target)) return;

      const dialogOpen = componentDialogOpen();

      for (const b of bindings) {
        if (!matches(b.parsed, e)) continue;

        // When a dialog is open, only Escape fires.
        if (dialogOpen && b.parsed.key !== 'escape') continue;

        // Optional per-shortcut guard
        if (b.when) {
          const cond = typeof b.when === 'function'
            ? b.when(component)
            : component[b.when];
          if (!cond) continue;
        }

        const fn = component[b.action];
        if (typeof fn !== 'function') {
          if (!warned.has(b.action)) {
            systemLog.warn('shortcuts', 'attach', `Missing component action "${b.action}" for ${b.combo}`);
            warned.add(b.action);
          }
          continue;
        }

        e.preventDefault();
        e.stopPropagation();
        fn.call(component, e);
        return;
      }
    }

    function attach() { document.addEventListener('keydown', onKeydown, true); }
    function detach() { document.removeEventListener('keydown', onKeydown, true); }

    function list() {
      return bindings
        .filter(b => b.description)
        .map(b => ({
          group: b.group || 'General',
          keys: formatCombo(b.parsed),
          description: b.description,
        }));
    }

    return { attach, detach, list, isMac };
  }

  window.createShortcuts = createShortcuts;
})();
