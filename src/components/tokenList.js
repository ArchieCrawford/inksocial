import { UI } from '../utils/ui.js';
import { copy } from '../copy/en.js';
import { hashToColor, shortenAddress } from '../utils/format.js';

const createTokenRow = (token, { onSelect, onView }) => {
    const row = UI.el('div', 'token-row');
    const button = UI.el('button', 'token-row-main', '', {
        type: 'button',
        'aria-label': `${copy.tokens.select} ${token.symbol || copy.tokens.unknownSymbol}`
    });

    const logo = UI.el('div', 'token-logo');
    const logoUrl = token.market?.logo_url || token.logo_url;
    if (logoUrl) {
        const img = UI.el('img', 'token-logo-img', '', { alt: `${token.symbol || 'Token'} logo` });
        img.src = logoUrl;
        logo.appendChild(img);
    } else {
        const fallback = UI.el('span', 'token-logo-fallback', token.symbol?.[0] || '?');
        logo.style.background = hashToColor(token.address || token.symbol || 'ink');
        logo.appendChild(fallback);
    }

    const details = UI.el('div', 'token-row-details');
    const top = UI.el('div', 'token-row-top');
    const symbol = UI.el('span', 'token-symbol', token.symbol || copy.tokens.unknownSymbol);
    const name = UI.el('span', 'token-name', token.name || copy.tokens.unknownName);
    top.appendChild(symbol);
    top.appendChild(name);

    const bottom = UI.el('div', 'token-row-bottom');
    bottom.appendChild(UI.el('span', 'token-chain', token.chain_name || 'Ink Network'));
    bottom.appendChild(UI.el('span', 'token-address', shortenAddress(token.address)));
    if (token.verified) {
        bottom.appendChild(UI.el('span', 'token-verified', copy.tokens.verified));
    }

    details.appendChild(top);
    details.appendChild(bottom);

    button.appendChild(logo);
    button.appendChild(details);
    button.onclick = () => onSelect?.({
        address: token.address,
        symbol: token.symbol,
        name: token.name,
        decimals: token.decimals,
        logo_url: token.logo_url,
        description: token.description,
        links: token.links || {},
        chain_id: token.chain_id,
        metadata: token.metadata
    });

    const viewBtn = UI.el('button', 'ink-btn ink-btn-secondary token-view-btn', copy.tokens.view, {
        type: 'button',
        'aria-label': `${copy.tokens.view} ${token.symbol || copy.tokens.unknownSymbol}`
    });
    viewBtn.onclick = () => onView?.(token);

    row.appendChild(button);
    row.appendChild(viewBtn);

    return row;
};

export const renderTokenList = ({ tokens, onSelect, onView }) => {
    const list = UI.el('div', 'token-search-list');
    if (!tokens || tokens.length === 0) {
        return list;
    }
    tokens.forEach(token => list.appendChild(createTokenRow(token, { onSelect, onView })));
    return list;
};
