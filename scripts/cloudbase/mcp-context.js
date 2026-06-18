#!/usr/bin/env node
'use strict'

const fs = require('node:fs')
const path = require('node:path')

const {
  DEFAULT_ENV,
  ensureProfileHome
} = require('./tcb-profile')

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
  'SECRET_KEY',
  'CLOUDBASE_API_KEY'
]

function createMcpRuntime(root, env = process.env) {
  const projectConfig = readProjectConfig(root)
  const envId =
    env.CLOUDBASE_ENV_ID ||
    env.CLOUDBASE_ENV ||
    projectConfig.envId ||
    DEFAULT_ENV
  const region = env.CLOUDBASE_REGION || projectConfig.region || 'ap-shanghai'
  const mcpConfig = projectConfig.mcp || {}
  const credentialMode = env.CLOUDBASE_MCP_CREDENTIAL_MODE || mcpConfig.credentialMode || 'projectProfile'
  const pluginsEnabled =
    parseList(env.CLOUDBASE_MCP_PLUGINS) ||
    parseList(env.CLOUDBASE_MCP_PLUGINS_ENABLED) ||
    mcpConfig.pluginsEnabled ||
    ['env', 'functions', 'database']

  const home = ensureProfileHome(root, env)

  env.CI = '1'
  env.CLOUDBASE_ENV = envId
  env.CLOUDBASE_ENV_ID = envId
  env.TENCENTCLOUD_TCB_ENVID = envId
  env.TCB_REGION = region
  env.HOME = home
  env.USERPROFILE = home
  env.XDG_CONFIG_HOME = path.join(home, '.config')
  env.XDG_CACHE_HOME = path.join(home, '.cache')
  env.XDG_DATA_HOME = path.join(home, '.local', 'share')
  env.CLOUDBASE_MCP_PLUGINS_ENABLED = pluginsEnabled.join(',')

  if (credentialMode !== 'processEnv') {
    for (const key of SECRET_ENV_KEYS) {
      delete env[key]
    }
  }

  return {
    envId,
    region,
    credentialMode,
    pluginsEnabled,
    profileHome: home,
    cloudBaseOptions: buildCloudBaseOptions(env, envId, region, credentialMode)
  }
}

function readProjectConfig(root) {
  const configPath = path.join(root, 'cloudbase.project.json')
  if (!fs.existsSync(configPath)) return {}
  return JSON.parse(fs.readFileSync(configPath, 'utf8'))
}

function parseList(value) {
  if (!value) return null
  return value.split(',').map((item) => item.trim()).filter(Boolean)
}

function buildCloudBaseOptions(env, envId, region, credentialMode) {
  const options = { envId, region }

  if (credentialMode !== 'processEnv') return options

  const secretId = env.TENCENTCLOUD_SECRETID || env.TCB_SECRET_ID || env.CLOUD_SECRET_ID || env.SECRET_ID
  const secretKey = env.TENCENTCLOUD_SECRETKEY || env.TCB_SECRET_KEY || env.CLOUD_SECRET_KEY || env.SECRET_KEY
  const token = env.TENCENTCLOUD_SESSIONTOKEN || env.TCB_SESSION_TOKEN

  if (secretId && secretKey) {
    options.secretId = secretId
    options.secretKey = secretKey
  }

  if (token) {
    options.token = token
  }

  return options
}

module.exports = {
  createMcpRuntime
}
