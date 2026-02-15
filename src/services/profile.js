import { Logger } from '../utils/logger.js';
import { WalletService } from './wallet.js';
import { API_BASE } from '../utils/apiBase.js';

const hashPayload = async (payload) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(payload));
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
};

const buildMessage = ({ address, nonce, issuedAt, payloadHash }) => {
    return [
        'InkSocial Profile Update',
        `Address: ${address}`,
        `Nonce: ${nonce}`,
        `Issued At: ${issuedAt}`,
        `Payload: ${payloadHash}`
    ].join('\n');
};

export const ProfileService = {
    async fetchProfile(address) {
        const response = await fetch(`${API_BASE}/profile?address=${encodeURIComponent(address)}`);
        if (!response.ok) {
            const message = await response.text();
            Logger.error('Profile fetch failed', message);
            throw new Error('Unable to load profile settings.');
        }
        return response.json();
    },

    async saveProfile({ address, updates, uploads }) {
        const nonceResponse = await fetch(`${API_BASE}/profile/nonce`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address })
        });
        if (!nonceResponse.ok) {
            throw new Error('Unable to start profile update.');
        }
        const { nonce, issuedAt } = await nonceResponse.json();

        const payload = {
            updates,
            uploads: uploads?.map(({ kind, fileName, fileType, size }) => ({
                kind,
                fileName,
                fileType,
                size
            })) || []
        };
        const payloadHash = await hashPayload(payload);
        const message = buildMessage({ address, nonce, issuedAt, payloadHash });
        const signature = await WalletService.signMessage(message);

        const response = await fetch(`${API_BASE}/profile/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                address,
                updates,
                uploads,
                nonce,
                issuedAt,
                payloadHash,
                signature,
                message
            })
        });

        if (!response.ok) {
            const messageText = await response.text();
            Logger.error('Profile update failed', messageText);
            throw new Error('Unable to save profile.');
        }

        return response.json();
    }
};
