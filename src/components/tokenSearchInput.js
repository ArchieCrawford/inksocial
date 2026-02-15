import { UI } from '../utils/ui.js';
import { copy } from '../copy/en.js';
import { createInput } from './primitives.js';

const debounce = (fn, wait = 200) => {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), wait);
    };
};

export const createTokenSearchInput = ({ onQueryChange }) => {
    const wrapper = UI.el('div', 'token-search');
    const input = createInput({
        placeholder: copy.tokens.placeholder,
        ariaLabel: copy.tokens.placeholder
    });
    const status = UI.el('p', 'token-search-status', '');

    const debouncedSearch = debounce((value) => onQueryChange?.(value.trim()), 200);
    input.addEventListener('input', (event) => debouncedSearch(event.target.value));

    wrapper.appendChild(input);
    wrapper.appendChild(status);
    return {
        wrapper,
        input,
        status
    };
};
