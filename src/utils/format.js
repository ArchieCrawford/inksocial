export const shortenAddress = (address, chars = 4) => {
    if (!address) return '';
    const lower = address.toLowerCase();
    if (lower.length <= chars * 2 + 2) return lower;
    return `${lower.slice(0, chars + 2)}…${lower.slice(-chars)}`;
};

export const hashToColor = (value) => {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
        hash = value.charCodeAt(i) + ((hash << 5) - hash);
        hash &= hash;
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue} 70% 55%)`;
};

export const formatUsd = (value, options = {}) => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
    const formatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: options.maximumFractionDigits ?? 2
    });
    return formatter.format(Number(value));
};

export const formatCompact = (value) => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
    const formatter = new Intl.NumberFormat('en-US', {
        notation: 'compact',
        maximumFractionDigits: 2
    });
    return formatter.format(Number(value));
};

export const formatPercent = (value) => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
    const num = Number(value);
    const formatter = new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2
    });
    return `${num > 0 ? '+' : ''}${formatter.format(num)}%`;
};

export const formatHandle = ({ dnsName, dns_name, username, address } = {}) => {
    const resolved = dnsName || dns_name || username || (address ? shortenAddress(address) : '');
    if (!resolved) return '';
    const handle = resolved.startsWith('@') ? resolved.slice(1) : resolved;
    return `@${handle}`;
};
