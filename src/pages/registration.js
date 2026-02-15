import { UI } from '../utils/ui.js';
import { copy } from '../copy/en.js';
import { createButton, createInput } from '../components/primitives.js';
import { AuthService } from '../services/auth.js';

export const renderRegistration = (container) => {
    const reg = UI.el('section', 'flex-1 flex flex-col p-8');
    const title = UI.el('h2', 'text-3xl font-bold mb-2', copy.registration.title);
    const desc = UI.el('p', 'text-slate-400 mb-8', copy.registration.description);

    const inputWrap = UI.el('div', 'mb-6');
    const label = UI.el('label', 'block text-sm font-medium text-slate-400 mb-2', copy.registration.usernameLabel);
    const input = createInput({ placeholder: copy.registration.usernamePlaceholder });

    inputWrap.appendChild(label);
    inputWrap.appendChild(input);

    const claimBtn = createButton({
        label: copy.actions.claimProfile,
        variant: 'primary',
        className: 'w-full'
    });
    claimBtn.onclick = async () => {
        const username = input.value.trim();
        if (!username) return;
        claimBtn.disabled = true;
        claimBtn.innerText = copy.actions.confirmTx;
        await AuthService.claimProfile(username);
    };

    const cancelBtn = createButton({
        label: copy.actions.cancel,
        variant: 'ghost',
        className: 'mt-4 w-full'
    });
    cancelBtn.onclick = () => AuthService.logout();

    reg.appendChild(title);
    reg.appendChild(desc);
    reg.appendChild(inputWrap);
    reg.appendChild(claimBtn);
    reg.appendChild(cancelBtn);
    container.appendChild(reg);
};

