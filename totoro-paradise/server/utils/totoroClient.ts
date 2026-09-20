/**
 * 服务端直连龙猫接口的轻量客户端 —— 供跑步引擎使用。
 *
 * 请求头语义与 server/api/totoro/[...slug].ts 代理层完全一致
 * （🔬 对齐 capture.log 实抓：全小写 content-type + charset + Referer + 真机微信 UA +
 *   Authorization: Bearer），保证服务端发起的请求与真机/代理流量画像一致。
 * 区别：不做额度扣减（由引擎在成功回调里处理），不写调试文件。
 */
import type { Device } from '../../src/utils/device';

export const DEFAULT_TOTORO_HOST = 'https://wxxcx.xtotoro.com';

export interface TotoroContext {
  token: string;
  host: string;
  device: Device;
}

const buildHeaders = (ctx: TotoroContext): Record<string, string> => ({
  'content-type': 'application/json;charset=UTF-8',
  charset: 'utf-8',
  Authorization: `Bearer ${ctx.token}`,
  Referer: 'https://servicewechat.com/wx8e8598deed63f9b1/65/page-frame.html',
  'User-Agent': ctx.device.ua,
  'Accept-Encoding': 'gzip, deflate, br',
});

/** POST /wxxcx/<path>，body 为普通对象；非 2xx 抛错 */
export const totoroPost = async <T = Record<string, unknown>>(
  ctx: TotoroContext,
  path: string,
  body: Record<string, unknown> = {},
): Promise<T> => {
  const host = (ctx.host || DEFAULT_TOTORO_HOST).replace(/\/$/, '');
  const res = await fetch(`${host}/wxxcx/${path}`, {
    method: 'POST',
    headers: buildHeaders(ctx),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`龙猫接口 ${path} HTTP ${res.status}`);
  return res.json() as Promise<T>;
};

/** GET /wxxcx/<path>（GetStudentInfoByToken 等 A 型接口） */
export const totoroGet = async <T = Record<string, unknown>>(
  ctx: TotoroContext,
  path: string,
): Promise<T> => {
  const host = (ctx.host || DEFAULT_TOTORO_HOST).replace(/\/$/, '');
  const res = await fetch(`${host}/wxxcx/${path}`, { headers: buildHeaders(ctx) });
  if (!res.ok) throw new Error(`龙猫接口 ${path} HTTP ${res.status}`);
  return res.json() as Promise<T>;
};
