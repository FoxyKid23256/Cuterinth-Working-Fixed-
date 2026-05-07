const fs = require('fs')
const { execSync } = require('child_process')

// you can set this up to make your own scripts

fs.copyFileSync('injector.js', 'injector.build.js');
console.log('copied injector.js to injector.build.js');

execSync('pkg .', { stdio: 'inherit' })
console.log('done!')