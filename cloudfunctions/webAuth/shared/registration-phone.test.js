const assert = require('node:assert/strict')
const test = require('node:test')
const { resolveRegistrationPhone } = require('./registration-phone')

test('uses the phone identifier as the account phone', () => {
  const result = resolveRegistrationPhone({ type: 'phone', value: '13800138000' }, '')

  assert.deepEqual(result, { phone: '13800138000' })
})

test('requires a phone when registering with an email identifier', () => {
  const result = resolveRegistrationPhone({ type: 'email', value: 'runner@example.com' }, '')

  assert.equal(result.error.code, 'PHONE_REQUIRED')
})

test('normalizes and validates the profile phone for email registration', () => {
  const result = resolveRegistrationPhone({ type: 'email', value: 'runner@example.com' }, ' 139 0013 9000 ')

  assert.deepEqual(result, { phone: '13900139000' })
})

test('rejects invalid profile phone numbers', () => {
  const result = resolveRegistrationPhone({ type: 'email', value: 'runner@example.com' }, '12345')

  assert.equal(result.error.code, 'INVALID_PHONE')
})
