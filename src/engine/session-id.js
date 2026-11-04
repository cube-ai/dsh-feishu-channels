/** Feishu channel session identity: separate from web tasks by id prefix. */
export const DFC_ORIGIN = 'dfc';
export const DFC_SESSION_PREFIX = 'dfc:';

export function sessionKeyOf(channel, kind, chatId) {
    return `${channel}:${kind}:${chatId}`;
}

let lastStamp = 0;

/** New sessions use a timestamped unique id; same-millisecond creates increment. */
export function createFeishuSessionId(channel, kind, chatId, now = Date.now()) {
    const stamp = now <= lastStamp ? lastStamp + 1 : now;
    lastStamp = stamp;
    return `${DFC_SESSION_PREFIX}${channel}:${kind}:${stamp}:${chatId}`;
}

export function isFeishuSessionId(sessionId) {
    return typeof sessionId === 'string' && sessionId.startsWith(DFC_SESSION_PREFIX);
}

const CHANNEL_IDS = ['feishu'];
const STAMP_RE = /^\d{13,}$/;

export function parseFeishuSessionId(sessionId) {
    if (!isFeishuSessionId(sessionId))
        return undefined;
    const rest = sessionId.slice(DFC_SESSION_PREFIX.length);
    const first = rest.indexOf(':');
    const second = rest.indexOf(':', first + 1);
    if (first <= 0 || second <= first)
        return undefined;
    const channel = rest.slice(0, first);
    const kind = rest.slice(first + 1, second);
    let chatId = rest.slice(second + 1);
    const third = chatId.indexOf(':');
    if (third > 0 && STAMP_RE.test(chatId.slice(0, third))) {
        chatId = chatId.slice(third + 1);
    }
    const platform = channel.split('_', 1)[0];
    const validInstance = CHANNEL_IDS.includes(platform) && /^[a-z0-9_-]+$/.test(channel);
    if (!validInstance || (kind !== 'dm' && kind !== 'group') || chatId === '')
        return undefined;
    return { channel, kind, chatId };
}

export function isFeishuOrigin(origin) {
    return origin === DFC_ORIGIN;
}

/** Task list visibility: exclude channel sessions and subagents. */
export function isTaskSession(input) {
    if (input.blank === true)
        return false;
    if (isFeishuOrigin(input.origin))
        return false;
    if (typeof input.id === 'string' && isFeishuSessionId(input.id))
        return false;
    if (input.origin === 'subagent')
        return false;
    return true;
}
