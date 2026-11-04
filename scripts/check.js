import { readFileSync, readdirSync, statSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const failures = []
const notes = []

function read(path) {
  return readFileSync(join(root, path), 'utf8')
}
function fail(message) {
  failures.push(message)
}
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    const stat = statSync(path)
    if (stat.isDirectory()) {
      if (name === 'node_modules' || name === '.npm-cache' || name === '.git') continue
      walk(path, out)
    } else if (name.endsWith('.js')) out.push(path)
  }
  return out
}

const pkg = JSON.parse(read('package.json'))
if (pkg.name !== '@cubeai/dsh-feishu-channels') fail(`package name is ${pkg.name}`)
if (pkg.type !== 'module') fail('package must be ESM')
if (pkg.main !== 'src/index.js') fail(`main is ${pkg.main}`)
if (pkg.exports?.['.'] !== './src/index.js') fail('exports["."] must point at src/index.js')
if (pkg.exports?.['./client'] !== './client.js') fail('exports["./client"] must point at client.js')
if (pkg.dsh?.bundle?.patch !== './cordis.patch.yml') fail('dsh.bundle.patch missing')
if (pkg.dsh?.client?.platform !== 'web') fail('dsh.client.platform must be web')
if (!Array.isArray(pkg.dsh?.client?.inject) || !pkg.dsh.client.inject.includes('@deepseek-ai/dsh-client-locale')) fail('dsh.client.inject must include locale')
if (!pkg.dsh?.client?.inject?.includes('@deepseek-ai/dsh-client-ui-slots')) fail('dsh.client.inject must include slots')

const files = walk(join(root, 'src')).concat([join(root, 'client.js')])
for (const file of files) {
  const check = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' })
  if (check.status !== 0) fail(`syntax: ${relative(root, file)}\n${check.stderr}`)
}

const runtimeText = files.map((file) => readFileSync(file, 'utf8')).join('\n')
for (const forbidden of [
  '@michengai/dsh-im-connect',
  'im_connect_',
  '/api/dsh-im-connect',
  'x-dsh-im-connect-client',
  'dsh-im-connect',
]) {
  if (runtimeText.includes(forbidden)) fail(`runtime still contains ${forbidden}`)
}
if (!read('src/engine/session-id.js').includes("DFC_SESSION_PREFIX = 'dfc:'")) fail('session prefix must be dfc:')
if (!read('src/engine/credentials.js').includes('dfc_${channelId}_${key}')) fail('credential ref prefix must be dfc_')
if (!read('src/manager.js').includes("'/api/dsh-feishu-channels'")) fail('manager API prefix must be /api/dsh-feishu-channels')
if (!read('src/manager.js').includes("'x-dsh-feishu-channels-client'")) fail('manager mutation header must be x-dsh-feishu-channels-client')
if (!read('client.js').includes('id: "@cubeai/dsh-feishu-channels"')) fail('client module id mismatch')
if (!read('client.js').includes('"/api/dsh-feishu-channels"')) fail('client API base mismatch')
if (!read('client.js').includes('"feishu-channel"')) fail('client locale namespace mismatch')

const clientText = read('client.js')
for (const forbidden of ['telegram', 'discord', 'slack', 'wecom', 'weixin', 'dingtalk', 'lark', 'ima-', 'im-connect']) {
  if (clientText.toLowerCase().includes(forbidden)) fail(`client.js still contains ${forbidden}`)
}
for (const name of ['zh', 'en']) {
  const text = read(`locale/${name}.json`).toLowerCase()
  for (const forbidden of ['telegram', 'discord', 'slack', 'wecom', 'weixin', 'dingtalk', 'lark']) {
    if (text.includes(forbidden)) fail(`locale/${name}.json still contains ${forbidden}`)
  }
}
const localeStart = clientText.indexOf('const DFC_LOCALES = {')
const localeEnd = clientText.indexOf('const fallbackT', localeStart)
if (localeStart < 0 || localeEnd <= localeStart) fail('DFC_LOCALES block not found')
else {
  const literal = clientText.slice(clientText.indexOf('{', localeStart), localeEnd).trim().replace(/;\s*$/, '')
  const dictionaries = new Function(`return (${literal})`)()
  const zhKeys = Object.keys(dictionaries.zh)
  const enKeys = Object.keys(dictionaries.en)
  if (zhKeys.length !== enKeys.length) fail(`locale key mismatch: zh=${zhKeys.length} en=${enKeys.length}`)
  for (const key of zhKeys) if (!enKeys.includes(key)) fail(`locale key missing in en: ${key}`)
  for (const key of enKeys) if (!zhKeys.includes(key)) fail(`locale key missing in zh: ${key}`)
  const used = new Set([...clientText.matchAll(/\bt\("([^"]+)"\)/g)].map((match) => match[1]))
  for (const key of used) if (!zhKeys.includes(key)) fail(`literal locale key missing: ${key}`)
  const dynamic = [
    'connection.connected', 'connection.connecting', 'connection.reconnecting', 'connection.disconnected',
    'connection.stopped', 'connection.error', 'connection.unknown', 'connection.paused',
    'diagnostic.title', 'diagnostic.scope', 'diagnostic.credentials', 'diagnostic.bot',
    'diagnostic.passed', 'diagnostic.failed', 'diagnostic.unverified', 'diagnostic.ok',
    'diagnostic.local-state', 'diagnostic.cancelled', 'diagnostic.auth', 'diagnostic.permission',
    'diagnostic.rate-limit', 'diagnostic.server', 'diagnostic.network', 'diagnostic.timeout',
    'diagnostic.invalid-response', 'diagnostic.rejected', 'diagnostic.missing-context',
    'diagnostic.not-connected', 'diagnostic.unsupported', 'diagnostic.changed',
    'server.unknownChannel', 'server.channelUnconfigured', 'server.sessionMissing', 'server.accountMissing',
    'server.accountConnectFailed', 'server.accountReconnectFailed', 'server.remarkTooLong',
    'server.remarkControl', 'server.selectAccountSettings', 'server.selectModel', 'server.selectWorkspace',
    'server.createWorkspace', 'server.selectPermission', 'server.missingCredentials', 'server.qrUnsupported',
    'server.qrExpired', 'server.qrIncomplete', 'server.accessDenied',
    'channel.feishu', 'qr.feishu', 'rail.feishu', 'account.statusNotConnected',
    'status.stopped', 'status.longConnection', 'status.saving', 'status.saved',
  ]
  for (const key of dynamic) if (!zhKeys.includes(key)) fail(`dynamic locale key missing: ${key}`)
}

const zh = JSON.parse(read('locale/zh.json'))
const en = JSON.parse(read('locale/en.json'))
if (!zh.meta?.title || !zh.meta?.description) fail('locale/zh.json meta incomplete')
if (!en.meta?.title || !en.meta?.description) fail('locale/en.json meta incomplete')
if (zh.meta.title !== 'DSH飞书频道') fail(`zh meta.title is ${zh.meta.title}`)

for (const path of ['README.md', 'README.zh-CN.md', 'LICENSE', 'NOTICE', 'icon.svg', 'cordis.patch.yml']) {
  try {
    read(path)
  } catch {
    notes.push(`missing optional deliverable: ${path}`)
  }
}

if (failures.length) {
  console.error('check failed:')
  for (const message of failures) console.error(`- ${message}`)
  process.exit(1)
}
console.log(`check ok: ${files.length} JS files, ${notes.length} notes`)
for (const note of notes) console.log(`note: ${note}`)
