import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createSessionSwitcherHarness,
  findNode,
  makeRegistry,
  textOf,
} from './support/session-switcher-harness.mjs'

const LABELS = {
  'rail.tasks': '任务',
  'rail.feishu': '飞书频道',
  'rail.tabsAria': '工作区分类',
}

function t(key) {
  return LABELS[key] ?? key
}

function storageWith(tab) {
  return {
    getItem: (key) => (key === 'dsh-feishu-channels.sidebar-tab' ? tab : null),
    setItem: () => {},
    removeItem: () => {},
  }
}

function renderWith(tabs = [], tab = null) {
  const harness = createSessionSwitcherHarness(storageWith(tab))
  const registry = makeRegistry(tabs)
  const tree = harness.render({
    t,
    officialT: t,
    nativeTabs: registry,
    useSessions: (selector) => selector({ ids: [], byId: {}, current: null, phase: 'ready' }),
    openSession: () => {},
  })
  return { harness, registry, tree }
}

function tabValues(tree) {
  const segmented = findNode(tree, 'segmented-tabs')
  assert.ok(segmented, 'segmented tabs not rendered')
  return segmented.props.items.map((item) => item.value)
}

test('own shell shows 任务 | 飞书频道', () => {
  const { tree } = renderWith([])
  assert.deepEqual(tabValues(tree), ['tasks', 'feishu'])
  const segmented = findNode(tree, 'segmented-tabs')
  const feishu = segmented.props.items.find((item) => item.value === 'feishu')
  assert.match(textOf(feishu.label), /飞书频道/)
  assert.ok(findNode(feishu.label, 'brand-mark'), 'feishu tab should render the Feishu brand mark')
  assert.ok(findNode(tree, 'official-tree'), 'tasks content should be the official tree')
})

test('foreign channel tab is placed between 任务 and 飞书频道', () => {
  const { tree } = renderWith([
    { id: 'channels', order: 20, label: '频道', render: () => ({ type: 'channels-render', props: {} }) },
  ])
  assert.deepEqual(tabValues(tree), ['tasks', 'channels', 'feishu'])
  const segmented = findNode(tree, 'segmented-tabs')
  assert.match(textOf(segmented.props.items.find((item) => item.value === 'channels').label), /频道/)
})

test('other plugin tabs are ordered by order, then tasks, then feishu', () => {
  const { tree } = renderWith([
    { id: 'channels', order: 20, label: '频道', render: () => ({ type: 'channels-render', props: {} }) },
    { id: 'schedule', order: 10, label: '定时', render: () => ({ type: 'schedule-render', props: {} }) },
    { id: 'other', order: 40, label: '其他', render: () => ({ type: 'other-render', props: {} }) },
  ])
  assert.deepEqual(tabValues(tree), ['tasks', 'schedule', 'channels', 'feishu', 'other'])
})

test('feishu tab renders the channel view', () => {
  const { tree } = renderWith([], 'feishu')
  assert.ok(findNode(tree, 'feishu-channel-page'), 'feishu content should be the Feishu account page')
})

test('foreign tab renders through its own render function', () => {
  const { tree } = renderWith([
    { id: 'channels', order: 20, label: '频道', render: () => ({ type: 'channels-render', props: {} }) },
  ], 'channels')
  assert.ok(findNode(tree, 'channels-render'), 'foreign tab content should use its render()')
})

test('dfc sessions claim the feishu tab, normal sessions claim tasks', () => {
  const { harness } = renderWith([])
  const feishu = harness.helpers.followSidebarTab(
    { ready: true, previousId: 'old' },
    'dfc:feishu_abc:dm:1700000000000:oc_1',
    [],
  )
  assert.equal(feishu.tab, 'feishu')
  const normal = harness.helpers.followSidebarTab(
    { ready: true, previousId: 'old' },
    'session-123',
    [],
  )
  assert.equal(normal.tab, 'tasks')
  assert.equal(harness.helpers.resolveSidebarTab('feishu', []), 'feishu')
  assert.equal(harness.helpers.resolveSidebarTab('channels', []), 'tasks')
})
