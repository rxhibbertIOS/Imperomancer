/**
 * Normalise any dice result (silent roll, public roll, error) into a single
 * consistent shape consumed by the result modal.
 *
 * Library field contract (per docs):
 *   diceResults[].value      number
 *   diceResults[].kept       boolean  — false when a keep/drop rule excluded it
 *   diceResults[].critical   boolean  — true if a cs or cf rule matched
 *   diceResults[].success    boolean  — true if a cs or t rule matched
 *   diceResults[].failure    boolean  — true if a cf or f rule matched
 *
 * The library includes *every* logical die in diceResults regardless of
 * keep/drop status. Dropped dice carry kept=false and are positioned next
 * to their kept siblings (or, for recursive rolls, in the phase that
 * produced them). So:
 *
 *   - diceResults.length   = total dice rolled (logical dice for d100)
 *   - droppedCount         = entries with kept === false
 *   - discarded values are directly readable, no reconstruction needed
 *
 * Compound dice (d100) still produce ONE entry per logical die with a
 * single diceId — the tens die's ID. Do not infer dice from diceId gaps:
 * for 2d100 the IDs are, e.g., 0 and 2, with 1 and 3 belonging to the
 * physical units dice that are never surfaced as separate entries.
 *
 * The library also reports top-level successCount / failureCount on the
 * result object, and those are the authoritative counts (computed over
 * *kept* dice only, matching resultTotal). Prefer them when present and
 * only fall back to scanning diceResults for the legacy _fallbackRoll path.
 */

/** Normalizes a dice-library result into the modal and history contract. @param {object|null} raw @param {{notation?:string,rollMode?:string,message?:string,tag?:string}} [metadata] @returns {object} */
function normalizeDiceResult(raw, { notation, rollMode, message, tag } = {}) {
    if (!raw || raw.error) {
        return {
            notation,
            total: '?',
            breakdown: raw?.errorMessage || raw?.resultString || 'Invalid notation',
            diceResults: null,
            audit: null,
            message: message || '',
            tag: tag || 'Roll',
            rollMode,
            critical: false,
            fail: false,
            hasTarget: false,
            successCount: 0,
            failureCount: 0,
            droppedCount: 0,
            error: true,
        };
    }

    const diceResults = normalizeDiceArray(raw.diceResults || null);

    const hasTarget = detectHasTarget(raw, diceResults, notation);

    // Prefer library-reported counts: they're over kept dice only, matching
    // resultTotal. Fall back to scanning diceResults for the legacy
    // _fallbackRoll path (which has no successCount / failureCount fields).
    const successCount = raw.successCount ?? diceResults.filter(d => d.success === true).length;
    const failureCount = raw.failureCount ?? diceResults.filter(d => d.failure === true).length;
    const droppedCount = diceResults.filter(d => d.dropped).length;

    const critical = !!raw.critical || diceResults.some(d => d.critical && d.success);
    const fail     = !!raw.fail     || diceResults.some(d => d.critical && d.failure);

    return {
        notation,
        total: raw.resultTotal ?? 0,
        breakdown: raw.resultString || `${notation} = ${raw.resultTotal ?? 0}`,
        diceResults: diceResults.length ? diceResults : null,
        audit: Array.isArray(raw.audit) ? raw.audit.map(formatAuditEntry) : null,
        message: message || '',
        tag: tag || 'Roll',
        rollMode,
        critical,
        fail,
        hasTarget,
        successCount,
        failureCount,
        droppedCount,
        error: false,
    };
}

/** Detects target/success rules using authoritative result data before notation fallback. @param {object} raw @param {object[]} diceResults @param {string} notation @returns {boolean} */
function detectHasTarget(raw, diceResults, notation) {
    // 1. Authoritative source: the parsed rule list on each group.
    if (Array.isArray(raw.groups)) {
        const TARGET_RULES = ['target-number', 'failures', 'critical-success', 'critical-failure'];
        const fromGroups = raw.groups.some(g =>
            Array.isArray(g.rules) && g.rules.some(r => TARGET_RULES.includes(r.type))
        );
        if (fromGroups) return true;
    }

    // 2. Any per-die success/failure flag set by the rule pass.
    if (diceResults.some(d => d.success === true || d.failure === true)) return true;

    // 3. Notation fallback (legacy path / missing groups). Allow whitespace
    //    between the rule token and its threshold, since the library strips
    //    it internally ("4d6 t3" is valid input).
    return /(?:^|[^a-z])(?:t|f|cs|cf)\s*\d/i.test(notation || '');
}

/** Converts legacy and library dice arrays into one display-safe shape. @param {*} arr @returns {object[]} */
function normalizeDiceArray(arr) {
    if (!Array.isArray(arr) || !arr.length) return [];

    return arr.map(entry => {
        if (typeof entry === 'number') return { value: entry };
        if (!entry || typeof entry !== 'object') return { value: '?' };

        return {
            value:    entry.value ?? '?',
            type:     entry.type,
            diceId:   entry.diceId,
            groupId:  entry.groupId,
            dropped:  entry.kept === false,
            critical: !!entry.critical,
            success:  entry.success,
            failure:  entry.failure,
        };
    });
}

/** Human-readable audit entry, preserving step/phase when available. @param {*} entry @returns {string} */
function formatAuditEntry(entry) {
    if (typeof entry === 'string') return entry;
    if (!entry || typeof entry !== 'object') return String(entry);

    const text =
        entry.description ||
        entry.message     ||
        entry.text        ||
        entry.reason      ||
        entry.rule        ||
        entry.summary     ||
        JSON.stringify(entry);

    if (entry.step !== undefined && entry.phase !== undefined) {
        return `Step ${entry.step} (${entry.phase}): ${text}`;
    }
    if (entry.step !== undefined) {
        return `Step ${entry.step}: ${text}`;
    }
    return text;
}

/** CSS class bag for a single die tile in the modal. @param {object} die @returns {Record<string, boolean>} */
function dieClass(die) {
    return {
        'die-crit-success': die.critical && die.success === true,
        'die-crit-fail':    die.critical && die.failure === true,
        'die-success':      !die.critical && die.success === true,
        'die-fail':         !die.critical && die.failure === true,
        'die-dropped':      !!die.dropped,
    };
}
