# Verification

## Current automated status (2026-11-04)

- Package installed from `/home/hls/dev/dsh-remote-feishu/dsh-feishu-channels`
  into the `web` profile as a local link.
- Host plugin row is active (`Config.listConfigs` reports `feishu-channel`).
- Host log `~/.dsh/dsh-feishu-channels/gateway.log` shows:
  - `API 已注册 /api/dsh-feishu-channels`
  - `apply 完成`
  - `initEnabled`
  - `attachMappedSessions`
- `pnpm test` passes 94 tests.
- `pnpm run check` passes (syntax, isolation, manifest, locale metadata).
- After the page loaded the new Client module, live slot inspection reports:
  - `settings.section` has **no** `feishu-channel` occupant (the settings entry was removed).
  - `sidebar.session.row.leading` occupant `feishu-channel-session-channel`, order 10, active.
- `conversation.composer` chain entry should appear after a page refresh; it replaces the
  normal composer for `dfc:` sessions with a read-only Feishu notice.
- The Client module therefore loaded and executed `apply` without a slot crash.
- The shared tab bar itself is rendered inside the sidebar wrapper and is not exposed by
  slot inspection; it still needs the visual check below.
- Code-level coexistence evidence:
  - A harness using the **real `dsh-im-connect@1.0.12` `SessionSwitcher`** with both a
    `channels` tab and our `feishu` tab renders `任务 | 频道 | 飞书频道` and switches
    content for all three tabs.
  - Our own `SessionSwitcher` harness renders `任务 | 飞书频道`, inserts a foreign
    `channels` tab at order 20, and keeps `飞书频道` at order 30.

## Real Feishu provisioning verification (2026-11-04)

- Two test accounts were created by QR: `新智能体1号` and `新智能体2号`.
- Both received the requested name and scopes:
  - `im:message`
  - `im:message.send_as_user`
- Initial redirect-URL writes failed with Feishu business code `99991672`:
  `application:application:patch` was missing.
- The app was updated through Feishu's existing-app QR flow to add
  `application:application:patch`.
- Re-running the v7 config patch returned `code: 0, msg: success`; all five
  redirect URLs were then present in `application.v6.application.get`.
- Conclusion: keep the redirect-URL write step, with
  `application:application:patch` included in the QR addons for new accounts.
  Existing accounts can use **重新检查应用配置** after adding the permission.

## Visual confirmation

The user confirmed the live tab bar on 2026-11-04:

- Sidebar: **任务 | 频道 | 飞书频道** (im-connect and this plugin both enabled).
- The settings entry was removed in the follow-up UI revamp; live slot inspection confirms
  `settings.section` has no `feishu-channel` occupant.
- Real Feishu QR/message acceptance is still pending a user scan; this is the remaining
  verification item.

The Client module is loaded (see the live slot evidence above). Remaining page checks:

1. **Settings nav**: no **飞书频道** entry.
2. **Sidebar**: `任务 | 频道 | 飞书频道` when im-connect is also enabled; only
   `任务 | 飞书频道` when it is disabled.
3. **Channel tab**: left side has only **添加飞书账号**; no content title, folder group,
   or right-side icon add button.
4. **Add dialog**: title **添加飞书账号**; only QR binding; no manual fields or
   **快捷绑定** text; has **频道名称** with default `飞书账号1`.
5. **Account row**: after scanning, the entered name appears immediately, with status,
   receive switch, and **设置**.
6. **Account settings**: **飞书App信息** shows App ID/App Secret in one row; App ID is
   copyable; App Secret is masked and can be shown/copied. The check result is collapsible.
7. **Feishu session composer**: opening a `dfc:` session removes the text input/send
   button and shows the current account model as read-only text; switch models in
   account settings and the display follows. While a turn is running, a **Stop
   generating** button asks for confirmation before cancelling the turn. The current
   session row is highlighted in the channel list.
8. **No console error** such as `slot entry crashed` or a blank sidebar.

If the sidebar is blank or the tabs are wrong, disable this bundle in Plugin Manager
first (the official sidebar returns immediately), then report the browser console
error. Do not uninstall `dsh-im-connect`.

## Slot-level checks (no browser needed)

```text
cordis_inspect_query client Slots.listSubTree { "root": "settings.section" }
→ occupants must NOT include { id: "feishu-channel" }

cordis_inspect_query client Slots.listSubTree { "root": "sidebar.session.row.leading" }
→ occupants should include { id: "feishu-channel-session-channel" }
```

If these entries do not appear, the page has not loaded the new Client module; refresh
first.

## Real Feishu acceptance

1. Open the **飞书频道** tab → **添加飞书账号** → enter a name → scan the QR code.
2. After the account appears, open **设置** and verify App ID / App Secret show and copy.
3. Inspect `config.provisioning` in `~/.dsh/dsh-feishu-channels/channels.json`:
   - If all five redirect URLs are present, keep the redirect write step.
   - If Feishu rejects them, remove the redirect write operation and its UI hint.
4. Send a private message to the bot; the first user is the owner.
5. Verify: text reply, group @ mention, image, file, approval card, question card,
   slash commands, receive off/on, diagnostics, remove account.
6. Add a second Feishu account with a different app; verify sessions do not mix.
7. Keep im-connect enabled but with its Feishu account removed/disabled. Do not use the
   same App ID in both plugins.

## Commands

```bash
cd /home/hls/dev/dsh-remote-feishu/dsh-feishu-channels
pnpm test
pnpm run check
```

## Known limits

- Visual verification requires the user; this environment has no browser control.
- Registry v1 is private to the im-connect/new-plugin coexistence convention.
- Codex UI sidebars are not wrapped in v1.
- Same Feishu App ID in both plugins is a platform-level conflict.
