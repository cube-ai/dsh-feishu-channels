/**
 * Feishu app provisioning for QR-created PersonalAgent apps.
 *
 * - QR link: prefill app name and incremental scopes via `name` / `addons`.
 * - After creation: try to write scopes / redirect URLs / name through the
 *   application OpenAPI. Some Feishu tenants reject these for apps created
 *   outside the developer console; callers must treat the result as best-effort.
 */
import { gzipSync } from 'node:zlib'

export const FEISHU_APP_SCOPES = {
  // `application:application:patch` is required by the app-config OpenAPI
  // that writes redirect URLs. Without it Feishu returns 99991672 even for
  // an app updating itself. It is prefilled together with the user-requested
  // message scopes so a freshly QR-created app can configure itself.
  tenant: ['im:message', 'application:application:patch'],
  user: ['im:message.send_as_user'],
}

export const FEISHU_REDIRECT_URLS = [
  'http://127.0.0.1:3080/api/dsh-feishu-client/oauth/callback',
  'http://localhost:3080/api/dsh-feishu-client/oauth/callback',
  'http://127.0.0.1:32123/api/dsh-feishu-client/oauth/callback',
  'http://localhost:32123/api/dsh-feishu-client/oauth/callback',
  'http://127.0.0.1:8731/api/oauth/callback',
  'http://localhost:8731/api/oauth/callback',
  'https://www.cubeai.com:6443/cubeaispace-dsh1-1234567890-dsh/api/dsh-feishu-client/oauth/callback',
]

const REQUESTED_SCOPES = [
  { scope_name: 'im:message', token_type: 'tenant' },
  { scope_name: 'im:message.send_as_user', token_type: 'user' },
]

/** Encode addons exactly like the Feishu SDK: JSON -> gzip -> base64url. */
export function encodeAddons(addons = { scopes: FEISHU_APP_SCOPES }) {
  const json = JSON.stringify(addons)
  return gzipSync(Buffer.from(json, 'utf8'))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/** Prefill the app-creation page. The user may still edit these values in Feishu. */
export function decorateQrUrl(raw, { name } = {}) {
  const url = new URL(raw)
  url.searchParams.set('from', 'sdk')
  url.searchParams.set('tp', 'sdk')
  url.searchParams.set('source', 'dsh-feishu-channels')
  url.searchParams.set('createOnly', 'true')
  if (typeof name === 'string' && name.trim()) url.searchParams.set('name', name.trim())
  url.searchParams.set('addons', encodeAddons({ scopes: FEISHU_APP_SCOPES }))
  return url.toString()
}

function safeError(step, error) {
  const response = error && typeof error === 'object' ? error.response : undefined
  // Prefer the business code inside response.data: Axios puts a string such as
  // ERR_BAD_REQUEST on error.code, which hides Feishu's numeric code.
  const rawCode = response?.data?.code ?? error?.code ?? response?.status
  const rawStatus = response?.status
  const rawMessage = typeof response?.data?.msg === 'string'
    ? response.data.msg
    : typeof error?.msg === 'string'
      ? error.msg
      : typeof error?.message === 'string' ? error.message : ''
  const message = /secret|token|authorization|app_secret/i.test(rawMessage)
    ? 'request failed'
    : rawMessage.slice(0, 160)
  const code = Number(rawCode)
  const status = Number(rawStatus)
  return {
    step,
    ...(Number.isFinite(code) ? { code } : {}),
    ...(Number.isFinite(status) ? { status } : {}),
    ...(message ? { message } : {}),
  }
}

function noopLogger() {
  return { debug() {}, info() {}, warn() {}, error() {}, trace() {} }
}

async function readApp(client, appId) {
  const response = await client.application.v6.application.get({
    path: { app_id: appId },
    params: { lang: 'zh_cn' },
  })
  return response?.data?.app ?? response?.app ?? null
}

function scopeNames(app) {
  return (app?.scopes ?? []).map((item) => String(item?.scope ?? '')).filter(Boolean)
}

function redirectUrls(app) {
  const list = app?.security?.redirect_urls ?? app?.redirect_urls ?? []
  return Array.isArray(list) ? list.map(String) : []
}

/**
 * Best-effort app provisioning. Never throws and never returns the App Secret.
 * @returns {Promise<{
 *   checkedAt: string,
 *   name: { requested: string, present?: string, applied: boolean, ok: boolean },
 *   scopes: { requested: string[], present: string[], missing: string[], applied: boolean },
 *   redirectUrls: { requested: string[], present: string[], missing: string[], written: boolean },
 *   verified: boolean,
 *   errors: Array<{ step: string, code?: number, status?: number, message?: string }>
 * }>}
 */
export async function provisionFeishuApp({ appId, appSecret, name, log = () => {}, client: injectedClient }) {
  const requestedName = typeof name === 'string' ? name.trim() : ''
  const result = {
    checkedAt: new Date().toISOString(),
    name: { requested: requestedName, applied: false, ok: false },
    scopes: {
      requested: REQUESTED_SCOPES.map((item) => item.scope_name),
      present: [],
      missing: REQUESTED_SCOPES.map((item) => item.scope_name),
      applied: false,
    },
    redirectUrls: {
      requested: [...FEISHU_REDIRECT_URLS],
      present: [],
      missing: [...FEISHU_REDIRECT_URLS],
      written: false,
    },
    verified: false,
    errors: [],
  }
  if (!appId || !appSecret) {
    result.errors.push({ step: 'credentials', message: 'missing app credentials' })
    return result
  }

  let client = injectedClient
  if (!client) {
    try {
      const sdk = await import('@larksuiteoapi/node-sdk')
      client = new sdk.Client({
        appId,
        appSecret,
        logger: noopLogger(),
        loggerLevel: sdk.LoggerLevel?.error ?? 1,
      })
    } catch (error) {
      result.errors.push(safeError('sdk', error))
      log('[feishu-app] SDK 不可用，跳过应用配置')
      return result
    }
  }

  if (requestedName) {
    try {
      await client.application.v7.applicationBase.patch({
        path: { app_id: appId },
        data: { i18ns: [{ i18n_key: 'zh_cn', name: requestedName }] },
      })
      result.name.applied = true
    } catch (error) {
      result.errors.push(safeError('name', error))
    }
  }

  let configApplied = false
  try {
    await client.application.v7.applicationConfig.patch({
      path: { app_id: appId },
      data: {
        scope: { add_scopes: REQUESTED_SCOPES },
        security: { add: { redirect_urls: FEISHU_REDIRECT_URLS } },
      },
    })
    configApplied = true
    result.scopes.applied = true
    result.redirectUrls.written = true
  } catch (error) {
    result.errors.push(safeError('config-v7', error))
  }

  if (!configApplied) {
    try {
      await client.application.v7.applicationConfig.patch({
        path: { app_id: appId },
        data: { scope: { add_scopes: REQUESTED_SCOPES } },
      })
      result.scopes.applied = true
    } catch (error) {
      result.errors.push(safeError('scopes-v7', error))
    }
    try {
      await client.application.v7.applicationConfig.patch({
        path: { app_id: appId },
        data: { security: { add: { redirect_urls: FEISHU_REDIRECT_URLS } } },
      })
      result.redirectUrls.written = true
    } catch (error) {
      result.errors.push(safeError('redirect-v7', error))
    }
  }

  // v6 compatibility: security.redirect_urls is a full-list update. Merge the
  // current list first so we never drop an existing redirect URL.
  let v6Attempted = false
  const attemptV6Redirects = async () => {
    if (v6Attempted) return
    v6Attempted = true
    let existing = []
    try {
      const app = await readApp(client, appId)
      existing = redirectUrls(app)
    } catch (error) {
      result.errors.push(safeError('app-get', error))
    }
    const merged = [...new Set([...existing, ...FEISHU_REDIRECT_URLS])]
    try {
      await client.application.v6.application.patch({
        path: { app_id: appId },
        params: { lang: 'zh_cn' },
        data: { security: { redirect_urls: merged } },
      })
      result.redirectUrls.written = true
    } catch (error) {
      result.errors.push(safeError('redirect-v6', error))
    }
  }

  if (!result.redirectUrls.written) await attemptV6Redirects()

  const observeApp = (app) => {
    if (!app) return
    result.verified = true
    const presentScopes = scopeNames(app)
    result.scopes.present = result.scopes.requested.filter((key) => presentScopes.includes(key))
    result.scopes.missing = result.scopes.requested.filter((key) => !presentScopes.includes(key))
    const presentRedirects = redirectUrls(app)
    result.redirectUrls.present = result.redirectUrls.requested.filter((url) => presentRedirects.includes(url))
    result.redirectUrls.missing = result.redirectUrls.requested.filter((url) => !presentRedirects.includes(url))
    result.redirectUrls.written = result.redirectUrls.missing.length === 0
    if (typeof app.app_name === 'string') {
      result.name.present = app.app_name
      result.name.ok = requestedName !== '' && app.app_name === requestedName
    }
    result.scopes.applied = result.scopes.missing.length === 0
  }

  try {
    observeApp(await readApp(client, appId))
  } catch (error) {
    result.errors.push(safeError('verify', error))
  }

  // v7 may report success while the tenant silently ignores the redirect
  // update. If verification still misses some URLs, try v6 once more.
  if (result.redirectUrls.missing.length > 0 && !v6Attempted) {
    await attemptV6Redirects()
    try {
      observeApp(await readApp(client, appId))
    } catch (error) {
      result.errors.push(safeError('verify-v6', error))
    }
  }

  const failed = result.errors.map((item) => item.step).join(',')
  log(`[feishu-app] 配置完成：name=${result.name.ok ? 'ok' : 'pending'} scopes=${result.scopes.missing.length === 0 ? 'ok' : 'missing'} redirects=${result.redirectUrls.missing.length === 0 ? 'ok' : 'missing'}${failed ? ` errors=${failed}` : ''}`)
  return result
}
