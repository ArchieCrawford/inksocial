import { Logger } from '../utils/logger.js';
import { copy } from '../copy/en.js';

/**
 * PRODUCTION-STYLE WALLET LAYER
 * Handles both gasless signing (Viem) and gas-required transactions.
 */
export const WalletService = {
    async connect() {
        if (!window.ethereum) throw new Error(copy.errors.noWallet);
        
        Logger.info('[Wallet] Requesting account connection...');
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        const address = accounts[0];

        // Ensure we are on Ink Network
        await this.switchChain();

        Logger.info(`[Wallet] Connected: ${address}`);
        return address;
    },

    async switchChain() {
        const INK_CHAIN_ID = '0xDE91'; // 57073 in hex
        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: INK_CHAIN_ID }],
            });
        } catch (switchError) {
            // This error code indicates that the chain has not been added to MetaMask.
            if (switchError.code === 4902) {
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId: INK_CHAIN_ID,
                        chainName: 'Ink Network',
                        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
                        rpcUrls: ['https://rpc-mainnet.inkonchain.com'],
                        blockExplorerUrls: ['https://explorer.inkonchain.com']
                    }],
                });
            }
        }
    },

    /**
     * Gasless Social Action Signing (Off-chain)
     */
    async signAction(address, type, data) {
        Logger.info(`[Wallet] Requesting signature for ${type}...`);
        
        // Structure the payload for SIWE or EIP-712
        const message = JSON.stringify({
            action: type,
            data: data,
            nonce: Math.random().toString(36).substring(7),
            issuedAt: new Date().toISOString()
        });

        const signature = await window.ethereum.request({
            method: 'personal_sign',
            params: [message, address],
        });

        return { message, signature };
    },

    async signMessage(message) {
        let accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (!accounts || accounts.length === 0) {
            await this.connect();
            accounts = await window.ethereum.request({ method: 'eth_accounts' });
        }
        const address = accounts[0];
        if (!address) throw new Error('Wallet not connected');
        Logger.info('[Wallet] Signing message for profile update...');
        const signature = await window.ethereum.request({
            method: 'personal_sign',
            params: [message, address]
        });
        return signature;
    },

    /**
     * Gas-required Transaction (On-chain Registration)
     */
    async registerProfileOnChain(username, metadataUri) {
        const IDENTITY_CONTRACT = '0x0000000000000000000000000000000000000000'; // Placeholder
        
        Logger.info(`[Contract] Executing register('${username}')...`);
        
        // Mocking the contract call for the buildless environment
        // In reality, this would use viem's writeContract or ethers' Contract.register
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        
        const txParams = {
            from: accounts[0],
            to: IDENTITY_CONTRACT,
            data: '0x', // Function selector + encoded params for register(string,string)
            gas: '0x30D40' // 200,000 gas
        };

        const txHash = await window.ethereum.request({
            method: 'eth_sendTransaction',
            params: [txParams],
        });

        Logger.info(`[Contract] Transaction sent: ${txHash}`);
        return txHash;
    }
};
