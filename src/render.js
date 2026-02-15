import { store } from './state/store.js';
import { UI } from './utils/ui.js';
import { renderHeader } from './components/header.js';
import { renderNav } from './components/nav.js';
import { renderFab, renderComposerBar } from './components/composer.js';
import { renderLanding } from './pages/landing.js';
import { renderRegistration } from './pages/registration.js';
import { renderFeed } from './pages/feed.js';
import { renderProfile } from './pages/profile.js';
import { renderNotifications } from './pages/notifications.js';
import { renderSearch } from './pages/search.js';
import { renderThread } from './pages/thread.js';
import { renderTokenSearch } from './pages/tokenSearch.js';
import { renderProfileSettings } from './pages/profileSettings.js';
import { renderTokenDetail } from './pages/tokenDetail.js';

export const Renderer = {
    renderApp() {
        const app = document.getElementById('app');
        UI.clear(app);

        const state = store.getState();

        if (!state.isWalletConnected) {
            renderLanding(app);
            return;
        }

        if (!state.isRegistered) {
            renderRegistration(app);
            return;
        }

        renderHeader(app);

        const content = UI.el('main', 'ink-content', '', { role: 'main' });
        app.appendChild(content);

        if (state.view === 'feed') {
            renderFeed(content);
        } else if (state.view === 'profile') {
            renderProfile(content, state.currentUser);
        } else if (state.view === 'notifications') {
            renderNotifications(content);
        } else if (state.view === 'search') {
            renderSearch(content);
        } else if (state.view === 'token-search') {
            renderTokenSearch(content);
        } else if (state.view === 'token-detail') {
            renderTokenDetail(content);
        } else if (state.view === 'profile-settings') {
            renderProfileSettings(content);
        } else if (state.view === 'thread' && state.selectedCast) {
            renderThread(content, state.selectedCast);
        }

        renderNav(app);
        renderComposerBar(app);
        renderFab(app);
    }
};
