import assert from 'node:assert/strict'
import test from 'node:test'
import { parseFeishuBegin, parseFeishuPoll } from '../src/channels/qr/feishu.js'
import { isRasterQr, remainingSeconds } from '../src/channels/qr/shared.js'

test('飞书注册开始与轮询解析', () => {
  const begun = parseFeishuBegin({
    device_code: 'dc',
    verification_uri_complete: 'https://accounts.feishu.cn/qr',
    interval: 5,
    expire_in: 120,
  }, 0)
  assert.equal(begun.deviceCode, 'dc')
  assert.equal(begun.qrUrl, 'https://accounts.feishu.cn/qr')
  assert.equal(begun.pollIntervalMs, 5000)
  const pending = parseFeishuPoll({ error: 'authorization_pending' })
  assert.equal(pending.status, 'waiting')
  const done = parseFeishuPoll({
    client_id: 'cli',
    client_secret: 'sec',
    user_info: { tenant_brand: 'feishu', open_id: 'ou_1' },
  })
  assert.equal(done.status, 'success')
  assert.equal(done.credentials.appId, 'cli')
  assert.equal(done.credentials.ownerOpenId, 'ou_1')
})

test('Lark 租户被明确拒绝', () => {
  const rejected = parseFeishuPoll({
    client_id: 'cli',
    client_secret: 'sec',
    user_info: { tenant_brand: 'lark', open_id: 'ou_1' },
  })
  assert.equal(rejected.status, 'failed')
  assert.match(rejected.error, /仅支持飞书/)
})

test('剩余秒数不为负', () => {
  assert.equal(remainingSeconds(1000, 5000), 0)
  assert.equal(remainingSeconds(9000, 5000), 4)
})

test('扫码链接不是图片地址', () => {
  assert.equal(isRasterQr('https://accounts.feishu.cn/qr'), false)
  assert.equal(isRasterQr('data:image/png;base64,AAA'), true)
})
