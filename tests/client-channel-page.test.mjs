import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { extractBlock, flattenChildren, textOf } from './support/session-switcher-harness.mjs'

const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8')
const body = extractBlock(source, '    function FeishuChannelPage(props)', '    function SettingsPage(props)', 'FeishuChannelPage')

function makeData() {
  return {
    ok: true,
    channels: [{
      id: 'feishu',
      label: '飞书',
      kind: 'qr-or-credentials',
      fields: [],
      accounts: [{
        id: 'feishu_test',
        platform: 'feishu',
        name: '飞书频道1',
        autoName: false,
        appId: 'cli_test',
        hasAppSecret: true,
        connectionState: 'connected',
        receiveConfigured: true,
      }],
    }],
    groups: [{
      id: 'feishu',
      label: '飞书',
      sessions: [{
        sessionId: 'dfc:feishu_test:dm:1700000000000:oc_1',
        channel: 'feishu_test',
        chatId: 'oc_1',
        title: '测试会话',
        updatedAt: new Date().toISOString(),
      }],
    }],
    pending: [],
  }
}

function renderPage() {
  const state = []
  let cursor = 0
  let effects = []
  let dirty = false
  const data = makeData()
  const props = { hostProps: {}, ctx: {}, t: (key) => key, currentSessionId: 'dfc:feishu_test:dm:1700000000000:oc_1' }
  const env = {
    h: (type, props2, ...children) => ({ type, props: { ...props2, children } }),
    useState(initial) {
      const index = cursor++
      if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial
      return [state[index], (next) => {
        const value = typeof next === 'function' ? next(state[index]) : next
        if (state[index] !== value) {
          state[index] = value
          dirty = true
        }
      }]
    },
    useEffect(callback, deps) {
      const index = cursor++
      const old = state[index]
      if (old && deps && old.deps && deps.length === old.deps.length && deps.every((value, i) => Object.is(value, old.deps[i]))) return
      effects.push(() => {
        old?.cleanup?.()
        state[index] = { deps, cleanup: callback() }
      })
    },
    useCallback: (fn) => fn,
    fallbackT: (key) => key,
    Button: 'button',
    Tag: 'tag',
    Switch: 'switch',
    Logo: 'logo',
    NoticeBar: 'notice',
    Modal: 'modal',
    BindModal: 'bind-modal',
    AccountInspector: 'account-inspector',
    IconPlusOutline: 'icon-plus',
    IconSettingsOutline16: 'icon-settings',
    api: () => Promise.resolve({ ok: true, providers: [], permissions: [], agentPresets: [] }),
    channelRefresh: {
      subscribe(fn) {
        fn(data)
        return () => {}
      },
      async invalidate() {},
    },
    serverText: (value) => String(value || ''),
    accountLabel: (account) => account && account.name || '',
    relativeTime: () => '',
    openHostSession() {},
    pickHostDirectory() { return Promise.resolve('') },
    readMainSessionModel() { return null },
  }
  const Page = new Function(...Object.keys(env), `${body}; return FeishuChannelPage;`)(...Object.values(env))
  let tree
  for (let attempt = 0; attempt < 10; attempt++) {
    cursor = 0
    effects = []
    dirty = false
    tree = Page(props)
    for (const effect of effects) effect()
    if (!dirty) break
  }
  return tree
}

test('account page renders add button, account name, settings button and sessions', () => {
  const tree = renderPage()
  const nodes = flattenChildren(tree)
  const buttons = nodes.filter((node) => node.type === 'button')
  assert.ok(buttons.some((node) => textOf(node) === 'action.addAccount'))
  assert.ok(nodes.some((node) => textOf(node) === '飞书频道1'))
  assert.ok(buttons.some((node) => node.props && (node.props['aria-label'] === 'action.settings' || node.props.title === 'action.settings')))
  assert.ok(nodes.some((node) => textOf(node) === '测试会话'))
  assert.ok(nodes.some((node) => node.type === 'button' && String(node.props.className).includes('is-current')), 'current session should be highlighted')
  assert.equal(nodes.some((node) => textOf(node) === '飞书频道'), false)
})
