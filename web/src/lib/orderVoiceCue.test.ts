import assert from 'node:assert/strict'
import test from 'node:test'
import { getRunnerOrderVoiceCue } from './orderVoiceCue.ts'

test('getRunnerOrderVoiceCue returns the publish success status', () => {
  assert.equal(getRunnerOrderVoiceCue('publishSuccess'), '已发布陪跑请求，正在为你匹配志愿者')
})

test('getRunnerOrderVoiceCue returns the cancel success status', () => {
  assert.equal(getRunnerOrderVoiceCue('cancelSuccess'), '已取消该陪跑请求')
})
