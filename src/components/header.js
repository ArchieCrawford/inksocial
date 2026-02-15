import { store } from '../state/store.js';
import { UI } from '../utils/ui.js';
import { createTabList } from './primitives.js';
import { copy } from '../copy/en.js';

export const renderHeader = (container) => {
    const header = UI.el('header', 'ink-header ink-glass safe-top', '', { role: 'banner' });
    const headerInner = UI.el('div', 'ink-header-inner');

    const logoButton = UI.el('button', 'ink-btn ink-btn-ghost', '', { type: 'button', 'aria-label': copy.appName });
    logoButton.onclick = () => store.setState({ view: 'feed', selectedChannel: 'all' });

    const miniLogo = UI.el('img', 'w-8 h-8 rounded-lg', '', { alt: copy.a11y.logoAlt(copy.appName) });
    miniLogo.src = 'https://rosebud.ai/assets/ink-social-logo.webp?0cao';
    const title = UI.el('span', 'ink-header-title', copy.appName);

    logoButton.appendChild(miniLogo);
    logoButton.appendChild(title);
    headerInner.appendChild(logoButton);
    header.appendChild(headerInner);

    if (store.getState().view === 'search') {
        const label = UI.el('div', 'ink-channel-label', copy.headers.streams);
        header.appendChild(label);

        const channels = store.getState().channels.map(ch => ({
            id: ch.id,
            label: ch.name
        }));
        const tablist = createTabList({
            items: channels,
            activeId: store.getState().selectedChannel,
            onChange: (id) => store.setState({ selectedChannel: id })
        });
        const tabWrap = UI.el('div', 'px-4 pb-3');
        tabWrap.appendChild(tablist);
        header.appendChild(tabWrap);
    }

    container.appendChild(header);
};
