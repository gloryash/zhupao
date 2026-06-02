import assert from 'node:assert/strict'
import test from 'node:test'
import { getOrderCounterparty, getOrderParty } from './orderParties.ts'
import type { Order } from '../types/index.ts'

test('getOrderCounterparty returns volunteer contact details for a runner', () => {
  const order = {
    _id: 'order-1',
    targetDistance: 5,
    estimatedDuration: 45,
    status: 'accepted',
    volunteerOpenid: 'vol-openid',
    volunteerName: '王志愿',
    volunteerPhone: '13800138000',
    volunteerTierName: '银牌陪跑员',
    volunteerTotalRuns: 12,
    volunteerPace: '6:10/km'
  } as Order

  const party = getOrderCounterparty(order, 'disabled')

  assert.equal(party?.label, '陪跑志愿者')
  assert.equal(party?.name, '王志愿')
  assert.equal(party?.account, 'vol-openid')
  assert.equal(party?.phone, '13800138000')
  assert.deepEqual(
    party?.details.map((row) => [row.label, row.value]),
    [
      ['身份', '陪跑志愿者'],
      ['账号', 'vol-openid'],
      ['手机号', '13800138000'],
      ['等级', '银牌陪跑员'],
      ['陪跑次数', '12 次'],
      ['平均配速', '6:10/km']
    ]
  )
})

test('getOrderCounterparty returns runner contact details for a volunteer', () => {
  const order = {
    _id: 'order-2',
    openid: 'runner-openid',
    userName: '李跑者',
    userPhone: '13900139000',
    runnerGender: 'female',
    runnerAge: 31,
    runningLocation: '世纪公园',
    targetDistance: 3,
    estimatedDuration: 30,
    status: 'accepted'
  } as Order

  const party = getOrderCounterparty(order, 'volunteer')

  assert.equal(party?.label, '视障跑者')
  assert.equal(party?.name, '李跑者')
  assert.equal(party?.account, 'runner-openid')
  assert.equal(party?.phone, '13900139000')
  assert.deepEqual(
    party?.details.map((row) => [row.label, row.value]),
    [
      ['身份', '视障跑者'],
      ['账号', 'runner-openid'],
      ['手机号', '13900139000'],
      ['性别', '女'],
      ['年龄', '31 岁'],
      ['常用跑步地点', '世纪公园']
    ]
  )
})

test('getOrderCounterparty omits volunteer details before a runner order is accepted', () => {
  const order = {
    _id: 'order-3',
    openid: 'runner-openid',
    userName: '李跑者',
    targetDistance: 3,
    estimatedDuration: 30,
    status: 'waiting'
  } as Order

  assert.equal(getOrderCounterparty(order, 'disabled'), null)
})

test('getOrderParty accepts backend alias fields for phones and names', () => {
  const order = {
    _id: 'order-4',
    blindOpenid: 'blind-openid',
    blindName: '赵同学',
    blindPhone: '13700137000',
    volunteerId: 'vol-id',
    volunteerNickName: '陈教练',
    volunteerMobile: '13600136000',
    targetDistance: 10,
    estimatedDuration: 80,
    status: 'accepted'
  } as Order

  assert.equal(getOrderParty(order, 'runner')?.phone, '13700137000')
  assert.equal(getOrderParty(order, 'runner')?.name, '赵同学')
  assert.equal(getOrderParty(order, 'volunteer')?.phone, '13600136000')
  assert.equal(getOrderParty(order, 'volunteer')?.name, '陈教练')
})

test('getOrderParty prefers volunteerProfile snapshot over flat volunteer fields', () => {
  const order = {
    _id: 'order-5',
    volunteerOpenid: 'flat-vol-openid',
    volunteerName: '扁平志愿者',
    volunteerPhone: '13500135000',
    volunteerTierName: '扁平等级',
    volunteerPace: '7:00/km',
    volunteerProfile: {
      openid: 'profile-vol-openid',
      nickName: '快照志愿者',
      phone: '13400134000',
      tierName: '金牌陪跑员',
      pace: '5:50/km',
      certificateNo: 'CERT-2026-001'
    },
    targetDistance: 8,
    estimatedDuration: 60,
    status: 'accepted'
  } as Order

  const party = getOrderParty(order, 'volunteer')

  assert.equal(party?.name, '快照志愿者')
  assert.equal(party?.account, 'profile-vol-openid')
  assert.equal(party?.phone, '13400134000')
  assert.deepEqual(
    party?.details.map((row) => [row.label, row.value]),
    [
      ['身份', '陪跑志愿者'],
      ['账号', 'profile-vol-openid'],
      ['手机号', '13400134000'],
      ['等级', '金牌陪跑员'],
      ['平均配速', '5:50/km'],
      ['证书编号', 'CERT-2026-001']
    ]
  )
})

test('getOrderParty prefers runnerProfile snapshot over flat runner fields', () => {
  const order = {
    _id: 'order-6',
    openid: 'flat-runner-openid',
    userName: '扁平跑者',
    userPhone: '13300133000',
    runningLocation: '扁平公园',
    runnerTotalRuns: 2,
    runnerTotalDistance: 6,
    runnerProfile: {
      openid: 'profile-runner-openid',
      nickName: '快照跑者',
      phone: '13200132000',
      runningLocation: '滨江步道',
      totalRuns: 9,
      totalDistance: 42.5
    },
    targetDistance: 4,
    estimatedDuration: 35,
    status: 'accepted'
  } as Order

  const party = getOrderParty(order, 'runner')

  assert.equal(party?.name, '快照跑者')
  assert.equal(party?.account, 'profile-runner-openid')
  assert.equal(party?.phone, '13200132000')
  assert.deepEqual(
    party?.details.map((row) => [row.label, row.value]),
    [
      ['身份', '视障跑者'],
      ['账号', 'profile-runner-openid'],
      ['手机号', '13200132000'],
      ['常用跑步地点', '滨江步道'],
      ['运动次数', '9 次'],
      ['总里程', '42.5 km']
    ]
  )
})

test('getOrderParty falls back to a deterministic test phone when a party only has an account', () => {
  const order = {
    _id: 'order-7',
    userId: 'runner-user-id',
    userName: '只有账号的跑者',
    volunteerId: 'volunteer-user-id',
    volunteerName: '只有账号的志愿者',
    targetDistance: 4,
    estimatedDuration: 35,
    status: 'accepted'
  } as Order

  assert.match(getOrderParty(order, 'runner')?.phone || '', /^199\d{8}$/)
  assert.match(getOrderParty(order, 'volunteer')?.phone || '', /^199\d{8}$/)
})
