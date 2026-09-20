/** 管理端充值码：GET ?adminKey= 列表 / POST { adminKey, count, runs } 生成 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const adminKey = (query.adminKey as string) || '';
  if (!isAdmin(adminKey)) {
    setResponseStatus(event, 403);
    return { ok: false, message: '管理口令错误' };
  }
  if (event.method === 'GET') {
    return { ok: true, codes: listRechargeCodes() };
  }
  const body = (await readBody<{ count?: number; runs?: number }>(event)) ?? {};
  const count = Math.min(Math.max(Number(body.count) || 1, 1), 100);
  const runs = Math.min(Math.max(Number(body.runs) || 1, 1), 10000);
  const made = createRechargeCodes(count, runs);
  return { ok: true, message: `已生成 ${made.length} 个充值码（每个 ${runs} 次）`, codes: made };
});
