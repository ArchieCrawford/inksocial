import { store } from '../state/store.js';
import { UI, Icons } from '../utils/ui.js';
import { copy } from '../copy/en.js';
import { formatHandle } from '../utils/format.js';

export const renderNotifications = (container) => {
    const notifs = store.getState().notifications;
    const title = UI.el('h2', 'ink-section-title', copy.headers.notifications);
    container.appendChild(title);

    if (notifs.length === 0) {
        container.appendChild(UI.el('div', 'ink-empty', copy.notifications.empty));
        return;
    }

    notifs.forEach(n => {
        const el = UI.el('div', 'p-4 border-b border-slate-800 flex gap-4 items-center hover:bg-slate-900/30');
        let icon = '';
        let text = '';

        if (n.type === 'like') { icon = `<span class="text-rose-400">${Icons.heart}</span>`; text = copy.notifications.like; }
        if (n.type === 'recast') { icon = `<span class="text-emerald-400">${Icons.recast}</span>`; text = copy.notifications.reprint; }
        if (n.type === 'reply') { icon = `<span class="text-sky-400">${Icons.reply}</span>`; text = copy.notifications.reply; }

        const avatar = UI.el('img', 'w-8 h-8 rounded-full', '', { alt: copy.a11y.userAvatarAlt(n.actor.displayName) });
        avatar.src = n.actor.pfp;

        const content = UI.el('div', 'flex-1');
        const handle = formatHandle({
            dnsName: n.actor.dnsName,
            dns_name: n.actor.dns_name,
            username: n.actor.username,
            address: n.actor.address
        });
        const actorName = n.actor.displayName || n.actor.username || handle.replace('@', '');
        content.innerHTML = `<span class="font-bold">${actorName}</span> ${text}`;
        if (handle) {
            const handleEl = UI.el('div', 'text-slate-500 text-sm', handle);
            content.appendChild(handleEl);
        }
        const preview = UI.el('p', 'text-slate-500 text-sm truncate mt-1', n.targetCast.text);
        content.appendChild(preview);

        el.innerHTML = `<div class="w-6">${icon}</div>`;
        el.appendChild(avatar);
        el.appendChild(content);
        container.appendChild(el);
    });
};
