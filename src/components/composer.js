import { store } from '../state/store.js';
import { UI, Icons } from '../utils/ui.js';
import { ApiService } from '../services/api.js';
import { copy } from '../copy/en.js';
import { createButton, createTextarea, createModalShell } from './primitives.js';

const lockScroll = (lock) => {
    document.body.classList.toggle('ink-scroll-lock', lock);
};

export const showComposer = (parentHash = null) => {
    const modalShell = createModalShell({ ariaLabel: parentHash ? copy.actions.reply : copy.actions.print });
    const modal = modalShell.backdrop;
    const box = modalShell.panel;
    const close = () => {
        lockScroll(false);
        modal.remove();
    };

    const header = UI.el('div', 'ink-modal-header');
    const cancel = createButton({ label: copy.actions.cancel, variant: 'ghost', onClick: close });
    const submit = createButton({
        label: parentHash ? copy.actions.reply : copy.actions.print,
        variant: 'primary'
    });

    header.appendChild(cancel);
    header.appendChild(submit);

    const inputArea = UI.el('div', 'flex gap-3');
    const pfp = UI.el('img', 'w-10 h-10 rounded-full', '', { alt: copy.a11y.composerAvatarAlt });
    pfp.src = store.getState().currentUser?.pfp || 'https://rosebud.ai/assets/avatar-1.webp?Vg8e';

    const textarea = createTextarea({
        placeholder: parentHash ? copy.composer.replyPlaceholder : copy.composer.placeholder,
        className: 'flex-1 bg-transparent border-none text-white text-lg focus:ring-0 resize-none',
        ariaLabel: parentHash ? copy.composer.replyPlaceholder : copy.composer.placeholder
    });

    submit.onclick = async () => {
        const text = textarea.value.trim();
        if (!text) return;
        submit.disabled = true;
        const activeChannel = store.getState().view === 'search' ? store.getState().selectedChannel : 'all';
        await ApiService.sendCast(text, activeChannel, parentHash);
        close();
    };

    inputArea.appendChild(pfp);
    inputArea.appendChild(textarea);

    box.appendChild(header);
    box.appendChild(inputArea);
    modal.appendChild(box);

    modal.onclick = (event) => {
        if (event.target === modal) close();
    };
    modal.onkeydown = (event) => {
        if (event.key === 'Escape') close();
    };

    document.body.appendChild(modal);
    lockScroll(true);
    textarea.focus();
};

export const renderComposerBar = (container) => {
    const bar = UI.el('div', 'ink-composer-bar');
    const button = UI.el('button', '', `${Icons.plus} ${copy.composer.barPlaceholder}`, {
        type: 'button',
        'aria-label': copy.composer.barPlaceholder
    });
    button.onclick = () => showComposer();
    bar.appendChild(button);
    container.appendChild(bar);
};

export const renderFab = (container) => {
    const fab = UI.el('button', 'ink-fab', Icons.plus, { type: 'button', 'aria-label': copy.actions.print });
    fab.onclick = () => showComposer();
    container.appendChild(fab);
};
