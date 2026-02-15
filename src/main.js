import { store } from './state/store.js';
import { ApiService } from './services/api.js';
import { Renderer } from './render.js';
import { Logger } from './utils/logger.js';

/**
 * InkSocial Main Entry Point
 */
async function init() {
    Logger.info('Initializing InkSocial...');
    
    // Subscribe to state changes to re-render
    store.subscribe((state) => {
        Renderer.renderApp();
    });

    // Hide loading indicator before initial render if it exists
    const loading = document.getElementById('loading');
    if (loading) loading.style.display = 'none';

    // Fetch initial data
    try {
        await ApiService.fetchInitialCasts();
        // Renderer.renderApp() will be called automatically by the store subscription
    } catch (error) {
        Logger.error('Failed to initialize app', error);
    }
}

// Start the app
init();
