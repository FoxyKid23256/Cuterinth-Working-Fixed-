const fs = require('fs')
const { execSync } = require('child_process')

// you can set this up to make your own scripts

const script = fs.readFileSync('default.js', 'utf8')
const injector = fs.readFileSync('injector.js', 'utf8')

const patched = injector.replace(
  /const code = fs\.readFileSync\(path\.join\(__dirname,\s*'default\.js'\),\s*'utf8'\)/,
  `const code = ${JSON.stringify(script)}`
)

if (patched === injector) {
  process.exit(1)
}

fs.writeFileSync('injector.build.js', patched)
console.log('written injector.build.js')

execSync('pkg .', { stdio: 'inherit' })
console.log('done!')