#!/usr/bin/env node
'use strict'

const crypto = require('crypto')
const path = require('path')
const { spawnSync } = require('child_process')

const DEFAULT_ENV = 'cloud1-d8gbfzr7t6c5dc8bc'
const envId = process.env.CLOUDBASE_ENV || DEFAULT_ENV
const tcbBin = path.resolve(__dirname, '../../node_modules/.bin/tcb')

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
  const phoneTail = String(Date.now()).slice(-10)

  return {
    runId,
    phone: `1${phoneTail}`,
    password: `Verify-${runId}-Pass9`
  }
}

function invokeCloudFunction(name, payload) {
  const args = [
    'fn',
    'invoke',
    name,
    '-e',
    envId,
    '--params',
    JSON.stringify(payload),
    '--json'
  ]

  const result = spawnSync(tcbBin, args, {
    cwd: path.resolve(__dirname, '../..'),
    encoding: 'utf8',
    env: { ...process.env, CLOUDBASE_ENV: envId }
  })

  if (result.error) {
    throw new Error(`Failed to run tcb CLI: ${result.error.message}`)
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
