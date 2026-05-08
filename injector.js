'use strict'

const { spawn, execSync } = require('child_process')
const fs = require('fs')
const http = require('http')
const path = require('path')
const WebSocket = require('ws')

const code = fs.readFileSync(path.join(__dirname, 'default.js'), 'utf8')

const possiblePaths = [
  process.argv[2],
  process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Modrinth App', 'Modrinth App.exe'),
  process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'Modrinth App', 'Modrinth App.exe'),
  process.env['ProgramFiles(x86)'] && path.join(process.env['ProgramFiles(x86)'], 'Modrinth App', 'Modrinth App.exe')
].filter(Boolean);

let exe;
for (const p of possiblePaths) {
  if (fs.existsSync(p)) {
    exe = p;
    break;
  }
}

if (!exe) {
  console.error('Modrinth App executable not found. Please provide the full path as an argument.');
  process.exit(1);
}

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
  console.log('Attempting to inject into Modrinth App...');
  console.log(`Using executable: ${exe}`);

  try {
    console.log('Closing Modrinth App if it is running...');
    execSync('taskkill /F /IM "Modrinth App.exe"');
    console.log('Modrinth App closed. Waiting a moment...');
    await new Promise(r => setTimeout(r, 1500)); // Wait 1.5 seconds
  } catch (e) {
    console.log('Modrinth App was not running.');
  }

  const env = Object.assign({}, process.env, {
    WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${debugPort}`
  })

  console.log('Spawning Modrinth App with remote debugging...');
  const child = spawn(exe, [], {
    detached: true,
    stdio: 'ignore',
    env: env
  });
  child.unref();

  async function waitForCDP(retries) {
    console.log('Waiting for Modrinth App to open debug port...');
    for (let i = 0; i < retries; i++) {
      try {
        const targets = await httpGet(`http://127.0.0.1:${debugPort}/json`);
        const target = targets.find(t => t.url && t.url.includes('tauri.localhost'));
        if (target) {
          console.log('Successfully connected to Modrinth App.');
          return target;
        }
      } catch (e) {
        if (i === 0) {
          console.log('Connection failed, retrying...');
        }
      }
      await new Promise(r => setTimeout(r, 1000));
    }
    console.error('Failed to connect to Modrinth App. Another process might be using port 9222, or a firewall might be blocking the connection.');
    process.exit(1);
  }

  const target = await waitForCDP(30); // 30 retries, 1s each
  const ws = new WebSocket(target.webSocketDebuggerUrl)

  ws.on('open', function() {
    console.log('Injecting code...');
    ws.send(JSON.stringify({
      id: 1,
      method: 'Runtime.evaluate',
      params: { expression: code, awaitPromise: true, returnByValue: true }
    }))
  })

  ws.on('message', function(data) {
    const msg = JSON.parse(data)
    if (msg.id !== 1) return

    if (msg.result && msg.result.exceptionDetails) {
      console.error('\n--- An error occurred during code injection ---');
      console.error(msg.result.exceptionDetails.exception.description.trim());
      console.error('\nThis error came from within the Modrinth App. Please check the injected script for issues.');
      process.exit(1);
    } else {
      console.log('Injection reported success.');
      console.log('\nIf you still do not see the changes, open the Modrinth App, press Ctrl+Shift+I, and check the Console tab for any errors.');
    }

    ws.close()
    process.exit(0)
  })

  ws.on('error', function(err) {
    console.error('WebSocket connection failed:', err.message)
    process.exit(1)
  })
}

main().catch(function(err) {
  console.error('An unhandled error occurred:', err.message)
  process.exit(1)
})