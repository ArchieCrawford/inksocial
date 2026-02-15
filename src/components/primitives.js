import { UI } from '../utils/ui.js';

const buttonVariants = {
    primary: 'ink-btn ink-btn-primary',
    secondary: 'ink-btn ink-btn-secondary',
    ghost: 'ink-btn ink-btn-ghost',
    icon: 'ink-btn ink-btn-icon ink-btn-ghost'
};

export const createButton = ({
    label,
    variant = 'primary',
    className = '',
    icon = '',
    ariaLabel,
    type = 'button',
    onClick
}) => {
    const classes = `${buttonVariants[variant] || buttonVariants.primary} ${className}`.trim();
    const button = UI.el('button', classes, icon ? `${icon}<span>${label}</span>` : label, {
        type,
        'aria-label': ariaLabel || label
    });
    if (onClick) button.onclick = onClick;
    return button;
};

export const createIconButton = ({ icon, ariaLabel, className = '', onClick }) => {
    const button = UI.el('button', `${buttonVariants.icon} ${className}`.trim(), icon, {
        type: 'button',
        'aria-label': ariaLabel
    });
    if (onClick) button.onclick = onClick;
    return button;
};

export const createInput = ({ placeholder = '', value = '', ariaLabel, className = '', onInput, type = 'text' }) => {
    const input = UI.el('input', `ink-input ${className}`.trim(), '', {
        type,
        placeholder,
        value,
        'aria-label': ariaLabel || placeholder
    });
    if (onInput) input.oninput = onInput;
    return input;
};

export const createTextarea = ({ placeholder = '', value = '', ariaLabel, className = '', onInput }) => {
    const textarea = UI.el('textarea', `ink-textarea ${className}`.trim(), '', {
        placeholder,
        'aria-label': ariaLabel || placeholder
    });
    textarea.value = value;
    if (onInput) textarea.oninput = onInput;
    return textarea;
};

export const createTabList = ({ items, activeId, onChange }) => {
    const tablist = UI.el('div', 'ink-tablist', '', { role: 'tablist' });
    items.forEach(item => {
        const tab = UI.el('button', `ink-tab ${activeId === item.id ? 'is-active' : ''}`, item.label, {
            type: 'button',
            role: 'tab',
            'aria-selected': activeId === item.id ? 'true' : 'false'
        });
        tab.onclick = () => onChange(item.id);
        tablist.appendChild(tab);
    });
    return tablist;
};

export const createCard = ({ className = '', content = '', attrs = {} }) => {
    return UI.el('div', `ink-card ${className}`.trim(), content, attrs);
};

export const createModalShell = ({ ariaLabel }) => {
    const backdrop = UI.el('div', 'ink-modal-backdrop', '', {
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': ariaLabel
    });
    const panel = UI.el('div', 'ink-modal');
    backdrop.appendChild(panel);
    return { backdrop, panel };
};
