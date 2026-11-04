/** Maps the Feishu adapter's status text to the account view state. */
const readyStates = new Set(['长连接已建立']);
const connectingStates = new Set(['连接中']);

export function connectionState(status) {
  if (readyStates.has(status)) return 'connected';
  if (connectingStates.has(status)) return 'connecting';
  if (status === '已停止') return 'stopped';
  if (status === '未连接' || status === '已断开') return 'disconnected';
  if (status === '连接失败' || status === '连接失败，请查看本机日志' || status === '连接错误') return 'error';
  return 'unknown';
}
