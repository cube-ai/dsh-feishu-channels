// Extracts the real SessionSwitcher from client.js and renders it with a tiny hook runtime.
import { readFileSync } from 'node:fs'

export function extractBlock(source, startMarker, endMarker, label) {
  source = source.replace(/\r\n/g, '\n')
  const start = source.indexOf(startMarker)
  const end = source.indexOf(endMarker)
  if (start < 0 || end <= start || source.indexOf(startMarker, start + 1) >= 0 || source.indexOf(endMarker, end + 1) >= 0) {
    throw new Error(`${label}: marker missing, duplicated, or out of order`)
  }
  return source.slice(start, end)
}

const source = readFileSync(new URL('../../client.js', import.meta.url), 'utf8')
const membership = source.slice(source.indexOf('    let channelSessionIds'), source.indexOf('    const api ='))
const helpers = new Function(membership + '; return { followSidebarTab, isHostNewSessionControl, resolveSidebarTab, sidebarTabForSession, isChannelSession };')()
const body = extractBlock(source, '    function SessionSwitcher(props)', '    function sidebarOccupantName', 'SessionSwitcher')
const TAB_KEY = JSON.parse(source.match(/const TAB_KEY = ("[^"]+");/)[1])

export { helpers, TAB_KEY, body }

export function createSessionSwitcherHarness(storage = { getItem: () => null, setItem: () => {}, removeItem: () => {} }) {
  const state = []
  let cursor = 0
  let effects = []
  let dirty = false
  const listeners = new Set()
  const env = {
    ...helpers,
    TAB_KEY,
    localStorage: storage,
    document: {
      addEventListener: (_, fn) => listeners.add(fn),
      removeEventListener: (_, fn) => listeners.delete(fn),
    },
    subscribeChannelMembership: () => () => {},
    channelMembershipSnapshot: () => 0,
    useSyncExternalStore: (_, snapshot) => snapshot(),
    useMemo: (fn) => fn(),
    useCallback: (fn) => fn,
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
    useRef(value) {
      const index = cursor++
      if (!(index in state)) state[index] = { current: value }
      return state[index]
    },
    useEffect(callback, deps) {
      const index = cursor++
      const old = state[index]
      if (old && deps && deps.length === old.deps?.length && deps.every((value, i) => Object.is(value, old.deps[i]))) return
      effects.push(() => {
        old?.cleanup?.()
        state[index] = { deps, cleanup: callback() }
      })
    },
    fallbackT: (key) => key,
    EMPTY_EXTRA_TABS: [],
    currentSessionId: (snapshot) => snapshot.current ?? null,
    applySessionFilters: (value) => value,
    resolveHostSessionId: (id) => id,
    openRegisteredSession() {},
    openListedSession() {},
    ensureStyle() {},
    h: (type, props, ...children) => ({ type, props: { ...props, children } }),
    HostSegmentedTabs: 'segmented-tabs',
    IconFolderClose: 'folder',
    IconQueueOutline: 'queue',
    IconClockOutline: 'clock',
    ChannelOfficialView: 'channel-view',
    BrandMark: 'brand-mark',
    feishuTabLabelNode: (t) => ({ type: 'span', props: { className: 'dfc-tab-inline', children: [{ type: 'brand-mark', props: {} }, { type: 'span', props: { children: [t('rail.feishu')] } }] } }),
    FeishuChannelPage: 'feishu-channel-page',
    ChannelUnavailable: 'unavailable',
    isChannelSession: (id) => String(id).startsWith('dfc:'),
  }
  const Shell = new Function(...Object.keys(env), `${body}; return SessionSwitcher;`)(...Object.values(env))
  return {
    render(props = {}) {
      let tree
      for (let attempt = 0; attempt < 10; attempt++) {
        cursor = 0
        effects = []
        dirty = false
        tree = Shell({
          t: (key) => key,
          officialT: (key) => key,
          officialTree: 'official-tree',
          useSessions: (selector) => selector({ ids: [], byId: {}, current: null, phase: 'ready' }),
          openSession() {},
          ...props,
        })
        for (const effect of effects) effect()
        if (!dirty) return tree
      }
      throw new Error('SessionSwitcher state did not settle')
    },
    helpers,
  }
}

export function flattenChildren(node, out = []) {
  if (node === null || node === undefined || node === false) return out
  if (Array.isArray(node)) {
    for (const item of node) flattenChildren(item, out)
    return out
  }
  if (typeof node === 'object' && 'type' in node) {
    out.push(node)
    flattenChildren(node.props?.children, out)
  }
  return out
}

export function findNode(tree, type) {
  return flattenChildren(tree).find((node) => node.type === type)
}

export function textOf(node) {
  if (node === null || node === undefined || node === false) return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  return textOf(node.props?.children)
}

export function makeRegistry(tabs = []) {
  let revision = 0
  const listeners = new Set()
  const emit = () => {
    revision += 1
    for (const fn of listeners) fn()
  }
  return {
    version: 1,
    officialTree: 'official-tree',
    sessionFilters: [],
    sessionOpeners: [],
    getTabs: () => [...tabs].sort((a, b) => (a.order || 0) - (b.order || 0)),
    getRevision: () => revision,
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn) },
    insert: (tab) => { tabs.push(tab); emit(); return () => { const i = tabs.indexOf(tab); if (i >= 0) { tabs.splice(i, 1); emit() } } },
    addSessionFilter: (fn) => { return () => {} },
    addSessionOpener: () => () => {},
  }
}
