#!/usr/bin/env node
'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const {
  DEFAULT_ENV,
  buildIsolatedEnv,
  ensureProfileHome,
  profileHome,
  tcbBinaryPath,
  withDefaultEnvArg
} = require('./tcb-profile')

const root = path.resolve(__dirname, '../..')
const envId = process.env.CLOUDBASE_ENV || DEFAULT_ENV
const rawArgs = process.argv.slice(2)
const args = withDefaultEnvArg(rawArgs.length > 0 ? rawArgs : ['--help'], envId)
const tcbBin = tcbBinaryPath(root)

if (!fs.existsSync(tcbBin)) {
  console.error(`CloudBase CLI not found at ${tcbBin}. Run npm install from the project root.`)
  process.exit(1)
}

ensureProfileHome(root, process.env)

if (process.env.CLOUDBASE_TCB_VERBOSE === '1') {
  console.error(`[cloudbase] env=${envId}`)
  console.error(`[cloudbase] isolated HOME=${profileHome(root, process.env)}`)
}

const result = spawnSync(tcbBin, args, {
  cwd: root,
  stdio: 'inherit',
  env: buildIsolatedEnv(process.env, root, envId)
})

if (result.error) {
  console.error(result.error.message)
  process.exit(1)
}

if (result.signal) {
  console.error(`tcb ${rawArgs.join(' ')} terminated by ${result.signal}`)
  process.exit(1)
}

process.exit(result.status || 0)
