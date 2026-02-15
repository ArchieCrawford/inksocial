import { store } from '../state/store.js';
import { UI, Icons } from '../utils/ui.js';
import { copy } from '../copy/en.js';

export const renderNav = (container) => {
    const nav = UI.el('nav', 'ink-nav ink-glass safe-bottom', '', { 'aria-label': copy.a11y.primaryNav });

    const items = [
        { id: 'feed', icon: Icons.home, label: copy.nav.feed },
        { id: 'search', icon: Icons.search, label: copy.nav.search },
        { id: 'token-search', icon: Icons.bitcoin, label: copy.nav.tokens },
        { id: 'notifications', icon: Icons.bell, label: copy.nav.notifications },
        { id: 'profile', icon: Icons.user, label: copy.nav.profile }
    ];

    items.forEach(item => {
        const isActive = store.getState().view === item.id;
        const btn = UI.el('button', `ink-nav-button ${isActive ? 'is-active' : ''}`, '', {
            type: 'button',
            'aria-label': item.label,
            'aria-current': isActive ? 'page' : 'false'
        });
        btn.innerHTML = item.icon;
        const label = UI.el('span', 'sr-only', item.label);
        btn.appendChild(label);
        btn.onclick = () => store.setState({ view: item.id });
        nav.appendChild(btn);
    });

    container.appendChild(nav);
};
