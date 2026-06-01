#!/usr/bin/env node
'use strict'

const crypto = require('crypto')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')

const DEFAULT_ENV = 'cloud1-d8gbfzr7t6c5dc8bc'
const envId = process.env.CLOUDBASE_ENV || DEFAULT_ENV
const repoRoot = path.resolve(__dirname, '../..')
const tcbBin = path.resolve(
  repoRoot,
  'node_modules/.bin',
  process.platform === 'win32' ? 'tcb.cmd' : 'tcb'
)
const INVOKE_TIMEOUT_MS = 60000

async function main() {
  await ensureExamQuestions()

  const disabled = createAccount('disabled')
  const volunteer = createAccount('volunteer')
  const disabledRegistration = registerWebUser(disabled)
  const volunteerRegistration = registerWebUser(volunteer)

  updateUserDemographics(disabledRegistration.user._id, {
    age: 32,
    userAge: 32,
    gender: 'female'
  })

  certifyVolunteer(volunteerRegistration.authToken)

  const requestedDepartureAt = new Date(Date.now() + 45 * 60 * 1000).toISOString()
  const publishResult = invokeCloudFunction('handleOrder', {
    action: 'publish',
    authToken: disabledRegistration.authToken,
    targetDistance: '2.8',
    estimatedDuration: '35',
    departureMode: 'delayed',
    departureOffsetMinutes: 45,
    departureAt: requestedDepartureAt,
    city: '上海市',
    origin: {
      latitude: 31.23065,
      longitude: 121.47395,
      address: '上海市黄浦区人民广场1号门',
      city: '上海市'
    },
    destination: {
      latitude: 31.22408,
      longitude: 121.46924,
      address: '上海市黄浦区新天地太平湖',
      city: '上海市'
    },
    latitude: 31.23065,
    longitude: 121.47395,
    address: '上海市黄浦区人民广场1号门',
    destinationLatitude: 31.22408,
    destinationLongitude: 121.46924,
    destinationAddress: '上海市黄浦区新天地太平湖'
  })
  assertSuccess(publishResult, 'handleOrder.publish delayed order')

  const order = publishResult.order
  assert(order && order._id, 'publish should return order with _id')
  assert(order.originAddress === '上海市黄浦区人民广场1号门', 'originAddress should be persisted')
  assert(order.destinationAddress === '上海市黄浦区新天地太平湖', 'destinationAddress should be persisted')
  assert(order.departureMode === 'delayed', 'departureMode should be delayed')
  assert(order.departureOffsetMinutes === 45, 'departureOffsetMinutes should be 45')
  assert(hasValue(order.departureAt), 'departureAt should be returned')
  assert(Number.isInteger(order.departureHour), 'departureHour should be returned')
  assert(/^\d{4}-\d{2}-\d{2}$/.test(String(order.departureDate)), 'departureDate should be YYYY-MM-DD')
  assert(hasValue(order.departureLabel), 'departureLabel should be returned')
  assert(order.runnerGender === 'female', 'runnerGender should be copied from user')
  assert(Number(order.runnerAge) === 32, 'runnerAge should be copied from user')

  const exactHourOrders = getWaitingOrders(volunteerRegistration.authToken, {
    latitude: 31.2307,
    longitude: 121.474,
    maxDistance: 5000,
    distanceBasis: 'origin',
    gender: 'female',
    ageRange: '30-39',
    city: '上海市',
    departureFilterType: 'hour',
    departureHour: order.departureHour
  })
  const hourMatch = findOrder(exactHourOrders, order._id)
  assert(hourMatch, 'hour + city + gender + age filter should include the new order')
  assert(hourMatch.destinationAddress === '上海市黄浦区新天地太平湖', 'waiting order should expose destinationAddress')
  assert(hourMatch.distanceBasis === 'origin', 'distance basis should be origin')
  assert(Number.isFinite(hourMatch.distance) && hourMatch.distance <= 5000, 'origin distance should be computed within 5km')

  const exactDateOrders = getWaitingOrders(volunteerRegistration.authToken, {
    latitude: 31.2307,
    longitude: 121.474,
    maxDistance: 5000,
    distanceBasis: 'origin',
    city: '上海市',
    departureFilterType: 'date',
    departureDate: order.departureDate
  })
  assert(findOrder(exactDateOrders, order._id), 'date filter should include the new order')

  const withinOrders = getWaitingOrders(volunteerRegistration.authToken, {
    latitude: 31.2307,
    longitude: 121.474,
    maxDistance: 5000,
    distanceBasis: 'origin',
    city: '上海市',
    departureFilterType: 'within',
    departureWithinMinutes: 60
  })
  assert(findOrder(withinOrders, order._id), 'within-60-minutes filter should include the new order')

  const wrongCityOrders = getWaitingOrders(volunteerRegistration.authToken, {
    latitude: 31.2307,
    longitude: 121.474,
    maxDistance: 5000,
    distanceBasis: 'origin',
    city: '苏州市',
    departureFilterType: 'date',
    departureDate: order.departureDate
  })
  assert(!findOrder(wrongCityOrders, order._id), 'non-matching city filter should exclude the new order')

  const acceptResult = invokeCloudFunction('handleOrder', {
    action: 'accept',
    authToken: volunteerRegistration.authToken,
    orderId: order._id,
    latitude: 31.231,
    longitude: 121.4742
  })
  assertSuccess(acceptResult, 'handleOrder.accept')
  assert(acceptResult.order && acceptResult.order.status === 'accepted', 'accept should return accepted order')

  assertSuccess(invokeCloudFunction('handleOrder', {
    action: 'updateOrderStatus',
    authToken: volunteerRegistration.authToken,
    orderId: order._id,
    status: 'arrived'
  }), 'handleOrder.updateOrderStatus arrived')

  assertSuccess(invokeCloudFunction('handleOrder', {
    action: 'updateOrderStatus',
    authToken: volunteerRegistration.authToken,
    orderId: order._id,
    status: 'running'
  }), 'handleOrder.updateOrderStatus running')

  assertSuccess(invokeCloudFunction('handleOrder', {
    action: 'updateVolunteerLocation',
    authToken: volunteerRegistration.authToken,
    orderId: order._id,
    latitude: 31.2285,
    longitude: 121.4723,
    runningStats: {
      distance: 0.6,
      duration: 5,
      pace: '8\'20"/km'
    },
    runningPath: [
      { latitude: 31.23065, longitude: 121.47395 },
      { latitude: 31.2285, longitude: 121.4723 }
    ]
  }), 'handleOrder.updateVolunteerLocation')

  assertSuccess(invokeCloudFunction('handleOrder', {
    action: 'complete',
    authToken: volunteerRegistration.authToken,
    orderId: order._id,
    actualDistance: 2.8,
    duration: 35
  }), 'handleOrder.complete')

  const disabledOrders = invokeCloudFunction('handleOrder', {
    action: 'getMyOrders',
    authToken: disabledRegistration.authToken,
    status: 'completed',
    page: 1,
    pageSize: 10
  })
  assertSuccess(disabledOrders, 'handleOrder.getMyOrders completed')
  const completed = findOrder(disabledOrders.orders || [], order._id)
  assert(completed && completed.status === 'completed', 'completed order should be visible to runner')
  assert(completed.destinationAddress === '上海市黄浦区新天地太平湖', 'completed order should keep destinationAddress')

  printSuccess({
    env: envId,
    order: {
      idSuffix: String(order._id).slice(-8),
      destinationAddress: completed.destinationAddress,
      departureMode: order.departureMode,
      departureOffsetMinutes: order.departureOffsetMinutes,
      departureHour: order.departureHour,
      departureDate: order.departureDate,
      distanceBasis: hourMatch.distanceBasis,
      distanceMeters: hourMatch.distance
    },
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
    checks: [
      'webAuth.register disabled/volunteer',
      'handleTraining.updateVideoWatched',
      'handleTraining.submitExam',
      'handleOrder.publish with origin/destination/departure',
      'getWaitingOrders hour/date/within/city/distanceBasis filters',
      'accept -> arrived -> running -> location upload -> complete',
      'getMyOrders completed retains destination'
    ]
  })
}

function registerWebUser(account) {
  const profile = account.userType === 'volunteer'
    ? {
        userType: 'volunteer',
        nickName: `VerifyVolunteer${account.runId}`,
        name: 'Verification Volunteer',
        gender: 'male',
        runningYears: '3',
        pace: '6:00',
        hasMarathon: 'no',
        hasFirstAid: 'yes',
        hasCompanionExp: 'yes'
      }
    : {
        userType: 'disabled',
        nickName: `VerifyDisabled${account.runId}`,
        name: 'Verification Runner',
        gender: 'female',
        emergencyName: 'Verification Contact',
        emergencyPhone: '13900000000',
        emergencyRelation: 'test',
        runningLocation: '上海市黄浦区人民广场'
      }

  const result = invokeCloudFunction('webAuth', {
    action: 'register',
    identifier: account.phone,
    password: account.password,
    profile
  })

  assertSuccess(result, `webAuth.register ${account.userType}`)
  assert(result.authToken, `webAuth.register ${account.userType} should return authToken`)
  assert(result.user && result.user.userType === account.userType, `registered user should be ${account.userType}`)
  return result
}

function certifyVolunteer(authToken) {
  assertSuccess(invokeCloudFunction('handleTraining', {
    action: 'updateVideoWatched',
    authToken
  }), 'handleTraining.updateVideoWatched')

  const exams = getExamDocuments()
  assert(exams.length > 0, 'exam collection should contain questions')

  const answers = exams
    .sort((a, b) => getNumber(a.order) - getNumber(b.order))
    .map((question) => ({
      questionId: question._id,
      selectedIndex: getNumber(question.answer)
    }))

  const examResult = invokeCloudFunction('handleTraining', {
    action: 'submitExam',
    authToken,
    answers
  })

  assertSuccess(examResult, 'handleTraining.submitExam')
  assert(examResult.passed === true, 'volunteer exam should pass')
  assert(hasValue(examResult.certificateNo), 'passed exam should issue certificateNo')
}

function getExamDocuments() {
  const command = [{
    TableName: 'exams',
    CommandType: 'QUERY',
    Command: JSON.stringify({
      find: 'exams',
      filter: {},
      sort: { order: 1 },
      limit: 100
    })
  }]
  const result = executeDbCommand(command)
  const docs = result && result.data && result.data.results && result.data.results[0]
  return Array.isArray(docs) ? docs : []
}

async function ensureExamQuestions() {
  if (getExamDocuments().length > 0) return
  assertSuccess(invokeCloudFunction('initDB', {}), 'initDB')
  assert(getExamDocuments().length > 0, 'initDB should seed exam questions')
}

function updateUserDemographics(userId, data) {
  const command = [{
    TableName: 'users',
    CommandType: 'UPDATE',
    Command: JSON.stringify({
      update: 'users',
      updates: [
        {
          q: { _id: userId },
          u: { $set: data }
        }
      ]
    })
  }]
  const result = executeDbCommand(command)
  const updateResult = result && result.data && result.data.results && result.data.results[0] && result.data.results[0][0]
  assert(updateResult && getNumber(updateResult.n) === 1, 'test user demographics should match one user')
}

function getWaitingOrders(authToken, filters) {
  const result = invokeCloudFunction('handleOrder', {
    action: 'getWaitingOrders',
    authToken,
    page: 1,
    pageSize: 20,
    ...filters
  })
  assertSuccess(result, 'handleOrder.getWaitingOrders')
  return Array.isArray(result.orders) ? result.orders : []
}

function findOrder(orders, orderId) {
  return orders.find(order => order && order._id === orderId) || null
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
      env: { ...process.env, CI: '1', CLOUDBASE_ENV: envId }
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

function executeDbCommand(command) {
  const result = spawnSync(tcbBin, [
    'db',
    'nosql',
    'execute',
    '-e',
    envId,
    '--json',
    '--command',
    JSON.stringify(command)
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: INVOKE_TIMEOUT_MS,
    env: { ...process.env, CI: '1', CLOUDBASE_ENV: envId }
  })

  if (result.error) {
    throw new Error(`Failed to run tcb CLI: ${result.error.message}`)
  }

  if (result.signal) {
    throw new Error(`tcb db nosql execute terminated by ${result.signal}`)
  }

  if (result.status !== 0) {
    throw new Error(`tcb db nosql execute failed with exit ${result.status}: ${redactOutput(result.stderr || result.stdout)}`)
  }

  const values = extractJsonValues(result.stdout)
  if (values.length === 0) {
    throw new Error('tcb db nosql execute did not emit parseable JSON')
  }
  return values[values.length - 1]
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

function getNumber(value) {
  if (typeof value === 'number') return value
  if (value && typeof value === 'object') {
    if (value.$numberInt !== undefined) return Number(value.$numberInt)
    if (value.$numberLong !== undefined) return Number(value.$numberLong)
    if (value.$numberDouble !== undefined) return Number(value.$numberDouble)
  }
  return Number(value)
}

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== ''
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
    script: 'verify-order-refinement',
    ...details
  }, null, 2))
}

main().catch((err) => {
  console.error(JSON.stringify({
    success: false,
    script: 'verify-order-refinement',
    error: err.message
  }, null, 2))
  process.exit(1)
})
