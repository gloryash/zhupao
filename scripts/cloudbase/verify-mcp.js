#!/usr/bin/env node
'use strict'

const path = require('node:path')

const { createMcpRuntime } = require('./mcp-context')

const root = path.resolve(__dirname, '../..')
const runtime = createMcpRuntime(root, process.env)
const { envId, region, credentialMode, pluginsEnabled, profileHome, cloudBaseOptions } = runtime

const { createCloudBaseMcpServer } = require('@cloudbase/cloudbase-mcp')

main().catch((error) => {
  console.error(JSON.stringify({
    success: false,
    code: 'CLOUDBASE_MCP_VERIFY_FAILED',
    message: error.message
  }, null, 2))
  process.exit(1)
})

async function main() {
  const server = await createCloudBaseMcpServer({
    enableTelemetry: false,
    cloudBaseOptions,
    pluginsEnabled
  })

  const tools = Object.keys(server._registeredTools || {}).sort()
  const envInfo = await callTool(server, 'envQuery', { action: 'info', envId })
  const actualEnvId = envInfo.EnvInfo?.EnvId || envInfo.env?.EnvId || envInfo.data?.envId

  if (actualEnvId !== envId) {
    throw new Error(`MCP env mismatch: expected ${envId}, got ${actualEnvId || 'unknown'}`)
  }

  const functionsResult = await callTool(server, 'queryFunctions', {
    action: 'listFunctions',
    limit: 100,
    offset: 0
  })
  const functions = functionsResult.data?.functions || functionsResult.functions || []

  const collectionsResult = await callTool(server, 'readNoSqlDatabaseStructure', {
    action: 'listCollections',
    limit: 100,
    offset: 0
  })
  const collections = collectionsResult.collections || collectionsResult.Tables || []

  console.log(JSON.stringify({
    success: true,
    envId: actualEnvId,
    region,
    credentialMode,
    profileHome,
    mcp: {
      package: '@cloudbase/cloudbase-mcp',
      tools: {
        count: tools.length,
        selected: tools.filter((name) => [
          'auth',
          'envQuery',
          'queryFunctions',
          'manageFunctions',
          'readNoSqlDatabaseStructure',
          'readNoSqlDatabaseContent'
        ].includes(name))
      }
    },
    functions: {
      count: functions.length,
      sample: functions.slice(0, 8).map((fn) => fn.FunctionName || fn.name || fn.Name).filter(Boolean)
    },
    collections: {
      count: collections.length,
      sample: collections.slice(0, 8).map((item) => item.TableName || item.name || item).filter(Boolean)
    }
  }, null, 2))
}

async function callTool(server, name, args) {
  const tool = server._registeredTools?.[name]
  if (!tool || !tool.enabled || typeof tool.callback !== 'function') {
    throw new Error(`CloudBase MCP tool unavailable: ${name}`)
  }
  const result = await tool.callback(args)
  const text = result?.content?.[0]?.text
  if (!text) return result
  try {
    return JSON.parse(text)
  } catch {
    return { text }
  }
}
