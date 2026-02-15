import { store } from '../state/store.js';
import { UI } from '../utils/ui.js';
import { copy } from '../copy/en.js';
import { createInkPrintCard } from '../components/inkPrintCard.js';
import { showComposer } from '../components/composer.js';

export const renderFeed = (container) => {
    const state = store.getState();
    let casts = [...state.casts];

    // Filter out replies from main feed unless we are in a thread
    casts = casts.filter(c => !c.parentHash);

    // Simulated ranking algorithm
    casts.sort((a, b) => {
        const score = (c) => {
            const hoursSince = (Date.now() - c.timestamp) / 3600000;
            return (c.likes * 2) + (c.recasts * 3) + (c.replies) - (hoursSince * 5);
        };
        return score(b) - score(a);
    });

    const title = UI.el('h2', 'ink-section-title', copy.headers.feedTitle);
    container.appendChild(title);

    if (casts.length === 0) {
        const empty = UI.el('div', 'ink-empty', copy.feed.empty);
        container.appendChild(empty);
        return;
    }

    casts.forEach(cast => {
        container.appendChild(createInkPrintCard(cast, {
            onOpenThread: (selected) => store.setState({ view: 'thread', selectedCast: selected }),
            onReply: (hash) => showComposer(hash)
        }));
    });
};
