(function () {
    'use strict';
    const version = '2026.09.14';
    globalThis.__cuterinthCleanup?.();
    globalThis.__cuterinthObserver?.disconnect();
    clearInterval(globalThis.__cuterinthMaintenanceTimer);
    const validTheme = t => t && typeof t.name === 'string' && t.name.trim() && t.vars &&
        typeof t.vars === 'object' && !Array.isArray(t.vars) &&
        Object.entries(t.vars).every(([k, v]) => /^--[\w-]+$/.test(k) && typeof v === 'string');
    function parseData(json) {
        try { const d = JSON.parse(json); if (d && Array.isArray(d.customThemes)) return d; } catch {}
        return null;
    }
    let data = parseData(globalThis.__cuterinthPersistedData) || parseData(localStorage.getItem('modded')) ||
        { customTheme: null, customThemes: [] };
    delete globalThis.__cuterinthPersistedData;
    data.customThemes = data.customThemes.filter(validTheme);
    data.hiddenBundledThemes = Array.isArray(data.hiddenBundledThemes) ? data.hiddenBundledThemes : [];
    if (data.customTheme === 'default') data.customTheme = null;
    for (const theme of globalThis.__cuterinthBundledThemes || []) {
        if (!validTheme(theme) || data.hiddenBundledThemes.includes(theme.name)) continue;
        const index = data.customThemes.findIndex(t => t.name === theme.name);
        const preset = { ...theme, _cuterinthBundled: true };
        if (index === -1) data.customThemes.push(preset);
        else if (data.customThemes[index]._cuterinthBundled) data.customThemes[index] = preset;
    }
    const previousProperties = new Map();
    function clearVars() {
        for (const [k, { value, priority }] of previousProperties) {
            if (value) document.documentElement.style.setProperty(k, value, priority);
            else document.documentElement.style.removeProperty(k);
        }
        previousProperties.clear();
    }
    function applyVars(vars) {
        clearVars();
        const style = document.documentElement.style;
        for (const [k, v] of Object.entries(vars)) {
            previousProperties.set(k, { value: style.getPropertyValue(k), priority: style.getPropertyPriority(k) });
            style.setProperty(k, v);
        }
    }
    function saveData() {
        const json = JSON.stringify(data);
        localStorage.setItem('modded', json);
        try { globalThis.cuterinthPersist?.(json); } catch {}
    }
    const activeTheme = data.customThemes.find(t => t.name === data.customTheme);
    if (activeTheme) applyVars(activeTheme.vars); else data.customTheme = null;
    saveData();
    const stylesheet = document.createElement('style');
    stylesheet.id = 'cuterinth-styles';
    stylesheet.textContent = `
        .cuterinth-theme-card { position:relative; min-width:0; }
        .cuterinth-theme-card > .preview-radio { width:100%; height:100%; }
        .cuterinth-theme-card .cuterinth-delete {
            position:absolute; top:6px; right:6px; width:28px; height:28px; padding:0;
            border:0; border-radius:6px; cursor:pointer; background:var(--color-red-bg,#ff496e33);
            color:var(--color-red,#ff496e); opacity:0; font-size:18px;
        }
        .cuterinth-theme-card:hover .cuterinth-delete,
        .cuterinth-theme-card:focus-within .cuterinth-delete { opacity:1; }
        .cuterinth-delete:focus-visible { outline:2px solid currentColor; outline-offset:2px; }
        .cuterinth-upload { min-height:64px; }
        .cuterinth-status { padding:12px 16px; color:var(--color-secondary); }
        .app-sidebar .ad-parent, .app-sidebar > a[href*="modrinth.host"],
        .app-sidebar > a[href*="modrinth.plus"] { display:none !important; }
        .app-sidebar::after { display:none !important; }
    `;
    document.getElementById('modded-ad-fix')?.remove();
    document.getElementById(stylesheet.id)?.remove();
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json,application/json'; input.hidden = true;
    input.dataset.cuterinthOwned = '';
    input.addEventListener('change', () => {
        const file = input.files[0]; input.value = ''; if (file) uploadTheme(file);
    });
    const nativeStates = new Map();
    let container = null, scheduled = null, resourceStatus = null, resourceTimer = null, stopped = false;
    const diagnostics = { version, maintenanceRuns: 0 };
    function setStatus(message, isError = false) {
        const parent = container?.parentElement;
        if (!parent) return;
        let status = parent.querySelector('.cuterinth-import-status');
        if (!status) {
            status = document.createElement('p'); status.className = 'cuterinth-status cuterinth-import-status';
            status.dataset.cuterinthOwned = ''; parent.appendChild(status);
        }
        status.setAttribute('role', isError ? 'alert' : 'status'); status.textContent = message;
    }
    async function uploadTheme(file) {
        try {
            if (file.size > 1024 * 1024) throw new Error('Theme files must be smaller than 1 MB.');
            const uploaded = JSON.parse(await file.text());
            if (!validTheme(uploaded)) throw new Error('Choose a theme with a name and CSS variables containing text values.');
            if (stopped) return;
            const theme = { name: uploaded.name.trim(), author: uploaded.author, vars: uploaded.vars };
            const index = data.customThemes.findIndex(t => t.name === theme.name);
            if (index === -1) data.customThemes.push(theme); else data.customThemes[index] = theme;
            data.hiddenBundledThemes = data.hiddenBundledThemes.filter(name => name !== theme.name);
            data.customTheme = theme.name; applyVars(theme.vars); saveData(); renderThemes();
            setStatus(`Imported ${theme.name}.`);
        } catch (error) {
            setStatus(error instanceof SyntaxError ? 'This file is not valid JSON.' : error.message, true);
        }
    }
    function syncSelection() {
        if (!container) return;
        for (const button of container.querySelectorAll('.preview-radio')) {
            if (button.classList.contains('cuterinth-upload')) continue;
            const custom = button.dataset.moddedName;
            if (!custom && !nativeStates.has(button)) nativeStates.set(button, {
                selected: button.classList.contains('selected'), pressed: button.getAttribute('aria-pressed'),
                radio: button.querySelector('.radio')?.innerHTML
            });
            const selected = custom ? custom === data.customTheme : !data.customTheme && nativeStates.get(button)?.selected;
            button.classList.toggle('selected', !!selected); button.setAttribute('aria-pressed', String(!!selected));
            const radio = button.querySelector('.radio');
            if (radio) {
                radio.querySelector('circle')?.remove();
                if (selected) {
                    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                    for (const [k, v] of Object.entries({ cx:12, cy:12, r:5, fill:'currentColor' })) circle.setAttribute(k, v);
                    radio.appendChild(circle);
                }
            }
        }
    }
    function createThemeCard(theme, template) {
        // Inherit the current build's scoped preview styling instead of hardcoding a Vue hash.
        const button = template.cloneNode(true);
        button.type = 'button'; button.classList.add('modded-btn'); button.dataset.moddedName = theme.name;
        button.removeAttribute('data-modded-patched'); button.removeAttribute('aria-label');
        button.querySelectorAll('.theme-icon').forEach(icon => icon.remove());
        const preview = button.querySelector('.preview');
        preview.classList.remove('dark-mode', 'light-mode', 'oled-mode');
        for (const [k, v] of Object.entries(theme.vars)) preview.style.setProperty(k, v);
        preview.style.backgroundColor = 'var(--surface-3, #27292e)';
        const label = button.querySelector('.label'), radio = label.querySelector('.radio');
        label.replaceChildren(); if (radio) label.appendChild(radio);
        label.appendChild(document.createTextNode(` ${theme.name}`));
        button.addEventListener('click', () => {
            data.customTheme = theme.name; applyVars(theme.vars); saveData(); syncSelection();
        });
        const card = document.createElement('div');
        card.className = 'cuterinth-theme-card'; card.dataset.cuterinthOwned = '';
        const remove = document.createElement('button');
        remove.type = 'button'; remove.className = 'cuterinth-delete'; remove.textContent = '×';
        remove.setAttribute('aria-label', `Delete ${theme.name} theme`); remove.title = `Delete ${theme.name} theme`;
        remove.addEventListener('click', () => {
            data.customThemes = data.customThemes.filter(t => t.name !== theme.name);
            if (theme._cuterinthBundled) data.hiddenBundledThemes.push(theme.name);
            if (data.customTheme === theme.name) { data.customTheme = null; clearVars(); }
            saveData(); renderThemes();
        });
        card.append(button, remove); return card;
    }
    function renderThemes() {
        if (!container?.isConnected) return;
        const template = container.querySelector('.preview-radio:not(.modded-btn)');
        if (!template?.querySelector('.preview') || !template.querySelector('.label')) return;
        container.querySelectorAll('[data-cuterinth-owned], .modded-btn').forEach(node => node.remove());
        const fragment = document.createDocumentFragment();
        for (const theme of data.customThemes) fragment.appendChild(createThemeCard(theme, template));
        const upload = document.createElement('button');
        upload.type = 'button'; upload.className = 'preview-radio button-base modded-btn cuterinth-upload';
        for (const name of template.getAttributeNames().filter(n => n.startsWith('data-v-'))) upload.setAttribute(name, '');
        upload.dataset.cuterinthOwned = ''; upload.textContent = 'Upload theme';
        upload.addEventListener('click', () => input.click()); fragment.appendChild(upload);
        container.appendChild(fragment); syncSelection();
    }
    function clearResourceStatus() {
        resourceStatus?.remove(); resourceStatus = null; clearInterval(resourceTimer); resourceTimer = null;
    }
    function onClick(event) {
        const button = event.target.closest?.('button'); if (!button) return;
        if (button.matches('.theme-options .preview-radio:not(.modded-btn)')) {
            data.customTheme = null; clearVars();
            for (const [native, state] of nativeStates) state.selected = native === button;
            saveData(); schedule();
        }
        const dialog = button.closest('[role="dialog"]');
        if (dialog && button.querySelector('.lucide-gauge')) {
            clearResourceStatus(); resourceStatus = document.createElement('p');
            resourceStatus.className = 'cuterinth-status'; resourceStatus.dataset.cuterinthOwned = '';
            resourceStatus.setAttribute('role', 'status');
            resourceStatus.textContent = 'Calculating content storage… Large libraries can take a few seconds.';
            dialog.appendChild(resourceStatus);
            const started = Date.now();
            resourceTimer = setInterval(() => {
                const ready = dialog.querySelector('button[aria-label="Check for missing or damaged files and repair them."]');
                if (!dialog.isConnected || ready || Date.now() - started > 30000) clearResourceStatus();
            }, 150);
        } else if (dialog && !button.closest('.theme-options')) clearResourceStatus();
    }
    function maintain() {
        scheduled = null; if (stopped) return; diagnostics.maintenanceRuns++;
        const current = document.querySelector('.theme-options');
        if (current !== container) { container = current; nativeStates.clear(); renderThemes(); }
        else if (container && !container.querySelector('.modded-btn')) renderThemes();
        else if (container) syncSelection();
        const dialog = document.querySelector('[role="dialog"]');
        const label = dialog && [...dialog.querySelectorAll('p.m-0')].find(p => /^Modrinth App \d/.test(p.textContent));
        if (label) label.textContent = label.textContent.replace(/^Modrinth App/, 'Cuterinth App');
    }
    function schedule() { if (!scheduled && !stopped) scheduled = setTimeout(maintain, 50); }
    // Inspect newly mounted settings nodes, without rescanning the page on resource-list changes.
    const observer = new MutationObserver(records => {
        if (container && !container.isConnected) { container = null; nativeStates.clear(); }
        for (const record of records) for (const node of record.addedNodes) {
            if (node.nodeType !== 1 || node.closest('[data-cuterinth-owned]')) continue;
            if (node.matches('.theme-options, [role="dialog"]') || node.querySelector('.theme-options')) {
                schedule(); return;
            }
        }
    });
    function start() {
        document.head.appendChild(stylesheet); document.body.appendChild(input);
        document.addEventListener('click', onClick, true);
        observer.observe(document.body, { childList:true, subtree:true }); maintain();
        globalThis.__cuterinthVersion = version;
    }
    globalThis.__cuterinthObserver = observer;
    globalThis.__cuterinthDiagnostics = diagnostics;
    globalThis.__cuterinthCleanup = () => {
        stopped = true; observer.disconnect(); clearTimeout(scheduled); clearResourceStatus();
        document.removeEventListener('DOMContentLoaded', start); document.removeEventListener('click', onClick, true);
        for (const [button, state] of nativeStates) {
            button.classList.toggle('selected', state.selected);
            if (state.pressed === null) button.removeAttribute('aria-pressed'); else button.setAttribute('aria-pressed', state.pressed);
            if (state.radio && button.querySelector('.radio')) button.querySelector('.radio').innerHTML = state.radio;
        }
        document.querySelectorAll('[data-cuterinth-owned]').forEach(node => node.remove());
        stylesheet.remove(); clearVars(); delete globalThis.__cuterinthVersion;
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true }); else start();
})();
