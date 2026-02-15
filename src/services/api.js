import { store } from '../state/store.js';
import { Logger } from '../utils/logger.js';
import { ToastService } from '../components/toast.js';
import { copy } from '../copy/en.js';
import { API_BASE } from '../utils/apiBase.js';

const authHeaders = () => {
    const token = localStorage.getItem('ink_session');
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
};

/**
 * PRODUCTION-READY API INTERFACE
 * Interacts with backend that verifies cryptographic signatures.
 */
export const ApiService = {
    async fetchInitialCasts() {
        try {
            const response = await fetch(`${API_BASE}/casts/feed?limit=50`, { headers: { ...authHeaders() } });
            if (!response.ok) throw new Error(await response.text());
            const data = await response.json();
            const normalized = (data.items || []).map(this.normalizeCast);
            store.setState({ casts: normalized });
        } catch (error) {
            Logger.error('Failed to fetch initial Ink Prints', error);
            ToastService.show({ title: copy.toasts.feedErrorTitle, message: copy.toasts.feedErrorMessage, type: 'error' });
        }
    },

    async sendCast(text, channel = 'all', parentHash = null) {
        try {
            const currentUser = store.getState().currentUser;
            if (!currentUser) {
                ToastService.show({ title: copy.toasts.connectWalletTitle, message: copy.toasts.connectWalletPrintMessage, type: 'error' });
                return;
            }
            const response = await fetch(`${API_BASE}/casts`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...authHeaders()
                },
                body: JSON.stringify({
                    address: currentUser.address,
                    content: text,
                    channel_id: channel,
                    parent_hash: parentHash
                })
            });
            if (!response.ok) throw new Error(await response.text());
            const data = await response.json();
            const newCast = this.normalizeCast(data);
            const currentCasts = store.getState().casts;
            const updatedCasts = currentCasts.map(c => {
                if (parentHash && c.hash === parentHash) {
                    return { ...c, replies: (c.replies || 0) + 1 };
                }
                return c;
            });
            store.setState({ casts: [newCast, ...updatedCasts] });
        } catch (error) {
            Logger.error('Failed to send Ink Print', error);
            ToastService.show({ title: copy.toasts.printFailedTitle, message: error.message, type: 'error' });
        }
    },

    async toggleLike(hash) {
        try {
            const currentUser = store.getState().currentUser;
            if (!currentUser) {
                ToastService.show({ title: copy.toasts.connectWalletTitle, message: copy.toasts.connectWalletLikeMessage, type: 'error' });
                return;
            }
            const response = await fetch(`${API_BASE}/casts/like`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders() },
                body: JSON.stringify({ address: currentUser.address, hash })
            });
            if (!response.ok) throw new Error(await response.text());
            const data = await response.json();
            const updatedCasts = store.getState().casts.map(c => {
                if (c.hash === hash) {
                    return { ...c, likes: data.likes, isLikedByMe: data.isLiked };
                }
                return c;
            });
            store.setState({ casts: updatedCasts });
        } catch (error) {
            Logger.error('Failed to toggle like', error);
            ToastService.show({ title: copy.toasts.likeFailedTitle, message: error.message, type: 'error' });
        }
    },

    async toggleRecast(hash) {
        try {
            const currentUser = store.getState().currentUser;
            if (!currentUser) {
                ToastService.show({ title: copy.toasts.connectWalletTitle, message: copy.toasts.connectWalletReprintMessage, type: 'error' });
                return;
            }
            const response = await fetch(`${API_BASE}/casts/recast`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders() },
                body: JSON.stringify({ address: currentUser.address, hash })
            });
            if (!response.ok) throw new Error(await response.text());
            const data = await response.json();
            const updatedCasts = store.getState().casts.map(c => {
                if (c.hash === hash) {
                    return { ...c, recasts: data.recasts, isRecastedByMe: data.isRecasted };
                }
                return c;
            });
            store.setState({ casts: updatedCasts });
        } catch (error) {
            Logger.error('Failed to toggle reprint', error);
            ToastService.show({ title: copy.toasts.reprintFailedTitle, message: error.message, type: 'error' });
        }
    },

    normalizeCast(cast) {
        const author = cast.author || {
            username: cast.author_username,
            displayName: cast.author_display_name || cast.author_username,
            pfp: cast.author_pfp_url,
            address: cast.author_address,
            dnsName: cast.author_dns_name,
            dns_name: cast.author_dns_name
        };
        return {
            hash: cast.hash,
            author,
            text: cast.content || cast.text,
            timestamp: Number(cast.timestamp),
            replies: cast.reply_count ?? cast.replies ?? 0,
            recasts: cast.recast_count ?? cast.recasts ?? 0,
            likes: cast.like_count ?? cast.likes ?? 0,
            channel: cast.channel_id || cast.channel,
            parentHash: cast.parent_hash || cast.parentHash,
            verified: true,
            isLikedByMe: cast.is_liked || false,
            isRecastedByMe: cast.is_recasted || false
        };
    }
};
