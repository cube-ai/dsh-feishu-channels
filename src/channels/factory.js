import { createFeishuChannel } from './feishu.js'

/**
 * Only the Feishu platform is supported by this plugin.
 * The manager still passes a platform id; unknown ids are rejected.
 */
export function createChannelAdapter(id, config, log, _stateDir, options) {
  if (id !== 'feishu') return undefined
  const adapter = createFeishuChannel('feishu', {
    appId: config.appId,
    appSecret: config.appSecret,
    host: options?.host,
  }, log)
  if (!adapter) return undefined
  return {
    ...adapter,
    id: options?.accountId ?? adapter.id,
    label: options?.accountLabel ?? adapter.label,
  }
}
