/** 管理端使用统计：访问量 + 正式跑人数/次数（今日/累计/近7天） */
import { isAdmin } from '../../utils/authStore';
import { getStatsSummary } from '../../utils/statsStore';

export default defineEventHandler((event) => {
  const adminKey = (getQuery(event).adminKey as string) || '';
  if (!isAdmin(adminKey)) {
    setResponseStatus(event, 403);
    return { ok: false, message: '管理口令错误' };
  }
  return { ok: true, stats: getStatsSummary() };
});
