window.LOG = function(...args) {
    console.log(`[${window.MODE?.toUpperCase() || '??'}]`, ...args);
};
window.WARN = function(...args) {
    console.warn(`[${window.MODE?.toUpperCase() || '??'}]`, ...args);
};
window.ERR = function(...args) {
    console.error(`[${window.MODE?.toUpperCase() || '??'}]`, ...args);
};