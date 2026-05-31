#!/usr/bin/env node
'use strict'

const crypto = require('crypto')
const path = require('path')
const { spawnSync } = require('child_process')

const DEFAULT_ENV = 'cloud1-d8gbfzr7t6c5dc8bc'
const envId = process.env.CLOUDBASE_ENV || DEFAULT_ENV
const tcbBin = path.resolve(__dirname, '../../node_modules/.bin/tcb')

async function main() {
  const disabled = createAccount('disabled')
  const volunteer = createAccount('volunteer')

  const disabledRegistration = registerWebUser(disabled)
  const volunteerRegistration = registerWebUser(volunteer)

  const publishResult = invokeCloudFunction('handleOrder', {
    action: 'publish',
    authToken: disabledRegistration.authToken,
    targetDistance: '3',
    estimatedDuration: '30',
    latitude: 31.2304,
    longitude: 121.4737,
    address: 'CloudBase verification point'
  })
  assertSuccess(publishResult, 'handleOrder.publish')
  const orderId = publishResult.orderId || (publishResult.order && publishResult.order._id)
  assert(orderId, 'handleOrder.publish should return orderId')

  const disabledWaitingOrders = invokeCloudFunction('handleOrder', {
    action: 'getWaitingOrders',
    authToken: disabledRegistration.authToken,
    page: 1,
    pageSize: 1
  })
  assertFailureCode(disabledWaitingOrders, 'FORBIDDEN', 'disabled handleOrder.getWaitingOrders')

  const untrainedWaitingOrders = invokeCloudFunction('handleOrder', {
    action: 'getWaitingOrders',
    authToken: volunteerRegistration.authToken,
    page: 1,
    pageSize: 10,
    latitude: 31.2304,
    longitude: 121.4737
  })
  assertFailureCode(untrainedWaitingOrders, 'TRAINING_REQUIRED', 'untrained volunteer handleOrder.getWaitingOrders')

  const untrainedAccept = invokeCloudFunction('handleOrder', {
    action: 'accept',
    authToken: volunteerRegistration.authToken,
    orderId
  })
  assertFailureCode(untrainedAccept, 'TRAINING_REQUIRED', 'untrained volunteer handleOrder.accept')

  printSuccess({
    env: envId,
    users: {
      disabled: {
        identifierType: 'phone',
        phoneSuffix: disabled.phone.slice(-4)
      },
      volunteer: {
        identifierType: 'phone',
        phoneSuffix: volunteer.phone.slice(-4)
      }
    },
    order: {
      idSuffix: String(orderId).slice(-8)
    },
    checks: [
      'webAuth.register disabled',
      'webAuth.register volunteer',
      'handleOrder.publish',
      'handleOrder.getWaitingOrders disabled FORBIDDEN',
      'handleOrder.getWaitingOrders untrained volunteer TRAINING_REQUIRED',
      'handleOrder.accept untrained volunteer TRAINING_REQUIRED'
    ]
  })
}

function registerWebUser(account) {
  const profile = account.userType === 'volunteer'
    ? {
        userType: 'volunteer',
        nickName: `VerifyVolunteer${account.runId}`,
        name: 'Verification Volunteer',
        runningYears: '1',
        pace: '6:00',
        hasMarathon: 'no',
        hasFirstAid: 'no',
        hasCompanionExp: 'no'
      }
    : {
        userType: 'disabled',
        nickName: `VerifyDisabled${account.runId}`,
        name: 'Verification Runner',
        emergencyName: 'Verification Contact',
        emergencyPhone: '13900000000',
        emergencyRelation: 'test',
        runningLocation: 'CloudBase verification'
      }

  const result = invokeCloudFunction('webAuth', {
    action: 'register',
    identifier: account.phone,
    password: account.password,
    profile
  })

  assertSuccess(result, `webAuth.register ${account.userType}`)
  assert(result.authToken, `webAuth.register ${account.userType} should return an authToken`)
  assert(result.user && result.user.userType === account.userType, `registered user should be ${account.userType}`)
  return result
}

function createAccount(userType) {
  const runId = `${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`
  const hash = crypto.createHash('sha1').update(`${userType}:${runId}`).digest('hex')
  const phoneTail = String(BigInt(`0x${hash.slice(0, 12)}`) % 10000000000n).padStart(10, '0')

  return {
    runId,
    userType,
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

function assertNotSuccess(result, label) {
  assert(result && result.success !== true, `${label} should not succeed, got ${summarizeResult(result)}`)
}

function assertFailureCode(result, code, label) {
  assertNotSuccess(result, label)
  assert(result.code === code, `${label} expected code=${code}, got ${summarizeResult(result)}`)
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
    script: 'verify-core-flow',
    ...details
  }, null, 2))
}

main().catch((err) => {
  console.error(JSON.stringify({
    success: false,
    script: 'verify-core-flow',
    error: err.message
  }, null, 2))
  process.exit(1)
})
