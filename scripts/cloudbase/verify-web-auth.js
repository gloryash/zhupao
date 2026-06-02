#!/usr/bin/env node
'use strict'

const crypto = require('crypto')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')
const {
  DEFAULT_ENV,
  buildIsolatedEnv,
  ensureProfileHome,
  tcbBinaryPath
} = require('./tcb-profile')

const envId = process.env.CLOUDBASE_ENV || DEFAULT_ENV
const repoRoot = path.resolve(__dirname, '../..')
const tcbBin = tcbBinaryPath(repoRoot)
const INVOKE_TIMEOUT_MS = 60000

ensureProfileHome(repoRoot, process.env)

async function main() {
  const account = createAccount()

  const registerResult = invokeCloudFunction('webAuth', {
    action: 'register',
    identifier: account.phone,
    password: account.password,
    profile: {
      userType: 'disabled',
      nickName: `VerifyAuth${account.runId}`,
      name: 'Verification User',
      emergencyName: 'Verification Contact',
      emergencyPhone: '13900000000',
      emergencyRelation: 'test',
      runningLocation: 'CloudBase verification'
    }
  })
  assertSuccess(registerResult, 'webAuth.register')
  assert(registerResult.authToken, 'webAuth.register should return an authToken')
  assert(registerResult.user && registerResult.user.userType === 'disabled', 'registered user should be disabled')

  const meResult = invokeCloudFunction('webAuth', {
    action: 'me',
    authToken: registerResult.authToken
  })
  assertSuccess(meResult, 'webAuth.me')
  assert(meResult.source === 'web', 'webAuth.me should resolve a web session')
  assert(meResult.user && meResult.user.userType === 'disabled', 'webAuth.me should return the registered user')

  const loginResult = invokeCloudFunction('webAuth', {
    action: 'login',
    identifier: account.phone,
    password: account.password
  })
  assertSuccess(loginResult, 'webAuth.login')
  assert(loginResult.authToken, 'webAuth.login should return an authToken')

  const logoutResult = invokeCloudFunction('webAuth', {
    action: 'logout',
    authToken: loginResult.authToken
  })
  assertSuccess(logoutResult, 'webAuth.logout')

  printSuccess({
    env: envId,
    account: {
      identifierType: 'phone',
      phoneSuffix: account.phone.slice(-4)
    },
    checks: [
      'webAuth.register',
      'webAuth.me',
      'webAuth.login',
      'webAuth.logout'
    ]
  })
}

function createAccount() {
  const runId = `${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`
  const hash = crypto.createHash('sha1').update(`auth:${runId}`).digest('hex')
  const phoneTail = String(BigInt(`0x${hash.slice(0, 12)}`) % 10000000000n).padStart(10, '0')

  return {
    runId,
    phone: `1${phoneTail}`,
    password: `Verify-${runId}-Pass9`
  }
}

function invokeCloudFunction(name, payload) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'blind-run-tcb-'))
  const payloadPath = path.join(tempDir, 'payload.json')
  fs.writeFileSync(payloadPath, JSON.stringify(payload), { mode: 0o600 })

  let result
  try {
    result = spawnSync(tcbBin, [
      'fn',
      'invoke',
      name,
      '-e',
      envId,
      '-d',
      `@${payloadPath}`,
      '--json'
    ], {
      cwd: repoRoot,
      encoding: 'utf8',
      timeout: INVOKE_TIMEOUT_MS,
      env: buildIsolatedEnv(process.env, repoRoot, envId)
    })
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true })
  }

  if (result.error) {
    throw new Error(`Failed to run tcb CLI: ${result.error.message}`)
  }

  if (result.signal) {
    throw new Error(`tcb fn invoke ${name} terminated by ${result.signal}`)
  }

  if (result.status !== 0) {
    throw new Error(`tcb fn invoke ${name} failed with exit ${result.status}: ${redactOutput(result.stderr || result.stdout)}`)
  }

  return extractFunctionResult(result.stdout, name)
}

function extractFunctionResult(output, name) {
  const parsedValues = extractJsonValues(output)
  if (parsedValues.length === 0) {
    throw new Error(`tcb fn invoke ${name} did not emit parseable JSON`)
  }

  const wrapper = parsedValues[parsedValues.length - 1]
  const data = wrapper && wrapper.data ? wrapper.data : wrapper

  if (data && typeof data.RetMsg === 'string') {
    return parseJsonString(data.RetMsg, `RetMsg from ${name}`)
  }

  if (data && typeof data.body === 'string') {
    return parseJsonString(data.body, `body from ${name}`)
  }

  if (data && data.RetMsg && typeof data.RetMsg === 'object') {
    return data.RetMsg
  }

  if (data && data.body && typeof data.body === 'object') {
    return data.body
  }

  return data
}

function extractJsonValues(text) {
  const values = []
  let start = -1
  let depth = 0
  let inString = false
  let escaping = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]

    if (inString) {
      if (escaping) {
        escaping = false
      } else if (char === '\\') {
        escaping = true
      } else if (char === '"') {
        inString = false
      }
      continue
    }

    if (char === '"') {
      inString = true
      continue
    }

    if (char === '{' || char === '[') {
      if (depth === 0) {
        start = i
      }
      depth++
      continue
    }

    if ((char === '}' || char === ']') && depth > 0) {
      depth--
      if (depth === 0 && start !== -1) {
        const candidate = text.slice(start, i + 1)
        try {
          values.push(JSON.parse(candidate))
        } catch (err) {
          // Ignore non-JSON brace blocks from CLI banners or logs.
        }
        start = -1
      }
    }
  }

  return values
}

function parseJsonString(value, label) {
  try {
    return JSON.parse(value)
  } catch (err) {
    throw new Error(`Unable to parse ${label} as JSON`)
  }
}

function assertSuccess(result, label) {
  assert(result && result.success === true, `${label} expected success=true, got ${summarizeResult(result)}`)
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function summarizeResult(result) {
  if (!result || typeof result !== 'object') {
    return String(result)
  }
  return JSON.stringify({
    success: result.success,
    code: result.code,
    error: result.error
  })
}

function redactOutput(output) {
  return String(output || '')
    .replace(/"authToken"\s*:\s*"[^"]+"/g, '"authToken":"[redacted]"')
    .replace(/"password"\s*:\s*"[^"]+"/g, '"password":"[redacted]"')
    .trim()
}

function printSuccess(details) {
  console.log(JSON.stringify({
    success: true,
    script: 'verify-web-auth',
    ...details
  }, null, 2))
}

main().catch((err) => {
  console.error(JSON.stringify({
    success: false,
    script: 'verify-web-auth',
    error: err.message
  }, null, 2))
  process.exit(1)
})
