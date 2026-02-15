export const API_BASE = (() => {
    if (window.__INKSOCIAL_API_BASE__) return window.__INKSOCIAL_API_BASE__;
    const rawHost = window.location.hostname || '';
    const host = rawHost.replace(/^\[|\]$/g, '');
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
        return 'http://localhost:3000';
    }
    return '';
})();
