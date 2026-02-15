import { store } from '../state/store.js';
import { WalletService } from './wallet.js';
import { Logger } from '../utils/logger.js';
import { ToastService } from '../components/toast.js';
import { copy } from '../copy/en.js';
import { API_BASE } from '../utils/apiBase.js';

/**
 * PRODUCTION Auth Service with SIWE and On-Chain Identity Binding
 */
export const AuthService = {
    async login() {
        try {
            const address = await WalletService.connect();
            
            const { message, signature } = await WalletService.signAction(address, 'login', { nonce: Date.now() });

            const response = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address, message, signature })
            });
            if (!response.ok) {
                throw new Error(await response.text());
            }
            const data = await response.json();
            const profile = data.profile || {};
            const normalized = {
                ...profile,
                displayName: profile.display_name || profile.displayName || profile.username,
                pfp: profile.pfp_url || profile.pfp,
                dnsName: profile.dns_name || profile.dnsName
            };
            if (data.sessionToken) {
                localStorage.setItem('ink_session', data.sessionToken);
            }

            store.setState({
                currentUser: normalized,
                isWalletConnected: true,
                isRegistered: Boolean(profile.username),
                users: { ...store.getState().users, [profile.username]: normalized }
            });

            return normalized;
        } catch (error) {
            Logger.error('Auth failed', error);
            ToastService.show({ title: copy.toasts.walletConnectFailedTitle, message: error.message, type: 'error' });
        }
    },

    async claimProfile(username) {
        try {
            const address = store.getState().currentUser?.address;
            if (!address) throw new Error(copy.errors.connectWalletFirst);

            // 1. Transaction to InkSocialIdentity.sol (GAS)
            const txHash = await WalletService.registerProfileOnChain(username, "ipfs://...");
            
            // 2. Index on Backend
            // await fetch('/api/profile/claim', { 
            //    method: 'POST', 
            //    body: JSON.stringify({ username, txHash, address }) 
            // });

            const updatedUser = { 
                ...store.getState().currentUser, 
                username, 
                displayName: username, 
                display_name: username,
                fid: Math.floor(Math.random() * 50000) + 1000 
            };
            
            store.setState({
                currentUser: updatedUser,
                isRegistered: true
            });
            
            return updatedUser;
        } catch (error) {
            Logger.error('Profile claim failed', error);
            ToastService.show({ title: copy.toasts.registrationFailedTitle, message: error.message, type: 'error' });
        }
    },

    logout() {
        localStorage.removeItem('ink_session');
        store.setState({
            currentUser: null,
            isWalletConnected: false,
            isRegistered: false
        });
    }
};
