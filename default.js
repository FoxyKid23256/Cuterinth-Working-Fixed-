(function () {
    let data = localStorage.getItem('modded');

    if (!data) { // saving everything inside localStorage cause why not
        data = {
            customTheme: null,
            customThemes: [
                {
                    name: 'default',
                    author: 'Modrinth App',
                    vars: defaultThemeVars()
                }
            ],
        };
        localStorage.setItem('modded', JSON.stringify(data));
    } else {
        data = JSON.parse(data);
        if (data.customTheme === 'default') data.customTheme = null;
    }

    let inlinedProps = [];

    function applyVars(vars) {
        inlinedProps = Object.keys(vars);
        for (const [prop, val] of Object.entries(vars)) {
            document.documentElement.style.setProperty(prop, val);
        }
    }

    function clearInlinedVars() {
        for (const prop of inlinedProps) {
            document.documentElement.style.removeProperty(prop);
        }
        inlinedProps = [];
    }

    if (data.customTheme) {
        const activeTheme = data.customThemes.find(t => t.name === data.customTheme);
        if (activeTheme) applyVars(activeTheme.vars);
        else data.customTheme = null;
    }

    const svgRadioSelected =
        `<svg data-v-ad9dd354="" xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" class="radio shrink-0">` +
        `<path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8"></path>` +
        `<circle cx="12" cy="12" r="5" fill="currentColor"></circle></svg>`;
    const svgRadioEmpty =
        `<svg data-v-ad9dd354="" xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" class="radio shrink-0">` +
        `<path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8"></path></svg>`;

    function resolveVar(vars, key) {
        let v = vars[key];
        if (!v) return null;
        const m = v.match(/^var\((--[\w-]+)\)$/);
        if (m && vars[m[1]]) v = vars[m[1]];
        return v;
    }

    function updateRadios(container) {
        container.querySelectorAll('.modded-btn').forEach(btn => {
            const label = btn.querySelector('.label');
            if (!label) return;
            const radio = label.querySelector('svg.radio');
            if (radio) radio.outerHTML = btn.classList.contains('selected') ? svgRadioSelected : svgRadioEmpty;
        });
    }

    function createCustomButton(theme) {
        const isSelected = data.customTheme === theme.name;
        const v = theme.vars;

        const bgSurface1  = resolveVar(v, '--surface-1')           || '#16181c';
        const bgSurface3  = resolveVar(v, '--surface-3')           || '#27292e';
        const btnBg       = resolveVar(v, '--color-button-bg')
                         || resolveVar(v, '--surface-4')           || '#34363c';
        const textDefault = resolveVar(v, '--color-text-default')  || '#b0bac5';
        const textTert    = resolveVar(v, '--color-text-tertiary') || '#96a2b0';

        const btn = document.createElement('button');
        btn.setAttribute('data-v-ad9dd354', '');
        btn.className = 'preview-radio button-base modded-btn' + (isSelected ? ' selected' : '');
        btn.dataset.moddedName = theme.name;

        btn.style.position = 'relative';

        btn.innerHTML =
            `<div data-v-ad9dd354="" class="preview" ` +
                `style="background-color:${bgSurface3};` +
                       `--color-button-bg:${btnBg};` +
                       `--color-base:${textDefault};` +
                       `--color-secondary:${textTert}">` +
                `<div data-v-ad9dd354="" class="example-card card card" style="background-color:${bgSurface1}">` +
                    `<div data-v-ad9dd354="" class="example-icon"></div>` +
                    `<div data-v-ad9dd354="" class="example-text-1"></div>` +
                    `<div data-v-ad9dd354="" class="example-text-2"></div>` +
                `</div>` +
            `</div>` +
            `<div data-v-ad9dd354="" class="label">` +
                (isSelected ? svgRadioSelected : svgRadioEmpty) +
                ` ${theme.name}` +
            `</div>`;

        const deleteBtn = document.createElement('button');
        deleteBtn.title = 'Delete theme';
        deleteBtn.innerHTML =
            `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">` +
            `<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;
        deleteBtn.style.cssText =
            'position:absolute;top:6px;right:6px;' +
            'width:26px;height:26px;border-radius:6px;border:none;cursor:pointer;' +
            'display:flex;align-items:center;justify-content:center;' +
            'background:var(--color-red-bg,#ff496e33);color:var(--color-red,#ff496e);' +
            'opacity:0;transition:opacity .15s;pointer-events:none;z-index:1';

        btn.addEventListener('mouseenter', () => { deleteBtn.style.opacity = '1'; deleteBtn.style.pointerEvents = 'auto'; });
        btn.addEventListener('mouseleave', () => { deleteBtn.style.opacity = '0'; deleteBtn.style.pointerEvents = 'none'; });

        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            data.customThemes = data.customThemes.filter(t => t.name !== theme.name);
            if (data.customTheme === theme.name) {
                data.customTheme = null;
                clearInlinedVars();
            }
            localStorage.setItem('modded', JSON.stringify(data));
            injectCustomThemes();
        });

        btn.appendChild(deleteBtn);

        btn.addEventListener('click', () => {
            const container = btn.closest('.theme-options');
            container.querySelectorAll('.preview-radio').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            updateRadios(container);
            data.customTheme = theme.name;
            localStorage.setItem('modded', JSON.stringify(data));
            applyVars(theme.vars);
        });

        return btn;
    }

    function handleThemeUpload(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            let theme;
            try {
                theme = JSON.parse(e.target.result);
            } catch {
                return;
            }

            if (!theme.name || typeof theme.name !== 'string') {
                return;
            }
            if (!theme.vars || typeof theme.vars !== 'object') {
                return;
            }

            const existingIndex = data.customThemes.findIndex(t => t.name === theme.name);
            if (existingIndex !== -1) {
                data.customThemes[existingIndex] = theme;
            } else {
                data.customThemes.push(theme);
            }

            data.customTheme = theme.name;
            localStorage.setItem('modded', JSON.stringify(data));
            applyVars(theme.vars);

            lastContainer = null;
            injectCustomThemes();
        };
        reader.readAsText(file);
    }

    function createUploadButton() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.style.display = 'none';
        input.addEventListener('change', () => {
            if (input.files[0]) handleThemeUpload(input.files[0]);
            input.value = '';
        });
        document.body.appendChild(input);

        const btn = document.createElement('button');
        btn.setAttribute('data-v-ad9dd354', '');
        btn.className = 'preview-radio button-base modded-btn modded-upload-wrap';

        const uploadIcon =
            `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:.4rem;flex-shrink:0">` +
            `<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`;

        btn.innerHTML =
            `<div data-v-ad9dd354="" class="label" style="justify-content:center;opacity:.7">` +
                uploadIcon +
                `<b>Upload Theme` +
            `</div>`;

        btn.addEventListener('click', () => input.click());
        return btn;
    }

    let observerRoot = null;

    const observer = new MutationObserver(() => {
        const container = document.querySelector('.theme-options');
        if (container && !container.querySelector('.modded-btn')) {
            injectCustomThemes();
        }

        removeAds();
        patchAppVersion();
    });

    function injectCustomThemes() {
        const container = document.querySelector('.theme-options');
        if (!container) return;

        observer.disconnect();

        container.querySelectorAll('.modded-btn').forEach(el => el.remove());

        if (data.customTheme) {
            container.querySelectorAll('.preview-radio:not(.modded-btn)')
                .forEach(b => b.classList.remove('selected'));
        }

        container.querySelectorAll('.preview-radio:not(.modded-btn)').forEach(btn => {
            if (btn.dataset.moddedPatched) return;
            btn.dataset.moddedPatched = '1';
            btn.addEventListener('click', () => {
                data.customTheme = null;
                localStorage.setItem('modded', JSON.stringify(data));
                clearInlinedVars();
                container.querySelectorAll('.modded-btn')
                    .forEach(b => b.classList.remove('selected'));
            });
        });

        for (const theme of data.customThemes) {
            container.appendChild(createCustomButton(theme));
        }

        container.appendChild(createUploadButton());

        if (observerRoot) observer.observe(observerRoot, { childList: true, subtree: true });
    }

    function patchAppVersion() {
        const el = [...document.querySelectorAll("p.m-0")]
            .find(p => p.textContent.startsWith("Modrinth App"));

        if (!el) return;

        const match = el.textContent.match(/Modrinth App (.+)/);
        if (!match) return;

        const version = match[1];
        el.textContent = `Cuterinth App ${version}`;
    }

    function removeAds() { // rip ads
        const selectors = [
            '#app > div.app-contents.experimental-styles-within.sidebar-enabled > div.app-sidebar.mt-px.shrink-0.flex.flex-col.border-0.border-l-\\[1px\\].border-\\[--brand-gradient-border\\].border-solid.overflow-auto > div.ad-parent.relative.flex.w-full.justify-center.cursor-pointer.bg-bg',
            '#app > div.app-contents.experimental-styles-within.sidebar-enabled > div.app-sidebar.mt-px.shrink-0.flex.flex-col.border-0.border-l-\\[1px\\].border-\\[--brand-gradient-border\\].border-solid.overflow-auto > a'
        ];

        for (const selector of selectors) {
            const el = document.querySelector(selector);
            if (el) el.remove();
        }

        if (!document.getElementById('modded-ad-fix')) {
            const style = document.createElement('style');
            style.id = 'modded-ad-fix';
            style.textContent = '.app-sidebar::after { display: none !important; }';
            document.head.appendChild(style);
        }
    }

    function start() {
        try {
            observerRoot = document.getElementById('app') || document.body;
            observer.observe(observerRoot, { childList: true, subtree: true });
            
            injectCustomThemes();
            patchAppVersion();
            removeAds();
        } catch (e) {
            console.error('[Cuterinth] An error occurred while initializing:', e);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }

})();