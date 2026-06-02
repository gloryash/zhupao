#!/usr/bin/env node
'use strict'

const assert = require('node:assert/strict')
const path = require('node:path')
const test = require('node:test')

const {
  DEFAULT_ENV,
  buildIsolatedEnv,
  profileHome,
  withDefaultEnvArg
} = require('./tcb-profile')

test('withDefaultEnvArg appends the project env for CloudBase commands', () => {
  assert.deepEqual(
    withDefaultEnvArg(['fn', 'list', '--json'], 'cloud-test-env'),
    ['fn', 'list', '--json', '-e', 'cloud-test-env']
  )
})

test('withDefaultEnvArg keeps an explicit env untouched', () => {
  assert.deepEqual(
    withDefaultEnvArg(['fn', 'list', '-e', 'explicit-env', '--json'], 'cloud-test-env'),
    ['fn', 'list', '-e', 'explicit-env', '--json']
  )
  assert.deepEqual(
    withDefaultEnvArg(['env', 'detail', '--env-id', 'explicit-env'], 'cloud-test-env'),
    ['env', 'detail', '--env-id', 'explicit-env']
  )
})

test('withDefaultEnvArg skips login unless a CloudBase env api key needs env scope', () => {
  assert.deepEqual(withDefaultEnvArg(['login', '-k'], 'cloud-test-env'), ['login', '-k'])
  assert.deepEqual(
    withDefaultEnvArg(['login', '--cloudbase-api-key', 'test-key'], 'cloud-test-env'),
    ['login', '--cloudbase-api-key', 'test-key', '-e', 'cloud-test-env']
  )
})

test('buildIsolatedEnv scopes tcb state to the project and removes inherited secrets', () => {
  const root = path.join('/tmp', 'zhupao-test')
  const env = buildIsolatedEnv(
    {
      PATH: '/bin',
      HOME: '/Users/someone',
      TENCENTCLOUD_SECRETID: 'leaked-id',
      TENCENTCLOUD_SECRETKEY: 'leaked-key',
      CLOUD_SECRET_ID: 'leaked-cloud-id'
    },
    root,
    DEFAULT_ENV
  )

  assert.equal(env.CLOUDBASE_ENV, DEFAULT_ENV)
  assert.equal(env.HOME, profileHome(root, {}))
  assert.equal(env.USERPROFILE, profileHome(root, {}))
  assert.equal(env.PATH, '/bin')
  assert.equal(env.TENCENTCLOUD_SECRETID, undefined)
  assert.equal(env.TENCENTCLOUD_SECRETKEY, undefined)
  assert.equal(env.CLOUD_SECRET_ID, undefined)
})
