#!/usr/bin/env node
'use strict'

const fs = require('node:fs')
const path = require('node:path')

const DEFAULT_ENV = 'cloud1-d8gbfzr7t6c5dc8bc'

const SECRET_ENV_KEYS = [
  'TENCENTCLOUD_SECRETID',
  'TENCENTCLOUD_SECRETKEY',
  'TENCENTCLOUD_SESSIONTOKEN',
  'TCB_SECRET_ID',
  'TCB_SECRET_KEY',
  'TCB_SESSION_TOKEN',
  'CLOUD_SECRET_ID',
  'CLOUD_SECRET_KEY',
  'SECRET_ID',
  'SECRET_KEY'
]

function profileHome(root, env = process.env) {
  return path.resolve(env.CLOUDBASE_TCB_HOME || path.join(root, '.cloudbase-home'))
}

function ensureProfileHome(root, env = process.env) {
  const home = profileHome(root, env)
  fs.mkdirSync(home, { recursive: true })
  fs.mkdirSync(path.join(home, '.config'), { recursive: true })
  fs.mkdirSync(path.join(home, '.cache'), { recursive: true })
  fs.mkdirSync(path.join(home, '.local', 'share'), { recursive: true })
  return home
}

function tcbBinaryPath(root) {
  return path.join(
    root,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tcb.cmd' : 'tcb'
  )
}

function hasEnvArg(args) {
  return args.some((arg, index) => (
    arg === '-e' ||
    arg === '--env-id' ||
    arg.startsWith('--env-id=') ||
    args[index - 1] === '-e' ||
    args[index - 1] === '--env-id'
  ))
}

function shouldAppendEnv(args) {
  if (args.length === 0) return false
  if (hasEnvArg(args)) return false
  if (args.some((arg) => ['-h', '--help', '-v', '--version'].includes(arg))) return false

  const command = args[0]
  if (command === 'logout' || command === 'help') return false
  if (command === 'login') return args.includes('--cloudbase-api-key')

  return !command.startsWith('-')
}

function withDefaultEnvArg(args, envId) {
  return shouldAppendEnv(args) ? [...args, '-e', envId] : [...args]
}

function buildIsolatedEnv(baseEnv, root, envId) {
  const env = { ...baseEnv }
  for (const key of SECRET_ENV_KEYS) {
    delete env[key]
  }

  const home = profileHome(root, baseEnv)
  env.CI = '1'
  env.CLOUDBASE_ENV = envId
  env.HOME = home
  env.USERPROFILE = home
  env.XDG_CONFIG_HOME = path.join(home, '.config')
  env.XDG_CACHE_HOME = path.join(home, '.cache')
  env.XDG_DATA_HOME = path.join(home, '.local', 'share')
  return env
}

module.exports = {
  DEFAULT_ENV,
  buildIsolatedEnv,
  ensureProfileHome,
  profileHome,
  tcbBinaryPath,
  withDefaultEnvArg
}
