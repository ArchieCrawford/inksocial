import { store } from '../state/store.js';
import { UI } from '../utils/ui.js';
import { copy } from '../copy/en.js';
import { createTokenSearchInput } from '../components/tokenSearchInput.js';
import { renderTokenList } from '../components/tokenList.js';
import { ToastService } from '../components/toast.js';
import { TokenService } from '../services/tokens.js';
import { shortenAddress } from '../utils/format.js';
import { Logger } from '../utils/logger.js';
import { createTabList } from '../components/primitives.js';

const DEFAULT_CHAIN_ID = 57073;
const RECENT_SEARCHES_KEY = 'ink_recent_token_searches';

export const renderTokenSearch = (container) => {
    const title = UI.el('h2', 'ink-section-title', copy.tokens.title);
    const helper = UI.el('p', 'px-4 pb-4 text-slate-400 text-sm', copy.tokens.helper);
    container.appendChild(title);
    container.appendChild(helper);

    const modeTabs = UI.el('div', 'px-4 pb-2');
    const modeState = { value: 'trending' };
    const renderModeTabs = () => {
        UI.clear(modeTabs);
        const tablist = createTabList({
            items: [
                { id: 'trending', label: copy.tokens.tabs.trending },
                { id: 'recent', label: copy.tokens.tabs.recent }
            ],
            activeId: modeState.value,
            onChange: (id) => {
                modeState.value = id;
                resetList();
                loadMore();
            }
        });
        modeTabs.appendChild(tablist);
    };
    renderModeTabs();
    container.appendChild(modeTabs);

    const selected = store.getState().selectedToken;
    if (selected) {
        const selectedCard = UI.el('div', 'token-selected');
        selectedCard.innerHTML = `
            <div class="token-selected-title">${copy.tokens.selectedTitle}</div>
            <div class="token-selected-meta">${selected.symbol} · ${shortenAddress(selected.address)}</div>
        `;
        container.appendChild(selectedCard);
    }

    const listState = {
        query: '',
        tokens: [],
        searchResults: [],
        cursor: '',
        hasMore: true,
        isLoading: false
    };

    const { wrapper: searchWrapper, status, input } = createTokenSearchInput({
        onQueryChange: (query) => {
            listState.query = query;
            if (!query) {
                renderRecentSearches();
                renderList();
                return;
            }
            runSearch(query);
        }
    });
    container.appendChild(searchWrapper);

    const recentWrap = UI.el('div', 'token-search-recent');
    container.appendChild(recentWrap);

    const listWrap = UI.el('div', 'token-list-wrap');
    container.appendChild(listWrap);

    const loadMoreBtn = UI.el('button', 'ink-btn ink-btn-secondary token-load-more', copy.tokens.loadMore, { type: 'button' });
    loadMoreBtn.onclick = () => loadMore();

    const applySelect = (token) => {
        store.setState({ selectedToken: token });
        ToastService.show({
            title: copy.tokens.selectedToastTitle,
            message: `${token.symbol || copy.tokens.unknownSymbol} · ${shortenAddress(token.address)}`,
            type: 'success'
        });
    };

    const applyView = (token) => {
        store.setState({ selectedToken: token, view: 'token-detail' });
    };

    const renderList = () => {
        UI.clear(listWrap);
        const tokens = listState.query ? listState.searchResults : listState.tokens;
        if (!tokens || tokens.length === 0) {
            status.textContent = listState.query ? copy.tokens.empty : copy.tokens.emptyState;
            return;
        }
        status.textContent = '';
        listWrap.appendChild(renderTokenList({ tokens, onSelect: applySelect, onView: applyView }));
        if (!listState.query && listState.hasMore) {
            listWrap.appendChild(loadMoreBtn);
        }
    };

    const resetList = () => {
        listState.tokens = [];
        listState.cursor = '';
        listState.hasMore = true;
    };

    const loadMore = async () => {
        if (listState.isLoading || !listState.hasMore) return;
        listState.isLoading = true;
        status.textContent = copy.tokens.loading;
        try {
            const result = modeState.value === 'trending'
                ? await TokenService.listTrending({
                    chainId: DEFAULT_CHAIN_ID,
                    window: '6h',
                    limit: 20,
                    cursor: listState.cursor
                })
                : await TokenService.listRecent({
                    chainId: DEFAULT_CHAIN_ID,
                    limit: 20,
                    cursor: listState.cursor
                });
            const items = result.items || [];
            listState.tokens = listState.tokens.concat(items);
            listState.cursor = result.nextCursor || '';
            listState.hasMore = Boolean(listState.cursor);
        } catch (error) {
            Logger.error('Token list failed', error);
            status.textContent = copy.tokens.error;
        } finally {
            listState.isLoading = false;
            renderList();
        }
    };

    const saveRecentSearch = (value) => {
        const trimmed = value.trim();
        if (!trimmed) return;
        const existing = getRecentSearches().filter(item => item !== trimmed);
        const next = [trimmed, ...existing].slice(0, 6);
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
    };

    const getRecentSearches = () => {
        try {
            const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    };

    const renderRecentSearches = () => {
        UI.clear(recentWrap);
        if (listState.query) return;
        const recent = getRecentSearches();
        const titleEl = UI.el('div', 'token-search-recent-title', copy.tokens.recentSearchesTitle);
        recentWrap.appendChild(titleEl);
        if (recent.length === 0) {
            recentWrap.appendChild(UI.el('div', 'token-search-recent-empty', copy.tokens.recentSearchesEmpty));
            return;
        }
        const chips = UI.el('div', 'token-search-recent-chips');
        recent.forEach((term) => {
            const chip = UI.el('button', 'token-search-chip', term, { type: 'button' });
            chip.onclick = () => {
                input.value = term;
                listState.query = term;
                runSearch(term);
            };
            chips.appendChild(chip);
        });
        recentWrap.appendChild(chips);
    };

    const runSearch = async (query) => {
        status.textContent = copy.tokens.searching;
        try {
            const result = await TokenService.searchTokens({ query, chainId: DEFAULT_CHAIN_ID, limit: 20 });
            listState.searchResults = result.items || [];
            saveRecentSearch(query);
        } catch (error) {
            Logger.error('Token search failed', error);
            listState.searchResults = [];
            status.textContent = copy.tokens.error;
        } finally {
            renderList();
        }
    };

    renderRecentSearches();
    status.textContent = copy.tokens.loading;
    loadMore();
};
