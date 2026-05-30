const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '../..')
const sharedDir = path.join(root, 'cloudfunctions/_shared')
const cloudfunctionsDir = path.join(root, 'cloudfunctions')

if (!fs.existsSync(sharedDir)) {
  console.log('No shared helpers found yet. Skipping sync.')
  process.exit(0)
}

const targets = fs.readdirSync(cloudfunctionsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((name) => name !== '_shared')
  .filter((name) => {
    const functionDir = path.join(cloudfunctionsDir, name)
    return fs.existsSync(path.join(functionDir, 'index.js')) &&
      fs.existsSync(path.join(functionDir, 'package.json'))
  })

let synced = 0
for (const fn of targets) {
  const functionDir = path.join(cloudfunctionsDir, fn)
  const targetDir = path.join(functionDir, 'shared')
  fs.mkdirSync(targetDir, { recursive: true })
  for (const file of fs.readdirSync(sharedDir)) {
    fs.copyFileSync(path.join(sharedDir, file), path.join(targetDir, file))
  }
  synced++
}

console.log(`Synced shared helpers into ${synced} cloud function folders.`)
