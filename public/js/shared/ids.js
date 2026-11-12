/** Creates a short, UI-local identifier; it is not a cryptographic UUID. @returns {string} */
window.uid = function() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
};

/** Creates a globally unique identifier, using the platform UUID API when available. @returns {string} */
window.uuid = function() {
    return crypto.randomUUID?.() ?? String(Date.now() + Math.random());
};
