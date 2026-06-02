import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getRunnerOrderVoiceCue,
  getRunnerOrderVoiceCueSequence,
  getVolunteerOrderVoiceCue
} from './orderVoiceCue.ts'

test('getRunnerOrderVoiceCue returns the publish success status', () => {
  assert.equal(getRunnerOrderVoiceCue('publishSuccess'), '已发布陪跑请求，正在为你匹配志愿者')
})

test('getRunnerOrderVoiceCue returns the cancel success status', () => {
  assert.equal(getRunnerOrderVoiceCue('cancelSuccess'), '已取消该陪跑请求')
})

test('getRunnerOrderVoiceCue announces accepted orders with the volunteer phone', () => {
  assert.equal(
    getRunnerOrderVoiceCue('accepted', { phone: '13800138000' }),
    '您的订单已被接。志愿者电话：1 3 8 0 0 1 3 8 0 0 0'
  )
})

test('getRunnerOrderVoiceCueSequence speaks accepted notice before volunteer phone', () => {
  assert.deepEqual(getRunnerOrderVoiceCueSequence('accepted', { phone: '13800138000' }), [
    '您的订单已被接',
    '志愿者手机号码：1 3 8 0 0 1 3 8 0 0 0'
  ])
})

test('getRunnerOrderVoiceCue keeps the accepted notice concise without a phone', () => {
  assert.equal(getRunnerOrderVoiceCue('accepted'), '您的订单已被接')
})

test('getVolunteerOrderVoiceCue returns the accept success status with runner phone', () => {
  assert.equal(
    getVolunteerOrderVoiceCue('acceptSuccess', { phone: '13900139000' }),
    '接单成功，请尽快前往集合点。跑者电话：1 3 9 0 0 1 3 9 0 0 0'
  )
})

test('getVolunteerOrderVoiceCue returns status-flow prompts', () => {
  assert.equal(getVolunteerOrderVoiceCue('arriveSuccess'), '已标记到达集合点')
  assert.equal(getVolunteerOrderVoiceCue('startRunSuccess'), '陪跑开始，注意安全')
  assert.equal(getVolunteerOrderVoiceCue('locationUploaded'), '已上传实时定位与配速')
  assert.equal(getVolunteerOrderVoiceCue('completeSuccess'), '陪跑已完成，感谢你的付出')
  assert.equal(getVolunteerOrderVoiceCue('cancelSuccess'), '已取消该订单')
})
