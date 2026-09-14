'use strict'

const { spawn } = require('child_process')
const fs = require('fs')
const http = require('http')
const path = require('path')
const WebSocket = require('ws')

const code = "(function () {\n    \u0027use strict\u0027;\n    const version = \u00272026.09.14\u0027;\n    globalThis.__cuterinthCleanup?.();\n    globalThis.__cuterinthObserver?.disconnect();\n    clearInterval(globalThis.__cuterinthMaintenanceTimer);\n    const validTheme = t =\u003e t \u0026\u0026 typeof t.name === \u0027string\u0027 \u0026\u0026 t.name.trim() \u0026\u0026 t.vars \u0026\u0026\n        typeof t.vars === \u0027object\u0027 \u0026\u0026 !Array.isArray(t.vars) \u0026\u0026\n        Object.entries(t.vars).every(([k, v]) =\u003e /^--[\\w-]+$/.test(k) \u0026\u0026 typeof v === \u0027string\u0027);\n    function parseData(json) {\n        try { const d = JSON.parse(json); if (d \u0026\u0026 Array.isArray(d.customThemes)) return d; } catch {}\n        return null;\n    }\n    let data = parseData(globalThis.__cuterinthPersistedData) || parseData(localStorage.getItem(\u0027modded\u0027)) ||\n        { customTheme: null, customThemes: [] };\n    delete globalThis.__cuterinthPersistedData;\n    data.customThemes = data.customThemes.filter(validTheme);\n    data.hiddenBundledThemes = Array.isArray(data.hiddenBundledThemes) ? data.hiddenBundledThemes : [];\n    if (data.customTheme === \u0027default\u0027) data.customTheme = null;\n    for (const theme of globalThis.__cuterinthBundledThemes || []) {\n        if (!validTheme(theme) || data.hiddenBundledThemes.includes(theme.name)) continue;\n        const index = data.customThemes.findIndex(t =\u003e t.name === theme.name);\n        const preset = { ...theme, _cuterinthBundled: true };\n        if (index === -1) data.customThemes.push(preset);\n        else if (data.customThemes[index]._cuterinthBundled) data.customThemes[index] = preset;\n    }\n    const previousProperties = new Map();\n    function clearVars() {\n        for (const [k, { value, priority }] of previousProperties) {\n            if (value) document.documentElement.style.setProperty(k, value, priority);\n            else document.documentElement.style.removeProperty(k);\n        }\n        previousProperties.clear();\n    }\n    function applyVars(vars) {\n        clearVars();\n        const style = document.documentElement.style;\n        for (const [k, v] of Object.entries(vars)) {\n            previousProperties.set(k, { value: style.getPropertyValue(k), priority: style.getPropertyPriority(k) });\n            style.setProperty(k, v);\n        }\n    }\n    function saveData() {\n        const json = JSON.stringify(data);\n        localStorage.setItem(\u0027modded\u0027, json);\n        try { globalThis.cuterinthPersist?.(json); } catch {}\n    }\n    const activeTheme = data.customThemes.find(t =\u003e t.name === data.customTheme);\n    if (activeTheme) applyVars(activeTheme.vars); else data.customTheme = null;\n    saveData();\n    const stylesheet = document.createElement(\u0027style\u0027);\n    stylesheet.id = \u0027cuterinth-styles\u0027;\n    stylesheet.textContent = `\n        .cuterinth-theme-card { position:relative; min-width:0; }\n        .cuterinth-theme-card \u003e .preview-radio { width:100%; height:100%; }\n        .cuterinth-theme-card .cuterinth-delete {\n            position:absolute; top:6px; right:6px; width:28px; height:28px; padding:0;\n            border:0; border-radius:6px; cursor:pointer; background:var(--color-red-bg,#ff496e33);\n            color:var(--color-red,#ff496e); opacity:0; font-size:18px;\n        }\n        .cuterinth-theme-card:hover .cuterinth-delete,\n        .cuterinth-theme-card:focus-within .cuterinth-delete { opacity:1; }\n        .cuterinth-delete:focus-visible { outline:2px solid currentColor; outline-offset:2px; }\n        .cuterinth-upload { min-height:64px; }\n        .cuterinth-status { padding:12px 16px; color:var(--color-secondary); }\n        .app-sidebar .ad-parent, .app-sidebar \u003e a[href*=\"modrinth.host\"],\n        .app-sidebar \u003e a[href*=\"modrinth.plus\"] { display:none !important; }\n        .app-sidebar::after { display:none !important; }\n    `;\n    document.getElementById(\u0027modded-ad-fix\u0027)?.remove();\n    document.getElementById(stylesheet.id)?.remove();\n    const input = document.createElement(\u0027input\u0027);\n    input.type = \u0027file\u0027; input.accept = \u0027.json,application/json\u0027; input.hidden = true;\n    input.dataset.cuterinthOwned = \u0027\u0027;\n    input.addEventListener(\u0027change\u0027, () =\u003e {\n        const file = input.files[0]; input.value = \u0027\u0027; if (file) uploadTheme(file);\n    });\n    const nativeStates = new Map();\n    let container = null, scheduled = null, resourceStatus = null, resourceTimer = null, stopped = false;\n    const diagnostics = { version, maintenanceRuns: 0 };\n    function setStatus(message, isError = false) {\n        const parent = container?.parentElement;\n        if (!parent) return;\n        let status = parent.querySelector(\u0027.cuterinth-import-status\u0027);\n        if (!status) {\n            status = document.createElement(\u0027p\u0027); status.className = \u0027cuterinth-status cuterinth-import-status\u0027;\n            status.dataset.cuterinthOwned = \u0027\u0027; parent.appendChild(status);\n        }\n        status.setAttribute(\u0027role\u0027, isError ? \u0027alert\u0027 : \u0027status\u0027); status.textContent = message;\n    }\n    async function uploadTheme(file) {\n        try {\n            if (file.size \u003e 1024 * 1024) throw new Error(\u0027Theme files must be smaller than 1 MB.\u0027);\n            const uploaded = JSON.parse(await file.text());\n            if (!validTheme(uploaded)) throw new Error(\u0027Choose a theme with a name and CSS variables containing text values.\u0027);\n            if (stopped) return;\n            const theme = { name: uploaded.name.trim(), author: uploaded.author, vars: uploaded.vars };\n            const index = data.customThemes.findIndex(t =\u003e t.name === theme.name);\n            if (index === -1) data.customThemes.push(theme); else data.customThemes[index] = theme;\n            data.hiddenBundledThemes = data.hiddenBundledThemes.filter(name =\u003e name !== theme.name);\n            data.customTheme = theme.name; applyVars(theme.vars); saveData(); renderThemes();\n            setStatus(`Imported ${theme.name}.`);\n        } catch (error) {\n            setStatus(error instanceof SyntaxError ? \u0027This file is not valid JSON.\u0027 : error.message, true);\n        }\n    }\n    function syncSelection() {\n        if (!container) return;\n        for (const button of container.querySelectorAll(\u0027.preview-radio\u0027)) {\n            if (button.classList.contains(\u0027cuterinth-upload\u0027)) continue;\n            const custom = button.dataset.moddedName;\n            if (!custom \u0026\u0026 !nativeStates.has(button)) nativeStates.set(button, {\n                selected: button.classList.contains(\u0027selected\u0027), pressed: button.getAttribute(\u0027aria-pressed\u0027),\n                radio: button.querySelector(\u0027.radio\u0027)?.innerHTML\n            });\n            const selected = custom ? custom === data.customTheme : !data.customTheme \u0026\u0026 nativeStates.get(button)?.selected;\n            button.classList.toggle(\u0027selected\u0027, !!selected); button.setAttribute(\u0027aria-pressed\u0027, String(!!selected));\n            const radio = button.querySelector(\u0027.radio\u0027);\n            if (radio) {\n                radio.querySelector(\u0027circle\u0027)?.remove();\n                if (selected) {\n                    const circle = document.createElementNS(\u0027http://www.w3.org/2000/svg\u0027, \u0027circle\u0027);\n                    for (const [k, v] of Object.entries({ cx:12, cy:12, r:5, fill:\u0027currentColor\u0027 })) circle.setAttribute(k, v);\n                    radio.appendChild(circle);\n                }\n            }\n        }\n    }\n    function createThemeCard(theme, template) {\n        // Inherit the current build\u0027s scoped preview styling instead of hardcoding a Vue hash.\n        const button = template.cloneNode(true);\n        button.type = \u0027button\u0027; button.classList.add(\u0027modded-btn\u0027); button.dataset.moddedName = theme.name;\n        button.removeAttribute(\u0027data-modded-patched\u0027); button.removeAttribute(\u0027aria-label\u0027);\n        button.querySelectorAll(\u0027.theme-icon\u0027).forEach(icon =\u003e icon.remove());\n        const preview = button.querySelector(\u0027.preview\u0027);\n        preview.classList.remove(\u0027dark-mode\u0027, \u0027light-mode\u0027, \u0027oled-mode\u0027);\n        for (const [k, v] of Object.entries(theme.vars)) preview.style.setProperty(k, v);\n        preview.style.backgroundColor = \u0027var(--surface-3, #27292e)\u0027;\n        const label = button.querySelector(\u0027.label\u0027), radio = label.querySelector(\u0027.radio\u0027);\n        label.replaceChildren(); if (radio) label.appendChild(radio);\n        label.appendChild(document.createTextNode(` ${theme.name}`));\n        button.addEventListener(\u0027click\u0027, () =\u003e {\n            data.customTheme = theme.name; applyVars(theme.vars); saveData(); syncSelection();\n        });\n        const card = document.createElement(\u0027div\u0027);\n        card.className = \u0027cuterinth-theme-card\u0027; card.dataset.cuterinthOwned = \u0027\u0027;\n        const remove = document.createElement(\u0027button\u0027);\n        remove.type = \u0027button\u0027; remove.className = \u0027cuterinth-delete\u0027; remove.textContent = \u0027×\u0027;\n        remove.setAttribute(\u0027aria-label\u0027, `Delete ${theme.name} theme`); remove.title = `Delete ${theme.name} theme`;\n        remove.addEventListener(\u0027click\u0027, () =\u003e {\n            data.customThemes = data.customThemes.filter(t =\u003e t.name !== theme.name);\n            if (theme._cuterinthBundled) data.hiddenBundledThemes.push(theme.name);\n            if (data.customTheme === theme.name) { data.customTheme = null; clearVars(); }\n            saveData(); renderThemes();\n        });\n        card.append(button, remove); return card;\n    }\n    function renderThemes() {\n        if (!container?.isConnected) return;\n        const template = container.querySelector(\u0027.preview-radio:not(.modded-btn)\u0027);\n        if (!template?.querySelector(\u0027.preview\u0027) || !template.querySelector(\u0027.label\u0027)) return;\n        container.querySelectorAll(\u0027[data-cuterinth-owned], .modded-btn\u0027).forEach(node =\u003e node.remove());\n        const fragment = document.createDocumentFragment();\n        for (const theme of data.customThemes) fragment.appendChild(createThemeCard(theme, template));\n        const upload = document.createElement(\u0027button\u0027);\n        upload.type = \u0027button\u0027; upload.className = \u0027preview-radio button-base modded-btn cuterinth-upload\u0027;\n        for (const name of template.getAttributeNames().filter(n =\u003e n.startsWith(\u0027data-v-\u0027))) upload.setAttribute(name, \u0027\u0027);\n        upload.dataset.cuterinthOwned = \u0027\u0027; upload.textContent = \u0027Upload theme\u0027;\n        upload.addEventListener(\u0027click\u0027, () =\u003e input.click()); fragment.appendChild(upload);\n        container.appendChild(fragment); syncSelection();\n    }\n    function clearResourceStatus() {\n        resourceStatus?.remove(); resourceStatus = null; clearInterval(resourceTimer); resourceTimer = null;\n    }\n    function onClick(event) {\n        const button = event.target.closest?.(\u0027button\u0027); if (!button) return;\n        if (button.matches(\u0027.theme-options .preview-radio:not(.modded-btn)\u0027)) {\n            data.customTheme = null; clearVars();\n            for (const [native, state] of nativeStates) state.selected = native === button;\n            saveData(); schedule();\n        }\n        const dialog = button.closest(\u0027[role=\"dialog\"]\u0027);\n        if (dialog \u0026\u0026 button.querySelector(\u0027.lucide-gauge\u0027)) {\n            clearResourceStatus(); resourceStatus = document.createElement(\u0027p\u0027);\n            resourceStatus.className = \u0027cuterinth-status\u0027; resourceStatus.dataset.cuterinthOwned = \u0027\u0027;\n            resourceStatus.setAttribute(\u0027role\u0027, \u0027status\u0027);\n            resourceStatus.textContent = \u0027Calculating content storage… Large libraries can take a few seconds.\u0027;\n            dialog.appendChild(resourceStatus);\n            const started = Date.now();\n            resourceTimer = setInterval(() =\u003e {\n                const ready = dialog.querySelector(\u0027button[aria-label=\"Check for missing or damaged files and repair them.\"]\u0027);\n                if (!dialog.isConnected || ready || Date.now() - started \u003e 30000) clearResourceStatus();\n            }, 150);\n        } else if (dialog \u0026\u0026 !button.closest(\u0027.theme-options\u0027)) clearResourceStatus();\n    }\n    function maintain() {\n        scheduled = null; if (stopped) return; diagnostics.maintenanceRuns++;\n        const current = document.querySelector(\u0027.theme-options\u0027);\n        if (current !== container) { container = current; nativeStates.clear(); renderThemes(); }\n        else if (container \u0026\u0026 !container.querySelector(\u0027.modded-btn\u0027)) renderThemes();\n        else if (container) syncSelection();\n        const dialog = document.querySelector(\u0027[role=\"dialog\"]\u0027);\n        const label = dialog \u0026\u0026 [...dialog.querySelectorAll(\u0027p.m-0\u0027)].find(p =\u003e /^Modrinth App \\d/.test(p.textContent));\n        if (label) label.textContent = label.textContent.replace(/^Modrinth App/, \u0027Cuterinth App\u0027);\n    }\n    function schedule() { if (!scheduled \u0026\u0026 !stopped) scheduled = setTimeout(maintain, 50); }\n    // Inspect newly mounted settings nodes, without rescanning the page on resource-list changes.\n    const observer = new MutationObserver(records =\u003e {\n        if (container \u0026\u0026 !container.isConnected) { container = null; nativeStates.clear(); }\n        for (const record of records) for (const node of record.addedNodes) {\n            if (node.nodeType !== 1 || node.closest(\u0027[data-cuterinth-owned]\u0027)) continue;\n            if (node.matches(\u0027.theme-options, [role=\"dialog\"]\u0027) || node.querySelector(\u0027.theme-options\u0027)) {\n                schedule(); return;\n            }\n        }\n    });\n    function start() {\n        document.head.appendChild(stylesheet); document.body.appendChild(input);\n        document.addEventListener(\u0027click\u0027, onClick, true);\n        observer.observe(document.body, { childList:true, subtree:true }); maintain();\n        globalThis.__cuterinthVersion = version;\n    }\n    globalThis.__cuterinthObserver = observer;\n    globalThis.__cuterinthDiagnostics = diagnostics;\n    globalThis.__cuterinthCleanup = () =\u003e {\n        stopped = true; observer.disconnect(); clearTimeout(scheduled); clearResourceStatus();\n        document.removeEventListener(\u0027DOMContentLoaded\u0027, start); document.removeEventListener(\u0027click\u0027, onClick, true);\n        for (const [button, state] of nativeStates) {\n            button.classList.toggle(\u0027selected\u0027, state.selected);\n            if (state.pressed === null) button.removeAttribute(\u0027aria-pressed\u0027); else button.setAttribute(\u0027aria-pressed\u0027, state.pressed);\n            if (state.radio \u0026\u0026 button.querySelector(\u0027.radio\u0027)) button.querySelector(\u0027.radio\u0027).innerHTML = state.radio;\n        }\n        document.querySelectorAll(\u0027[data-cuterinth-owned]\u0027).forEach(node =\u003e node.remove());\n        stylesheet.remove(); clearVars(); delete globalThis.__cuterinthVersion;\n    };\n    if (document.readyState === \u0027loading\u0027) document.addEventListener(\u0027DOMContentLoaded\u0027, start, { once:true }); else start();\n})();\r\n"
const bundledThemes = fs.readdirSync(path.join(__dirname, 'themes'))
  .filter(name => name.endsWith('.json'))
  .map(name => JSON.parse(fs.readFileSync(path.join(__dirname, 'themes', name), 'utf8')))
const bootstrap = 'globalThis.__cuterinthBundledThemes = ' + JSON.stringify(bundledThemes) + ';\n' + code

const exe = path.join(process.env.LOCALAPPDATA, 'Modrinth App', 'Modrinth App.exe')
const debugPort = 9222

function httpGet(url) {
  return new Promise(function(resolve, reject) {
    const req = http.get(url, { family: 4 }, function(res) {
      let body = ''
      res.on('data', function(chunk) { body += chunk })
      res.on('end', function() {
        try { resolve(JSON.parse(body)) }
        catch (e) { reject(e) }
      })
    })
    req.on('error', reject)
    req.setTimeout(2000, () => req.destroy(new Error('Debugger request timed out')))
  })
}

async function main() {
  if (!fs.existsSync(exe)) {
    console.error('Modrinth App not found at:', exe)
    process.exit(1)
  }

  const env = Object.assign({}, process.env, {
    WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${debugPort}`
  })

  spawn(exe, [], {
    detached: true,
    stdio: 'ignore',
    env: env
  })

  async function waitForCDP(retries) {
    for (var i = 0; i < retries; i++) {
      try {
        const targets = await httpGet('http://127.0.0.1:' + debugPort + '/json')
        const target = targets.find(function(t) {
          try { return t.type === 'page' && new URL(t.url).hostname === 'tauri.localhost' }
          catch { return false }
        })
        if (target) return target
      } catch (e) {}
      await new Promise(function(r) { return setTimeout(r, 3000) })
    }
    throw new Error('Could not connect. After Modrinth updates, close it completely and restart Cuterinth.')
  }

  const target = await waitForCDP(20)
  const ws = new WebSocket(target.webSocketDebuggerUrl)
  let timer
  let commandId = 0
  let pending = false

  function inject() {
    if (pending || ws.readyState !== WebSocket.OPEN) return
    pending = true
    ws.send(JSON.stringify({
      id: ++commandId,
      method: 'Runtime.evaluate',
      params: {
        expression: "if (!globalThis.__cuterinthVersion && document.readyState !== 'loading') {\n" + bootstrap + '\n}',
        awaitPromise: true, returnByValue: true
      }
    }))
  }

  ws.on('open', function() {
    inject()
    timer = setInterval(inject, 2000)
  })

  ws.on('message', function(data) {
    const msg = JSON.parse(data)
    if (msg.id !== commandId) return
    pending = false
    if (msg.error || msg.result?.exceptionDetails) {
      console.error('Customization failed:', JSON.stringify(msg.error || msg.result.exceptionDetails))
    }
  })

  ws.on('close', () => { clearInterval(timer) })

  ws.on('error', function(err) {
    console.error('Connection failed:', err.message)
    process.exit(1)
  })
}

main().catch(function(err) {
  console.error('Unhandled error in main:', err.message)
  process.exit(1)
})
