import { store } from '../state/store.js';
import { UI } from '../utils/ui.js';
import { copy } from '../copy/en.js';
import { ProfileService } from '../services/profile.js';
import { ToastService } from '../components/toast.js';
import { createButton, createInput, createTextarea } from '../components/primitives.js';

const MAX_AVATAR_MB = 2;
const MAX_BANNER_MB = 4;
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Unable to read file'));
    reader.readAsDataURL(file);
});

const validateImage = (file, maxSizeMb) => {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        return 'Please upload a JPG, PNG, or WebP image.';
    }
    const sizeMb = file.size / (1024 * 1024);
    if (sizeMb > maxSizeMb) {
        return `Image must be under ${maxSizeMb}MB.`;
    }
    return null;
};

export const renderProfileSettings = (container) => {
    const user = store.getState().currentUser;
    const address = user?.address;
    if (!address) {
        container.appendChild(UI.el('div', 'ink-empty', 'Connect a wallet to edit your profile.'));
        return;
    }

    const state = {
        isSaving: false,
        avatarFile: null,
        bannerFile: null,
        avatarPreview: user.pfp,
        bannerPreview: user.banner_url || null,
        profile: {
            ...user,
            display_name: user.display_name || user.displayName,
            pfp_url: user.pfp_url || user.pfp
        }
    };

    const header = UI.el('div', 'flex items-center justify-between p-4 border-b border-slate-800');
    const backBtn = UI.el('button', 'ink-btn ink-btn-ghost', `← ${copy.profile.settings}`, { type: 'button' });
    backBtn.onclick = () => store.setState({ view: 'profile' });
    const title = UI.el('h2', 'text-lg font-bold', copy.settings.title);
    header.appendChild(backBtn);
    header.appendChild(title);
    container.appendChild(header);

    const content = UI.el('div', 'settings-content');
    container.appendChild(content);

    const form = UI.el('form', 'settings-form');
    content.appendChild(form);
    form.appendChild(UI.el('h3', 'text-lg font-bold', copy.settings.editProfile));

    const visualsSection = UI.el('div', 'settings-section');
    visualsSection.appendChild(UI.el('h3', 'settings-section-title', copy.settings.sections.visuals));

    const bannerWrap = UI.el('div', 'settings-banner-wrap');
    const bannerPreview = UI.el('div', 'settings-banner');
    const bannerImg = UI.el('img', 'settings-banner-img', '', { alt: 'Banner preview' });
    if (state.bannerPreview) {
        bannerImg.src = state.bannerPreview;
    } else {
        bannerImg.style.display = 'none';
    }
    bannerPreview.appendChild(bannerImg);

    const bannerInput = UI.el('input', 'sr-only', '', { type: 'file', accept: ACCEPTED_IMAGE_TYPES.join(',') });
    const bannerBtn = createButton({ label: copy.settings.upload.change, variant: 'secondary', className: 'settings-upload-btn' });
    bannerBtn.type = 'button';
    bannerBtn.onclick = () => bannerInput.click();
    bannerInput.onchange = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const error = validateImage(file, MAX_BANNER_MB);
        if (error) {
            ToastService.show({ title: 'Banner upload', message: error, type: 'error' });
            return;
        }
        state.bannerFile = file;
        state.bannerPreview = await readFileAsDataUrl(file);
        bannerImg.src = state.bannerPreview;
        bannerImg.style.display = 'block';
    };

    bannerWrap.appendChild(bannerPreview);
    bannerWrap.appendChild(bannerInput);
    bannerWrap.appendChild(bannerBtn);
    visualsSection.appendChild(bannerWrap);

    const avatarWrap = UI.el('div', 'settings-avatar-wrap');
    const avatarPreview = UI.el('div', 'settings-avatar');
    const avatarImg = UI.el('img', 'settings-avatar-img', '', { alt: 'Avatar preview' });
    avatarImg.src = state.avatarPreview;
    avatarPreview.appendChild(avatarImg);

    const avatarInput = UI.el('input', 'sr-only', '', { type: 'file', accept: ACCEPTED_IMAGE_TYPES.join(',') });
    const avatarBtn = createButton({ label: copy.settings.upload.change, variant: 'secondary', className: 'settings-upload-btn' });
    avatarBtn.type = 'button';
    avatarBtn.onclick = () => avatarInput.click();
    avatarInput.onchange = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const error = validateImage(file, MAX_AVATAR_MB);
        if (error) {
            ToastService.show({ title: 'Profile picture', message: error, type: 'error' });
            return;
        }
        state.avatarFile = file;
        state.avatarPreview = await readFileAsDataUrl(file);
        avatarImg.src = state.avatarPreview;
    };

    avatarWrap.appendChild(avatarPreview);
    avatarWrap.appendChild(avatarInput);
    avatarWrap.appendChild(avatarBtn);
    visualsSection.appendChild(avatarWrap);
    form.appendChild(visualsSection);

    const identitySection = UI.el('div', 'settings-section');
    identitySection.appendChild(UI.el('h3', 'settings-section-title', copy.settings.sections.identity));

    const displayNameInput = createInput({ placeholder: copy.settings.fields.displayName, value: state.profile.display_name || '' });
    const usernameInput = createInput({ placeholder: copy.settings.fields.username, value: state.profile.username || '' });
    const applyUsernameLock = (locked) => {
        if (locked) {
            usernameInput.setAttribute('readonly', 'true');
            usernameInput.classList.add('is-readonly');
        } else {
            usernameInput.removeAttribute('readonly');
            usernameInput.classList.remove('is-readonly');
        }
    };
    let usernameLocked = Boolean(state.profile.on_chain_tx_hash);
    applyUsernameLock(usernameLocked);

    identitySection.appendChild(UI.el('label', 'settings-label', copy.settings.fields.displayName));
    identitySection.appendChild(displayNameInput);
    identitySection.appendChild(UI.el('label', 'settings-label', copy.settings.fields.username));
    identitySection.appendChild(usernameInput);
    const usernameHelper = UI.el('p', 'settings-helper', usernameLocked ? copy.settings.helper.usernameLocked : copy.settings.helper.usernameEditable);
    identitySection.appendChild(usernameHelper);
    form.appendChild(identitySection);

    const aboutSection = UI.el('div', 'settings-section');
    aboutSection.appendChild(UI.el('h3', 'settings-section-title', copy.settings.sections.about));
    const bioInput = createTextarea({ placeholder: copy.settings.fields.bio, value: state.profile.bio || '' });
    aboutSection.appendChild(UI.el('label', 'settings-label', copy.settings.fields.bio));
    aboutSection.appendChild(bioInput);
    form.appendChild(aboutSection);

    const optionalSection = UI.el('div', 'settings-section');
    optionalSection.appendChild(UI.el('h3', 'settings-section-title', copy.settings.sections.optional));
    const websiteInput = createInput({ placeholder: copy.settings.fields.website, value: state.profile.website || '' });
    const locationInput = createInput({ placeholder: copy.settings.fields.location, value: state.profile.location || '' });
    const pronounsInput = createInput({ placeholder: copy.settings.fields.pronouns, value: state.profile.pronouns || '' });
    optionalSection.appendChild(UI.el('label', 'settings-label', copy.settings.fields.website));
    optionalSection.appendChild(websiteInput);
    optionalSection.appendChild(UI.el('label', 'settings-label', copy.settings.fields.location));
    optionalSection.appendChild(locationInput);
    optionalSection.appendChild(UI.el('label', 'settings-label', copy.settings.fields.pronouns));
    optionalSection.appendChild(pronounsInput);
    form.appendChild(optionalSection);

    const saveBtn = createButton({ label: copy.settings.save, variant: 'primary', className: 'settings-save' });
    saveBtn.type = 'button';
    saveBtn.onclick = async () => {
        if (state.isSaving) return;
        state.isSaving = true;
        saveBtn.innerText = copy.settings.saving;
        saveBtn.disabled = true;

        const updates = {
            display_name: displayNameInput.value.trim(),
            bio: bioInput.value.trim(),
            website: websiteInput.value.trim(),
            location: locationInput.value.trim(),
            pronouns: pronounsInput.value.trim()
        };

        if (!usernameLocked) {
            const usernameValue = usernameInput.value.trim();
            if (usernameValue && !/^[a-zA-Z0-9_]{3,20}$/.test(usernameValue)) {
                ToastService.show({ title: 'Username', message: 'Use 3-20 letters, numbers, or underscores.', type: 'error' });
                state.isSaving = false;
                saveBtn.disabled = false;
                saveBtn.innerText = copy.settings.save;
                return;
            }
            updates.username = usernameValue;
        }

        const uploads = [];
        if (state.avatarFile) {
            uploads.push({
                kind: 'avatar',
                fileName: state.avatarFile.name,
                fileType: state.avatarFile.type,
                size: state.avatarFile.size,
                dataUrl: state.avatarPreview
            });
        }
        if (state.bannerFile) {
            uploads.push({
                kind: 'banner',
                fileName: state.bannerFile.name,
                fileType: state.bannerFile.type,
                size: state.bannerFile.size,
                dataUrl: state.bannerPreview
            });
        }

        try {
            const result = await ProfileService.saveProfile({ address, updates, uploads });
            const updatedProfile = result.profile || result;
            const normalized = {
                ...store.getState().currentUser,
                ...updatedProfile,
                displayName: updatedProfile.display_name || updatedProfile.displayName || store.getState().currentUser.displayName,
                pfp: updatedProfile.pfp_url || updatedProfile.pfp || store.getState().currentUser.pfp,
                dnsName: updatedProfile.dns_name || updatedProfile.dnsName || store.getState().currentUser.dnsName
            };
            store.setState({ currentUser: normalized });
            ToastService.show({ title: 'Profile saved', message: 'Your settings are updated.', type: 'success' });
        } catch (error) {
            ToastService.show({ title: 'Save failed', message: error.message, type: 'error' });
        } finally {
            state.isSaving = false;
            saveBtn.disabled = false;
            saveBtn.innerText = copy.settings.save;
        }
    };

    form.appendChild(saveBtn);

    ProfileService.fetchProfile(address)
        .then((profile) => {
            state.profile = { ...state.profile, ...profile };
            displayNameInput.value = state.profile.display_name || state.profile.displayName || '';
            usernameInput.value = state.profile.username || '';
            bioInput.value = state.profile.bio || '';
            websiteInput.value = state.profile.website || '';
            locationInput.value = state.profile.location || '';
            pronounsInput.value = state.profile.pronouns || '';
            if (state.profile.pfp_url || state.profile.pfp) {
                avatarImg.src = state.profile.pfp_url || state.profile.pfp;
            }
            if (state.profile.banner_url) {
                bannerImg.src = state.profile.banner_url;
                bannerImg.style.display = 'block';
            }
            usernameLocked = Boolean(state.profile.on_chain_tx_hash);
            applyUsernameLock(usernameLocked);
            usernameHelper.textContent = usernameLocked ? copy.settings.helper.usernameLocked : copy.settings.helper.usernameEditable;
        })
        .catch(() => {
            ToastService.show({ title: 'Profile', message: 'Unable to refresh profile settings.', type: 'error' });
        });
};
