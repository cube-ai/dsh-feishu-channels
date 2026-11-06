import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { Readable } from 'node:stream'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { apply } from '../src/index.js'

function makeResponse() {
  return {
    status: 0,
    headers: undefined,
    body: '',
    writeHead(status, headers) {
      this.status = status
      this.headers = headers
    },
    end(body) {
      this.body = body ?? ''
    },
  }
}

function makeRequest(url, method = 'GET', headers = {}) {
  return { url, method, headers }
}

function installFake(connection) {
  const routes = []
  const disposers = []
  const ctx = {
    logger: () => ({ info() {} }),
    effect: (fn) => {
      const dispose = fn()
      if (typeof dispose === 'function') disposers.push(dispose)
      return dispose
    },
    permissionPresets: {
      defaultPreset: 'workspace-write',
      names: ['workspace-write'],
      optionOf: (name) => ({ value: name, name }),
    },
    credentials: { async set() {}, async resolve() { return undefined }, async unset() {} },
    webServer: {
      register(route) {
        routes.push(route)
        return () => {}
      },
    },
    get(name) {
      if (name === 'connection') return connection
      return undefined
    },
    agents: {},
    agentPresets: {},
    agentDefaultModel: {},
    llm: {},
  }
  return { ctx, routes, disposers }
}

test('GET /channels returns the Feishu-only channel list', async () => {
  const stateDir = mkdtempSync(join(tmpdir(), 'dfc-api-'))
  const { ctx, routes, disposers } = installFake({ requestRejection: () => undefined })
  try {
    apply(ctx, { stateDir, cwd: process.cwd(), provider: '', model: '', agentPreset: 'standard', mergeTimeoutSecs: 5 })
    await new Promise((resolve) => setTimeout(resolve, 30))
    const route = routes[0]
    const res = makeResponse()
    await route.handler(makeRequest('/api/dsh-feishu-channels/channels'), res)
    assert.equal(res.status, 200)
    const data = JSON.parse(res.body)
    assert.equal(data.ok, true)
    assert.equal(data.channels.length, 1)
    assert.equal(data.channels[0].id, 'feishu')
    assert.equal(data.channels[0].total, 0)
    assert.deepEqual(data.groups, [])
    assert.deepEqual(data.pending, [])
  } finally {
    for (const dispose of [...disposers].reverse()) await dispose()
    rmSync(stateDir, { recursive: true, force: true })
  }
})

test('API rejects unauthenticated and unmarked mutations', async () => {
  const stateDir = mkdtempSync(join(tmpdir(), 'dfc-api-'))
  let rejection
  const { ctx, routes, disposers } = installFake({ requestRejection: () => rejection })
  try {
    apply(ctx, { stateDir, cwd: process.cwd(), provider: '', model: '', agentPreset: 'standard', mergeTimeoutSecs: 5 })
    await new Promise((resolve) => setTimeout(resolve, 30))
    const route = routes[0]

    rejection = 401
    const unauthorized = makeResponse()
    await route.handler(makeRequest('/api/dsh-feishu-channels/channels'), unauthorized)
    assert.equal(unauthorized.status, 401)

    rejection = undefined
    const unmarked = makeResponse()
    await route.handler(makeRequest('/api/dsh-feishu-channels/accounts/x/settings', 'POST', {
      'content-type': 'application/json',
    }), unmarked)
    assert.equal(unmarked.status, 403)

    const missingJson = makeResponse()
    await route.handler(makeRequest('/api/dsh-feishu-channels/accounts/x/settings', 'POST', {
      'content-type': 'text/plain',
      'x-dsh-feishu-channels-client': '1',
    }), missingJson)
    assert.equal(missingJson.status, 415)
  } finally {
    for (const dispose of [...disposers].reverse()) await dispose()
    rmSync(stateDir, { recursive: true, force: true })
  }
})


test('account view exposes app id / secret presence and the secret route reveals it', async () => {
  const stateDir = mkdtempSync(join(tmpdir(), 'dfc-api-'))
  writeFileSync(join(stateDir, 'channels.json'), JSON.stringify({
    version: 2,
    channels: {
      feishu_test: {
        id: 'feishu_test',
        platform: 'feishu',
        name: '飞书频道1',
        nameOrdinal: 1,
        enabled: false,
        receiveEnabled: false,
        config: {
          appId: 'cli_test',
          appSecretRef: 'dfc_feishu_appSecret',
          provisioning: {
            checkedAt: '2026-11-04T00:00:00.000Z',
            redirectUrls: { requested: [], present: [], missing: [] },
          },
        },
      },
    },
    allowlist: {},
    pending: {},
  }))
  const { ctx, routes, disposers } = installFake({
    requestRejection: () => undefined,
  })
  ctx.credentials = {
    async set() {},
    async unset() {},
    async resolve(ref) { return ref === 'dfc_feishu_appSecret' ? 'app-secret-value' : undefined },
  }
  try {
    apply(ctx, { stateDir, cwd: process.cwd(), provider: '', model: '', agentPreset: 'standard', mergeTimeoutSecs: 5 })
    await new Promise((resolve) => setTimeout(resolve, 30))
    const route = routes[0]
    const listRes = makeResponse()
    await route.handler(makeRequest('/api/dsh-feishu-channels/channels'), listRes)
    const list = JSON.parse(listRes.body)
    const account = list.channels[0].accounts[0]
    assert.equal(account.appId, 'cli_test')
    assert.equal(account.hasAppSecret, true)
    assert.equal(account.provisioning, undefined)
    const saved = JSON.parse(readFileSync(join(stateDir, 'channels.json'), 'utf8'))
    assert.equal(saved.channels.feishu_test.config.provisioning, undefined)

    const req = Readable.from(['{}'])
    req.url = '/api/dsh-feishu-channels/accounts/feishu_test/secret'
    req.method = 'POST'
    req.headers = {
      'content-type': 'application/json',
      'x-dsh-feishu-channels-client': '1',
    }
    const res = makeResponse()
    await route.handler(req, res)
    assert.equal(res.status, 200)
    assert.deepEqual(JSON.parse(res.body), { ok: true, appId: 'cli_test', appSecret: 'app-secret-value' })
  } finally {
    for (const dispose of [...disposers].reverse()) await dispose()
    rmSync(stateDir, { recursive: true, force: true })
  }
})
