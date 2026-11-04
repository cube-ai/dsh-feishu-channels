/** 飞书设备注册扫码，自动创建机器人。 */
import { asRecord, cleanString, readJson } from './shared.js';
import { decorateQrUrl } from '../feishu-app.js';

const FEISHU_ACCOUNTS = 'https://accounts.feishu.cn';

export function parseFeishuBegin(body, now = Date.now()) {
    const record = asRecord(body);
    const err = cleanString(record.error);
    if (err)
        throw new Error(`飞书注册开始失败：${err}`);
    const deviceCode = cleanString(record.device_code);
    const qrUrl = cleanString(record.verification_uri_complete);
    if (!deviceCode || !qrUrl)
        throw new Error('飞书注册没有返回完整二维码');
    const expiresIn = Number(record.expire_in ?? record.expires_in);
    const interval = Number(record.interval);
    return {
        deviceCode,
        qrUrl,
        expiresAt: now + (Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 300) * 1000,
        pollIntervalMs: (Number.isFinite(interval) && interval > 0 ? interval : 5) * 1000,
    };
}

export function parseFeishuPoll(body) {
    const record = asRecord(body);
    const userInfo = asRecord(record.user_info);
    const brand = cleanString(userInfo.tenant_brand);
    if (brand?.toLowerCase() === 'lark')
        return { status: 'failed', error: '检测到 Lark 账号；本插件仅支持飞书账号。' };
    const appId = cleanString(record.client_id);
    const appSecret = cleanString(record.client_secret);
    if (appId && appSecret) {
        const ownerOpenId = cleanString(userInfo.open_id);
        return {
            status: 'success',
            credentials: ownerOpenId ? { appId, appSecret, ownerOpenId } : { appId, appSecret },
        };
    }
    const err = cleanString(record.error);
    if (err === 'authorization_pending')
        return { status: 'waiting' };
    if (err === 'slow_down')
        return { status: 'waiting', pollIntervalMs: 10_000 };
    if (err === 'access_denied')
        return { status: 'failed', error: '用户拒绝授权' };
    if (err === 'expired_token')
        return { status: 'expired', error: '二维码已过期' };
    if (err)
        return { status: 'failed', error: err };
    return { status: 'waiting' };
}

async function call(action, params, signal) {
    const form = new URLSearchParams({ action, ...params });
    const response = await fetch(`${FEISHU_ACCOUNTS}/oauth/v1/app/registration`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
        redirect: 'error',
        signal: signal ?? AbortSignal.timeout(15_000),
    });
    return readJson(response, `飞书${action}`);
}

export async function beginFeishuQr(options = {}, signal) {
    if (options && typeof options.aborted === 'boolean') {
        signal = options;
        options = {};
    }
    await call('init', {}, signal);
    const begun = parseFeishuBegin(await call('begin', {
        archetype: 'PersonalAgent',
        auth_method: 'client_secret',
        request_user_info: 'open_id',
    }, signal));
    return {
        qrUrl: decorateQrUrl(begun.qrUrl, { name: options?.name ?? options?.__setting_name }),
        expiresAt: begun.expiresAt,
        pollIntervalMs: begun.pollIntervalMs,
        poll: async (pollSignal) => parseFeishuPoll(await call('poll', { device_code: begun.deviceCode }, pollSignal)),
    };
}
