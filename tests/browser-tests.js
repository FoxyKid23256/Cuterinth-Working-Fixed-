(async function () {
    const frame = document.createElement('iframe');
    frame.hidden = true;
    document.body.appendChild(frame);
    const win = frame.contentWindow;
    const doc = win.document;
    const results = [];
    const check = (condition, message) => { if (!condition) throw new Error(message); results.push(message); };
    const pause = () => new Promise(resolve => setTimeout(resolve, 100));
    let stored = JSON.stringify({ customTheme: 'First', customThemes: [
        { name: 'First', vars: { '--test-first': 'red', '--test-shared': 'red' } },
        { name: 'Second', vars: { '--test-shared': 'blue' } }
    ] });
    Object.defineProperty(win, 'localStorage', { value: { getItem: () => stored, setItem: (key, value) => { stored = value; } } });
    const fixture = `<div role="dialog"><button id="resource"><svg class="lucide-gauge"></svg>Resource management</button>
        <div class="theme-options"><button data-v-current type="button" class="preview-radio selected" aria-pressed="true">
        <div data-v-current class="preview dark-mode"><div data-v-current class="example-card"></div></div>
        <div data-v-current class="label"><svg data-v-current class="radio"><circle cx="12" cy="12" r="5" /></svg>Dark</div></button></div></div>`;
    const run = () => {
        const globalThis = win, document = doc, localStorage = win.localStorage, MutationObserver = win.MutationObserver;
        /* CUTERINTH_SOURCE */
    };
    const select = name => [...doc.querySelectorAll('[data-modded-name]')].find(button => button.dataset.moddedName === name).click();
    const upload = async json => {
        const transfer = new win.DataTransfer();
        transfer.items.add(new win.File([json], 'theme.json', { type: 'application/json' }));
        const input = doc.querySelector('input[type=file]');
        input.files = transfer.files; input.dispatchEvent(new win.Event('change')); await pause();
    };
    try {
        doc.body.innerHTML = fixture;
        doc.documentElement.style.setProperty('--test-shared', 'green', 'important');
        win.__cuterinthBundledThemes = [{ name: 'Preset', vars: { '--test-preset': 'black' } }];
        run(); await pause();
        check(doc.querySelectorAll('[data-modded-name]').length === 3, 'Bundled and imported themes render');
        check(doc.querySelector('.modded-btn .preview').hasAttribute('data-v-current'), 'Preview inherits current Modrinth scope');
        check(!doc.querySelector('button button'), 'Delete controls are not nested buttons');
        select('Second');
        check(!doc.documentElement.style.getPropertyValue('--test-first'), 'Switching removes previous theme-only variables');
        check(doc.documentElement.style.getPropertyValue('--test-shared') === 'blue', 'Selected theme applies');
        doc.querySelector('.preview-radio:not(.modded-btn)').click(); await pause();
        check(doc.documentElement.style.getPropertyValue('--test-shared') === 'green' && doc.documentElement.style.getPropertyPriority('--test-shared') === 'important', 'Native theme restores original inline values and priorities');
        check(!doc.querySelector('.modded-btn[aria-pressed=true]'), 'Native theme clears custom selection accessibility state');
        await upload('null');
        check(!!doc.querySelector('[role=alert]'), 'Invalid theme import shows an error');
        await upload(JSON.stringify({ name: '<b>Partial</b>', vars: { '--test-upload': 'pink' }, _cuterinthBundled: true }));
        check(JSON.parse(stored).customTheme === '<b>Partial</b>' && !doc.querySelector('.modded-btn .label b'), 'Imports treat names as text and select the theme');
        check(!JSON.parse(stored).customThemes.find(t => t.name === '<b>Partial</b>')._cuterinthBundled, 'Imported files cannot impersonate bundled themes');
        doc.querySelector('[aria-label="Delete Preset theme"]').click();
        run(); await pause();
        check(!JSON.parse(stored).customThemes.some(t => t.name === 'Preset'), 'Deleted preset stays deleted after reinjection');
        check(doc.querySelectorAll('input[type=file]').length === 1 && doc.querySelectorAll('#cuterinth-styles').length === 1, 'Reinjection leaves one file picker and stylesheet');
        select('First');
        check(JSON.parse(stored).customTheme === 'First', 'Controls remain live after reinjection');
        const before = win.__cuterinthDiagnostics.maintenanceRuns;
        for (let i = 0; i < 100; i++) { const p = doc.createElement('p'); p.textContent = String(i); doc.body.appendChild(p); }
        await pause();
        check(win.__cuterinthDiagnostics.maintenanceRuns === before, 'Resource-list changes do not trigger whole-page maintenance');
        doc.querySelector('#resource').click();
        check(!!doc.querySelector('[role=status]'), 'Resource management immediately shows loading feedback');
        const ready = doc.createElement('button');
        ready.setAttribute('aria-label', 'Check for missing or damaged files and repair them.');
        doc.querySelector('[role=dialog]').appendChild(ready);
        await new Promise(resolve => setTimeout(resolve, 250));
        check(!doc.querySelector('.cuterinth-status:not(.cuterinth-import-status)'), 'Loading feedback clears when resource controls appear');
        doc.querySelector('[role=dialog]').remove(); await pause();
        doc.body.insertAdjacentHTML('beforeend', fixture); await pause();
        check(doc.querySelectorAll('[data-modded-name]').length === 3, 'Reopened settings receive custom themes without polling');
        return JSON.stringify({ passed: results.length, results });
    } finally { win.__cuterinthCleanup?.(); frame.remove(); }
})();
