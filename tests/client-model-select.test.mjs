import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { extractBlock, flattenChildren, textOf } from './support/session-switcher-harness.mjs'

const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8')
const body = extractBlock(source, '    function FeishuRemoteModelSelect({ sessionId, t }) {', '    function FeishuComposerGuard(props) {', 'FeishuRemoteModelSelect')

function renderDisplay() {
  const state = []
  let cursor = 0
  let effects = []
  let dirty = false
  const props = { sessionId: 'dfc:feishu_test:dm:1:oc_1', t: (key) => key }
  const env = {
    h: (type, props2, ...children) => ({ type, props: { ...props2, children } }),
    accountIdOfSession: () => 'feishu_test',
    channelRefresh: {
      subscribe(fn) {
        fn({ ok: true, channels: [{ accounts: [{
          id: 'feishu_test',
          assistant: { provider: 'provider-a', model: 'model-a' },
        }] }] })
        return () => {}
      },
    },
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
    FeishuComposerGuard: 'guard',
  }
  const Component = new Function(...Object.keys(env), `${body}; return FeishuRemoteModelSelect;`)(...Object.values(env))
  let tree
  for (let attempt = 0; attempt < 10; attempt++) {
    cursor = 0
    effects = []
    dirty = false
    tree = Component(props)
    for (const effect of effects) effect()
    if (!dirty) break
  }
  return tree
}

test('remote composer displays the account model without a switcher', () => {
  const tree = renderDisplay()
  const nodes = flattenChildren(tree)
  assert.equal(nodes.some((node) => node.type === 'select'), false, 'model must be read-only')
  const value = nodes.find((node) => node.type === 'span' && String(node.props.className).includes('dfc-remote-model-value'))
  assert.ok(value, 'model value should render')
  assert.equal(textOf(value), 'provider-a / model-a')
})
