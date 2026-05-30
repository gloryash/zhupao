const cloud = require('wx-server-sdk')
const crypto = require('crypto')
const { fail } = require('./responses')

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex')
}

async function resolveIdentity(db, event, options = {}) {
  const authToken = event && (event.authToken || event._authToken)
  if (authToken) {
    const tokenHash = hashToken(authToken)
    const sessionRes = await db.collection('web_sessions')
      .where({ tokenHash, revoked: false })
      .limit(1)
      .get()

    if (sessionRes.data.length === 0) {
      return { error: fail('SESSION_EXPIRED', '登录已过期，请重新登录') }
    }

    const session = sessionRes.data[0]
    const expiresAt = session.expiresAt ? new Date(session.expiresAt).getTime() : 0
    if (!expiresAt || expiresAt <= Date.now()) {
      return { error: fail('SESSION_EXPIRED', '登录已过期，请重新登录') }
    }

    const userDoc = await db.collection('users').doc(session.userId).get()
    if (!userDoc.data) {
      return { error: fail('USER_NOT_FOUND', '用户不存在') }
    }

    await db.collection('web_sessions').doc(session._id).update({
      data: { lastUsedAt: db.serverDate() }
    })

    return {
      user: userDoc.data,
      userId: userDoc.data._id,
      openid: userDoc.data.openid,
      source: 'web'
    }
  }

  const wxContext = cloud.getWXContext()
  if (wxContext && wxContext.OPENID) {
    const _ = db.command
    const userRes = await db.collection('users')
      .where(_.or([
        { openid: wxContext.OPENID },
        { miniOpenid: wxContext.OPENID }
      ]))
      .limit(1)
      .get()
    const user = userRes.data[0] || null
    return {
      user,
      userId: user ? user._id : '',
      openid: user ? (user.openid || wxContext.OPENID) : wxContext.OPENID,
      source: 'miniapp'
    }
  }

  if (options.optional) {
    return { user: null, userId: '', openid: '', source: 'anonymous' }
  }

  return { error: fail('AUTH_REQUIRED', '请先登录') }
}

function requireUser(identity) {
  if (identity.error) return identity.error
  if (!identity.user) return fail('USER_NOT_FOUND', '用户不存在')
  return null
}

module.exports = { resolveIdentity, requireUser, hashToken }
