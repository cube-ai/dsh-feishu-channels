import test from 'node:test'
import assert from 'node:assert/strict'
import { gunzipSync } from 'node:zlib'
import {
  FEISHU_APP_SCOPES,
  FEISHU_REDIRECT_URLS,
  decorateQrUrl,
} from '../src/channels/feishu-app.js'

function decodeAddons(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  return JSON.parse(gunzipSync(Buffer.from(base64, 'base64')).toString('utf8'))
}

test('QR url prefills the channel name, scopes and create-only mode', () => {
  const url = new URL(decorateQrUrl('https://accounts.feishu.cn/oauth/v1/app/registration?existing=1', { name: ' 飞书频道1 ' }))
  assert.equal(url.searchParams.get('existing'), '1')
  assert.equal(url.searchParams.get('name'), '飞书频道1')
  assert.equal(url.searchParams.get('createOnly'), 'true')
  assert.equal(url.searchParams.get('source'), 'dsh-feishu-channels')
  assert.deepEqual(decodeAddons(url.searchParams.get('addons')), {
    scopes: {
      tenant: ['im:message', 'application:application:patch'],
      user: ['im:message.send_as_user'],
    },
  })
})

test('QR url omits an empty name but still carries the scopes', () => {
  const url = new URL(decorateQrUrl('https://accounts.feishu.cn/oauth/v1/app/registration', { name: '   ' }))
  assert.equal(url.searchParams.has('name'), false)
  assert.equal(url.searchParams.has('addons'), true)
})

test('redirect URL list is exact and ordered', () => {
  assert.deepEqual(FEISHU_REDIRECT_URLS, [
    'http://127.0.0.1:3080/api/dsh-feishu-client/oauth/callback',
    'http://localhost:3080/api/dsh-feishu-client/oauth/callback',
    'http://127.0.0.1:32123/api/dsh-feishu-client/oauth/callback',
    'http://localhost:32123/api/dsh-feishu-client/oauth/callback',
    'http://127.0.0.1:8731/api/oauth/callback',
    'http://localhost:8731/api/oauth/callback',
    'https://www.cubeai.com:6443/cubeaispace-dsh1-1234567890-dsh/api/dsh-feishu-client/oauth/callback',
  ])
  assert.deepEqual(FEISHU_APP_SCOPES, {
    tenant: ['im:message', 'application:application:patch'],
    user: ['im:message.send_as_user'],
  })
})

import { provisionFeishuApp } from '../src/channels/feishu-app.js'
import { beginFeishuQr } from '../src/channels/qr/feishu.js'

function makeFakeClient() {
  const calls = []
  const app = {
    app_name: '飞书频道1',
    scopes: [
      { scope: 'im:message' },
      { scope: 'im:message.send_as_user' },
    ],
    security: { redirect_urls: [...FEISHU_REDIRECT_URLS] },
  }
  const client = {
    application: {
      v6: {
        application: {
          get: async (payload) => {
            calls.push(['v6.get', payload])
            return { data: { app: { ...app, security: { ...app.security, redirect_urls: [...app.security.redirect_urls] } } } }
          },
          patch: async (payload) => {
            calls.push(['v6.patch', payload])
            app.security.redirect_urls = [...payload.data.security.redirect_urls]
            return { data: {} }
          },
        },
      },
      v7: {
        applicationBase: {
          patch: async (payload) => {
            calls.push(['v7.base.patch', payload])
            return { data: {} }
          },
        },
        applicationConfig: {
          patch: async (payload) => {
            calls.push(['v7.config.patch', payload])
            return { data: {} }
          },
        },
      },
    },
  }
  return { client, calls, app }
}

test('provisioning applies name, scopes and redirect URLs through v7', async () => {
  const { client, calls } = makeFakeClient()
  const result = await provisionFeishuApp({ appId: 'cli_test', appSecret: 'secret', name: '飞书频道1', client })
  assert.equal(result.name.applied, true)
  assert.equal(result.name.present, '飞书频道1')
  assert.equal(result.name.ok, true)
  assert.deepEqual(result.scopes.missing, [])
  assert.deepEqual(result.redirectUrls.missing, [])
  assert.equal(result.redirectUrls.written, true)
  assert.equal(result.verified, true)
  const config = calls.find(([name]) => name === 'v7.config.patch')[1]
  assert.deepEqual(config.data.scope.add_scopes, [
    { scope_name: 'im:message', token_type: 'tenant' },
    { scope_name: 'im:message.send_as_user', token_type: 'user' },
  ])
  assert.deepEqual(config.data.security.add.redirect_urls, FEISHU_REDIRECT_URLS)
  assert.doesNotMatch(JSON.stringify(result), /secret/i)
})

test('provisioning falls back to v6 redirects and merges existing URLs', async () => {
  const { client, calls, app } = makeFakeClient()
  let v7Calls = 0
  client.application.v7.applicationConfig.patch = async (payload) => {
    v7Calls += 1
    calls.push(['v7.config.patch', payload])
    if (v7Calls === 1) throw Object.assign(new Error('forbidden'), { code: 210504 })
    if (v7Calls === 2) return { data: {} }
    throw Object.assign(new Error('forbidden'), { code: 210504 })
  }
  client.application.v7.applicationBase.patch = async () => {
    throw Object.assign(new Error('forbidden'), { code: 210504 })
  }
  app.security.redirect_urls = ['https://existing.example/callback']
  const result = await provisionFeishuApp({ appId: 'cli_test', appSecret: 'secret', name: '飞书频道1', client })
  const v6Patch = calls.find(([name]) => name === 'v6.patch')
  assert.ok(v6Patch, 'v6 redirect fallback should be called')
  assert.deepEqual(v6Patch[1].data.security.redirect_urls, [
    'https://existing.example/callback',
    ...FEISHU_REDIRECT_URLS,
  ])
  assert.equal(result.redirectUrls.written, true)
  assert.deepEqual(result.redirectUrls.missing, [])
  assert.ok(result.errors.some((item) => item.step === 'config-v7'))
})


test('beginFeishuQr reads the channel name from pairing settings', async () => {
  const originalFetch = globalThis.fetch
  const calls = []
  globalThis.fetch = async (_url, init) => {
    const params = new URLSearchParams(init.body)
    calls.push(params.get('action'))
    if (params.get('action') === 'begin') {
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            device_code: 'device-1',
            verification_uri_complete: 'https://accounts.feishu.cn/qr/device-1',
            expire_in: 600,
            interval: 5,
          }
        },
      }
    }
    return { ok: true, status: 200, async json() { return {} } }
  }
  try {
    const begun = await beginFeishuQr({ __setting_name: '飞书频道7' })
    const url = new URL(begun.qrUrl)
    assert.equal(url.searchParams.get('name'), '飞书频道7')
    assert.deepEqual(calls, ['init', 'begin'])
  } finally {
    globalThis.fetch = originalFetch
  }
})
