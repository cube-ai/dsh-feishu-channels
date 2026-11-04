import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DFC_SESSION_PREFIX,
  createFeishuSessionId,
  isFeishuOrigin,
  isFeishuSessionId,
  isTaskSession,
  parseFeishuSessionId,
  sessionKeyOf,
} from '../src/engine/session-id.js'

test('session prefix is dfc: and never im:', () => {
  assert.equal(DFC_SESSION_PREFIX, 'dfc:')
  const id = createFeishuSessionId('feishu_abc123', 'dm', 'oc_1', 1700000000000)
  assert.equal(id, 'dfc:feishu_abc123:dm:1700000000000:oc_1')
  assert.equal(isFeishuSessionId(id), true)
  assert.equal(isFeishuSessionId('im:feishu_abc123:dm:1700000000000:oc_1'), false)
})

test('parse round-trips account, kind and chat id', () => {
  const id = createFeishuSessionId('feishu_abc123', 'group', 'oc_group:with:colons', 1700000000001)
  assert.deepEqual(parseFeishuSessionId(id), {
    channel: 'feishu_abc123',
    kind: 'group',
    chatId: 'oc_group:with:colons',
  })
  assert.equal(parseFeishuSessionId('im:feishu_abc:dm:1700000000000:oc_1'), undefined)
  assert.equal(parseFeishuSessionId('dfc:unknown:dm:1700000000000:oc_1'), undefined)
  assert.equal(parseFeishuSessionId('dfc:feishu_abc:nope:1700000000000:oc_1'), undefined)
})

test('task visibility excludes only Feishu sessions and subagents', () => {
  assert.equal(isTaskSession({ id: 'dfc:feishu_abc:dm:1700000000000:oc_1' }), false)
  assert.equal(isTaskSession({ origin: 'dfc' }), false)
  assert.equal(isTaskSession({ origin: 'subagent' }), false)
  assert.equal(isTaskSession({ blank: true }), false)
  assert.equal(isTaskSession({ id: 'normal-session' }), true)
  assert.equal(isFeishuOrigin('dfc'), true)
  assert.equal(isFeishuOrigin('im'), false)
})

test('session key shares account chat identity only', () => {
  assert.equal(sessionKeyOf('feishu_abc', 'dm', 'oc_1'), 'feishu_abc:dm:oc_1')
})
