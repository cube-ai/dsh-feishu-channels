import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { apply } from '../src/index.js'

test('host applies, registers the Feishu API prefix, and disposes cleanly', async () => {
  const stateDir = mkdtempSync(join(tmpdir(), 'dfc-host-'))
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
    credentials: {
      async set() {},
      async resolve() { return undefined },
      async unset() {},
    },
    webServer: {
      register(route) {
        routes.push(route)
        return () => {}
      },
    },
    get() { return undefined },
    agents: {},
    agentPresets: {},
    agentDefaultModel: {},
    llm: {},
  }
  try {
    apply(ctx, {
      stateDir,
      cwd: process.cwd(),
      provider: '',
      model: '',
      agentPreset: 'standard',
      mergeTimeoutSecs: 5,
    })
    await new Promise((resolve) => setTimeout(resolve, 50))
    assert.equal(routes.length, 1)
    assert.equal(routes[0].kind, 'prefix')
    assert.equal(routes[0].path, '/api/dsh-feishu-channels')
    assert.equal(existsSync(join(stateDir, 'channels.json')), true)
    assert.equal(existsSync(join(stateDir, 'gateway.log')), true)
    const persisted = JSON.parse(readFileSync(join(stateDir, 'channels.json'), 'utf8'))
    assert.equal(persisted.version, 2)
    assert.deepEqual(persisted.channels, {})
    for (const dispose of [...disposers].reverse()) await dispose()
    assert.equal(existsSync(join(stateDir, 'dsh-im-connect')), false)
  } finally {
    rmSync(stateDir, { recursive: true, force: true })
  }
})
