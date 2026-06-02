const cloud = require('wx-server-sdk')
const crypto = require('crypto')
const { ok, fail } = require('./shared/responses')
const {
  normalizeIdentifier,
  normalizePhone,
  createWebOpenid,
  publicUser
} = require('./shared/user')
const { resolveIdentity, hashToken } = require('./shared/auth')
const { resolveRegistrationPhone } = require('./shared/registration-phone')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000
const PASSWORD_MIN_LENGTH = 8
const PASSWORD_MAX_LENGTH = 128
const SCRYPT_KEY_LENGTH = 64
const MAX_FAILED_LOGINS = 5
const LOCKOUT_MS = 15 * 60 * 1000

exports.main = async (event = {}) => {
  try {
    switch (event.action) {
      case 'register':
        return await register(event)
      case 'login':
        return await login(event)
      case 'logout':
        return await logout(event)
      case 'me':
        return await me(event)
      default:
        return fail('UNKNOWN_ACTION', '未知操作')
    }
  } catch (err) {
    console.error('webAuth error:', err && err.message ? err.message : err)
    return fail('INTERNAL_ERROR', '服务暂时不可用')
  }
}

async function register(event) {
  const identifier = normalizeIdentifier(event.identifier)
  const password = String(event.password || '')
  const profile = sanitizeProfile(event.profile)

  if (!identifier.value) {
    return fail('IDENTIFIER_REQUIRED', '请输入手机号或邮箱')
  }

  if (!isValidIdentifier(identifier)) {
    return fail('INVALID_IDENTIFIER', '请输入有效的手机号或邮箱')
  }

  const phoneResult = resolveRegistrationPhone(identifier, profile.phone)
  if (phoneResult.error) {
    return fail(phoneResult.error.code, phoneResult.error.message)
  }
  profile.phone = phoneResult.phone

  if (password.length < PASSWORD_MIN_LENGTH) {
    return fail('PASSWORD_TOO_SHORT', '密码至少需要8位')
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    return fail('PASSWORD_TOO_LONG', '密码不能超过128位')
  }

  const existingAccount = await findWebAccount(identifier)
  if (existingAccount) {
    return fail('ACCOUNT_EXISTS', '账号已存在')
  }

  const accountId = getAccountId(identifier)
  const linkConflict = await getPhoneLinkConflict(identifier, profile.phone)
  if (linkConflict) {
    return linkConflict
  }

  const passwordRecord = hashPassword(password)

  try {
    await db.collection('web_accounts').add({
      data: {
        _id: accountId,
        accountId,
        identifierType: identifier.type,
        identifier: identifier.value,
        userId: '',
        openid: '',
        passwordHash: passwordRecord.hash,
        passwordSalt: passwordRecord.salt,
        passwordAlgorithm: 'scrypt',
        failedLoginCount: 0,
        lockUntil: '',
        active: false,
        status: 'provisioning',
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    })
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      return fail('ACCOUNT_EXISTS', '账号已存在')
    }
    throw err
  }

  let user = null
  try {
    const userResult = await createNewUser(identifier, profile)
    user = userResult.user
    await db.collection('web_accounts').doc(accountId).update({
      data: {
        userId: user._id,
        openid: user.openid,
        active: true,
        status: 'active',
        updatedAt: db.serverDate()
      }
    })
  } catch (err) {
    if (user && user._id) {
      await cleanupCreatedUser(user._id)
    }
    await cleanupProvisioningAccount(accountId)
    throw err
  }

  const session = await createSession(user._id)

  return ok({
    authToken: session.authToken,
    expiresAt: session.expiresAt,
    user: publicUser(user)
  })
}

async function login(event) {
  const identifier = normalizeIdentifier(event.identifier)
  const password = String(event.password || '')

  if (!identifier.value || !password) {
    return fail('INVALID_CREDENTIALS', '账号或密码错误')
  }

  if (!isValidIdentifier(identifier)) {
    return fail('INVALID_IDENTIFIER', '请输入有效的手机号或邮箱')
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    return fail('INVALID_CREDENTIALS', '账号或密码错误')
  }

  const account = await findWebAccount(identifier, true)
  if (!account) {
    return fail('INVALID_CREDENTIALS', '账号或密码错误')
  }

  if (isAccountLocked(account)) {
    return fail('ACCOUNT_LOCKED', '登录尝试次数过多，请稍后再试')
  }

  if (!verifyPassword(password, account.passwordSalt, account.passwordHash)) {
    await recordFailedLogin(account)
    return fail('INVALID_CREDENTIALS', '账号或密码错误')
  }

  const userRes = await db.collection('users').doc(account.userId).get()
  if (!userRes.data) {
    return fail('USER_NOT_FOUND', '用户不存在')
  }

  await db.collection('web_accounts').doc(account._id).update({
    data: {
      failedLoginCount: 0,
      lockUntil: '',
      lastLoginAt: db.serverDate(),
      updatedAt: db.serverDate()
    }
  })

  const session = await createSession(account.userId)

  return ok({
    authToken: session.authToken,
    expiresAt: session.expiresAt,
    user: publicUser(userRes.data)
  })
}

async function logout(event) {
  const authToken = event.authToken || event._authToken
  if (!authToken) {
    return ok()
  }

  await db.collection('web_sessions')
    .where({ tokenHash: hashToken(authToken), revoked: false })
    .update({
      data: {
        revoked: true,
        revokedAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    })

  return ok()
}

async function me(event) {
  const identity = await resolveIdentity(db, event)
  if (identity.error) {
    return identity.error
  }

  return ok({
    source: identity.source,
    user: publicUser(identity.user)
  })
}

async function findWebAccount(identifier, activeOnly = false) {
  const accountId = getAccountId(identifier)
  const docAccount = await getWebAccountById(accountId)
  if (docAccount && (!activeOnly || docAccount.active === true)) {
    return docAccount
  }

  const query = {
    identifierType: identifier.type,
    identifier: identifier.value
  }

  if (activeOnly) {
    query.active = true
  }

  const res = await db.collection('web_accounts')
    .where(query)
    .limit(1)
    .get()

  return res.data[0] || null
}

async function getWebAccountById(accountId) {
  try {
    const res = await db.collection('web_accounts').doc(accountId).get()
    return res.data || null
  } catch (err) {
    return null
  }
}

async function getPhoneLinkConflict(identifier, phone) {
  const normalizedPhone = normalizePhone(phone || (identifier.type === 'phone' ? identifier.value : ''))
  if (normalizedPhone) {
    const userRes = await db.collection('users')
      .where({ phone: normalizedPhone })
      .limit(1)
      .get()

    if (userRes.data.length > 0) {
      return fail(
        'PHONE_LINK_REQUIRED',
        '该手机号已有关联用户，请先完成手机号验证后再绑定网页账号'
      )
    }
  }

  return null
}

async function createNewUser(identifier, profile) {
  const now = new Date()
  const userType = profile.userType || profile.role || 'disabled'
  const webOpenid = createWebOpenid()
  const userData = {
    openid: webOpenid,
    webOpenid,
    miniOpenid: '',
    userType,
    role: profile.role || userType,
    nickName: profile.nickName || profile.name || 'Web用户',
    avatarUrl: profile.avatarUrl || '',
    phone: profile.phone,
    email: identifier.type === 'email' ? identifier.value : '',
    name: profile.name || '',
    gender: profile.gender || '',
    resume: profile.resume || '',
    points: 0,
    exp: 0,
    checkInDays: 0,
    lastCheckInDate: '',
    tierLevel: 1,
    tierName: userType === 'volunteer' ? '启明之星' : '初心跑者',
    totalRuns: 0,
    totalDistance: 0,
    totalTime: 0,
    likes: 0,
    medals: 0,
    emergencyPhone: profile.emergencyPhone || '',
    emergencyName: profile.emergencyName || '',
    emergencyRelation: profile.emergencyRelation || '',
    runningLocation: profile.runningLocation || '',
    examPassed: userType === 'volunteer' ? false : null,
    examScore: 0,
    examDate: '',
    certificateNo: '',
    certificateUrl: '',
    videoWatched: false,
    isAvailable: false,
    runningYears: profile.runningYears || '',
    pace: profile.pace || '',
    hasMarathon: profile.hasMarathon || 'no',
    hasFirstAid: profile.hasFirstAid || 'no',
    hasCompanionExp: profile.hasCompanionExp || 'no',
    latitude: 0,
    longitude: 0,
    authSources: ['web'],
    createdAt: now.toLocaleString(),
    lastLoginTime: now.toLocaleString(),
    updatedAt: db.serverDate()
  }

  const addRes = await db.collection('users').add({ data: userData })
  return { user: { _id: addRes._id, ...userData } }
}

async function cleanupProvisioningAccount(accountId) {
  try {
    const account = await getWebAccountById(accountId)
    if (account && account.status === 'provisioning' && !account.userId) {
      await db.collection('web_accounts').doc(accountId).remove()
    }
  } catch (err) {
    console.error('cleanup provisioning account failed:', err && err.message ? err.message : err)
  }
}

async function cleanupCreatedUser(userId) {
  try {
    if (userId) {
      await db.collection('users').doc(userId).remove()
    }
  } catch (err) {
    console.error('cleanup created user failed:', err && err.message ? err.message : err)
  }
}

async function createSession(userId) {
  const authToken = createAuthToken()
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString()

  await db.collection('web_sessions').add({
    data: {
      userId,
      tokenHash: hashToken(authToken),
      revoked: false,
      expiresAt,
      createdAt: db.serverDate(),
      updatedAt: db.serverDate(),
      lastUsedAt: db.serverDate()
    }
  })

  return { authToken, expiresAt }
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEY_LENGTH).toString('hex')
  return { salt, hash }
}

function verifyPassword(password, salt, expectedHash) {
  if (!salt || !expectedHash) {
    return false
  }

  const expected = Buffer.from(String(expectedHash), 'hex')
  const actual = crypto.scryptSync(password, String(salt), expected.length)

  if (actual.length !== expected.length) {
    return false
  }

  return crypto.timingSafeEqual(actual, expected)
}

async function recordFailedLogin(account) {
  await db.collection('web_accounts').doc(account._id).update({
    data: {
      failedLoginCount: _.inc(1),
      failedLoginAt: db.serverDate(),
      updatedAt: db.serverDate()
    }
  })

  const latest = await getWebAccountById(account._id)
  const failedLoginCount = Number((latest && latest.failedLoginCount) || 0)
  if (failedLoginCount < MAX_FAILED_LOGINS) {
    return
  }

  await db.collection('web_accounts').doc(account._id).update({
    data: {
      lockUntil: new Date(Date.now() + LOCKOUT_MS).toISOString(),
      failedLoginAt: db.serverDate(),
      updatedAt: db.serverDate()
    }
  })
}

function isAccountLocked(account) {
  if (!account.lockUntil) {
    return false
  }

  const lockUntil = new Date(account.lockUntil).getTime()
  return Number.isFinite(lockUntil) && lockUntil > Date.now()
}

function isValidIdentifier(identifier) {
  if (identifier.type === 'phone') {
    return /^1\d{10}$/.test(identifier.value)
  }

  if (identifier.type === 'email') {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier.value)
  }

  return false
}

function getAccountId(identifier) {
  const hash = crypto
    .createHash('sha256')
    .update(`${identifier.type}:${identifier.value}`)
    .digest('hex')
  return `acct_${hash.slice(0, 40)}`
}

function isDuplicateKeyError(err) {
  const message = String((err && (err.message || err.errMsg)) || '').toLowerCase()
  return message.includes('duplicate') || message.includes('e11000')
}

function createAuthToken() {
  return crypto.randomBytes(32)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function sanitizeProfile(profile) {
  const source = profile || {}
  const userType = source.userType === 'volunteer' ? 'volunteer' : 'disabled'
  return {
    userType,
    role: userType,
    nickName: cleanString(source.nickName, 40),
    avatarUrl: cleanString(source.avatarUrl, 500),
    name: cleanString(source.name, 40),
    phone: normalizePhone(source.phone).slice(0, 20),
    gender: cleanString(source.gender, 20),
    resume: cleanString(source.resume, 500),
    emergencyPhone: cleanString(source.emergencyPhone, 20),
    emergencyName: cleanString(source.emergencyName, 40),
    emergencyRelation: cleanString(source.emergencyRelation, 40),
    runningLocation: cleanString(source.runningLocation, 120),
    runningYears: cleanString(source.runningYears, 20),
    pace: cleanString(source.pace, 30),
    hasMarathon: source.hasMarathon === 'yes' ? 'yes' : 'no',
    hasFirstAid: source.hasFirstAid === 'yes' ? 'yes' : 'no',
    hasCompanionExp: source.hasCompanionExp === 'yes' ? 'yes' : 'no'
  }
}

function cleanString(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength)
}
