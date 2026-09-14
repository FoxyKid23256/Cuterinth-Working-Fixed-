'use strict'

const { spawn, execSync } = require('child_process')
const fs = require('fs')
const http = require('http')
const path = require('path')
const WebSocket = require('ws')

const code = fs.readFileSync(path.join(__dirname, 'default.js'), 'utf8')

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
        const target = targets.find(function(t) { return t.url && t.url.includes('tauri.localhost') })
        if (target) return target
      } catch (e) {}
      await new Promise(function(r) { return setTimeout(r, 3000) })
    }
    process.exit(1)
  }

  const target = await waitForCDP(20)
  const ws = new WebSocket(target.webSocketDebuggerUrl)

  ws.on('open', function() {
    ws.send(JSON.stringify({
      id: 1,
      method: 'Runtime.evaluate',
      params: { expression: code, awaitPromise: true, returnByValue: true }
    }))
  })

  ws.on('message', function(data) {
    const msg = JSON.parse(data)
    if (msg.id !== 1) return
    ws.close()
    process.exit(0)
  })

  ws.on('error', function(err) {
    console.error('Connection failed:', err.message)
    process.exit(1)
  })
}

main().catch(function(err) {
  console.error('Unhandled error in main:', err.message)
  process.exit(1)
})