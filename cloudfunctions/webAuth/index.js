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

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000
const PASSWORD_MIN_LENGTH = 8
const SCRYPT_KEY_LENGTH = 64

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

  if (password.length < PASSWORD_MIN_LENGTH) {
    return fail('PASSWORD_TOO_SHORT', '密码至少需要8位')
  }

  const existingAccount = await findWebAccount(identifier)
  if (existingAccount) {
    return fail('ACCOUNT_EXISTS', '账号已存在')
  }

  const user = await findOrCreateUser(identifier, profile)
  const passwordRecord = hashPassword(password)

  await db.collection('web_accounts').add({
    data: {
      identifierType: identifier.type,
      identifier: identifier.value,
      userId: user._id,
      openid: user.openid,
      passwordHash: passwordRecord.hash,
      passwordSalt: passwordRecord.salt,
      passwordAlgorithm: 'scrypt',
      active: true,
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    }
  })

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

  const account = await findWebAccount(identifier, true)
  if (!account || !verifyPassword(password, account.passwordSalt, account.passwordHash)) {
    return fail('INVALID_CREDENTIALS', '账号或密码错误')
  }

  const userRes = await db.collection('users').doc(account.userId).get()
  if (!userRes.data) {
    return fail('USER_NOT_FOUND', '用户不存在')
  }

  await db.collection('web_accounts').doc(account._id).update({
    data: {
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

async function findOrCreateUser(identifier, profile) {
  if (identifier.type === 'phone') {
    const userRes = await db.collection('users')
      .where({ phone: identifier.value })
      .limit(1)
      .get()

    if (userRes.data.length > 0) {
      const user = userRes.data[0]
      const authSources = mergeAuthSources(user.authSources)
      const updateData = {
        authSources,
        webLinkedAt: db.serverDate(),
        updatedAt: db.serverDate()
      }

      if (!user.webOpenid) {
        updateData.webOpenid = createWebOpenid()
      }

      await db.collection('users').doc(user._id).update({ data: updateData })
      return { ...user, ...updateData }
    }
  }

  const now = new Date()
  const userType = profile.userType || profile.role || 'disabled'
  const webOpenid = createWebOpenid()
  const userData = {
    ...profile,
    openid: webOpenid,
    webOpenid,
    miniOpenid: profile.miniOpenid || '',
    userType,
    role: profile.role || userType,
    nickName: profile.nickName || profile.name || 'Web用户',
    avatarUrl: profile.avatarUrl || '',
    phone: identifier.type === 'phone' ? identifier.value : normalizePhone(profile.phone),
    email: identifier.type === 'email' ? identifier.value : (profile.email || ''),
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
  return { _id: addRes._id, ...userData }
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

function createAuthToken() {
  return crypto.randomBytes(32)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function mergeAuthSources(authSources) {
  const sources = Array.isArray(authSources) ? authSources : []
  return Array.from(new Set([...sources, 'web']))
}

function sanitizeProfile(profile) {
  const clean = { ...(profile || {}) }
  delete clean.password
  delete clean.passwordHash
  delete clean.passwordSalt
  delete clean.tokenHash
  delete clean.authToken
  delete clean._authToken
  return clean
}
