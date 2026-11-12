window.roll = function(sides) {
    return Math.floor(Math.random() * sides) + 1;
};

/** Formats a completed dice roll consistently for Chronicle and other UI logs. */
window.formatDiceLog = function(notation, message, total) {
    const roll = `${notation || 'Dice'} rolled`;
    const reason = String(message || '').trim();
    return reason ? `${roll} for ${reason}: ${total ?? '?'}` : `${roll}: ${total ?? '?'}`;
};

/** Parse "2d6+3", "1d20", "4d6-1". Returns null on malformed input. */
window.parseNotation = function(notation) {
    if (!notation) return null;
    const m = String(notation).trim().match(/^(\d+)d(\d+)(?:\s*([+-])\s*(\d+))?$/i);
    if (!m) return null;
    const count = parseInt(m[1], 10);
    const sides = parseInt(m[2], 10);
    if (count < 1 || count > 100 || sides < 2 || sides > 1000) return null;
    let mod = 0;
    if (m[4]) mod = parseInt(m[4], 10) * (m[3] === '-' ? -1 : 1);
    return { count, sides, mod };
};

/**
 * Unified crit/fail detection. Prefers rule-engine flags (cs/fc on dice)
 * and falls back to the classic d20 20/1 heuristic.
 */
window.detectCritFail = function(notation, result) {
    const dice = result?.diceResults || [];
    if (dice.some(d => d.critical === true && d.failure !== true)) {
        return { critical: true, fail: false };
    }
    if (dice.some(d => d.failure === true)) {
        return { critical: false, fail: true };
    }

    const parsed = window.parseNotation(notation);
    if (!parsed || parsed.sides !== 20 || parsed.count !== 1) {
        return { critical: false, fail: false };
    }
    const first = Array.isArray(result?.result)
        ? result.result[0]
        : (result?.resultTotal ?? null);
    return { critical: first === 20, fail: first === 1 };
};
