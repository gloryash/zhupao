#!/usr/bin/env node
'use strict'

const path = require('path')
const { spawnSync } = require('child_process')
const {
  DEFAULT_ENV,
  buildIsolatedEnv,
  ensureProfileHome,
  tcbBinaryPath,
  withDefaultEnvArg
} = require('./tcb-profile')

const envId = process.env.CLOUDBASE_ENV || DEFAULT_ENV
const root = path.resolve(__dirname, '../..')
const tcbBin = tcbBinaryPath(root)

const command = process.argv[2]
const args = withDefaultEnvArg(buildArgs(command), envId)

ensureProfileHome(root, process.env)

const result = spawnSync(tcbBin, args, {
  cwd: root,
  stdio: 'inherit',
  env: buildIsolatedEnv(process.env, root, envId),
  timeout: 60000
})

if (result.error) {
  console.error(result.error.message)
  process.exit(1)
}

if (result.signal) {
  console.error(`tcb ${command} terminated by ${result.signal}`)
  process.exit(1)
}

process.exit(result.status || 0)

function buildArgs(commandName) {
  if (commandName === 'env-detail') {
    return ['env', 'detail', '--json']
  }

  if (commandName === 'fn-list') {
    return ['fn', 'list', '--json']
  }

  console.error('Usage: node scripts/cloudbase/tcb-command.js <env-detail|fn-list>')
  process.exit(1)
}
