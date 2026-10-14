/**
 * Normalise any dice result (silent roll, public roll, error) into a single
 * consistent shape consumed by the result modal.
 */
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
      error: true,
    };
  }

  const diceResults = normalizeDiceArray(
    raw.diceResults || raw.result || raw.rolls || null
  );

  const hasTarget = diceResults.some(
    d => d.success !== undefined || d.failure !== undefined
  );

  const successCount = hasTarget
    ? diceResults.filter(d => d.success === true).length : 0;
  const failureCount = hasTarget
    ? diceResults.filter(d => d.failure === true).length : 0;

  const critical = !!raw.critical
    || diceResults.some(d => d.critical && d.success);
  const fail = !!raw.fail
    || diceResults.some(d => d.critical && d.failure);

  return {
    notation,
    total: raw.resultTotal ?? raw.total ?? 0,
    breakdown: raw.resultString || raw.breakdown
               || `${notation} = ${raw.resultTotal ?? 0}`,
    diceResults: diceResults.length ? diceResults : null,
    audit: Array.isArray(raw.audit)
    ? raw.audit.map(formatAuditEntry)
    : null,
    message: message || '',
    tag: tag || 'Roll',
    rollMode,
    critical,
    fail,
    hasTarget,
    successCount,
    failureCount,
    error: false,
  };
}

function normalizeDiceArray(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(entry => {
    if (typeof entry === 'number') return { value: entry };
    if (entry && typeof entry === 'object') {
      return {
        value:    entry.value ?? entry.result ?? entry.roll ?? '?',
        critical: !!entry.critical,
        success:  entry.success,
        failure:  entry.failure,
        dropped:  !!entry.dropped,
        exploded: !!entry.exploded,
      };
    }
    return { value: '?' };
  });
}

function formatAuditEntry(entry) {
    if (typeof entry === 'string') return entry;
    if (!entry || typeof entry !== 'object') return String(entry);
    return entry.message
        || entry.text
        || entry.description
        || entry.reason
        || entry.rule
        || entry.summary
        || JSON.stringify(entry);
}

/** CSS class bag for a single die tile in the modal. */
function dieClass(die) {
  return {
    'die-crit-success': die.critical && die.success,
    'die-crit-fail':    die.critical && die.failure,
    'die-success':      !die.critical && die.success === true,
    'die-fail':         !die.critical && die.failure === true,
    'die-dropped':      !!die.dropped,
    'die-exploded':     !!die.exploded,
  };
}