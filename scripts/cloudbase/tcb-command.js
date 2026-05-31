#!/usr/bin/env node
'use strict'

const path = require('path')
const { spawnSync } = require('child_process')

const DEFAULT_ENV = 'cloud1-d8gbfzr7t6c5dc8bc'
const envId = process.env.CLOUDBASE_ENV || DEFAULT_ENV
const root = path.resolve(__dirname, '../..')
const tcbBin = path.join(
  root,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'tcb.cmd' : 'tcb'
)

const command = process.argv[2]
const args = buildArgs(command)

const result = spawnSync(tcbBin, args, {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, CI: '1', CLOUDBASE_ENV: envId },
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
    return ['env', 'detail', '-e', envId, '--json']
  }

  if (commandName === 'fn-list') {
    return ['fn', 'list', '-e', envId, '--json']
  }

  console.error('Usage: node scripts/cloudbase/tcb-command.js <env-detail|fn-list>')
  process.exit(1)
}
