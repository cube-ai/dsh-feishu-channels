# DSH飞书频道技术实现说明

> 本文面向需要了解插件内部机制、排障或二次开发的读者。安装、添加频道等日常操作请见 [README.md](../README.md)。

## 1. 定位与边界

「DSH飞书频道」用于把飞书机器人应用接入本机 DeepSeek Harness。插件只支持飞书，不包含其他 IM 通道，也不依赖云端中转：飞书消息由本机 Host 通过飞书长连接接收，再交给 DSH 的 Agent 处理。

一个**频道**对应：

- 一个飞书自建机器人应用（App ID / App Secret）；
- 一条飞书长连接；
- 一组本地配置：模型、工作区、权限、Agent 预设、私聊准入、发送方式和命令权限。

添加频道不会创建新的飞书用户账号，而是在当前飞书账号/租户下创建或绑定一个机器人应用。插件内部的 `account` / `accountId` 是沿用下来的数据模型名称，对应界面上的“频道”。

## 2. 包结构与加载

| 部分 | 文件 | 作用 |
|---|---|---|
| Cordis bundle patch | `cordis.patch.yml` | 向 profile 插入 Host 插件行 `feishu-channel` |
| Host 入口 | `src/index.js` | 注册 Config、初始化状态目录和日志、创建 `ChannelManager` |
| Host 核心 | `src/manager.js` | 频道生命周期、状态、凭据、HTTP API、扫码/连接/诊断 |
| 消息引擎 | `src/engine/*` | 会话路由、消息合并、Agent 调用、审批/提问、命令、投递 |
| 飞书通道 | `src/channels/*` | 飞书长连接、事件解析、媒体、扫码建应用、应用配置 |
| Client 入口 | `client.js` | 注册页签、频道页、会话行图标和 composer |
| 本地化 | `locale/*.json` | 中文/英文插件元数据 |

`package.json` 中：

- `dsh.bundle.patch` 指向 `cordis.patch.yml`；
- `dsh.client.platform` 为 `web`；
- `dsh.client.inject` 注入 locale、slots 和 UI primitives。

Host Config：

| 配置 | 默认值 | 作用 |
|---|---|---|
| `stateDir` | 空（使用 `$DSH_HOME/dsh-feishu-channels`） | 状态目录和日志目录 |
| `cwd` | `process.cwd()` | 默认工作区 |
| `provider` | 空 | 新频道的默认模型提供商 |
| `model` | 空 | 新频道的默认模型 |
| `agentPreset` | `standard` | 默认 Agent 预设 |
| `mergeTimeoutSecs` | `5` | 连续消息合并等待时间 |

Host 启动顺序大致为：

```text
apply()
  → 解析 Config（stateDir/cwd/provider/model/agentPreset/mergeTimeoutSecs）
  → 创建状态目录和 gateway.log
  → new ChannelManager(...)
  → manager.registerApi(ctx)
  → manager.initEnabled()          # 启动已启用的频道
  → manager.attachMappedSessions() # 恢复已有 dfc: 会话
```

`src/index.js` 的 `ctx.effect` 在卸载时调用 `disposeApi()`，停止 API、扫码、频道连接和消息引擎。

## 3. Host 架构

```text
src/index.js
  └─ ChannelManager
       ├─ channels.json / allowlist / pending
       ├─ CredentialVault（ctx.credentials 或 secrets.json 回退）
       ├─ PairingHub（飞书扫码）
       ├─ FeishuChannelAdapter（飞书 WebSocket）
       └─ ImEngine
            ├─ SessionRouter（dfc: 会话）
            ├─ SessionMerger / ReplyStreamHub
            ├─ ApprovalBroker / QuestionBroker
            ├─ ChatCommands / CommandPermissions
            ├─ DeferredDelivery
            └─ FileDelivery / ImageInput
```

### 3.1 ChannelManager

负责：

- 加载、迁移和原子写入 `channels.json`；
- 维护频道启用状态、接收状态和运行中的 adapter；
- 保存/解析凭据引用，不把 Secret 写进普通状态文件；
- 扫码配对、连接、重连、诊断、移除；
- 提供管理 API；
- 将飞书消息交给 `ImEngine`，把 Agent 回复送回飞书；
- 维护 `dfc:` 会话映射，并挂载到对应工作区。

### 3.2 PairingHub

扫码绑定的入口。当前 UI 只暴露扫码流程：

- 生成飞书应用创建二维码；
- 二维码带频道名称和应用所需 scope 的预填参数；
- 轮询扫码状态；
- 保存 App ID/Secret；
- 扫码成功后创建频道并启动连接。

### 3.3 FeishuChannelAdapter

基于 `@larksuiteoapi/node-sdk` 的飞书长连接适配器：

- 用 App ID/App Secret 建立 WebSocket 长连接；
- 接收私聊、群聊 @、图片、文件、富文本等事件；
- 将飞书消息规范化为引擎事件；
- 把文本、卡片、图片、文件回复发送到飞书；
- 暴露连接状态和诊断信息。

### 3.4 ImEngine

与具体 IM 平台解耦的消息/会话层，负责：

- 将飞书聊天映射为 DSH 会话；
- 消息去重、合并、分流；
- 调用 DSH Agent；
- 审批、提问、选择按钮和命令处理；
- 流式回复、分片、失败重试和延迟投递；
- 私聊准入和群聊 @ 规则；
- 文件和图片输入输出；
- 会话标题、历史恢复和工作区挂载。

Host 通过 `ctx` 使用这些宿主服务：

```text
webServer, credentials, agents, agentPresets,
agentDefaultModel, llm, permissionPresets
```

`connection`、`sessionPersistence`、`workspaceRegistry`、`userQuestions` 等通过 `ctx.get(...)` 按需读取；宿主缺少对应服务时会降级，而不是让插件启动失败。

## 4. 状态、凭据与会话

### 4.1 状态目录

默认：

```text
$DSH_HOME/dsh-feishu-channels
```

未设置 `DSH_HOME` 时通常是 `~/.dsh/dsh-feishu-channels`。可通过 Host Config 的 `stateDir` 覆盖。

| 文件 | 内容 |
|---|---|
| `channels.json` | 频道配置、允许列表、待批准请求、默认设置 |
| `sessions.json` | `dfc:` 会话映射 |
| `seen.json` | 消息去重记录 |
| `deferred-delivery.json` | 发送失败后的延迟投递状态 |
| `gateway.log` | 插件运行日志（滚动文件） |
| `secrets.json` | 仅当 Host 没有 credentials 服务时的本地凭据回退文件 |

### 4.2 channels.json

当前结构版本为 2，核心字段如下：

```jsonc
{
  "version": 2,
  "channels": {
    "feishu_ab12cd34ef56": {
      "id": "feishu_ab12cd34ef56",
      "platform": "feishu",
      "name": "飞书频道 1",
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
      "commandPermissions": {},
      "privateAccess": "approved",
      "sendMode": "queue",
      "lastCheckedAt": "2026-11-04T..."
    }
  },
  "allowlist": { "feishu_ab12cd34ef56": ["ou_xxx"] },
  "pending": { "feishu_ab12cd34ef56": [] },
  "assistant": {},
  "cwd": "/path/to/workspace",
  "permission": "workspace-write"
}
```

说明：

- `accountId` 由 `platform + "\0" + App ID` 的 SHA-256 前 12 位生成，格式为 `feishu_<hash>`；
- 若状态文件残留 `config.provisioning` 快照，加载时会自动删除并 flush；当前实现不写入该字段；
- `lastCheckedAt` 只记录最近一次连接诊断时间，不保存诊断明细；
- `secrets.json` 只在没有宿主 credentials 服务时使用，文件权限为 0600。

### 4.3 凭据

优先使用 DSH credentials 服务：

```text
dfc_<channelId>_<field>
```

例如：

```text
dfc_feishu_ab12cd34ef56_appSecret
```

`channels.json` 只保存 `appSecretRef` 和 `hasAppSecret` 一类信息，不保存明文 Secret。普通 `/channels` 响应不会返回 Secret；只有用户明确请求 `/accounts/:id/secret` 时才会解析并返回。

### 4.4 会话 ID 与映射

飞书会话 ID 格式：

```text
dfc:<channelId>:<dm|group>:<13位以上时间戳>:<chatId>
```

例如：

```text
dfc:feishu_ab12cd34ef56:dm:1793773379160:oc_xxx
```

- `dfc:` 与 im-connect 的 `im:` 会话完全分开；
- `sessions.json` 的 key 是 `channelId:dm|group:chatId`；
- `SessionRouter` 只恢复 `dfc:` 前缀的会话；
- 共享侧栏的 session filter 会把 `dfc:` 会话从“任务”页签中排除；
- 没有时间戳的 `dfc:` ID 也可被 parser 兼容。

## 5. 管理 API

基础路径：

```text
/api/dsh-feishu-channels
```

请求约束：

- 入口调用宿主 `connection.requestRejection(req)` 做登录/来源校验；宿主认证服务不可用时返回 503；
- 变更请求必须带：

```text
x-dsh-feishu-channels-client: 1
content-type: application/json
```

- 请求体上限 1 MB；超限返回 413；
- GET 不做变更标记校验；
- 响应格式统一为 `{ ok, ... }`，错误只返回安全文案，不返回凭据。

主要路由：

| 方法 | 路径 | 作用 |
|---|---|---|
| GET | `/channels` | 频道、会话分组、待批准请求和默认设置 |
| GET | `/assistant` | 默认模型/权限/预设/工作区和模型目录 |
| POST | `/assistant` | 保存默认设置 |
| POST | `/sessions/rename` | 重命名飞书会话 |
| POST | `/sessions/remove` | 删除飞书会话 |
| POST | `/sessions/cleanup-missing` | 清理已不存在的会话 |
| POST | `/sessions/ensure` | 确保会话已挂载 |
| GET | `/channels/feishu/qr/status` | 查询扫码状态 |
| POST | `/channels/feishu/qr/start` | 开始扫码 |
| POST | `/channels/feishu/qr/refresh` | 刷新二维码 |
| POST | `/channels/feishu/qr/cancel` | 取消扫码 |
| POST | `/channels/feishu/connect` | 使用 App ID/Secret 建立频道 |
| POST | `/channels/feishu/receive` | 设置接收开关 |
| POST | `/channels/feishu/disconnect` | 断开连接 |
| POST | `/channels/feishu/remove` | 移除频道 |
| POST | `/channels/feishu/approve` | 批准私聊用户 |
| POST | `/channels/feishu/deny` | 拒绝私聊用户 |
| POST | `/accounts/:id/settings` | 保存频道级设置 |
| POST | `/accounts/:id/secret` | 显式读取 App Secret |
| POST | `/accounts/:id/provision` | 一次性检查/应用飞书应用配置 |
| POST | `/accounts/:id/receive` | 设置频道接收开关 |
| POST | `/accounts/:id/reconnect` | 重连频道 |
| POST | `/accounts/:id/check` | 运行连接诊断 |
| POST | `/accounts/:id/remove` | 移除频道 |
| POST | `/accounts/:id/approve` | 批准频道用户 |
| POST | `/accounts/:id/deny` | 拒绝频道用户 |

当前 Client 页面主要使用 `/channels`、`/assistant`、二维码、`/accounts/:id/*` 和会话操作；`/channels/feishu/connect` 保留在 Host 侧，但当前界面不提供手动 App ID/Secret 表单。

## 6. 消息运行流程

### 6.1 添加频道

```text
用户填写频道名称
  → POST /channels/feishu/qr/start
  → PairingHub 生成飞书应用创建二维码
  → 用户用手机飞书扫码并确认
  → PairingHub 获得 App ID / App Secret
  → 保存凭据到 credentials
  → ChannelManager.connect()
  → 建立飞书长连接
  → 可选执行应用配置 provisioning
  → 频道出现在频道页
```

### 6.2 入站消息

```text
飞书 WebSocket 事件
  → FeishuChannelAdapter 解析
  → ImEngine
      → 去重（seen.json）
      → 私聊准入 / 群聊 @ 判定
      → 斜杠命令或普通消息
      → SessionMerger / SessionRouter
      → DSH Agent
      → 流式回复 / 审批 / 提问 / 文件
  → FeishuChannelAdapter 发送
  → 成功后记录投递状态
```

### 6.3 出站与失败处理

- 文本按飞书消息大小限制分片；
- Markdown 优先使用卡片；卡片不可用或发送失败时回退纯文本；
- 图片、文件通过飞书上传接口发送；
- 处理中可显示状态表情；
- 发送失败按分片退避重试；
- 明确失败或超时可能进入 `deferred-delivery.json`，由后台恢复逻辑重试；
- Agent 运行期间的用户问题/工具审批会转成飞书卡片或文本交互，结果再回填 DSH。

### 6.4 访问控制与命令

- 私聊准入支持 `approved` 和 `all`；
- 首个用户/owner 会加入允许列表；
- 未批准用户在 `pending` 中显示，可在频道页批准/拒绝；
- 群聊按 @ 机器人判定；
- 每个频道可配置命令权限（私聊/群聊、允许的命令）；
- 常用命令包括 `/status`、`/workspace`、`/new`、`/model` 等，具体以当前命令实现为准；
- 命令行回复使用频道的语言环境。

## 7. 飞书应用 provisioning

扫码创建应用时，插件会在二维码 URL 中预填：

- 应用名称；
- `source=dsh-feishu-channels`；
- `createOnly=true`；
- 应用 scope addons。

当前 scope 常量：

| Scope | 类型 | 用途 |
|---|---|---|
| `im:message` | tenant | 接收/发送消息 |
| `im:message.send_as_user` | user | 以用户身份发送消息 |
| `application:application:patch` | tenant | 写入应用配置（名称、重定向 URL 等） |

扫码完成后，`provisionFeishuApp()` 会尽力执行：

1. 通过 `application.v7.applicationBase.patch` 写入应用名称；
2. 通过 `application.v7.applicationConfig.patch` 写入 scope 和重定向 URL；
3. v7 不适用时回退到 v6；
4. 读取应用配置验证结果。

该操作是 **best-effort**：飞书租户可能拒绝某些写入；调用方不能把它当作连接成功的必要条件。当前实现不会把 provisioning 结果写入 `channels.json`：

- `/accounts/:id/provision` 的响应会带本次结果；
- 自动 provisioning 的失败摘要会写 `gateway.log`；`/accounts/:id/provision` 的本次结果在响应中返回；
- 状态文件中残留的 `config.provisioning` 会在加载时清理。

重定向 URL 常量位于 `src/channels/feishu-app.js`，主要是本机 `dsh-remote-feishu` OAuth 回调地址和部署域名回调地址。本插件只负责把这些 URL 写入飞书应用配置，不处理这些 OAuth 回调。

## 8. Client 结构与界面

`client.js` 通过 `window.__ModuleLoader__.load` 注册模块，模块 id 为：

```text
@cubeai/dsh-feishu-channels
```

### 8.1 侧边栏页签

DSH 没有公开的侧栏页签 API，`sidebar.workspaces` 只有一个 occupant。插件实现与 `dsh-im-connect` 兼容的私有 **Registry v1**：

- 如果官方 `sidebar.workspaces` 还没有被包装，插件包装它并挂上 registry；
- 如果已有合法 registry，插件把自己的 `feishu` 页签插入；
- 页签顺序：`channels` = 20，`feishu` = 30；
- 最终显示：

```text
任务 | 频道 | 飞书频道
```

只有本插件时显示：

```text
任务 | 飞书频道
```

页签插入/移除通过 `dsh-native-sidebar-change` 事件协调；所有 disposer 只清理自己插入的 tab/filter/opener。

### 8.2 频道页

频道页承载：

- 全宽“添加飞书频道”按钮；
- 频道列表：名称、连接状态、设置入口；
- 每个频道的飞书会话列表；
- 当前会话高亮；
- 待批准访问请求；
- 空状态和错误提示；
- 设置弹窗：
  - 频道名称；
  - 飞书机器人应用信息（App ID / App Secret 的显示、复制）；
  - 工作区；
  - 模型和推理等级；
  - 权限；
  - Agent 预设；
  - 私聊准入；
  - 发送方式（排队/插话）；
  - 命令权限；
  - 连接诊断、重连、移除。

添加频道弹窗当前只保留扫码流程，包含频道名称和初始频道设置。

### 8.3 会话行图标

通过 `sidebar.session.row.leading` 槽位，为飞书会话显示飞书品牌小图标。它和任务行的其他 leading 图标使用同一槽位，不修改宿主 DOM。

### 8.4 Composer

对 `dfc:` 会话，插件注册 `conversation.composer`：

- 如果会话存在待审批/待回答交互，让位给宿主自身的交互 composer；
- 否则替换为飞书只读提示栏：
  - 当前模型只读展示；
  - 不允许在本地输入或发送；
  - 模型切换在频道设置中完成；
  - 运行中显示黑色圆形“停止”按钮；
  - 点击停止先弹确认框，确认后调用会话级 `conversation.cancel()`，中断当前推理但保留队列。

### 8.5 国际化与样式

- 中文/英文词典内置在 client 中；
- 服务端错误通过 `server.*` 键映射，未知错误显示通用文案；
- 样式选择器统一使用 `.dfc-` 前缀；
- 颜色尽量使用 DSH 主题 token（`--dsw-alias-*`）；
- 不覆盖宿主全局样式，不写 `body`/`#root` 规则。

## 9. 与 dsh-im-connect 的共存

两个插件共享同一个 `sidebar.workspaces` 槽位，但不是 npm 依赖，也不共享 Host 状态：

| 项目 | dsh-im-connect | 本插件 |
|---|---|---|
| 会话前缀 | `im:` | `dfc:` |
| 页签 id | `channels` | `feishu` |
| 页签顺序 | 20 | 30 |
| 状态目录 | 各自独立 | 各自独立 |
| API 前缀 | 各自独立 | 各自独立 |
| 凭据 | 各自独立 | 各自独立 |

Registry v1 是私有约定，不是 DSH 公共 API。当前策略：

- 任一方都可以作为 wrapper；
- 另一方把页签插入 registry；
- 加载顺序不同都能得到 `任务 | 频道 | 飞书频道`；
- 无法识别外来宿主时降级为官方侧栏；
- 同一飞书 App ID 不能同时被两个插件连接（飞书长连接会冲突）；
- 卸载时如果 DSH 报 `bundle-in-use`，先禁用本插件，再卸载 `dsh-im-connect`，之后可以重新启用本插件。

## 10. 安全与隔离

- 管理 API 复用宿主登录/来源校验，不自行实现登录；
- 变更请求要求客户端标记头和 JSON content-type，降低跨站表单误操作风险；
- Secret 只通过显式接口读取，正常列表只暴露 `hasAppSecret`；
- 优先使用宿主 credentials 服务；
- `secrets.json` 回退文件权限为 0600；
- 频道状态、会话、凭据和 API 与 im-connect 独立；
- 插件不自带更新器，不修改其他插件的状态或代码。

## 11. 诊断与运维

### 11.1 日志

默认日志：

```text
$DSH_HOME/dsh-feishu-channels/gateway.log
```

日志包含启动、频道启动/停止、扫码、API 注册、消息投递和错误摘要。日志滚动策略由 `createRotatingFileAppender` 控制。

### 11.2 连接诊断

`POST /accounts/:id/check` 会执行连接探测，返回：

- 当前频道状态；
- 凭据是否可用；
- 平台响应摘要；
- 诊断检查项。

频道设置中的“诊断连接”会展示结果，失败时显示安全错误提示。诊断结果只用于当前操作，不写入 `channels.json`。

### 11.3 重连与移除

- 重连：`POST /accounts/:id/reconnect`；
- 移除：`POST /accounts/:id/remove`，删除频道配置和对应凭据引用；
- 卸载插件本身不会自动删除状态目录；若要彻底清除，需要手动删除状态目录、凭据引用和 `dfc:` 会话记录。

## 12. 已知限制

- 只支持飞书（Feishu），不包含 Lark 或其他 IM 通道；
- 当前界面以扫码创建应用为主，不提供手动 App ID/Secret 表单；
- 应用配置 provisioning 受飞书租户权限限制，是 best-effort；
- 共享侧栏依赖 Registry v1 私有约定，未来 im-connect 变更时需要适配；
- 同一 App ID 不能同时被本插件和 im-connect 使用；
- 插件不负责刷新/更新自身版本；
- 宿主认证服务不可用时，管理 API 会返回 503，页面无法加载频道数据；
- 客户端页面依赖 DSH Web profile 的 slots、locale 和 UI primitives。

## 13. 验证

当前自动化检查：

```bash
pnpm test
pnpm run check
```

测试覆盖 Host API、扫码/配对、飞书应用配置、会话、消息处理、命令、客户端页签、频道页、composer 和共存 harness。

相关代码：

- [README.md](../README.md)：安装和使用；
- `src/channels/feishu-app.js`：scope、redirect URL 和 provisioning 的实际常量；
- `src/manager.js`：API 路由和状态字段的最终事实来源。
