/**
 * POST /api/stats/visit —— 访问信标（前端每浏览器会话上报一次，无鉴权）。
 * 记录访问量 + 来源 IP/UA 明细（仅后台可见，保留 30 天）。
 */
import { recordVisit } from '../../utils/statsStore';
import { getClientIp } from '../../utils/clientIp';

export default defineEventHandler((event) => {
  recordVisit(getClientIp(event), getHeader(event, 'user-agent') ?? '');
  return { ok: true };
});
