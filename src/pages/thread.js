import { store } from '../state/store.js';
import { UI } from '../utils/ui.js';
import { copy } from '../copy/en.js';
import { createInkPrintCard } from '../components/inkPrintCard.js';
import { showComposer } from '../components/composer.js';

export const renderThread = (container, rootCast) => {
    const backBtn = UI.el('button', 'flex items-center gap-2 p-4 text-slate-400 hover:text-white', '', {
        type: 'button',
        'aria-label': copy.thread.back
    });
    backBtn.innerHTML = `← <span class="font-bold">${copy.thread.back}</span>`;
    backBtn.onclick = () => store.setState({ view: 'feed', selectedCast: null });
    container.appendChild(backBtn);

    container.appendChild(createInkPrintCard(rootCast, { isThreadHead: true, onReply: (hash) => showComposer(hash) }));

    const stats = UI.el('div', 'px-4 py-3 border-b border-slate-800 flex gap-4 text-sm text-slate-500');
    stats.innerHTML = `<span><strong>${rootCast.recasts}</strong> ${copy.thread.reprints}</span> <span><strong>${rootCast.likes}</strong> ${copy.thread.likes}</span>`;
    container.appendChild(stats);

    const replies = store.getState().casts.filter(c => c.parentHash === rootCast.hash);
    replies.forEach(reply => container.appendChild(createInkPrintCard(reply, {
        onOpenThread: (selected) => store.setState({ view: 'thread', selectedCast: selected }),
        onReply: (hash) => showComposer(hash)
    })));
};

