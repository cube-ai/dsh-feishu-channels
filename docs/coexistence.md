# Sidebar coexistence with dsh-im-connect

This document is the maintenance contract for the shared "任务 | 频道 | 飞书频道" tab bar.

## Why a contract is needed

DSH has no official sidebar-tab slot. `sidebar.workspaces` is a single slot owned by
`@deepseek-ai/dsh-client-ui-workspace`. `dsh-im-connect` wraps that component and
attaches a private **Registry v1** (`component.__dshNativeTabs`). Other plugins can insert
tabs into that registry without modifying `dsh-im-connect`.

`@cubeai/dsh-feishu-channels` implements the same registry contract. Either plugin may be
the wrapper ("host"); the other one inserts its tab.

## Registry v1

```ts
interface SidebarTabRegistryV1 {
  version: 1
  officialTree: React.ComponentType<any>
  sessionFilters: Array<(sessionId: string) => boolean>
  sessionOpeners: Array<{ id: string, order?: number, matchSession(id: string): boolean, open(id: string, hostOpen?: (id: string) => void): void }>
  getTabs(): Tab[]
  getRevision(): number
  subscribe(listener: () => void): () => void
  insert(tab: Tab): () => void
  addSessionFilter(filter: (id: string) => boolean): () => void
  addSessionOpener(opener: SessionOpener): () => void
}
```

Discovery rules (compatible with `dsh-im-connect@1.0.12`):

1. Read `sidebar.workspaces` occupants.
2. If `occupant.component.__dshNativeTabs` is a valid v1 registry, insert a tab; do not wrap.
3. Else if the component is already wrapped by an unknown host, leave it untouched.
4. Else wrap the official component and attach a registry to the wrapper function.

Wrapper markers:

- `__dshNativeTabHost = true`
- `__dshNativeTabWrapped = true`
- `__dshNativeTabOriginal = originalComponent`
- `__dshNativeTabOwner = 'im-connect' | 'feishu-channel'`
- `__dfcTabHost = true` (new plugin only)

Coordination event: `window.dispatchEvent(new Event('dsh-native-sidebar-change'))`.

## Tabs

| Plugin | id | order | Label |
|---|---|---:|---|
| dsh-im-connect | `channels` | 20 | 频道 / Channels |
| dsh-feishu-channels | `feishu` | 30 | 飞书频道 / Feishu |

Tasks is the fixed first tab. Sorted result:

```text
任务 | 频道 | 飞书频道
```

When only one plugin is installed, the other tab is absent.

## Session visibility

- Feishu sessions use `dfc:`; im-connect sessions use `im:`.
- Each plugin adds a session filter to the shared registry so its own sessions do not appear
  in the Tasks tree.
- A session id never matches both prefixes.
- Do not share `sessions.json`, `channels.json`, credentials, or state directories.

## Lifecycle

| Event | Behavior |
|---|---|
| New plugin loads after im-connect | Insert `feishu` into im-connect's registry |
| im-connect loads after new plugin | im-connect detects the new registry and inserts `channels` |
| New plugin unloads, im-connect remains | Remove own tab/filter; if own wrapper, restore official component and dispatch change event; im-connect re-wraps |
| im-connect unloads, new plugin remains | im-connect removes its tab/restores; new plugin re-wraps on change event |
| Both disabled | Official sidebar |
| Page refresh | Deterministic re-evaluation from the bundle order |

All disposers must be idempotent and remove only their own tab/filter/opener.

## Known limitations

- Registry v1 is a private convention, not a DSH public API. A future im-connect release may
  change it; the new plugin degrades to the official sidebar rather than fighting it.
- Codex UI sidebars (`sidebar.channels`) are not wrapped by v1.
- Two plugins must not use the same Feishu App ID at the same time; Feishu long-connection
  events are delivered to one connection.
- **Uninstall order:** because both plugins share the single `sidebar.workspaces` slot and
  one wraps the other, uninstalling `dsh-im-connect` while the new plugin is active can be
  rejected by DSH's `bundle-in-use` guard. Disable `@cubeai/dsh-feishu-channels` first, then
  uninstall `dsh-im-connect`; the new plugin can be re-enabled afterwards (it falls back to
  the official sidebar and shows `任务 | 飞书频道`). This is a UI-wrapper/runtime coupling,
  not an npm dependency: neither package imports the other, and their Host state, APIs,
  credentials, and sessions are separate.

## Verification matrix

| Scenario | Expected |
|---|---|
| new plugin only | 任务 \| 飞书频道 |
| im-connect only | 任务 \| 频道 |
| im-connect first, new plugin second | 任务 \| 频道 \| 飞书频道 |
| new plugin first, im-connect second | 任务 \| 频道 \| 飞书频道 |
| disable new plugin | 任务 \| 频道 |
| disable im-connect | 任务 \| 飞书频道 |
| uninstall either | Disable the other plugin first if DSH reports `bundle-in-use`; then uninstall, then re-enable |
| refresh | Same as before refresh |
| reload client | No duplicate tabs |
