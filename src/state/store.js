/**
 * State Management for InkSocial
 */
class Store {
    constructor() {
        this.state = {
            currentUser: null,
            isWalletConnected: false,
            isRegistered: false,
            view: 'feed', // 'feed', 'profile', 'notifications', 'search', 'thread', 'token-search', 'profile-settings', 'token-detail'
            selectedCast: null,
            casts: [],
            notifications: [],
            users: {},
            following: new Set(),
            followersCount: {},
            searchQuery: '',
            tokenSearchQuery: '',
            tokenSearchResults: [],
            tokenSearchStatus: 'idle', // 'idle' | 'loading' | 'error'
            tokenSearchError: null,
            selectedToken: null,
            channels: [
                { id: 'all', name: 'Home', icon: 'home' },
                { id: 'ink', name: 'Ink Ecosystem', icon: 'droplets' },
                { id: 'crypto', name: 'Crypto', icon: 'bitcoin' },
                { id: 'devs', name: 'Developers', icon: 'code' }
            ],
            selectedChannel: 'all'
        };
        this.listeners = [];
    }

    getState() {
        return this.state;
    }

    setState(newState) {
        this.state = { ...this.state, ...newState };
        this.notify();
    }

    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    notify() {
        this.listeners.forEach(listener => listener(this.state));
    }
}

export const store = new Store();
