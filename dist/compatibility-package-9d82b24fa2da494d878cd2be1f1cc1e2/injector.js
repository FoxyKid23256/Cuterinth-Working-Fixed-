'use strict'

const { spawn } = require('child_process')
const fs = require('fs')
const http = require('http')
const path = require('path')
const WebSocket = require('ws')

const code = fs.readFileSync(path.join(__dirname, 'default.js'), 'utf8')
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
