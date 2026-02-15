import { Logger } from '../utils/logger.js';
import { API_BASE } from '../utils/apiBase.js';

const DEFAULT_CHAIN_ID = 57073;

export const TokenService = {
    async searchTokens({ query, chainId = DEFAULT_CHAIN_ID, limit = 20 }) {
        if (!query || query.trim().length === 0) return { items: [] };

        const params = new URLSearchParams({
            q: query.trim(),
            chainId: String(chainId),
            limit: String(limit)
        });

        const response = await fetch(`${API_BASE}/tokens/search?${params.toString()}`);
        if (!response.ok) {
            const message = await response.text();
            Logger.error('Token search failed', message);
            throw new Error('Token search failed');
        }

        const data = await response.json();
        return data.items ? data : { items: data || [] };
    },

    async listTrending({ chainId = DEFAULT_CHAIN_ID, window = '6h', limit = 50, cursor = '' }) {
        const params = new URLSearchParams({
            chainId: String(chainId),
            window,
            limit: String(limit)
        });
        if (cursor) params.set('cursor', cursor);
        const response = await fetch(`${API_BASE}/tokens/trending?${params.toString()}`);
        if (!response.ok) {
            const message = await response.text();
            Logger.error('Token trending failed', message);
            throw new Error('Token trending failed');
        }
        return response.json();
    },

    async listRecent({ chainId = DEFAULT_CHAIN_ID, limit = 50, cursor = '' }) {
        const params = new URLSearchParams({
            chainId: String(chainId),
            limit: String(limit)
        });
        if (cursor) params.set('cursor', cursor);
        const response = await fetch(`${API_BASE}/tokens/recent?${params.toString()}`);
        if (!response.ok) {
            const message = await response.text();
            Logger.error('Token recent failed', message);
            throw new Error('Token recent failed');
        }
        return response.json();
    },

    async getTokenDetail(address) {
        if (!address) throw new Error('Missing token address');
        const response = await fetch(`${API_BASE}/token/${address}`);
        if (!response.ok) {
            const message = await response.text();
            Logger.error('Token detail failed', message);
            throw new Error('Token detail failed');
        }
        return response.json();
    },

    async getTokenChart(address, { range = '7d', limit = 168 } = {}) {
        if (!address) throw new Error('Missing token address');
        const params = new URLSearchParams({ limit: String(limit) });
        if (range) params.set('range', range);
        const response = await fetch(`${API_BASE}/token/${address}/chart?${params.toString()}`);
        if (!response.ok) {
            const message = await response.text();
            Logger.error('Token chart failed', message);
            throw new Error('Token chart failed');
        }
        const data = await response.json();
        return data.items || data || [];
    }
};
