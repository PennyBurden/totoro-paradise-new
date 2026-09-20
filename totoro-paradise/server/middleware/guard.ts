/**
 * 服务端门禁：/api/totoro/**（业务代理）必须已登录账号。
 *  - 未登录 → 401（前端跳登录页）
 *  - 起跑/提交次数不足 → 402（前端引导购买/充值）
 * 次数扣减在代理成功响应后由 [...slug].ts 完成。
 *
 * 登录功能停用期间（authEnabled=false）放行——核心跑步已由 /api/run
 * 服务端引擎承载，代理仅供任务列表等只读接口使用。
 */
import { remainingRuns, sessionUser } from '../utils/authStore';

export default defineEventHandler(async (event) => {
  if (!event.path.startsWith('/api/totoro/')) return;

  if (!useRuntimeConfig(event).public.authEnabled) return;

  const user = sessionUser(event);
  if (!user) {
    setResponseStatus(event, 401);
    return { error: '请先登录', needLogin: true };
  }
  const needsRunCredit = /\/sunrun\/(getRunBegin|sunRunExercises)$/.test(event.path);
  if (needsRunCredit && remainingRuns(user) <= 0) {
    setResponseStatus(event, 402);
    return { error: '跑步次数不足，请兑换新的兑换码', noRuns: true };
  }
});
