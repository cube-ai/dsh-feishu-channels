/** Media helpers used by the Feishu adapter. */
export const MAX_CHANNEL_IMAGES = 4

/** Generic files are not validated by image magic bytes; Chat admission decides. */
export function fileMedia(data, name = 'file.bin', maxBytes = 20 * 1024 * 1024) {
  if (!data.length || data.length > maxBytes) throw new Error('文件为空或超过大小限制')
  const leaf = name.replace(/\\/g, '/').split('/').pop()?.replace(/[\x00-\x1f]/g, '').slice(0, 200) || 'file.bin'
  return { kind: 'file', data, name: leaf }
}
