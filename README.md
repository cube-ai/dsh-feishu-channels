# DSH飞书频道

`@cubeai/dsh-feishu-channels` 

把飞书机器人接入本机 DeepSeek Harness。

## 功能

- 飞书机器人扫码绑定（自动创建 PersonalAgent 应用），添加时请填写频道名称。
- 多飞书账号，每个账号独立的模型、工作区、权限、Agent 预设、私聊准入、发送方式、命令权限。
- 文本、Markdown 卡片回复、图片、文件、群聊 @、审批卡片、提问卡片、状态表情、延迟投递、斜杠命令。
- 左侧边栏页签 **飞书频道**（`任务 | 飞书频道`）承载全部账号与设置；账号设置里可查看/复制 App ID，显示/复制 App Secret。

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

本包是纯 ESM JavaScript，不需要编译。

## 飞书应用配置

1. 打开侧边栏 **飞书频道**，点击左侧 **添加飞书账号**。
2. 填写频道名称并扫码；名称会预填到飞书应用创建页。
3. 添加成功后账号会立即出现在频道页，不需要等首条消息。

## 数据位置

- 状态：`$DSH_HOME/dsh-feishu-channels`
- 凭据：DSH 凭据服务，ref 前缀 `dfc_`
- 会话：`dfc:<账号>:<dm|group>:<时间戳>:<chatId>`

