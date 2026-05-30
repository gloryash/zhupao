const crypto = require('crypto')

function normalizePhone(phone) {
  return String(phone || '').replace(/\s+/g, '')
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase()
}

function normalizeIdentifier(identifier) {
  const value = String(identifier || '').trim()
  if (value.includes('@')) {
    return { type: 'email', value: normalizeEmail(value) }
  }
  return { type: 'phone', value: normalizePhone(value) }
}

function createWebOpenid() {
  return `web_${crypto.randomBytes(12).toString('hex')}`
}

function publicUser(user) {
  if (!user) return null
  const clone = { ...user }
  delete clone.idCard
  delete clone.password
  delete clone.passwordHash
  delete clone.passwordSalt
  return clone
}

module.exports = {
  normalizePhone,
  normalizeEmail,
  normalizeIdentifier,
  createWebOpenid,
  publicUser
}
