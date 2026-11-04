import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8')

const React = {
  createElement: (type, props, ...children) => ({ type, props: { ...(props || {}), children } }),
  Component: class Component {
    constructor(props) { this.props = props || {}; this.state = {} }
    setState(next) { Object.assign(this.state, next) }
  },
  Fragment: 'Fragment',
  useState: (value) => [typeof value === 'function' ? value() : value, () => {}],
  useEffect: () => {},
  useLayoutEffect: () => {},
  useCallback: (fn) => fn,
  useMemo: (fn) => fn(),
  useRef: (value) => ({ current: value }),
  useSyncExternalStore: (_subscribe, snapshot) => snapshot(),
}

function fakeElement() {
  return {
    isConnected: false,
    style: {},
    children: [],
    textContent: '',
    innerHTML: '',
    className: '',
    setAttribute() {},
    appendChild() {},
    remove() {},
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
    removeEventListener() {},
    closest: () => null,
  }
}

function loadClient() {
  const listeners = new Map()
  const fakeWindow = {
    setInterval: () => 1,
    clearInterval: () => {},
    setTimeout: () => 1,
    clearTimeout: () => {},
    addEventListener: (name, fn) => {
      if (!listeners.has(name)) listeners.set(name, new Set())
      listeners.get(name).add(fn)
    },
    removeEventListener: (name, fn) => listeners.get(name)?.delete(fn),
    dispatchEvent: (event) => {
      for (const fn of listeners.get(event.type) || []) fn(event)
      return true
    },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    location: { origin: 'http://127.0.0.1:3080' },
    navigator: { clipboard: { writeText: async () => {} } },
  }
  let factory
  fakeWindow.__ModuleLoader__ = { load: (entry) => { factory = entry.factory } }
  const document = {
    createElement: () => fakeElement(),
    head: { appendChild(el) { el.isConnected = true } },
    body: fakeElement(),
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
    removeEventListener() {},
    visibilityState: 'visible',
  }
  globalThis.window = fakeWindow
  globalThis.document = document
  globalThis.localStorage = fakeWindow.localStorage
  globalThis.sessionStorage = fakeWindow.sessionStorage
  globalThis.Event = class Event { constructor(type) { this.type = type } }
  new Function('window', source)(fakeWindow)
  const requireStub = (name) => {
    if (name === 'react') return React
    if (name === 'react-dom') return { createRoot: () => ({ render() {}, unmount() {} }), flushSync: (fn) => fn() }
    if (name === '@deepseek-ai/dsh-client-ui-primitives') return {}
    throw new Error(`unexpected require: ${name}`)
  }
  return factory(requireStub)
}

function makeCtx(entries) {
  const effects = []
  const slotDisposers = []
  const registrations = []
  const ctx = {
    effect: (fn) => {
      const dispose = fn()
      if (typeof dispose === 'function') effects.push(dispose)
      return dispose
    },
    logger: () => ({ info() {} }),
    locale: {
      register: () => () => {},
      bind: () => (key) => key,
      subscribe: () => () => {},
      getSnapshot: () => ({ locale: 'zh' }),
    },
    slots: {
      inject: (name, callback) => {
        const dispose = callback()
        if (typeof dispose === 'function') slotDisposers.push(dispose)
        return () => {}
      },
      register: (options) => {
        registrations.push(options)
        return () => {}
      },
      subscribe: () => () => {},
      entriesOfSlot: (name) => (name === 'sidebar.workspaces' ? entries : []),
    },
    workspaces: { create: async () => ({}) },
    sessions: { list: { getSnapshot: () => ({ byId: {} }) } },
    get: () => undefined,
    reflect: { get: () => undefined },
    uiWorkspace: { pickDirectory: async () => null },
  }
  return { ctx, effects, slotDisposers, registrations }
}

function disposeAll(effects, slotDisposers) {
  for (const dispose of [...slotDisposers].reverse()) dispose()
  for (const dispose of [...effects].reverse()) dispose()
}

function makeForeignRegistry() {
  const tabs = []
  const filters = []
  const openers = []
  let revision = 0
  const listeners = new Set()
  const emit = () => { revision += 1; for (const fn of listeners) fn() }
  return {
    version: 1,
    officialTree: function Official() {},
    sessionFilters: filters,
    sessionOpeners: openers,
    getTabs: () => [...tabs].sort((a, b) => (a.order || 0) - (b.order || 0)),
    getRevision: () => revision,
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn) },
    insert: (tab) => {
      tabs.push(tab)
      emit()
      return () => {
        const index = tabs.indexOf(tab)
        if (index >= 0) { tabs.splice(index, 1); emit() }
      }
    },
    addSessionFilter: (fn) => {
      filters.push(fn)
      emit()
      return () => {
        const index = filters.indexOf(fn)
        if (index >= 0) { filters.splice(index, 1); emit() }
      }
    },
    addSessionOpener: (opener) => {
      openers.push(opener)
      emit()
      return () => {
        const index = openers.indexOf(opener)
        if (index >= 0) { openers.splice(index, 1); emit() }
      }
    },
  }
}

test('client applies the Feishu session row + composer slots and no settings section', () => {
  const mod = loadClient()
  assert.deepEqual(mod.inject, ['slots', 'sessions', 'workspaces', 'locale'])
  const { ctx, effects, slotDisposers, registrations } = makeCtx([])
  mod.apply(ctx)
  const settings = registrations.find((item) => item.name === 'settings.section')
  const leading = registrations.find((item) => item.name === 'sidebar.session.row.leading')
  const composer = registrations.find((item) => item.name === 'conversation.composer')
  assert.equal(settings, undefined)
  assert.equal(leading.id, 'feishu-channel-session-channel')
  assert.ok(composer, 'composer chain entry should be registered')
  assert.equal(composer.select({ sessionId: 'session-1' }), null)
  assert.equal(composer.select({ sessionId: 'dfc:feishu_a:dm:1:oc_1' }), true)
  assert.equal(composer.select({ sessionId: 'dfc:feishu_a:dm:1:oc_1', pendingInteraction: { kind: 'approval' } }), null)
  disposeAll(effects, slotDisposers)
})

test('official sidebar is wrapped with a v1 registry and restored on dispose', () => {
  const mod = loadClient()
  const Official = function Official() {}
  const entry = { component: Official }
  const { ctx, effects, slotDisposers } = makeCtx([entry])
  mod.apply(ctx)
  assert.notEqual(entry.component, Official)
  const wrapper = entry.component
  assert.equal(wrapper.__dshNativeTabHost, true)
  assert.equal(wrapper.__dshNativeTabWrapped, true)
  assert.equal(wrapper.__dfcTabHost, true)
  assert.equal(wrapper.__dshNativeTabOwner, 'feishu-channel')
  const registry = wrapper.__dshNativeTabs
  assert.equal(registry.version, 1)
  assert.equal(registry.officialTree, Official)
  assert.equal(registry.sessionFilters.length, 1)
  assert.equal(registry.sessionFilters[0]('dfc:feishu_a:dm:1:oc'), false)
  assert.equal(registry.sessionFilters[0]('normal-session'), true)
  // im-connect's foreign tab insertion path
  registry.insert({ id: 'channels', order: 20, label: '频道', render: () => null })
  assert.deepEqual(registry.getTabs().map((tab) => tab.id), ['channels'])
  disposeAll(effects, slotDisposers)
  assert.equal(entry.component, Official)
})

test('foreign host receives the Feishu tab and filter, then loses them on dispose', () => {
  const mod = loadClient()
  const Official = function Official() {}
  const registry = makeForeignRegistry()
  registry.officialTree = Official
  const Foreign = function ForeignHost() {}
  Foreign.__dshNativeTabHost = true
  Foreign.__dshNativeTabs = registry
  const entry = { component: Foreign }
  const { ctx, effects, slotDisposers } = makeCtx([entry])
  mod.apply(ctx)
  assert.equal(entry.component, Foreign)
  assert.deepEqual(registry.getTabs().map((tab) => tab.id), ['feishu'])
  assert.equal(registry.sessionFilters.length, 1)
  assert.equal(registry.sessionOpeners.length, 1)
  assert.equal(registry.sessionOpeners[0].id, 'feishu-channel')
  const tab = registry.getTabs()[0]
  assert.equal(tab.label && tab.label.type, 'span', 'foreign tab label should carry the Feishu icon node')
  const brand = tab.label.props.children.find((child) => child && child.props && child.props.className === 'dfc-tab-brand')
  assert.ok(brand, 'foreign tab label should include the brand wrapper')
  assert.equal(brand.props.children[0].type && brand.props.children[0].type.name, 'BrandMark', 'foreign tab label should include the Feishu brand component')
  const rendered = tab.render({
    t: (key) => key,
    officialT: (key) => key,
    useSessions: (selector) => selector({ ids: [], byId: {}, current: null, phase: 'ready' }),
    useWorkspaces: (selector) => selector({ items: [], archivedSessionIds: [] }),
    openSession() {},
  })
  assert.ok(rendered && typeof rendered === 'object', 'foreign tab render should return a tree')
  disposeAll(effects, slotDisposers)
  assert.deepEqual(registry.getTabs(), [])
  assert.deepEqual(registry.sessionFilters, [])
  assert.deepEqual(registry.sessionOpeners, [])
})

test('unknown wrapped host is left untouched', () => {
  const mod = loadClient()
  const Unknown = function UnknownHost() {}
  Unknown.__dshNativeTabHost = true
  const entry = { component: Unknown }
  const { ctx, effects, slotDisposers } = makeCtx([entry])
  mod.apply(ctx)
  assert.equal(entry.component, Unknown)
  disposeAll(effects, slotDisposers)
  assert.equal(entry.component, Unknown)
})
