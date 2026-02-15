import { UI } from '../utils/ui.js';
import { copy } from '../copy/en.js';
import { createButton } from '../components/primitives.js';
import { AuthService } from '../services/auth.js';

export const renderLanding = (container) => {
    const landing = UI.el('section', 'flex-1 flex flex-col items-center justify-center p-8 text-center');

    const logo = UI.el('img', 'w-28 h-28 mb-6 rounded-3xl shadow-2xl border border-indigo-500/30');
    logo.src = 'https://rosebud.ai/assets/ink-social-logo.webp?0cao';
    logo.alt = copy.a11y.logoAlt(copy.appName);

    const title = UI.el('h1', 'text-4xl font-bold mb-4 tracking-tight', copy.landing.title);
    const desc = UI.el('p', 'text-slate-400 mb-10 max-w-sm', copy.landing.description);

    const loginBtn = createButton({
        label: copy.actions.connectWallet,
        variant: 'primary',
        className: 'w-full max-w-xs'
    });
    loginBtn.onclick = () => AuthService.login();

    landing.appendChild(logo);
    landing.appendChild(title);
    landing.appendChild(desc);
    landing.appendChild(loginBtn);
    container.appendChild(landing);
};
