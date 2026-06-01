import assert from 'node:assert/strict'
import test from 'node:test'
import { formatAddressOptionLabel } from './addressLabels.ts'

test('formatAddressOptionLabel removes repeated leading place name', () => {
  const label = formatAddressOptionLabel('人民广场', '人民广场, 西藏中路, 江阴社区, 南京东路街道')
  assert.equal(label, '人民广场，西藏中路, 江阴社区, 南京东路街道')
})

test('formatAddressOptionLabel keeps distinct name and detail', () => {
  const label = formatAddressOptionLabel('南京东路', '黄浦区南京东路街道')
  assert.equal(label, '南京东路，黄浦区南京东路街道')
})

test('formatAddressOptionLabel falls back to the readable value that exists', () => {
  assert.equal(formatAddressOptionLabel('人民广场', ''), '人民广场')
  assert.equal(formatAddressOptionLabel('', '黄浦区'), '黄浦区')
})
