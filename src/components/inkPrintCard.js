import { UI, Icons } from '../utils/ui.js';
import { ApiService } from '../services/api.js';
import { copy } from '../copy/en.js';
import { formatHandle } from '../utils/format.js';

export const createInkPrintCard = (cast, { isThreadHead = false, onOpenThread, onReply } = {}) => {
    const card = UI.el('article', `ink-card ${!isThreadHead ? 'is-clickable' : ''}`, '', {
        'aria-label': copy.terms.inkPrintSingular
    });

    if (!isThreadHead) {
        card.onclick = (event) => {
            if (event.target.closest('button')) return;
            if (onOpenThread) onOpenThread(cast);
        };
    }

    const handle = formatHandle({
        dnsName: cast.author.dnsName,
        dns_name: cast.author.dns_name,
        username: cast.author.username,
        address: cast.author.address
    });
    const displayName = cast.author.displayName || cast.author.username || handle.replace('@', '');
    const avatarLabel = copy.a11y.userAvatarAlt(displayName || cast.author.username);
    const avatar = UI.el('img', 'ink-avatar', '', { alt: avatarLabel });
    avatar.src = cast.author.pfp;

    const main = UI.el('div', 'flex-1 min-w-0');

    const header = UI.el('div', 'flex items-center gap-1 mb-1');
    const name = UI.el('span', 'font-bold text-white truncate hover:underline', displayName);
    const username = UI.el('span', 'ink-meta truncate', handle || '');
    const dot = UI.el('span', 'ink-meta', '·');
    const time = UI.el('span', 'ink-meta', UI.formatTime(cast.timestamp, copy.meta.now));

    header.appendChild(name);
    header.appendChild(username);
    if (cast.verified) {
        const verified = UI.el(
            'span',
            'text-indigo-400 ml-1',
            `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check-circle-2"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg>`
        );
        header.appendChild(verified);
    }
    header.appendChild(dot);
    header.appendChild(time);

    const text = UI.el(
        'p',
        `text-slate-200 leading-relaxed break-words ${isThreadHead ? 'text-xl mb-4' : ''}`,
        cast.text
    );

    const footer = UI.el('div', 'flex items-center justify-between mt-3 text-slate-400 max-w-sm');

    const actions = [
        { id: 'reply', icon: Icons.reply, count: cast.replies, color: 'hover:text-sky-400', label: copy.actionsLabels.reply },
        { id: 'recast', icon: Icons.recast, count: cast.recasts, color: cast.isRecastedByMe ? 'text-emerald-400' : 'hover:text-emerald-300', label: copy.actionsLabels.reprint },
        { id: 'like', icon: Icons.heart, count: cast.likes, color: cast.isLikedByMe ? 'text-rose-400' : 'hover:text-rose-300', label: copy.actionsLabels.like },
        { id: 'share', icon: Icons.share, count: '', color: 'hover:text-indigo-300', label: copy.actionsLabels.share }
    ];

    actions.forEach(action => {
        const btn = UI.el('button', `flex items-center gap-2 transition-colors ${action.color}`, '', {
            type: 'button',
            'aria-label': action.label
        });
        btn.innerHTML = `${action.icon} <span class="text-xs">${action.count}</span>`;

        if (action.id === 'like') btn.onclick = () => ApiService.toggleLike(cast.hash);
        if (action.id === 'recast') btn.onclick = () => ApiService.toggleRecast(cast.hash);
        if (action.id === 'reply') btn.onclick = () => onReply?.(cast.hash);

        footer.appendChild(btn);
    });

    main.appendChild(header);
    main.appendChild(text);
    main.appendChild(footer);

    card.appendChild(avatar);
    card.appendChild(main);

    return card;
};
