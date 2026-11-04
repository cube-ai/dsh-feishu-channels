# 飞书频道 UI / 应用配置改造 — 可行性分析

> 日期：2026-11-04  
> 范围：在现有 `@cubeai/dsh-feishu-channels` 上调整设置入口、频道页、添加账号流程、扫码建应用后的配置、账号展示与账号设置。

## 实施状态（2026-11-04）

- 1–4、6 已实现；`pnpm test` 93 项通过，`pnpm run check` 通过。
- `settings.section` 已无 `feishu-channel`；侧边栏仍保留 `任务 | 频道 | 飞书频道`。
- 扫码 begin 已用真实飞书接口验证，QR URL 包含 `name`、`createOnly=true`、`addons`。
- 应用配置 provisioning（名称/权限/重定向 URL）已实现；真实写入结果需要用户扫码创建测试账号后读取 `config.provisioning`。
- 真实测试确认：缺少 `application:application:patch` 时写入失败；补上该权限后 v7 返回 success，5 个重定向 URL 全部写入，保留该操作。

## 1. 总结论

| # | 需求 | 可行性 | 关键说明 |
|---|---|---|---|
| 1 | 去掉 DSH 设置里的“飞书频道”，全部移到频道页 | **可** | 删除 `settings.section` 注册；频道页承载账号/设置/待批准 |
| 2 | 频道页标题换成“添加飞书账号”按钮；右侧图标按钮去掉 | **可** | 用自绘账号页替换官方任务树头部，最直接 |
| 3 | 点击按钮直接弹“配置飞书”对话框 | **可** | 频道页持有 `BindModal` 状态，不经过设置页 |
| 4 | 对话框改名、只留快捷绑定、加“频道名称” | **可** | 隐藏手动页签/表单；`settings.name` 贯穿 QR 和账号保存 |
| 5 | 新建 App 用输入名称、加两个权限、加 5 个重定向 URL | **部分可** | 名称/权限可在扫码确认页预填；重定向 URL 只能走应用管理 OpenAPI，存在平台限制，需真机验证 |
| 6 | 添加后立即显示账号名；加“设置”按钮；显示 App ID/Secret | **可** | 账号来自 `/channels` 的 `accounts`，不依赖首条消息；Secret 只做掩码展示 |

**结论：可以按这个方向改。** 1–4、6 是纯插件内改造；5 的“名称/权限”可以做预填，5 的“重定向 URL”要接受平台可能拒绝的事实，并准备降级提示。

---

## 2. 第 5 项：飞书平台能力核查

### 2.1 名称：可以预填，不能保证锁定

飞书 SDK 的 `registerApp` 支持 `appPreset.name`，它会被编码成二维码 URL 的 `name` 参数：

```text
verification_uri_complete?name=<输入的名称>
```

SDK 文档明确说明：这是**预填**，用户扫码后仍可在飞书确认页修改；最终名称以用户提交的为准。

因此：

- 我们在二维码 URL 里带上用户输入的“频道名称”，飞书建应用页会默认填好。
- 创建成功后可以**尝试**调用 `application/v7/applicationBase.patch` 改名（`i18ns[].name`），但该接口文档注明“仅支持开发者后台创建的自建应用，不包含通过机器人助手等其他渠道创建的自建应用”，对扫码创建的 PersonalAgent **可能被拒绝**。
- 不能承诺“用户在确认页无法改”。如果必须 100% 锁定，平台没有提供这个能力。

### 2.2 权限：可在扫码确认页预填（addons）

SDK 的 `registerApp` 支持 `addons.scopes`：

```js
addons: {
  scopes: {
    tenant: ['im:message'],
    user: ['im:message.send_as_user'],
  },
}
```

SDK 会把 `addons` 做 `JSON → gzip → base64url`，放到二维码 URL 的 `addons` 参数。飞书确认页会把这些权限作为**增量**预填，用户确认后生效。

注意：

- SDK 注明：`addons` 需要平台灰度开启；未开启时整个参数会被忽略，走默认模板。
- 平台目录里不存在的权限名会被静默丢弃；SDK 不校验名称。
- 创建后可以再**尝试** `application/v7/applicationConfig.patch` 的 `scope.add_scopes`（`tenant` / `user`）作为兜底；该接口同样有“仅开发者后台应用”的限制，可能失败。
- 建议绑定完成后调用 `application/v6/application.get` 校验实际 scopes；缺失时在账号设置里显示警告，不阻断绑定。

### 2.3 重定向 URL：只能走应用管理 OpenAPI，且有限制

`addons` **不支持** `security.*`（SDK 明确说敏感配置被拒绝）。重定向 URL 只能通过应用管理 API 写入：

- 首选：`application/v7/applicationConfig.patch`
  - `security.add.redirect_urls: string[]`
  - 文档：修改重定向 URL 后立即生效。
- 兜底：`application/v6/application.patch`
  - `security.redirect_urls: string[]`（全量覆盖，需要先读现有列表并做并集）。
- 名称兜底：`application/v7/applicationBase.patch`（`i18ns[].name`）。

**关键风险：**

- v7 文档注明：**仅支持开发者后台创建的自建应用，不包含通过机器人助手等其他渠道创建的自建应用**。扫码创建的 PersonalAgent 是否被归入“其他渠道”，需要真实应用验证。
- 如果 v6/v7 都拒绝，插件没有合规的公开 API 可以替用户写入重定向 URL。
- 降级方案（推荐）：
  - 保存“待写入”的 5 个 URL；
  - 在账号设置里显示“平台未允许自动写入”的提示和“复制全部 URL”按钮；
  - 用户可在飞书开发者后台手动粘贴。
- 不建议用用户浏览器 Cookie 去调开发者后台私有接口；不稳定且有安全风险。

### 2.4 要写入的常量

```js
const FEISHU_REDIRECT_URLS = [
  'http://127.0.0.1:3080/api/dsh-remote-feishu/oauth/callback',
  'http://localhost:3080/api/dsh-remote-feishu/oauth/callback',
  'http://127.0.0.1:32123/api/dsh-remote-feishu/oauth/callback',
  'http://127.0.0.1:8731/api/oauth/callback',
  'https://www.cubeai.com:6443/cubeaispace-dsh1-1234567890-dsh/api/dsh-remote-feishu/oauth/callback',
]
```

按用户要求只添加，不校验这些地址是否可访问。

### 2.5 建议的扫码 URL 参数

```text
name=<频道名称>
createOnly=true
source=dsh-feishu-channels
addons=<gzip+base64url({ scopes: { tenant:['im:message'], user:['im:message.send_as_user'] } })>
```

保留当前 `begin` / `poll` 流程；域名仍固定 `accounts.feishu.cn`，Lark 租户继续拒绝。

---

## 3. 1–4、6 的界面与数据方案

### 3.1 去掉设置页

- 删除 `ctx.slots.inject('settings.section', ...)` 注册。
- DSH 设置左侧不再出现“飞书频道”。
- 频道页承载：
  - 添加账号（BindModal）
  - 账号列表/状态/接收开关
  - 账号设置（AccountInspector）
  - 待批准访问请求
  - 诊断/重连/移除
- `SettingsPage` 的账号/待批准/设置逻辑拆到频道页；`BindModal`、`AccountInspector` 保留复用。

### 3.2 频道页布局

```text
[ 添加飞书账号 ]                    ← 左侧显式按钮；无“飞书频道”标题
[待批准访问请求 ...]                ← 有则显示

[飞书 logo] 飞书账号1   [已连接] [接收开关] [设置]
  ├─ 会话标题 A                      10:32
  ├─ 会话标题 B                      10:28
  └─ 还没有会话，给机器人发一条消息

[飞书 logo] 飞书账号2   [已停止] [接收开关] [设置]
  └─ ...
```

- 页签本身的标签仍叫“飞书频道”（侧边栏 tab），去掉的是**页签内容里的标题行**。
- 右侧官方树自带的 icon 添加按钮不再出现，因为不再渲染官方树头部。
- 账号行名称来自 `account.name`（用户输入），不依赖首条消息或 LLM 标题。
- 每个账号行有“设置”按钮，直接打开 `AccountInspector` 弹窗。

### 3.3 数据来源

- `/channels` 返回的 `channels[0].accounts`：账号列表，包含名称/状态/是否接收。
- `/channels` 返回的 `groups[0].sessions`：会话列表；按 `session.channel === account.id` 归到账号下。
- 新账号即使没有会话，也从 `accounts` 立即渲染，无需等消息。
- `channelRefresh` 继续作为账号/会话的刷新 store；`onConnected` 后调用 `invalidate()`。

### 3.4 BindModal 调整

- 标题：`添加飞书账号`（不再拼“配置 飞书”）。
- 删除页签栏与手动配置表单；`tab` 固定为 `qr`。
- 顶部新增“频道名称”输入：
  - 默认 `飞书账号${现有账号数 + 1}`；
  - 写入 `settings.name`；
  - QR `start` 请求带上该名称；
  - 账号保存后名称即账号/频道名称。
- 保留现有的工作区/模型/权限/预设/命令权限/扫码/刷新/取消逻辑。
- 扫码开始前仍要求 workspace/model/permission 有效（与当前一致）。

### 3.5 AccountInspector 增加 App ID / App Secret

在现有字段顶部增加只读区：

```text
应用信息
  App ID:     cli_xxx
  App Secret: ••••••••   [已保存]
```

- 服务端 `accountView` 增加：
  - `appId: config.appId`
  - `hasAppSecret: Boolean(config.appSecretRef || config.appSecret)`
  - `provisioning?: { checkedAt, nameOk, scopesMissing, redirectMissing }`
- **不返回真实 Secret**；界面只显示掩码和“已保存”。
- 如果用户需要“显示/复制 Secret”，需要另开一个受宿主认证保护的高敏接口；不建议默认开放。

### 3.6 名称与账号保存

- `settings.name` 由 BindModal 输入，QR `start` 传给 `PairingHub`。
- `PairingHub` 的 `extra` 保存 settings；成功后 manager `connect` 的 `normalizeAccountSettings` 会持久化 `name`。
- 账号 `account.name` 直接用于频道行名称；LLM 会话标题仍只影响会话行标题。
- 如果名称为空，服务端回退到 `飞书账号 N`。

---

## 4. 需要改动的文件/接口

### Host

| 文件 | 改动 |
|---|---|
| `src/channels/qr/feishu.js` | `beginFeishuQr` 接收 `{name, addons}`；装饰 QR URL（`name`/`addons`/`createOnly`/`source`） |
| `src/channels/qr/hub.js` | 把 `session.extra` 传给 `begin`；保持现有 poll/refresh/cancel |
| `src/channels/feishu-provision.js`（新） | 应用管理：v7 config patch（scopes + redirect URLs）、v6 patch 兜底、v7 base 改名兜底、v6 get 校验 |
| `src/manager.js` | `connectNow` 在保存凭据后调用 provisioning；`accountView` 返回 appId/hasAppSecret/provisioning；错误只记安全码 |
| `src/channels/meta.js` | 若需要，增加应用配置相关字段（一般不用） |

### Client

| 文件/组件 | 改动 |
|---|---|
| `client.js` `apply` | 删除 `settings.section` 注册；保留 `sidebar.workspaces`/`sidebar.session.row.leading` |
| 新 `FeishuChannelPage` | 账号页：添加按钮、账号行、会话、待批准、设置弹窗 |
| `BindModal` | 标题/单页签/频道名称/旧逻辑保留 |
| `AccountInspector` | 增加 App ID / App Secret 掩码 / provisioning 警告 |
| `ChannelOfficialView` | 不再作为主视图；其会话/官方树逻辑可移除或保留为内部组件 |
| locale | 新增/调整 `bind.title`、`account.name`、`app.id`、`app.secret`、`provisioning.*` 等 |

### 不建议

- 不建议修改 `dsh-im-connect`。
- 不建议用 DOM 注入去改官方开发者后台页面。
- 不建议把真实 App Secret 返回浏览器。

---

## 5. 实施阶段与工期

| 阶段 | 内容 | 预估 |
|---|---|---|
| A | 数据/API：accountView appId/secret 掩码/provisioning；QR 参数 | 1.5 天 |
| B | 应用配置 provisioning（v7/v6、校验、降级提示） | 2–3 天 |
| C | 频道页重构：去设置页、账号行、会话、待批准、弹窗 | 3–4 天 |
| D | BindModal 单页签/名称字段 | 1 天 |
| E | AccountInspector App 信息 | 0.5 天 |
| F | 测试（Host/Client）+ 真实飞书扫码验证 | 2–3 天 |
| | **合计** | **10–13 人天** |

第 5 项的真实应用验证是关键路径；如果 v7/v6 都拒绝 redirect URL，需要走降级提示。

---

## 6. 需要你确认的点

1. **App 名称**：接受“扫码确认页预填 + 创建后尝试改名，但用户仍可在飞书确认页修改”吗？平台没有强制锁定能力。
2. **重定向 URL**：若飞书拒绝自动写入（很可能只对开发者后台应用开放），接受“账号设置里显示未写入 + 复制全部 URL”作为降级吗？还是要强制要求开发者后台创建的应用？
3. **App Secret**：只做掩码展示（推荐），还是需要“显示/复制真实 Secret”？后者要新增高敏接口。
4. **频道页形态**：改为自绘账号/会话列表，替代官方任务树头部，因此会失去官方树的“分组方式/按工作区”等富交互；会保留搜索、打开会话、重命名、归档、删除等核心操作。可以接受吗？

确认后我按 A→F 实施，先做 1–4、6，再做第 5 项的 provisioning 和真机验证。

---

## 参考

- 本地 SDK 注册能力：`node_modules/@larksuiteoapi/node-sdk/README.zh.md`（`registerApp`、`appPreset`、`addons`）
- 本地 SDK 类型：`node_modules/@larksuiteoapi/node-sdk/types/index.d.ts`
  - `applicationConfig.patch`（v7，`scope.add_scopes`、`security.add.redirect_urls`）
  - `applicationBase.patch`（v7，`i18ns[].name`）
  - `application.patch`（v6，`security.redirect_urls`）
- 飞书 v7 配置文档：<https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/application-v7/application-v7/application-config/patch>
- 扫码注册流程与 `name` 预填：<https://github.com/multica-ai/multica/blob/f41fae6b08fb734afcbd13205c0b3203dd0bc9c6/server/internal/integrations/lark/registration.go>
- 飞书 CLI 一键建机器人逆向调研：<https://github.com/op7418/codepilot/blob/1ae6d76de6993377dab961eacf04927babd99eb1/docs/research/feishu-cli-one-click-bot.md>
