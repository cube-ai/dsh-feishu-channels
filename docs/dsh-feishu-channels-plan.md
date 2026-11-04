# DSH飞书频道（@cubeai/dsh-feishu-channels）可行性分析与开发方案

> 版本：v0.1（方案稿）  
> 日期：2026-11-04  
> 状态：设计已实施；见下方“实施更新”与 `docs/verification.md`  
> 目标工作区：`/home/hls/dev/dsh-remote-feishu/dsh-feishu-channels`  
> 参考实现：已安装的 `@michengai/dsh-im-connect@1.0.12`，以及同版本源码  
> 运行环境：DeepSeek Harness `0.2.1-rc.2`，Web profile `web`，Node `v24.20.0`

---

> **实施更新（2026-11-04）：** 已按 D1/A、D2/A、D3/A、D4/A、D5/A、D6/A 执行。
> 最终实现选择**纯 JS ESM，无构建步骤**：Host 直接从 `dsh-im-connect` 已编译的
> `lib/*.js` 移植，Client 为手写 `client.js`。包已通过本地目录 link 安装到当前
> `web` profile，Host 已加载并注册 `/api/dsh-feishu-channels`；84 项测试通过。
> 浏览器页面已加载新的 Client 模块（`settings.section` 与
> `sidebar.session.row.leading` 的实时 slot 检查已确认）；用户已目视确认侧边栏为
> **任务 | 频道 | 飞书频道**。真机飞书联调由用户选择稍后进行。频道页签保留了
> 原有的分组图标/分组菜单注入作为轻量增强，设置左栏图标与插件更新 UI 已移除。
> 此更新不改变下方设计结论。

## 0. 结论（TL;DR）

**结论：需求可行，且不需要修改 DSH 内核或已安装的 dsh-im-connect。**

关键判断如下：

1. **功能复制可行。** `dsh-im-connect` 的飞书能力集中在 `src/channels/feishu.ts` 与约 40 个与平台无关的 engine 模块中；其余 8 个 IM 通道是独立 adapter。保留飞书 adapter + engine，删除其他通道 adapter/UI，即可得到完整飞书功能。
2. **“完全独立”可行。** 只要把包名、插件行 id、状态目录、凭据 ref、HTTP API 前缀、客户端模块 id、locale 命名空间、CSS 前缀、localStorage key、会话 ID 前缀全部换成新命名空间，两个插件在 Host 与 Client 两侧都可以独立运行。
3. **“任务 | 频道 | 飞书频道”共存可行，但有前提。** DSH 当前没有官方“侧边栏页签”API；现有“任务 | 频道”是 `dsh-im-connect` 自己包裹 `sidebar.workspaces` 单槽并附加一个**插件私有 Registry v1** 实现的。好消息是：该实现**已经支持“外来页签宿主”**——只要新插件提供符合 v1 契约的 wrapper/registry，im-connect 会自动把“频道”页签插进来；反过来，新插件也能识别 im-connect 的 wrapper 并插入“飞书频道”页签。两种安装顺序都成立。
4. **主要风险不是“能不能做”，而是“私有协议稳定性”。** 该 Registry 不是 DSH 公共 API，im-connect 升级可能改变契约。方案必须内置契约探测、错误边界、降级与契约测试；最坏情况下退化为“无页签、仍可通过设置页和任务列表使用”，不能把宿主侧边栏弄崩。
5. **推荐实现路线：fork-and-trim（基于 Apache-2.0 源码裁剪），而不是从零重写。** 预计可把 Host 从 14,715 行压到约 7,500–8,500 行、Client 从 3,819 行压到约 2,300–2,800 行，并直接继承 105 个测试中的飞书相关部分。工期约 **2–3 周**（1 名熟悉 DSH 插件机制的开发者）；clean-room 重写约 **5–7 周**。
6. **上线前必须明确的运行时约束：** 两个插件不能同时用同一个飞书应用（App ID）建立长连接，否则飞书事件会被其中一个连接抢走。推荐配置是“im-connect 管其他通道、新插件管飞书”，并在 im-connect 中移除或停用飞书账号，或使用两个不同的飞书应用。

---

## 1. 需求与验收标准

### 1.1 原始需求拆解

| # | 需求 | 验收口径 |
|---|---|---|
| 1 | 包名 `@cubeai/dsh-feishu-channels`，中文名“DSH飞书频道” | `package.json`、locale `meta.title`、设置页标题、插件市场/插件管理条目都使用该名称 |
| 2 | 功能完全复制现有 dsh-im-connect，但只保留飞书通道 | 飞书连接/扫码/手动配置/收发消息/审批/提问/图片/文件/命令/多账号/每账号设置全部保留；其他 8 个通道的 UI 与代码全部删除 |
| 3 | 完全独立，装不装 im-connect 都能工作，互不影响、不冲突 | 卸载 im-connect 后新插件功能完整；两者同时安装时状态目录/凭据/API/会话/页签互不串扰 |
| 4 | 侧边栏菜单项“任务 \| 飞书频道”；有 im-connect 时变成“任务 \| 频道 \| 飞书频道”；两种安装顺序都成立 | 单一 tab bar；顺序正确；刷新/HMR/禁用/卸载后仍正确 |
| 5 | 设置界面左侧新增“飞书频道”菜单项 | `settings.section` 出现独立条目；页面可管理飞书账号 |

### 1.2 本方案的行为级验收清单

**A. 独装新插件**

- 左侧边栏显示 `任务 | 飞书频道`。
- 设置左侧显示“飞书频道”，页面可添加/扫码/手动配置飞书账号。
- 飞书私聊、群聊 @、流式回复、审批卡片、提问卡片、图片、文件、命令、多账号、账号级模型/工作区/权限/命令权限/私聊准入/发送方式均可用。
- 飞书会话只出现在“飞书频道”页签，不出现在“任务”页签（或至少不重复干扰；本方案默认过滤）。
- 卸载/禁用插件后，官方侧边栏恢复原样。

**B. 已装 im-connect，再装新插件**

- 侧边栏显示 `任务 | 频道 | 飞书频道`。
- “频道”页签仍由 im-connect 管理，其原有账号/会话/设置不受影响。
- “飞书频道”页签由新插件管理，互不读取对方状态。
- 两个设置页都出现，互不覆盖。

**C. 先装新插件，再装 im-connect**

- 结果与 B 相同：单一 tab bar，顺序 `任务 | 频道 | 飞书频道`。
- im-connect 不重复包裹侧边栏；新插件也不重复包裹。

**D. 生命周期**

- 页面刷新、客户端重载（HMR 或刷新）、禁用其一、卸载其一、两个都禁用/卸载，侧边栏都能回到正确状态。
- 任一插件的页签注册/卸载不影响另一个插件的页签。

**E. 运行时隔离**

- 两个插件使用不同 `stateDir`、不同凭据 ref、不同 API 前缀、不同会话 ID 前缀。
- 两边各自配置不同飞书应用时，消息互不串台。
- 两边配置同一个飞书应用时，文档明确警告（平台层冲突，非代码可完全消除）。

### 1.3 非目标（v1 不做）

> **命名区分：** 已安装的 `@cubeai/dsh-remote-feishu`（“飞书远程DSH”）是“用户通过飞书访问远端智能体”的插件；本项目 `@cubeai/dsh-feishu-channels` 是“把飞书机器人接入本机 DSH”的通道插件。两者无代码依赖，也不要互相复用状态目录。

- 不修改 `@michengai/dsh-im-connect` 的任何文件。
- 不修改 DSH 内核或 `@deepseek-ai/dsh-client-ui-*` 包。
- 不引入 Lark/国际版作为独立通道；如扫码检测到 Lark 租户，给出明确提示（见 §6）。
- 不自动迁移 im-connect 中已有的飞书账号、凭据、会话。
- 不做插件自更新（im-connect 的 `plugin-updater` 与其 GitHub 仓库绑定，新插件没有对应发布源）。
- 不追求像素级复制 im-connect 的所有 DOM 注入彩蛋（频道品牌图标替换、工作区右键菜单注入等，见 §7.2 与 §12）。
- 不实现飞书语音/视频原生消息（im-connect 本身也未实现）。

---

## 2. 现有 dsh-im-connect 架构分析

### 2.1 安装与版本事实

- 已安装包：`/home/hls/.dsh/profiles/web/node_modules/@michengai/dsh-im-connect`，版本 `1.0.12`。
- 同版本完整源码：`/home/hls/dev/dsh-remote-feishu/dsh-im-connect-1.0.12`。
- 许可证：Apache-2.0（允许衍生，需保留 LICENSE/NOTICE）。
- Host 入口：`src/index.ts` → `ChannelManager`（`src/manager.ts`，1,485 行）→ `ImEngine`（`src/engine/gateway.ts`，1,387 行）。
- Client 入口：根目录 `client.js`（3,819 行，手写 UMD/ModuleLoader 工厂），由构建脚本复制为 `lib/client.js`；`lib/client.js` 另拼接了 `src/plugin-update-ui.js`。
- Bundle patch：`cordis.patch.yml` 插入一行 `id: im-connect`。
- 依赖：飞书 SDK、QQ/企微/钉钉 SDK、`qrcode`、`undici` 等；飞书实际只需要 `@larksuiteoapi/node-sdk` 与 `qrcode`。

### 2.2 Host 侧结构

```text
src/index.ts                 插件入口：Config、stateDir、日志、ChannelManager
src/manager.ts               账号/凭据/连接/API 路由/辅助模型/审批白名单
src/channels/
  feishu.ts                  飞书长连接、收发、卡片、媒体、诊断
  meta.ts                    9 个通道的元数据/字段
  factory.ts                 按通道创建 adapter
  connection-state.ts        连接状态归类
  diagnostics.ts             诊断探针
  qr/feishu.ts               飞书设备码扫码建应用
  qr/hub.ts                  扫码会话状态机
  qr/render.ts               本地二维码 data URL
  qr/shared.ts               扫码公共类型
  dingtalk/wecom/weixin/qq/telegram/discord/slack ... 其余 7 个通道
src/engine/
  gateway.ts                 Agent 会话、事件、流式回复、审批、提问、命令、投递
  router.ts                  IM 会话创建/恢复/绑定/轮转/工作区挂载
  session-id.ts              im: 前缀、通道 ID、task 过滤
  session-store.ts           sessions.json
  credentials.ts             凭据 ref 与 vault
  assistant-settings.ts      模型/权限/工作区归一化
  ...                        约 35 个平台无关模块
```

**飞书链路的实际数据流：**

```text
飞书 WS 长连接
  → createFeishuChannel 的 im.message.receive_v1
  → resolveFeishuContent（文本/图片/文件/富文本）
  → ImMessage
  → ImEngine.enqueue / handleInbound
  → SessionRouter.getOrCreate（创建或恢复 DSH Agent 会话）
  → DSH agent（ctx.agents.create / resume）
  → session/event + agent/assistant-stream
  → 飞书卡片 markdown 回复 / 状态表情 / 文件
```

**会话 ID：** `im:<accountId>:<dm|group>:<timestamp>:<chatId>`。  
**会话恢复：** 启动时扫描 `sessionPersistence.list()`，把 `im:` 前缀的会话写回 `sessions.json`。  
**关键点：** 会话归属完全靠这个前缀和 `sessions.json` 判定；这是两个插件可以互不干扰的基础。

### 2.3 飞书通道能力清单

`src/channels/feishu.ts` 已实现：

- App ID / App Secret 凭据连接；WebSocket 长连接。
- 私聊与群聊；群聊只有明确 @ 机器人本身才触发。
- 文本、图片、文件、富文本（post）接收；图片/文件通过 `messageResource.get` 下载；单图 20 MB、单消息累计 20 MB、最多 4 张。
- 卡片 2.0 markdown 回复；按表格数量拆分（飞书单卡最多 5 个 table）；卡片被拒时回退纯文本；限流码识别与退避。
- 选择卡片（按钮）与 `card.action.trigger` 回调。
- 状态表情（OnIt / DONE / ERROR）。
- 文件上传与发送。
- 连接诊断（tenant_access_token + bot info）。
- 扫码创建“PersonalAgent”飞书应用（`accounts.feishu.cn` 设备码流程）。

**这些能力与通道无关的支撑模块**（审批、提问、流式、延迟投递、会话映射、命令、文件/图片输入等）都在 engine，可以直接保留。

### 2.4 Client 侧结构

`client.js` 大致分为：

| 区块 | 作用 | 与新插件关系 |
|---|---|---|
| 通用控件（Button/Input/Select/Modal/Switch/Tag/NoticeBar） | 自绘 UI | 保留并去宿主 primitives 依赖 |
| `IM_LOCALES` | zh/en 词典 | 裁剪为飞书键 |
| `CSS` | `.ima-*` 全局样式 | 改前缀为 `.dfc-*` |
| `api()` / `channelRefresh` | 调 `/api/dsh-im-connect/*` | 改 base/header |
| `SettingsPage` | 设置页主界面：通道卡片/账号/待批准 | 裁剪为单飞书卡片 |
| `BindModal` | 扫码/手动绑定 | 保留飞书分支 |
| `AccountInspector` | 账号级模型/工作区/权限/命令/诊断 | 去掉代理等非飞书项 |
| `ChannelOfficialView` | 频道页签内容：官方任务树 + 频道分组 | 裁剪为飞书单通道 |
| `SessionSwitcher` | “任务 \| 频道”页签外壳 | 新插件自研同契约外壳 |
| `createNativeTabRegistry` | 私有页签注册表 v1 | 必须兼容实现 |
| `sidebar.workspaces` 包裹逻辑 | 把官方任务树换成带页签的壳 | 必须兼容实现 |
| `settings.section` 注册 | 设置左栏“IM助理” | 改成“飞书频道” |
| `sidebar.session.row.leading` | 会话行频道品牌标 | 改成飞书标 |
| `sidebar.channels` 注册 | 给 Codex UI 留占位 | v1 可不做 |

### 2.5 “任务 | 频道”到底是怎么实现的（关键发现）

DSH 当前 `sidebar.workspaces` 是 **single slot**，官方占用者是 `@deepseek-ai/dsh-client-ui-workspace` 的 WorkspaceBrowser；DSH **没有**提供“在侧边栏里加页签”的官方 slot。

`dsh-im-connect` 的做法是：

1. 读取 `ctx.slots.entriesOfSlot('sidebar.workspaces')`，取当前占用的 entry。
2. 保存官方 `component`（`originalComp`），创建一个带“任务/频道”页签的外壳组件。
3. 把外壳组件挂上 `__dshNativeTabs`（Registry v1），并打上 `__dshNativeTabHost` / `__dshNativeTabWrapped` / `__dshNativeTabOriginal` 标记。
4. 直接替换该 entry 的 `component` 为外壳。
5. 外壳内部：
   - “任务”页签渲染官方 `originalComp`，并用 `useSessions` 过滤；
   - “频道”页签渲染 `ChannelOfficialView`；
   - 其他插件可通过 Registry 的 `insert()` 插入页签。
6. 侧栏宽度为 `wide === false` 时只渲染官方树，不渲染页签。

**Registry v1 契约**（从 `client.js` 与测试中还原）：

```ts
interface SidebarTabRegistryV1 {
  version: 1
  officialTree: React.ComponentType<any>
  sessionFilters: Array<(sessionId: string) => boolean>
  sessionOpeners: Array<{
    id: string
    order?: number
    matchSession(sessionId: string): boolean
    open(sessionId: string, hostOpen?: (id: string) => void): void
  }>
  getTabs(): SidebarTab[]
  getRevision(): number
  subscribe(listener: () => void): () => void
  insert(tab: SidebarTab): () => void
  addSessionFilter(filter: (sessionId: string) => boolean): () => void
  addSessionOpener(opener: SessionOpener): () => void
}

interface SidebarTab {
  id: string
  label: React.ReactNode
  order?: number
  matchSession?(sessionId: string): boolean
  render(props: any): React.ReactNode
}
```

**外来宿主的识别逻辑**（im-connect `sync()`）：

```text
occupant = sidebar.workspaces 当前 entry
if occupant.component 有 __dshNativeTabHost/__dshNativeTabWrapped/... 
   或 occupant.component.__dshNativeTabs 是合法 v1 registry：
    不包裹；直接 registry.insert({ id: 'channels', order: 20, ... })
else if 没有 entry：
    清空自身页签
else：
    包裹官方 component
```

这意味着：**只要新插件的 wrapper 提供同样的 Registry v1，im-connect 会自己把“频道”插进来**。这正是需求 4 两种安装顺序都能成立的技术基础。

### 2.6 设置页的实现

- Slot：`settings.section`（list），注册项 `id` 决定设置分区 key，`order` 决定左栏顺序，`label` 支持 thunk。
- 当前已注册项（实测）：`general(0)`、`models(10)`、`plugins(15)`、`agent-presets(20)`、`market(40)`、`im-assistant(40)`、`better-sidebar(100)`。
- im-connect 用 `id: "im-assistant"`、`order: 40`、`label: () => t("settings.label")`、`inject` 提供 `createWorkspace/pickDirectory/permissionT/modelT/presetT`。
- 设置左栏图标不是注册参数；宿主给所有外部 section 一个通用齿轮。im-connect 通过额外 DOM 观察替换成自己的图标，新插件可不做。
- 设置页内部的“打开设置并定位到 IM 助理”是通过 DOM 查询 `[role="dialog"] nav button` 并按文本精确匹配实现的。这是私有 DOM 技巧，但有降级空间。

### 2.7 可直接复用的测试资产

im-connect 有 105 个 `node:test` 测试文件。与新插件直接相关的包括：

- 飞书：`feishu.test.mjs`、`feishu-images.test.mjs`、`feishu-tables.test.mjs`、`feishu-card-fallback.test.mjs`
- 扫码：`pairing.test.mjs`、`qr-hub.test.mjs`
- 会话/网关：`session-id`、`session-store`、`session-title`、`session-history`、`session-compat`、`router`、`gateway-*`、`deferred-*`、`message-progress`、`reply-stream`、`merge`、`choices`、`approval`、`question`、`chat-commands`、`command-*`
- 媒体/文件：`file-*`、`image-*`、`channel-file-send`、`feishu-images`
- 侧边栏：`sidebar-lifecycle-harness.mjs`、`sidebar-shell-harness.mjs`、`sidebar-lifecycle.test.mjs`、`sidebar-shell-state.test.mjs`、`sidebar-tab-follow.test.mjs`、`settings-navigation.test.mjs`
- 隔离/安全：`credentials-ref`、`management-auth`、`hardening`、`style-ownership`、`client-loader`、`client-i18n`

其中 `sidebar-lifecycle-harness.mjs` 已经用“可控 slots + 计时器 + 真实 client 闭包”的方式验证了：外来宿主、组件替换、卸载恢复、重复通知、计时器停止。这套 harness 可以直接改造成新插件的共存测试。

---

## 3. 可行性判断

### 3.1 功能复制：可行

飞书通道和 engine 的耦合度低。除了 `types.ts` 的 `ChannelAdapter` 接口和 `factory.ts` 的 switch，飞书 adapter 不依赖其他通道。engine 通过 `ChannelAdapter` 抽象工作，不包含平台分支（少量 `channel.skipMerge`、`channel.beginReply` 等可选能力判断是通用的）。

**结论：** 删除其他通道后，飞书功能不会缺失；只需把 `ChannelId` 收窄为 `'feishu'`，并清理通道数组/UI 分支。

### 3.2 完全独立：可行

需要同时满足以下 4 类隔离：

| 隔离面 | im-connect | 新插件 | 冲突风险 |
|---|---|---|---|
| npm 包 / 插件行 | `@michengai/dsh-im-connect` / `im-connect` | `@cubeai/dsh-feishu-channels` / `feishu-channel` | 无 |
| Host 状态 | `$DSH_HOME/dsh-im-connect` | `$DSH_HOME/dsh-feishu-channels` | 无 |
| 凭据 ref | `im_connect_*` | `dfc_*` | 无 |
| HTTP API | `/api/dsh-im-connect` + `x-dsh-im-connect-client` | `/api/dsh-feishu-channels` + `x-dsh-feishu-channels-client` | 无 |
| 会话 ID | `im:` | `dfc:` | 无 |
| Client 模块 id | `@michengai/dsh-im-connect` | `@cubeai/dsh-feishu-channels` | 无 |
| locale ns | `im-connect` | `feishu-channel` | 无 |
| CSS / DOM | `.ima-*` / `data-ima-*` | `.dfc-*` / `data-dfc-*` | 无 |
| localStorage | `dsh-im-connect.*` 等 | `dsh-feishu-channels.*` | 无（共享 tab key 仅 im-connect 使用） |
| 全局事件 | 只发 `dsh-native-sidebar-change` | 同样只发该事件 | 有意共享，用于协作 |
| 设置分区 id | `im-assistant` | `feishu-channel` | 无 |
| 页签 id | `channels` | `feishu` | 无 |

**唯一有意的“共享”是侧边栏页签外壳与 `dsh-native-sidebar-change` 事件**。这是需求 4 要求“共用同一个菜单项”的必要协作面，不涉及业务数据。

### 3.3 侧边栏共存：可行，但依赖私有协议

**支持两种顺序的证据：**

- **im-connect 后装**：其 `sync()` 明确支持“当前 occupant 已经是外来 wrapper 且带 Registry v1”的情况，会走 `insertChannelTab(occupant)`，只 `insert` 页签，不再包裹。
- **新插件后装**：新插件只要检测到 im-connect wrapper 的 `__dshNativeTabs`，直接 `insert` 页签，不再包裹。
- **双方都未装**：新插件自己包裹，显示 `任务 | 飞书频道`。
- **只有 im-connect**：行为完全不变。

**页签顺序：** `getTabs()` 按 `order` 升序；“任务”是外壳固定页签；im-connect 的“频道”是 `order: 20`；新插件的“飞书频道”取 `order: 30`。因此：

```text
任务 | 频道 | 飞书频道
```

**风险：** `__dshNativeTabs` 不是 DSH 公共 API。如果 im-connect 未来改成 slot 注册或换 registry 版本，新插件必须能探测失败并降级。方案见 §5.7。

### 3.4 设置页共存：可行

`settings.section` 是 list slot，天然支持多个条目。新插件注册：

```js
ctx.slots.inject('settings.section', () => ctx.slots.register({
  name: 'settings.section',
  id: 'feishu-channel',
  order: 41,
  label: () => t('settings.label'),   // “飞书频道” / “Feishu Channel”
  inject: () => ({ ... }),
}, FeishuSettingsPage))
```

- `order: 41` 位于 im-connect 的 `40` 之后、better-sidebar 的 `100` 之前。
- 两者 `id`/`label` 不同，互不替换。
- 宿主左栏会给通用齿轮图标；不需要复制 im-connect 的图标 DOM hack。

### 3.5 运行时共存：基本可行，有一个平台级限制

**代码层：**

- 两个 Host 插件各自注册全局事件监听（`session/event`、`approval/request`、`user-questions/request` 等），但都按自己的 `router.bindingForSession(sessionId)` 过滤；`im:` 与 `dfc:` 不会互相命中。
- 两者都会包装 `userQuestions.ask`，但包装是透明的：非自己的会话调用 `next()`/原方法；嵌套包装可正常卸载。
- 两者各自创建自己的 Agent 会话，互不 resume 对方会话。
- 两者各自维护 `sessions.json`；不会读对方状态目录。

**平台层（必须写进文档）：**

- 飞书 `WSClient` 长连接以 App ID 为维度。两个插件若配置**同一个 App ID**，飞书侧可能只把事件投递给其中一个连接，表现为“时而这个插件回、时而那个插件不回”。
- 扫码绑定每次都会创建新应用，因此默认不会撞车。
- 推荐：im-connect 保留其他通道，飞书账号移除/停用；新插件用新的飞书应用。或者两个插件用两个不同应用。
- 这不是代码缺陷，无法在插件内可靠消除（除非探测并阻止同 App 双连接，但会引入跨插件读取凭据的耦合，不建议）。

### 3.6 可行性结论

| 维度 | 判断 | 置信度 |
|---|---|---|
| 飞书功能复制 | 可行 | 高 |
| 独立安装/独立状态 | 可行 | 高 |
| 设置页共存 | 可行 | 高 |
| 侧边栏两种安装顺序 | 可行，依赖 im-connect Registry v1 | 中高（有源码与测试佐证） |
| 同 App 双长连接 | 平台限制，需文档规避 | 高（已知限制） |
| 不修改 im-connect | 可行 | 高 |
| 2–3 周交付 | 可行（fork-and-trim） | 中 |

---

## 4. 总体方案

### 4.1 实现路线：fork-and-trim（推荐）

以 `dsh-im-connect@1.0.12` 的 Apache-2.0 源码为基线，复制到新包，然后做三类改动：

1. **删除**：其他 8 个通道、其 QR/适配器/UI/词典/依赖、插件自更新、非飞书主题代码。
2. **改名**：所有跨边界标识符换成新命名空间（§4.2）。
3. **改写**：`ChannelId` 收窄、侧边栏外壳按 Registry v1 重写为独立实现、设置页/频道页裁剪。

**为什么推荐 fork-and-trim：**

- 飞书链路已有大量边界处理（卡片表格拆分、限流回退、媒体大小、部分投递、审批/提问串行、命令权限、延迟投递），重写极易漏掉。
- 测试资产可直接继承。
- 风险集中在“删得干净”和“页签协议”，而不是“重新发明 engine”。

**许可证合规：**

- 新包继续使用 Apache-2.0。
- 保留上游 `LICENSE`，新增 `NOTICE`，注明：
  - 本产品包含 MichengAI 的 `dsh-im-connect`（Apache-2.0）衍生代码。
  - 修改说明：仅保留飞书通道并重命名命名空间。
- 飞书 Logo 是商标，仅作“飞书集成”的指示性使用；插件包图标另做原创图形。

**如果要求 clean-room 重写：** 工期约 5–7 周，且需要重新建立全部飞书边界测试；不建议。

### 4.2 命名空间与隔离矩阵（最终值）

| 项 | 最终值 |
|---|---|
| npm 包名 | `@cubeai/dsh-feishu-channels` |
| 中文名 / locale `meta.title` | `DSH飞书频道` |
| 插件 Host `name` | `dsh-feishu-channels` |
| Bundle patch 行 id | `feishu-channel` |
| 状态目录 | `$DSH_HOME/dsh-feishu-channels`（可由 Config `stateDir` 覆盖） |
| 凭据 ref 前缀 | `dfc_<accountId>_<key>` |
| HTTP API 前缀 | `/api/dsh-feishu-channels` |
| 变更请求头 | `x-dsh-feishu-channels-client: 1` |
| 客户端模块 id | `@cubeai/dsh-feishu-channels` |
| locale 命名空间 | `feishu-channel` |
| 设置分区 id | `feishu-channel` |
| 设置分区 order | `41` |
| 页签 id | `feishu` |
| 页签 order | `30` |
| 页签中文/英文 | `飞书频道` / `Feishu` |
| 会话 ID 前缀 | `dfc:` |
| CSS 前缀 | `dfc-` |
| 样式元素 id | `dsh-feishu-channels-style` |
| DOM 属性前缀 | `data-dfc-` |
| localStorage | `dsh-feishu-channels.*` |
| sessionStorage | `dsh-feishu-channels.*` |
| 日志文件 | `$stateDir/gateway.log` |
| 会话行 leading slot id | `feishu-channel-session` |
| 页签外壳标记 | `__dfcTabHost` + 共享的 `__dshNativeTab*` |

**保留的跨插件协作常量（只用于页签，不用于业务）：**

```text
__dshNativeTabs
__dshNativeTabHost
__dshNativeTabWrapped
__dshNativeTabOriginal
__dshNativeTabOwner
dsh-native-sidebar-change
tab id "channels"（im-connect 的，只读识别）
tab order 20（im-connect 的，只读识别）
```

### 4.3 目标包结构

```text
dsh-feishu-channels/
├── package.json
├── cordis.patch.yml
├── icon.svg                       # 原创插件图标
├── client.js                      # 浏览器端源码（ModuleLoader 工厂）
├── locale/
│   ├── zh.json
│   └── en.json
├── src/
│   ├── index.ts                   # Config / apply / stateDir / 日志
│   ├── manager.ts                 # 单通道账号管理 + API
│   ├── channels/
│   │   ├── feishu.ts              # 飞书 adapter（原样保留，去 lark 分支）
│   │   ├── meta.ts                # 只保留 feishu
│   │   ├── media.ts               # fileMedia / MAX_CHANNEL_IMAGES（从 channel-image-download 抽出）
│   │   ├── connection-state.ts
│   │   ├── diagnostics.ts
│   │   └── qr/
│   │       ├── feishu.ts
│   │       ├── hub.ts
│   │       ├── render.ts
│   │       └── shared.ts
│   └── engine/
│       ├── gateway.ts
│       ├── router.ts
│       ├── session-id.ts          # dfc: 前缀
│       ├── session-store.ts
│       ├── credentials.ts         # dfc_ ref
│       ├── ...                    # 平台无关模块（约 30 个）
│       └── types.ts
├── lib/                           # tsc 输出 + client 复制
├── scripts/
│   ├── build-client.mjs           # 复制 + 语法/符号检查
│   └── check-isolation.mjs        # 禁用字符串/依赖扫描
├── tests/
│   ├── support/sidebar-harness.mjs
│   ├── feishu*.test.mjs
│   ├── engine*.test.mjs
│   ├── coexistence*.test.mjs
│   └── ...
├── docs/
│   ├── dsh-feishu-channels-plan.md # 本文件
│   ├── coexistence.md
│   └── verification.md
├── README.md
├── README.zh-CN.md
├── SECURITY.md
├── LICENSE
└── NOTICE
```

### 4.4 Host 架构

```text
index.ts
  ├─ register Config（stateDir/cwd/provider/model/agentPreset/mergeTimeoutSecs）
  ├─ 初始化 stateDir / gateway.log
  ├─ new FeishuChannelManager(...)
  ├─ manager.registerApi(ctx)
  └─ manager.initEnabled() + attachMappedSessions()
        │
        ├─ FeishuAccountStore（channels.json / allowlist / pending）
        ├─ CredentialVault（ctx.credentials，ref = dfc_*）
        ├─ PairingHub（只含 feishu）
        ├─ FeishuChannelAdapter（长连接）
        └─ FeishuEngine（原 ImEngine，单通道）
              ├─ SessionRouter（dfc: 会话）
              ├─ ApprovalBroker / QuestionBroker
              ├─ ChoiceStore / ReplyStreamHub / DeferredDelivery
              ├─ ChatCommands
              └─ File/Image delivery
```

**保留的 Host 服务注入：**

```ts
export const inject = [
  'webServer',
  'credentials',
  'agents',
  'agentPresets',
  'agentDefaultModel',
  'llm',
  'permissionPresets',
]
```

`sessionPersistence`、`workspaceRegistry`、`connection`、`userQuestions` 继续通过 `ctx.get(...)` 可选读取，保持旧宿主兼容。

### 4.5 Client 架构

```text
client.js
  ├─ 通用控件/图标（自绘，不依赖 ui-primitives）
  ├─ 词典（feishu-channel）
  ├─ CSS（.dfc-*，仅主题 token）
  ├─ api() / refresh store
  ├─ FeishuSettingsPage（settings.section）
  │    ├─ 飞书账号卡片
  │    ├─ BindModal（扫码/手动）
  │    ├─ AccountInspector（模型/工作区/权限/命令/诊断）
  │    └─ 待批准列表
  ├─ FeishuChannelView（“飞书频道”页签）
  │    ├─ 官方任务树 + 飞书会话过滤 + 单频道分组
  │    └─ 空状态/错误/设置入口
  ├─ FeishuSessionLeading（会话行飞书标）
  └─ SidebarTabHost（核心）
       ├─ Registry v1 实现
       ├─ 包裹/被包裹/外来宿主三态
       ├─ 任务/飞书频道/其他插件页签
       └─ 生命周期/错误边界
```

**不依赖 `@deepseek-ai/dsh-client-ui-primitives`。** 所有控件/图标自绘，只 `require("react")`。这符合 DSH 插件实践，也避免宿主 primitives 变动导致插槽条目崩溃。

### 4.6 数据模型与存储

**`$stateDir/channels.json`：**

```jsonc
{
  "version": 2,
  "channels": {
    "feishu_ab12cd34ef56": {
      "id": "feishu_ab12cd34ef56",
      "platform": "feishu",
      "name": "飞书账号 1",
      "nameOrdinal": 1,
      "enabled": true,
      "receiveEnabled": true,
      "config": {
        "appId": "cli_xxx",
        "appSecretRef": "dfc_feishu_ab12cd34ef56_appSecret",
        "ownerOpenId": "ou_xxx"
      },
      "assistant": { "provider": "deepseek-official", "model": "deepseek-flash" },
      "agentPreset": "standard",
      "cwd": "/path/to/workspace",
      "permission": "workspace-write",
      "commandPermissions": { "...": "..." },
      "privateAccess": "approved",
      "sendMode": "queue",
      "lastCheckedAt": "2026-11-04T..."
    }
  },
  "allowlist": { "feishu_...": ["ou_..."] },
  "pending": { "feishu_...": [{ "userId": "ou_...", "time": 0 }] }
}
```

**其他文件：**

- `sessions.json`：`dfc:` 会话映射（key = `accountId:dm|group:chatId`）。
- `seen.json`：消息去重。
- `deferred-delivery.json`：延迟投递。
- `gateway.log`：滚动日志。
- `secrets.json`：仅当宿主没有 `credentials` 服务时的回退文件（权限 0600）。

**凭据：**

```text
dfc_<accountId>_appSecret
```

`accountId` 由 `appId` 的 SHA-256 前 12 位生成，例如 `feishu_ab12cd34ef56`。Secret 永不返回浏览器；API 只返回 `configuredKeys`。

### 4.7 API 设计

所有路由挂在 `/api/dsh-feishu-channels` 下，复用 im-connect 的认证/请求校验模式：

- 入口用 `ctx.connection.requestRejection(req)` 做宿主登录/来源校验；不可用时返回 503。
- 变更请求必须带 `x-dsh-feishu-channels-client: 1` 且 `content-type: application/json`。
- 请求体上限 1 MB；超限 413。
- 统一 `{ ok, error? }` 响应；错误不泄露凭据。

| 方法 | 路径 | 作用 |
|---|---|---|
| GET | `/channels` | `{ ok, channels, groups, pending, assistant }` |
| GET | `/assistant` | 默认模型/权限/预设/工作区/模型目录 |
| POST | `/assistant` | 保存默认模型/工作区/权限（可选，客户端 v1 可不调用） |
| GET | `/channels/feishu/qr/status` | 扫码会话状态 |
| POST | `/channels/feishu/qr/start` | 开始扫码（可带 settings） |
| POST | `/channels/feishu/qr/refresh` | 刷新二维码 |
| POST | `/channels/feishu/qr/cancel` | 取消扫码 |
| POST | `/channels/feishu/connect` | 手动 App ID/Secret 绑定 |
| POST | `/channels/feishu/receive` | 开/关接收 |
| POST | `/channels/feishu/disconnect` | 断开 |
| POST | `/channels/feishu/remove` | 移除账号 |
| POST | `/channels/feishu/approve`、`/deny` | 私聊准入 |
| POST | `/accounts/:id/settings` | 保存账号级设置 |
| POST | `/accounts/:id/receive` | 账号接收开关 |
| POST | `/accounts/:id/reconnect` | 重连 |
| POST | `/accounts/:id/check` | 诊断 |
| POST | `/accounts/:id/remove` | 移除 |
| POST | `/accounts/:id/approve`、`/deny` | 账号准入 |
| POST | `/sessions/:id/rename`、`/remove`、`/cleanup-missing`、`/ensure` | 会话操作 |

### 4.8 会话模型

```text
dfc:<accountId>:<dm|group>:<13位时间戳>:<chatId>
```

- 与 im-connect 的 `im:` 完全分开。
- `SessionRouter.recoverHistory()` 只解析 `dfc:` 前缀。
- 客户端 `dfc:` 前缀 + `/channels` 返回的 `groups` 成员集合共同判断“飞书会话”。
- 发送到共享 Registry 的 `sessionFilters`：

```js
(sessionId) => !String(sessionId).startsWith('dfc:')
```

这样“任务”页签不会列出飞书会话；当 im-connect 是外壳宿主时，它读取同一个 `sessionFilters`，因此它的“任务”页签也不会列出新插件的飞书会话。

- 不设置 `origin: 'im'`；DSH 的 `origin` 不是给这个用途的，im-connect 也靠 ID 前缀。
- 已有的 `im:feishu:*` 会话不被新插件接管；它们仍归 im-connect 管。

---

## 5. 侧边栏页签共存协议（核心设计）

### 5.1 为什么需要协议

DSH 没有官方页签 API，`sidebar.workspaces` 只能有一个 occupant。两个插件都想显示“任务 + 自己的频道页签”，就必须：

- 只允许一个插件包裹官方组件；
- 另一个插件把页签插入同一个 Registry；
- 双方都能识别“对方已经是宿主”；
- 卸载时能恢复/交接。

im-connect 已经实现了这套约定，新插件按同一契约实现即可，不需要修改 im-connect。

### 5.2 Registry v1 契约

新插件必须提供与 im-connect 完全一致的字段/方法（§2.5）。特别注意 im-connect 的探测只认：

```js
registry.version === 1
typeof registry.getTabs === 'function'
typeof registry.subscribe === 'function'
typeof registry.insert === 'function'
```

并且它从 `entry.component.__dshNativeTabs` 读取 registry（不是 `entry.__dshNativeTabs`）。因此：

- 必须把 registry 挂到 **wrapper 组件函数对象**上；
- 同时建议挂到 entry 上，兼容其他消费者；
- `officialTree` 必须是**原始官方组件**，不能是 wrapper 自身；
- `insert` 必须按 `order` 排序并通知订阅者；
- `getTabs()` 必须返回稳定数组（未变化时同引用），避免 React `useSyncExternalStore` 死循环；
- `addSessionFilter` / `addSessionOpener` 必须返回幂等 disposer；提供 `addSessionOpener` 后，外壳打开会话时应走 `openRegisteredSession` 按 `order` 选择 opener，否则 im-connect 注入的 opener 不会生效；
- **词典隔离**：外壳调用 `tab.render(props)` 时，`props.t` 应保持宿主词典（或 `officialT`），各插件页签使用自己闭包捕获的 `t`。否则 im-connect 的页签会拿到新插件的词典，宿主键名渲染成原键。新插件渲染外来页签时同样传 `officialT: props.officialT || props.t`，并用 `t: officialT` 覆盖 `props.t`。

### 5.3 所有权状态机

新插件每次 `sync()`：

```text
if 没有 sidebar.workspaces occupant:
    清理自己的页签/包裹；等待
if occupant 带 codex-ui 标记:
    清理自己的页签/包裹；降级（v1 不支持 Codex UI）
if occupant.component 有合法 Registry v1:
    → 外来宿主模式：insert 自己的页签 + 自己的 sessionFilter + 自己的 opener（可选）
    → 不包裹
if occupant.component 已是被包裹但没有 Registry:
    → 未知宿主：不包裹、不插入；记录一次警告；等待/重试
if occupant.component 是自己的 wrapper:
    → 自己宿主模式：确保页签/filter 存在
if occupant.component 是官方组件:
    → 包裹：保存 original，创建 Registry，替换 component
```

**同步与竞态：**

- `sync()` 全程同步执行，不 `await`，避免两个插件在同一 tick 内都基于旧状态包裹。
- 注册 `ctx.slots.subscribe('sidebar.workspaces')`、`ctx.slots.subscribe('sidebar')`、`window.addEventListener('dsh-native-sidebar-change')`。
- 启动后做 20 次 × 250ms 的短重试，覆盖“对方后加载/槽位晚就绪”；接入成功后停止。
- 每次 sync 用 `syncing` 布尔量防止重入。

### 5.4 两种加载顺序

**顺序 A：im-connect 先装（当前 profile 的默认情况）**

```text
im-connect 包裹官方组件，挂 Registry(im)
  ↓
新插件加载，发现 occupant.component.__dshNativeTabs = Registry(im)
  ↓
新插件 registry.insert({ id:'feishu', order:30, ... })
  + registry.addSessionFilter(dfc 过滤)
  ↓
im-connect 的 SessionSwitcher 读到 extraTabs=[feishu]
  → 渲染 任务 | 频道 | 飞书频道
```

**顺序 B：新插件先装**

```text
新插件包裹官方组件，挂 Registry(new)
  ↓
im-connect 加载，sync 发现 occupant 带 __dshNativeTabHost / Registry v1
  ↓
im-connect 走 insertChannelTab(occupant)
  → registry.insert({ id:'channels', order:20, ... })
  → registry.addSessionOpener(...)（如果新插件提供 addSessionOpener）
  ↓
新插件的 TabHost 读到 extraTabs=[channels]
  → 渲染 任务 | 频道 | 飞书频道
```

**顺序 C：只有新插件**

```text
新插件包裹 → 任务 | 飞书频道
```

**顺序 D：只有 im-connect**

```text
im-connect 原行为完全不变 → 任务 | 频道
```

### 5.5 卸载 / HMR / 禁用

| 事件 | 行为 |
|---|---|
| 新插件卸载，im-connect 仍装 | 新插件移除自己的页签/filter；若是自己包裹则还原官方组件并 `dispatch(dsh-native-sidebar-change)`；im-connect 收到事件后重新包裹，页签恢复为 `任务 | 频道` |
| im-connect 卸载，新插件仍装 | im-connect 移除自己的页签并还原官方组件（如果它是宿主）；新插件收到事件后重新包裹，页签变成 `任务 | 飞书频道` |
| 两个都卸载 | 最后一个宿主还原官方组件 |
| 页面刷新 | 两个插件按 bundle 顺序重新 sync，结果与刷新前一致 |
| HMR 只为新插件重建 | 新插件新实例发现旧 wrapper/Registry，复用并确保页签存在；旧实例 cleanup 只删自己的项 |
| 只禁用其一 | 禁用方不加载 client；另一方按“只装自己”的路径工作 |

**关键清理原则：**

- 只删除自己插入的 tab/filter/opener；
- 只还原自己创建的 wrapper；
- 如果 `entry.component` 已被别人替换，不覆盖；
- cleanup 后 `dispatch(dsh-native-sidebar-change)`，让另一方接管；
- 所有 disposer 必须幂等。

### 5.6 任务树会话过滤

- 新插件把自己的 `dfc:` 过滤函数加入共享 Registry 的 `sessionFilters`。
- 当 im-connect 或新插件作为外壳时，“任务”页签的 `useSessions` 都会经过 `applySessionFilters`，因此飞书会话不会出现在“任务”；未知外来外壳若不实现过滤器，则无法保证（降级路径，见 §5.7）。
- 新插件的“飞书频道”页签使用**未经过滤**的 `useSessions` + 自己的成员集合，因此能看到全部飞书会话。
- 如果 im-connect 将来也加了自己的 filter，两者叠加，互不影响。

### 5.7 降级策略

按优先级从高到低：

1. **正常**：识别/创建 Registry v1，显示页签。
2. **外来宿主不可识别**：不包裹、不插入，保留官方侧边栏；设置页仍可管理账号；飞书会话仍可通过 `dfc:` 会话在宿主任务列表/URL 打开（只是没有专属页签）。在 console 打一条一次性警告，不弹窗、不破坏 UI。
3. **包裹渲染异常**：`TabHost` 用 ErrorBoundary 捕获，回落到官方 `originalComp`，只显示任务树。
4. **官方组件缺失/槽位消失**：清理自己的包裹，等待槽位恢复。
5. **Codex UI 宿主**：v1 不包裹；可注册 `sidebar.channels` 占位（可选），等后续适配。

### 5.8 关键伪代码

```js
function sync() {
  if (disposed || syncing) return
  syncing = true
  try {
    if (hasCodexUiSidebar(ctx)) { detach(); return }

    const entries = readSlotEntries(ctx, 'sidebar.workspaces')
    const occupant = entries.find((e) => e && e.component)
    if (!occupant) { detach(); return }

    const component = occupant.component
    const foreign = findRegistryV1(component)

    if (foreign) {
      detachWrapperIfOwned()
      ensureForeignTab(occupant, foreign)
      return
    }

    if (isWrappedComponent(component)) {
      detachOwnTab()
      warnOnceUnknownHost()
      return
    }

    if (component === ownWrapper) {
      ensureOwnTab()
      return
    }

    wrap(occupant)
  } finally {
    syncing = false
  }
}
```

```js
function ensureForeignTab(occupant, registry) {
  if (activeRegistry !== registry) {
    cleanupForeignTab()          // 移除旧 registry 上的 tab/filter
    activeRegistry = registry
  }
  removeFilter?.()               // 幂等：重复 sync 不叠加 filter
  removeFilter = registry.addSessionFilter((id) => !String(id).startsWith('dfc:'))
  removeTab?.()                  // 幂等：同 id 重插不会留下旧项
  removeTab = registry.insert({
    id: 'feishu',
    order: 30,
    label: t('rail.feishu'),
    matchSession: (id) => String(id).startsWith('dfc:') || feishuSessionIds.has(String(id)),
    // FeishuChannelView 内部用闭包捕获的 t；props.t 保持宿主词典
    render: (props) => h(FeishuChannelView, {
      ...props,
      t: props.officialT || props.t,
      officialTree: registry.officialTree,
    }),
  })
}
```

---

## 6. 飞书通道保留范围

### 6.1 必须保留（功能 parity 的核心）

**Host：**

- 飞书 WS 长连接、App ID/Secret。
- 私聊/群聊/@ 判定。
- 文本、图片、文件、富文本、卡片 2.0、表格拆分、纯文本回退、限流退避。
- 选择卡片/按钮回调、状态表情、文件上传。
- 扫码建应用（设备码）、手动凭据、诊断。
- 多账号、账号级模型/工作区/权限/Agent 预设/命令权限/私聊准入/发送方式。
- 审批/提问/流式回复/延迟投递/会话标题/会话映射/工作区挂载。
- `/` 命令、文件/图片输入、会话导出（如果命令保留）。
- 私聊白名单与 pending 批准。

**Client：**

- 设置页“飞书频道”：账号卡片、添加/扫码/手动、接收开关、状态、诊断、账号设置、移除、待批准。
- “飞书频道”页签：飞书会话列表/分组、打开会话、空状态、设置入口。
- 会话行飞书品牌标。
- zh/en 词典。

### 6.2 必须删除

**Host 通道：**

- `channels/dingtalk.ts`、`dingtalk-card.ts`、`dingtalk-token-cache.ts`
- `channels/wecom.ts`、`weixin.ts`、`qq.ts`、`qq-markdown.ts`、`telegram.ts`、`discord.ts`、`slack.ts`、`slack-markdown.ts`
- `channels/qr/dingtalk.ts`、`wecom.ts`、`weixin.ts`、`qq.ts`
- `channels/factory.ts`（改成单飞书工厂）
- `channels/image-host-policy.ts`（仅 QQ/企微/钉钉使用；删除前先完成下面的媒体拆分）
- `channels/channel-image-download.ts` 的其余部分：只把 `fileMedia`、`MAX_CHANNEL_IMAGES` 抽到新的 `channels/media.ts`，远图下载/安全校验逻辑全部删除
- `channels/file-send.ts`：飞书只用到它转出的 `fileOperation`；把 `feishu.ts` 改为直接从 `engine/abort.ts` 导入后删除
- `engine/topic-title.ts`、topic 相关 gateway/commands/config
- `engine/types.ts` 与 gateway 中仅被已删通道使用的可选能力：`beginReply`、`typingIntervalMs`、`sendAction`、`stopAction`、`skipMerge`、`renameTopic`、`setTopicEditHandler`、`loginUrl`（飞书均未实现；删除后减少死代码，不影响飞书）
- `plugin-updater.ts`、`plugin-update-ui.js`
- `manager.ts` 中 proxy / weixin migration / 多通道分支
- `session-id.ts` 中 lark/其他 ChannelId

**Client：**

- 其他 8 个通道的 `BrandMark` 分支、`CHANNEL_GROUP_IDS`、`CHANNEL_META` 展示、`field.*`、`qr.*`、`channel.*`、`status.*`、`diagnostic.*` 非飞书项。
- 代理 UI（`account.proxy*`）。
- 插件自更新 UI（`observePluginUpdate` / `UPDATE_ICONS`）。
- 频道品牌图标 DOM 注入（`channelLogoUrl` / `channelIconCss` / `channelWorkspaceIconCss`）——v1 可选删除，见 §7.2。
- 工作区右键菜单注入（`installChannelGroupMenu`）——v1 可选删除。
- “按频道”分组选项注入（`installChannelGroupOption`）——v1 可选删除。
- 宿主 primitives 依赖（`@deepseek-ai/dsh-client-ui-primitives`）——必须删除，改自绘。
- GitHub/问题反馈链接、更新图标。

**资源/依赖：**

- `assets/screenshots/*` 旧截图、其他品牌 `assets/brands/*`。
- `@tencent-connect/qqbot-connector`、`@wecom/aibot-node-sdk`、`dingtalk-stream`、`undici`。
- `@types/qrcode` 保留（qrcode 仍用）。

### 6.3 必须改写

| 文件 | 改动 |
|---|---|
| `package.json` | 包名/描述/依赖/peer/exports/dsh.client/files/scripts |
| `cordis.patch.yml` | 行 id/包名 |
| `src/index.ts` | 去 updater；Config 去 `topicNaming`；stateDir 改 `dsh-feishu-channels` |
| `src/channels/meta.ts` | 只保留 `feishu`；字段 appId/appSecret |
| `src/channels/feishu.ts` | 去 `lark`/`domain`/`id:'lark'` 分支；固定 `open.feishu.cn`；`fileOperation` 改从 `engine/abort.ts` 导入；`fileMedia`/`MAX_CHANNEL_IMAGES` 改从 `channels/media.ts` 导入 |
| `src/channels/qr/feishu.ts` | 只走 `accounts.feishu.cn`；Lark 租户明确报错 |
| `src/channels/qr/hub.ts` | 只支持 feishu；删其他 begin 分支 |
| `src/engine/session-id.ts` | `ChannelId='feishu'`；`DFC_SESSION_PREFIX='dfc:'`；parser 改名 |
| `src/engine/credentials.ts` | `dfc_` 前缀；校验 |
| `src/manager.ts` | 单通道；删 proxy/weixin/additionalImageHosts；API 前缀/header |
| `src/engine/gateway.ts` | 删 topic 命名/`renameTopic`/`/topic`；其余保留 |
| `src/engine/types.ts` | 删 `renameTopic`/`setTopicEditHandler`/`loginUrl` 等未用能力 |
| `src/engine/router.ts` | 会话前缀/恢复逻辑改名；保留其他 |
| `client.js` | §4.5/§7 的全部 UI 改名与裁剪 |
| `locale/*.json` | meta 标题/描述；词典键 |
| `icon.svg` | 原创图标 |

### 6.4 依赖收敛

**运行时：**

```json
{
  "@larksuiteoapi/node-sdk": "^1.36.0",
  "qrcode": "^1.5.4"
}
```

**peer（与 DSH 0.2.1-rc.2 对齐）：**

```json
{
  "@deepseek-ai/cordis": "^4.0.2",
  "@deepseek-ai/dsh-agent": "0.2.0-rc.1 || 0.2.0-rc.2 || 0.2.1-rc.1 || 0.2.1-rc.2",
  "@deepseek-ai/dsh-client-locale": "...",
  "@deepseek-ai/dsh-client-ui-slots": "...",
  "@deepseek-ai/dsh-host-webserver": "...",
  "@deepseek-ai/schemastery": "^3.18.2"
}
```

**dev：** `typescript@5.9.3`、`@types/node@^22`、`@types/qrcode`。

**删除：** `@deepseek-ai/dsh-client-ui-primitives`、`@deepseek-ai/dsh-client-ui-settings`、`react`/`react-dom` npm 依赖（浏览器端由 ModuleLoader 提供）、`undici`、其他 IM SDK。

### 6.5 代码量预估

| 部分 | 现状 | 目标 |
|---|---:|---:|
| Host TS | 14,715 行（含全部通道） | 约 7,500–8,500 行 |
| Client JS | 3,819 行 | 约 2,300–2,800 行 |
| 测试 | 105 个文件 | 约 45–55 个文件 |
| 依赖 | 6 个运行时 | 2 个运行时 |

---

## 7. 设置页与频道页设计

### 7.1 设置页“飞书频道”

**左栏：** `settings.section`，id `feishu-channel`，order 41，label `飞书频道` / `Feishu Channel`。

**页面结构：**

```text
飞书频道
管理飞书机器人账号。每个账号独立选择工作区、模型和权限，配置仅保存在本机。

[待批准访问请求]
  ou_xxx · 飞书账号 1     [批准] [拒绝]

[飞书]
  2 个账号                              [添加账号]
  ▸ 飞书账号 1   [已连接]  接收消息 [开关]  [设置]
  ▸ 飞书账号 2   [已停止]  接收消息 [开关]  [设置]

账号设置弹窗（720px）：
  名称备注
  工作区
  模型 / 推理等级
  权限
  Agent 预设
  私聊准入
  发送方式
  命令权限
  连接诊断 / 重新连接 / 移除
```

**添加账号弹窗：**

- 快捷绑定（推荐）：生成飞书二维码 → 手机飞书扫码 → 自动创建机器人 → 保存凭据。
- 手动配置：App ID / App Secret。
- 可选默认：工作区、模型、权限、Agent 预设、账号备注。
- 成功提示；失败只显示安全错误文案，详情进本机日志。

**复用 im-connect 的组件，但做以下裁剪：**

- 删除 proxy 字段与 UI。
- 删除其他通道卡片。
- 删除 GitHub/反馈/更新链接。
- 删除宿主 primitives 依赖，改自绘 Button/Modal/Select/Switch/Tag/NoticeBar/Icon。
- 保留二维码本地渲染、倒计时、刷新、取消、扫码后自动保存。

### 7.2 频道页“飞书频道”

**v1 目标（核心 parity）：**

- 页签内显示“飞书频道”标题 + 设置按钮 + 飞书会话树。
- 复用官方 WorkspaceBrowser（`officialTree`）渲染，传入过滤后的 `useSessions` 和 `useWorkspaces`，只保留含飞书会话的工作区/分组。
- 显示飞书会话的标题、时间、运行状态；支持点击打开、重命名、归档、删除（沿用宿主行能力）。
- 空状态：“还没有飞书会话。先在设置 → 飞书频道 里绑定机器人，并给机器人发一条消息。”+“打开设置”。
- 加载/错误状态有明确文案，不白屏。

**v1 明确不做（可选 parity 二期）：**

- 用飞书品牌 SVG 替换官方工作区分组文件夹图标（依赖宿主 DOM 结构 `[data-row-key=...]`，跨版本脆弱）。
- 向官方工作区右键菜单注入“频道设置”。
- 向官方“分组方式”菜单注入“按频道”。
- 自绘频道分组头/多频道彩色标识。

理由：这些是 im-connect 的视觉增强，不是 IM 接入核心功能；它们大量依赖宿主内部 DOM，和“独立、稳定、不冲突”目标相冲突。若用户要求像素级 parity，可作为 Phase 7 单独评估。

**如果二期要做账号分组：** 优先使用官方树 + 合成 workspace（im-connect 的 `syntheticChannelWorkspaceState` 思路），不要写 DOM 注入。

### 7.3 空状态 / 错误 / 降级

- 未配置账号：频道页显示引导；设置页可添加。
- 连接失败：账号卡片显示“连接失败，请查看本机日志”；诊断按钮可用。
- 页签宿主不可用：不显示页签，但设置页与会话仍可用；console 一次性警告。
- 页签渲染异常：ErrorBoundary 回落官方树。
- 扫码过期：显示“二维码已过期”，可重新生成。
- 飞书限流：卡片回退纯文本；仍失败则延迟投递/重试，不影响其他账号。

### 7.4 国际化

- locale 命名空间 `feishu-channel`。
- 词典：`zh`、`en`；键集合必须一致（测试校验）。
- 设置分区 label 用 thunk；页签 label 在 locale 变化时重新 `insert` 同 id 页签（因为 im-connect 的渲染器不接受函数 label）。
- 服务端错误通过 `server.*` 键映射；未知错误显示通用文案。
- 中文名固定“DSH飞书频道”；设置页标题“飞书频道”。

### 7.5 样式与主题

- 所有颜色使用 `--dsw-alias-*` token；飞书 Logo 的品牌色只用于图形。
- 选择器统一 `.dfc-` 前缀；样式元素 id `dsh-feishu-channels-style`。
- 不覆盖宿主全局样式；不写 `body`/`#root` 级规则。
- 弹窗 z-index 与 im-connect 兼容（互不重叠使用）；Escape 只关最上层。
- 亮/暗主题下对比度检查；窄侧栏（`wide === false`）只渲染官方树。

### 7.6 可访问性

- 页签 `role="tablist"` / `role="tab"` / `aria-selected` / `aria-controls`。
- 开关 `role="switch"` + `aria-checked`。
- 弹窗焦点管理、Escape、遮罩点击关闭。
- 图标 `aria-hidden`；按钮有 `aria-label`。
- 二维码有 `alt` 文案。

---

## 8. 实施计划

### Phase 0：技术验证 spike（1 天）

**目的：** 在写完整插件前，验证最危险的“页签共存”假设。

**内容：**

1. 建一个最小包 `@cubeai/dsh-feishu-channels-spike`（或在新包内用 `SPIKE=1` 的最小 client）：
   - Host 空 `apply`。
   - Client 只做：检测 `sidebar.workspaces` → 若有 Registry v1 则 `insert({id:'feishu', order:30, label:'飞书频道', render:()=>'spike'})`；否则包裹官方组件并创建 Registry。
2. 在当前 `web` profile 安装（需用户批准），验证：
   - 只有 im-connect 时，页签变成 `任务 | 频道 | 飞书频道`；
   - 卸载 spike 后恢复 `任务 | 频道`；
   - 页面无 slot crash。
3. 卸载 spike，清理状态。

**通过标准：** 页签出现、顺序正确、卸载恢复、console 无错误。  
**若失败：** 回到方案讨论，可能需要接受“独立侧栏区块”而非共用 tab bar（需求 4 降级）。

> 注：Phase 0 会临时改动当前 profile，必须在执行前获得用户明确同意；也可以复制 profile 到临时 profile 做，但需要另起一个 DSH 实例。

### Phase 1：包骨架与构建（0.5 天）

- `package.json`、`cordis.patch.yml`、`locale`、`icon.svg`、`LICENSE`、`NOTICE`。
- `tsconfig.json`、`scripts/build-client.mjs`、`scripts/check-isolation.mjs`。
- `npm install`、`npm run build`、`node --check lib/client.js`。
- 空的 Host/Client 能安装、能加载、设置页显示“飞书频道”占位。

### Phase 2：Host 飞书化（2 天）

- 复制 engine + feishu + qr + manager。
- 删除其他通道、topic、proxy、updater。
- 改 `ChannelId`、`dfc:`、`dfc_`、API 前缀、stateDir。
- `tsc` 通过；`node --test` 中 Host 相关测试通过。
- 用 mock adapter 跑通“创建会话 → 事件 → 回复”的 Host 测试。

### Phase 3：Host 账号/API/扫码（1.5 天）

- 单通道账号管理、多账号。
- 扫码 hub（只飞书）、手动凭据、诊断、白名单。
- API 路由与认证；`/channels` payload。
- Host 测试：API 认证、413、凭据不泄露、状态隔离。

### Phase 4：Client 设置页（2.5 天）

- 复制并裁剪 SettingsPage/BindModal/AccountInspector。
- 去掉 primitives，改自绘控件/图标。
- 改 API base/header、locale、CSS 前缀。
- 扫码/手动/账号设置/诊断/待批准可用。
- 客户端 harness/词典/静态检查通过。

### Phase 5：Client “飞书频道”页签 + 侧边栏外壳（1.5 天）

- Registry v1 实现。
- 三态 sync：外来宿主 / 自建外壳 / 官方。
- 任务树过滤、页签顺序、空状态、ErrorBoundary。
- 生命周期重试、事件、卸载交接。
- 移植 im-connect 的 sidebar harness，跑两种加载顺序。

### Phase 6：整合测试与共存测试（2.5 天）

- 移植飞书/engine/session/媒体/命令测试。
- 新增：
  - `dfc:` vs `im:` 互不解析；
  - `dfc_` vs `im_connect_` 凭据 ref 不冲突；
  - API 前缀不冲突；
  - 两个 manager 状态目录不互读；
  - 共享 Registry 两种顺序；
  - 卸载/HMR/禁用矩阵；
  - 词典键完整；
  - 禁止字符串扫描（其他通道名、im-connect 运行时标识）。
- 跑 `npm test`。

### Phase 7：安装与真机验收（1 天）

- `plugin_manager install_bundle` 安装新包。
- 检查 `application: applied`、`warnings`。
- `Config.listConfigs` 确认行。
- `Slots.listSubTree` 确认 `settings.section` 有 `feishu-channel`、`sidebar.session.row.leading` 有注册。
- 用户用真实飞书 App 验证扫码/收发/审批/图片/文件/群聊。
- 两个插件同时安装验证侧边栏与设置页。
- 报告视觉验证限制（无浏览器控制时由用户确认）。

### Phase 8：文档与收尾（0.5 天）

- `README.md` / `README.zh-CN.md`。
- `docs/coexistence.md`、`docs/verification.md`。
- `NOTICE` / `LICENSE`。
- 版本 `0.1.0`；记录上游基线 `dsh-im-connect@1.0.12`。

### 工期汇总

| Phase | 内容 | 人天 |
|---|---|---:|
| 0 | spike | 1 |
| 1 | 骨架/构建 | 0.5 |
| 2 | Host 飞书化 | 2 |
| 3 | Host API/账号/扫码 | 1.5 |
| 4 | Client 设置页 | 2.5 |
| 5 | 页签/外壳 | 1.5 |
| 6 | 测试 | 2.5 |
| 7 | 安装/验收 | 1 |
| 8 | 文档 | 0.5 |
| | **合计** | **13 人天** |
| | 加 20% buffer | **约 15–16 人天（2–3 周）** |

clean-room 重写：约 5–7 周。  
若要把 §7.2 的 DOM 级视觉 parity 全部做进去：再加 3–5 天。

---

## 9. 测试与验收

### 9.1 静态检查

- `tsc -p tsconfig.json` 无错误。
- `node --check client.js` / `lib/client.js`。
- `scripts/check-isolation.mjs`：
  - 禁止运行时出现 `@michengai/dsh-im-connect`、`im_connect_`、`/api/dsh-im-connect`、`dsh-im-connect` 状态目录（`NOTICE`/文档除外）。
  - 禁止其他通道名（`telegram|discord|slack|wecom|weixin|dingtalk|qq|lark`），中文品牌名同理。
  - `client.js` 中禁止 `require("@deepseek-ai/")`（`react` 除外）。
  - 断言 CSS 只有 `.dfc-` 前缀，无 `.ima-`。
- `package.json` 校验：exports、files、dsh.bundle、dsh.client。
- `icon.svg` 为有效 SVG、<256 KiB、无外部引用。

### 9.2 Host 单元测试

移植/改造：

- `feishu.test.mjs`：文本/图片/文件/富文本解析、群 @、发送回退、限流。
- `feishu-images` / `feishu-tables` / `feishu-card-fallback`。
- `pairing` / `qr-hub`：只飞书；过期/取消/成功。
- `session-id`：`dfc:` 解析、`im:` 不匹配、task 过滤。
- `credentials-ref`：`dfc_` 合法、`im_connect_` 不出现。
- `router` / `gateway-*` / `deferred-*` / `merge` / `choices` / `approval` / `question`。
- `management-auth`：401/403/415/413。
- `hardening`：secret 不泄露、路径/媒体限制。

### 9.3 Client harness 测试

- `sidebar-harness`：
  - 独装：包裹官方组件，`任务 | 飞书频道`。
  - 外来 Registry：只 insert，不包裹，`任务 | 频道 | 飞书频道`。
  - 外来 wrapper 无 Registry：不包裹，降级。
  - 卸载：恢复官方/移除自己的页签。
  - 重复通知：不重复包裹。
  - 计时器停止。
  - 两个顺序的 fake im-connect 共存。
- `settings-navigation`：按“飞书频道”定位设置分区；找不到时不抛错。
- `client-i18n`：zh/en 键一致；label 更新。
- `client-loader`：模块 id/导出正确；无 primitives 依赖。

### 9.4 共存矩阵（必须全绿）

| 场景 | 侧栏 | 设置左栏 | 运行 |
|---|---|---|---|
| 只新 | 任务 \| 飞书频道 | 飞书频道 | 新插件 |
| 只旧 | 任务 \| 频道 | IM助理 | 旧插件 |
| 旧先 + 新后 | 任务 \| 频道 \| 飞书频道 | 两者 | 两者 |
| 新先 + 旧后 | 任务 \| 频道 \| 飞书频道 | 两者 | 两者 |
| 新禁用 | 任务 \| 频道 | IM助理 | 旧 |
| 旧禁用 | 任务 \| 飞书频道 | 飞书频道 | 新 |
| 两者都禁用 | 官方 | 无外部项 | 无 |
| 新卸载 | 任务 \| 频道 | IM助理 | 旧 |
| 旧卸载 | 任务 \| 飞书频道 | 飞书频道 | 新 |
| 页面刷新 | 与刷新前一致 | 与刷新前一致 | 两者 |
| 客户端重载（HMR 或刷新） | 不重复页签 | 不重复 | 两者 |

### 9.5 真机飞书验收

需要真实飞书账号（建议测试企业/个人空间）：

1. 扫码创建一个测试应用 → 绑定成功。
2. 私聊机器人“你好” → 流式/最终回复。
3. 群聊 @机器人 → 回复；不 @ 不回复。
4. 发送图片 → 识别/回复；发送文件 → 保存/处理。
5. 触发一次工具审批 → 飞书卡片按钮批准/拒绝。
6. 触发一次 ask_user_question → 飞书按钮回答。
7. 发送 `/` 命令 → 命令列表/执行。
8. 多账号：两个应用，各自会话不串。
9. 关闭接收 → 不响应；重连 → 恢复。
10. 诊断 → 凭据/机器人检查通过。
11. 移除账号 → 凭据删除；旧会话保留。

### 9.6 安装验证

- `plugin_manager install_bundle` 返回 `application: applied`。
- `Config.listConfigs(name: "@cubeai/dsh-feishu-channels")` 有行。
- `Slots.listSubTree("settings.section")` 出现 `feishu-channel`。
- `Slots.listSubTree("sidebar.session.row.leading")` 出现 `feishu-channel-session`。
- 页面刷新后无 slot crash；console 无 `slot entry crashed`。
- 亮/暗主题检查（用户视觉确认）。
- 两个插件同时安装后的侧边栏（用户视觉确认）。

### 9.7 验证局限

当前环境没有浏览器控制能力；客户端 HMR 只有在同一 checkout 运行 `pnpm run dev:web` 时才自动生效，否则以页面刷新/DSH 重启为准。实施时：

- 能用 `cordis_inspect_query` 验证 slot 注册/配置/服务；
- 能用 Node harness 验证页签生命周期；
- **无法自动截图或逐像素验证**最终 UI；
- 真机飞书与最终视觉由用户确认；
- 报告中必须区分“已自动验证”与“待人工确认”。

---

## 10. 风险与缓解

| # | 风险 | 可能性 | 影响 | 缓解 |
|---|---|---|---|---|
| 1 | im-connect 升级改变 Registry v1 | 中 | 高（页签共存失效） | 契约探测 + 版本检查 + 契约测试；失败降级；锁定测试基线 1.0.12 |
| 2 | 双插件同时包裹侧边栏 | 低 | 高（页签重复/白屏） | 同步 sync、标记位、外来宿主识别、harness 两顺序测试 |
| 3 | 宿主 DSH 升级改变 `sidebar.workspaces` 结构 | 中 | 高（外壳失效） | ErrorBoundary 回落官方树；包裹失败不破坏宿主；版本兼容测试 |
| 4 | 两个插件同 App ID | 中 | 中（事件被抢） | 文档强警告；推荐不同应用；不自动导入旧凭据 |
| 5 | 设置页 DOM 定位失效 | 中 | 低（按钮无效） | 找不到时静默/控制台警告；用户仍可从侧栏设置进入 |
| 6 | 删除其他通道时漏删 UI/代码 | 中 | 中（验收失败） | `check-isolation` 字符串扫描 + 人工 review |
| 7 | 飞书扫码注册接口变化 | 中 | 中 | 保留手动 App ID/Secret 作为 fallback；错误文案清晰 |
| 8 | Apache-2.0 合规 | 低 | 高（法律） | 保留 LICENSE、新增 NOTICE、标注修改；不删除版权声明 |
| 9 | 上游代码维护负担 | 高 | 中 | 记录基线版本；只 cherry-pick 飞书相关修复；不盲目合并 |
| 10 | 会话前缀/凭据 ref 冲突 | 低 | 高 | `dfc:`/`dfc_` 保留前缀；测试断言 |
| 11 | 页签 label 本地化不更新 | 低 | 低 | locale 变化时重插同 id；测试 |
| 12 | 侧边栏折叠时页签溢出 | 低 | 低 | `wide === false` 只渲染官方树 |
| 13 | Codex UI 宿主不兼容 | 低 | 中 | 检测后不包裹；文档标注 v1 不支持 |
| 14 | 其他插件读 `isTaskSession` 不认 `dfc:` | 低 | 低 | 文档；自身页签过滤；不依赖第三方 |

---

## 11. 维护与升级策略

- **基线记录：** `UPSTREAM.md` 记录 `@michengai/dsh-im-connect@1.0.12` 的源码 commit/包版本、复制日期、删除清单。
- **上游同步：** 只关注 `src/channels/feishu.ts`、`src/engine/*`、飞书 QR、相关测试；不要整包 merge。
- **契约测试：** 把 §9.4 矩阵作为 release gate；每次 DSH 或 im-connect 升级都跑。
- **DSH 兼容：** `peerDependencies` 明确版本范围；`cordis.patch.yml` 不写死宿主配置。
- **插件版本：** 从 `0.1.0` 开始；破坏性变更升 minor。
- **数据兼容：** `channels.json` 带 `version: 2`；读取时容错并备份损坏文件。
- **安全：** Secret 只进 credentials；API 不返回；日志脱敏；文件大小/类型限制。
- **发布：** 先本地目录安装验证；后续如需发布 npm，补 `publishConfig`/仓库地址/CHANGELOG。

---

## 12. 需要拍板的决策

### D1. 实现路线（推荐 A）

- **A. fork-and-trim（推荐）**：基于 Apache-2.0 裁剪，2–3 周，保留 NOTICE。
- **B. clean-room 重写**：5–7 周，代码更“干净”，但飞书边界风险高。

### D2. Lark 范围（推荐 A）

- **A. 只做飞书（推荐）**：删除 `lark` 通道；扫码检测到 Lark 租户时提示“请使用飞书账号”。
- **B. 飞书 + Lark 双品牌**：复用同一 adapter，增加域名/品牌 UI；与“只保留飞书”表述有偏差。

### D3. UI parity 深度（推荐 A）

- **A. 核心 parity（推荐）**：设置页/账号管理/频道页/会话/审批/媒体/命令全部复制；不做 DOM 级品牌图标/右键菜单注入。
- **B. 像素级 parity**：额外复制频道品牌图标替换、工作区右键菜单、分组选项；增加 3–5 天，且更易受宿主 DOM 变化影响。

### D4. 旧数据迁移（推荐 A）

- **A. 不自动迁移（推荐）**：新插件从空状态开始；旧飞书账号/会话留在 im-connect。
- **B. 导入旧飞书账号**：复制 im-connect 的 `channels.json`/凭据；会带来同 App 双连接风险，不建议。

### D5. 安装目标（推荐 A）

- **A. 构建完成后安装到当前 `web` profile（推荐）**：能立即验证共存；需要 `plugin_manager` 审批。
- **B. 只交付本地包**：用户自行安装；无法完成端到端验证。

### D6. 插件自更新（推荐 A）

- **A. v1 不做（推荐）**：im-connect 的更新 UI/端点与其 GitHub 仓库绑定；新插件没有发布源。IM 接入功能不受影响。
- **B. 实现自己的更新端点**：需要先确定新插件的 npm 包/仓库地址；增加约 1 天。

> 如果按推荐组合（A/A/A/A/A/A）执行，本方案即可进入 Phase 0。

---

## 附录 A：关键代码位置

**现有实现（只读参考）：**

- 已安装包：`/home/hls/.dsh/profiles/web/node_modules/@michengai/dsh-im-connect/`
- 源码：`/home/hls/dev/dsh-remote-feishu/dsh-im-connect-1.0.12/`
- 飞书 adapter：`src/channels/feishu.ts`
- 扫码：`src/channels/qr/feishu.ts`、`qr/hub.ts`
- 会话 ID：`src/engine/session-id.ts`
- 凭据：`src/engine/credentials.ts`
- 路由：`src/engine/router.ts`
- 网关：`src/engine/gateway.ts`
- 管理/API：`src/manager.ts`
- 客户端：`client.js`
- 侧边栏测试：`tests/sidebar-lifecycle-harness.mjs`、`tests/sidebar-shell-harness.mjs`
- 设置导航测试：`tests/settings-navigation.test.mjs`

**DSH 侧：**

- Slot 目录：`cordis_inspect_query` → Client `Slots.listSubTree`
- 设置槽位：`settings.section`（list）
- 侧边栏槽位：`sidebar.workspaces`（single，官方 WorkspaceBrowser）
- `sidebar.channels`：当前宿主未声明（Codex UI 插件才会声明）
- 官方侧边栏包：`@deepseek-ai/dsh-client-ui-workspace`
- 主题 token：`cordis_inspect_query` → Client `Theme.listTokens`

**本方案文档：** `docs/dsh-feishu-channels-plan.md`

---

## 附录 B：术语

| 术语 | 含义 |
|---|---|
| Registry v1 | im-connect 在客户端定义的侧边栏页签注册表（`__dshNativeTabs`），非 DSH 公共 API |
| 宿主 / host | 当前负责包裹 `sidebar.workspaces`、渲染 tab bar 的插件 |
| 外来宿主 | 不是自己创建、但带合法 Registry 的 wrapper（对 im-connect 而言，新插件就是外来宿主） |
| 页签 / tab | tab bar 里的一项，如“任务”“频道”“飞书频道” |
| `dfc:` | 新插件会话 ID 前缀（DSH Feishu Channel） |
| `dfc_` | 新插件凭据 ref 前缀 |
| fork-and-trim | 复制上游源码后裁剪/改名的实现路线 |
| spike | 用最小实现验证高风险假设的短期技术试验 |

---

**实施状态：已按推荐决策安装到当前 web profile；`dsh-im-connect` 未被修改。**  
下一步：刷新页面并完成 `docs/verification.md` 中的目视与真机验收。
