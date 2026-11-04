import test from 'node:test'
import assert from 'node:assert/strict'
import { credentialRef } from '../src/engine/credentials.js'

test('credential refs use the dfc_ namespace', () => {
  assert.equal(credentialRef('feishu_abc123', 'appSecret'), 'dfc_feishu_abc123_appSecret')
  assert.equal(credentialRef('feishu_abc123', 'appId'), 'dfc_feishu_abc123_appId')
})

test('credential refs are POSIX identifiers and never im_connect_', () => {
  const ref = credentialRef('feishu-a/b', 'app:secret')
  assert.match(ref, /^[A-Za-z_][A-Za-z0-9_]*$/)
  assert.ok(ref.startsWith('dfc_'))
  assert.equal(ref.includes('im_connect_'), false)
})
