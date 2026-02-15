import { store } from '../state/store.js';
import { UI } from '../utils/ui.js';
import { copy } from '../copy/en.js';
import { createInput } from '../components/primitives.js';
import { createInkPrintCard } from '../components/inkPrintCard.js';
import { showComposer } from '../components/composer.js';
import { formatHandle } from '../utils/format.js';

export const renderSearch = (container) => {
    const state = store.getState();
    const searchBox = UI.el('div', 'p-4 border-b border-slate-800');
    const input = createInput({
        placeholder: copy.search.placeholder,
        value: state.searchQuery,
        ariaLabel: copy.search.placeholder,
        onInput: (event) => store.setState({ searchQuery: event.target.value })
    });

    searchBox.appendChild(input);
    container.appendChild(searchBox);

    const query = state.searchQuery.toLowerCase();
    const results = state.casts.filter(c => {
        const handle = formatHandle({
            dnsName: c.author.dnsName,
            dns_name: c.author.dns_name,
            username: c.author.username,
            address: c.author.address
        }).toLowerCase();
        const address = (c.author.address || '').toLowerCase();
        const matchesQuery =
            c.text.toLowerCase().includes(query) ||
            c.author.username.toLowerCase().includes(query) ||
            (c.author.dnsName || c.author.dns_name || '').toLowerCase().includes(query) ||
            handle.includes(query) ||
            address.includes(query.replace('@', ''));
        if (!matchesQuery) return false;
        if (state.selectedChannel === 'all') return true;
        return c.channel === state.selectedChannel;
    });

    if (state.searchQuery && results.length > 0) {
        results.forEach(c => container.appendChild(createInkPrintCard(c, {
            onOpenThread: (selected) => store.setState({ view: 'thread', selectedCast: selected }),
            onReply: (hash) => showComposer(hash)
        })));
    } else if (state.searchQuery) {
        container.appendChild(UI.el('div', 'ink-empty', copy.search.empty));
    }
};
