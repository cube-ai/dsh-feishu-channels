import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { extractBlock, flattenChildren } from './support/session-switcher-harness.mjs'

const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8')
const body = extractBlock(source, '    function FeishuStopButton({ ctx, sessionId, useSession, t }) {', '    function FeishuComposerGuard(props) {', 'FeishuStopButton')

test('stop button asks for confirmation and cancels the scoped conversation', async () => {
  let confirmed
  let cancelled = false
  const modal = {
    confirm(options) { confirmed = options },
  }
  const env = {
    React: { Fragment: 'Fragment' },
    h: (type, props, ...children) => ({ type, props: { ...(props || {}), children } }),
    Modal: { useModal: () => [{ confirm: modal.confirm }, 'modal-holder'] },
    Button: 'button',
    IconStopFill: 'stop-icon',
    useSession: (selector) => selector({ running: true }),
    ctx: {
      sessions: {
        scope: () => ({ get: () => ({ cancel: async () => { cancelled = true } }) }),
      },
    },
    sessionId: 'dfc:feishu_test:dm:1:oc_1',
    t: (key) => key,
  }
  const Component = new Function(...Object.keys(env), `${body}; return FeishuStopButton;`)(...Object.values(env))
  const tree = Component(env)
  const button = flattenChildren(tree).find((node) => node.type === 'button')
  assert.ok(button, 'stop button should render while running')
  button.props.onClick()
  assert.ok(confirmed, 'click should open a confirmation dialog')
  assert.equal(confirmed.title, 'composer.stopTitle')
  assert.equal(confirmed.description, 'composer.stopDescription')
  await confirmed.onOk()
  assert.equal(cancelled, true, 'confirming should cancel the conversation')
})
