import assert from 'node:assert/strict'
import test from 'node:test'
import { getSpokenLabel } from './voiceCue.ts'

function elementLike(attrs: Record<string, string | null>, textContent = '') {
  return {
    textContent,
    getAttribute(name: string) {
      return attrs[name] ?? null
    }
  }
}

test('getSpokenLabel prefers aria-label over visible text', () => {
  const label = getSpokenLabel(elementLike({ 'aria-label': '个人中心' }, '头像'))
  assert.equal(label, '个人中心')
})

test('getSpokenLabel normalizes visible text whitespace', () => {
  const label = getSpokenLabel(elementLike({}, '  发起\n一次\t陪跑  '))
  assert.equal(label, '发起 一次 陪跑')
})

test('getSpokenLabel returns an empty string when nothing readable exists', () => {
  const label = getSpokenLabel(elementLike({ 'aria-label': '   ', title: '' }, '   '))
  assert.equal(label, '')
})
