import { store } from '../state/store.js';
import { UI, Icons } from '../utils/ui.js';
import { copy } from '../copy/en.js';
import { createButton } from '../components/primitives.js';
import { createInkPrintCard } from '../components/inkPrintCard.js';
import { AuthService } from '../services/auth.js';
import { showComposer } from '../components/composer.js';
import { formatHandle } from '../utils/format.js';

export const renderProfile = (container, user) => {
    const header = UI.el('div', 'relative mb-16');
    const banner = UI.el('div', 'h-32 bg-indigo-900/40 overflow-hidden');
    if (user.banner_url) {
        const bannerImg = UI.el('img', 'w-full h-full object-cover', '', { alt: 'Profile banner' });
        bannerImg.src = user.banner_url;
        banner.appendChild(bannerImg);
    }
    const avatar = UI.el('img', 'absolute -bottom-12 left-4 w-24 h-24 rounded-full border-4 border-slate-950 bg-slate-800', '', {
        alt: copy.a11y.userAvatarAlt(user.displayName || user.display_name || user.username)
    });
    avatar.src = user.pfp || user.pfp_url || 'https://rosebud.ai/assets/avatar-1.webp?Vg8e';

    const settingsBtn = UI.el('button', 'ink-btn ink-btn-ghost settings-gear', '', { type: 'button', 'aria-label': copy.profile.settings });
    settingsBtn.innerHTML = Icons.settings;
    settingsBtn.onclick = () => store.setState({ view: 'profile-settings' });
    header.appendChild(banner);
    header.appendChild(avatar);
    header.appendChild(settingsBtn);

    const info = UI.el('div', 'px-4');
    const handle = formatHandle({
        dnsName: user.dnsName,
        dns_name: user.dns_name,
        username: user.username,
        address: user.address
    });
    const name = UI.el('h2', 'text-2xl font-bold', user.displayName || user.display_name || user.username);
    const username = UI.el('p', 'text-slate-500 mb-3', handle || `@${user.username}`);
    const bio = UI.el('p', 'text-slate-200 mb-4', user.bio || '');
    const meta = UI.el('div', 'flex flex-wrap gap-2 text-sm text-slate-400 mb-4');
    if (user.website) meta.appendChild(UI.el('span', 'profile-pill', user.website));
    if (user.location) meta.appendChild(UI.el('span', 'profile-pill', user.location));
    if (user.pronouns) meta.appendChild(UI.el('span', 'profile-pill', user.pronouns));

    const userCasts = store.getState().casts.filter(c => c.author.address === user.address);

    const stats = UI.el('div', 'flex flex-wrap gap-4 text-sm mb-6');
    stats.innerHTML = `
        <span class="text-slate-400"><strong class="text-white">${user.following}</strong> ${copy.profile.following}</span>
        <span class="text-slate-400"><strong class="text-white">${user.followers}</strong> ${copy.profile.followers}</span>
        <span class="text-slate-400"><strong class="text-white">${copy.profile.printsCount(userCasts.length)}</strong></span>
    `;

    const logoutBtn = createButton({ label: copy.actions.logout, variant: 'secondary', className: 'w-full mb-6' });
    logoutBtn.onclick = () => AuthService.logout();

    info.appendChild(name);
    info.appendChild(username);
    info.appendChild(bio);
    if (meta.children.length) info.appendChild(meta);
    info.appendChild(stats);
    info.appendChild(logoutBtn);

    const feedTitle = UI.el('h3', 'ink-section-title', copy.headers.profilePrints);

    container.appendChild(header);
    container.appendChild(info);
    container.appendChild(feedTitle);

    userCasts.forEach(c => container.appendChild(createInkPrintCard(c, {
        onOpenThread: (selected) => store.setState({ view: 'thread', selectedCast: selected }),
        onReply: (hash) => showComposer(hash)
    })));
};
