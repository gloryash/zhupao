const { normalizePhone } = require('./user')

function resolveRegistrationPhone(identifier, profilePhone) {
  const phone = identifier.type === 'phone'
    ? identifier.value
    : normalizePhone(profilePhone)

  if (!phone) {
    return { error: { code: 'PHONE_REQUIRED', message: '请填写手机号' } }
  }

  if (!/^1\d{10}$/.test(phone)) {
    return { error: { code: 'INVALID_PHONE', message: '请输入有效手机号' } }
  }

  return { phone }
}

module.exports = { resolveRegistrationPhone }
