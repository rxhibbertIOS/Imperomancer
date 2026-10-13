// js/shared/focus-trap.js
//
// Reusable focus trap for dialogs.
// Usage:
//   const trap = createFocusTrap(modalEl);
//   trap.activate();   // stores previously focused element, focuses first focusable, traps Tab
//   trap.deactivate(); // restores focus
//
// The modal element should have role="dialog" and aria-modal="true".

(() => {
  const FOCUSABLE = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',');

  function getFocusable(root) {
    return Array.from(root.querySelectorAll(FOCUSABLE))
      .filter(el => el.offsetParent !== null || el === document.activeElement);
  }

  function createFocusTrap(root) {
    let previouslyFocused = null;
    let active = false;

    function onKeydown(e) {
      if (!active) return;

      if (e.key === 'Escape') {
        // Let the caller handle Escape via a custom event so it can decide whether to close
        root.dispatchEvent(new CustomEvent('focus-trap:escape', { bubbles: true }));
        return;
      }

      if (e.key !== 'Tab') return;

      const focusables = getFocusable(root);
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const current = document.activeElement;

      if (e.shiftKey) {
        if (current === first || !root.contains(current)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (current === last || !root.contains(current)) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    function activate({ initialFocus } = {}) {
      if (active) return;
      active = true;
      previouslyFocused = document.activeElement;

      document.addEventListener('keydown', onKeydown, true);

      // Focus the requested element, or the first focusable, on the next frame
      // so x-show / x-transition have time to make the element visible.
      requestAnimationFrame(() => {
        const target = initialFocus
          ? (typeof initialFocus === 'string' ? root.querySelector(initialFocus) : initialFocus)
          : null;
        const focusables = getFocusable(root);
        const el = target || focusables[0] || root;
        if (el && typeof el.focus === 'function') {
          if (!el.hasAttribute('tabindex') && el === root) el.setAttribute('tabindex', '-1');
          el.focus();
        }
      });
    }

    function deactivate() {
      if (!active) return;
      active = false;
      document.removeEventListener('keydown', onKeydown, true);
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus();
      }
      previouslyFocused = null;
    }

    return { activate, deactivate, get isActive() { return active; } };
  }

  window.createFocusTrap = createFocusTrap;
})();