import { UI } from '../utils/ui.js';

let root;

const ensureRoot = () => {
    if (root) return root;
    root = UI.el('div', 'ink-toast-root', '', {
        id: 'ink-toast-root',
        role: 'status',
        'aria-live': 'polite'
    });
    document.body.appendChild(root);
    return root;
};

export const ToastService = {
    show({ title, message, type = 'info', duration = 3000 }) {
        const container = ensureRoot();
        const toast = UI.el('div', `ink-toast ${type === 'error' ? 'is-error' : ''} ${type === 'success' ? 'is-success' : ''}`);
        if (title) {
            toast.appendChild(UI.el('div', 'ink-toast-title', title));
        }
        if (message) {
            toast.appendChild(UI.el('div', 'ink-toast-message', message));
        }
        container.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, duration);
    }
};

