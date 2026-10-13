window.uid = function() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
};

window.uuid = function() {
    return crypto.randomUUID?.() ?? String(Date.now() + Math.random());
};