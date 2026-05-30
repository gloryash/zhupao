const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '../..')
const sharedDir = path.join(root, 'cloudfunctions/_shared')
const targets = [
  'syncUserInfo',
  'wechatLogin',
  'handleUser',
  'handleOrder',
  'handleVolunteer',
  'handleSchedule',
  'handleTraining',
  'handleRecord',
  'handleCircle',
  'handleShop',
  'updatePoints',
  'initDB',
  'testAll',
  'webAuth'
]

if (!fs.existsSync(sharedDir)) {
  console.log('No shared helpers found yet. Skipping sync.')
  process.exit(0)
}

for (const fn of targets) {
  const functionDir = path.join(root, `cloudfunctions/${fn}`)
  if (!fs.existsSync(functionDir)) continue

  const targetDir = path.join(functionDir, 'shared')
  fs.mkdirSync(targetDir, { recursive: true })
  for (const file of fs.readdirSync(sharedDir)) {
    fs.copyFileSync(path.join(sharedDir, file), path.join(targetDir, file))
  }
}

console.log(`Synced shared helpers into ${targets.length} cloud function slots.`)
