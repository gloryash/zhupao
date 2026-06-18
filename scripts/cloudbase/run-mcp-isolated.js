#!/usr/bin/env node
'use strict'

const path = require('node:path')

const { createMcpRuntime } = require('./mcp-context')

const root = path.resolve(__dirname, '../..')
const runtime = createMcpRuntime(root, process.env)

const {
  createCloudBaseMcpServer,
  StdioServerTransport
} = require('@cloudbase/cloudbase-mcp')

main().catch((error) => {
  console.error(JSON.stringify({
    success: false,
    code: 'CLOUDBASE_MCP_STDIO_FAILED',
    message: error.message
  }, null, 2))
  process.exit(1)
})

async function main() {
  const server = await createCloudBaseMcpServer({
    name: 'cloudbase-mcp',
    version: '1.0.0',
    enableTelemetry: false,
    cloudBaseOptions: runtime.cloudBaseOptions,
    pluginsEnabled: runtime.pluginsEnabled,
    ide: process.env.INTEGRATION_IDE || 'Codex'
  })

  const transport = new StdioServerTransport()
  await server.connect(transport)
}
