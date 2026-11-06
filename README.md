# DSH飞书频道

`@cubeai/dsh-feishu-channels`

把飞书机器人应用接入本机 DeepSeek Harness。

## 术语

- **频道**：本插件中的一个飞书接入单元，对应一个飞书自建机器人应用；每个频道有自己的模型、工作区、权限等配置。
- **飞书账号**：扫码或授权时使用的飞书用户/租户账号。添加频道不会创建新的飞书用户账号，而是在当前账号下创建或绑定机器人应用。

## 功能

- 扫码创建飞书机器人应用，自动在本插件添加频道，添加时请填写频道名称。
- 多飞书频道，每个频道独立的模型、工作区、权限、Agent 预设、私聊准入、发送方式、命令权限。
- 文本、Markdown 卡片回复、图片、文件、群聊 @、审批卡片、提问卡片、状态表情、延迟投递、斜杠命令。
- 左侧边栏页签 **飞书频道**（`任务 | 飞书频道`）承载全部频道与设置；频道设置里可查看/复制 App ID，显示/复制 App Secret。

## 安装（本地开发）

### 方式 A：界面安装（推荐）

在 DSH 里的「插件 → 添加插件」界面中，输入下面的地址，系统会自动安装：

```
@cubeai/dsh-feishu-channels
```

或：

```
https://openi.pcl.ac.cn/dsh/dsh-feishu-channels.git
```

安装后刷新 DSH，左侧边栏会出现页签 **飞书频道**（`任务 | 飞书频道`）。

### 方式 B：命令行安装（适用于 web profile）

```bash
dsh plugin --profile web add https://openi.pcl.ac.cn/dsh/dsh-feishu-channels.git
```

或从 npm 安装：

```bash
dsh plugin --profile web add @cubeai/dsh-feishu-channels
```

## 添加飞书频道

1. 打开侧边栏 **飞书频道**，点击 **添加飞书频道**。
2. 填写频道名称并用手机飞书App扫码。
3. 添加成功后频道会立即出现在频道页，不需要等首条消息。

## 技术实现

如需了解内部结构、状态目录、API、消息流程和侧栏共存机制，见 [技术实现说明](docs/dsh-feishu-channels.md)。
