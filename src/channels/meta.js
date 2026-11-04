/** Feishu-only channel metadata. */
export const CHANNEL_ORDER = ['feishu'];

export const CHANNEL_META = {
    feishu: {
        id: 'feishu',
        label: '飞书',
        description: '通过飞书机器人接收并回复用户消息',
        kind: 'qr-or-credentials',
        fields: [
            { key: 'appId', label: 'App ID' },
            { key: 'appSecret', label: 'App Secret', secret: true },
        ],
    },
};

export function listChannelMeta() {
    return CHANNEL_ORDER.map((id) => CHANNEL_META[id]);
}

export function supportsQr(id) {
    const kind = CHANNEL_META[id]?.kind;
    return kind === 'qr' || kind === 'qr-or-credentials';
}
