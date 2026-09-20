/** 管理端用户：GET 列表 / POST action=create 创建用户，action=quota 调整额度 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const adminKey = (query.adminKey as string) || '';
  if (!isAdmin(adminKey)) {
    setResponseStatus(event, 403);
    return { ok: false, message: '管理口令错误' };
  }
  if (event.method === 'GET') {
    return { ok: true, users: listUsers() };
  }
  const body = (await readBody<{ action?: 'create' | 'quota'; username?: string; password?: string; runs?: number }>(event)) ?? {};
  const username = (body.username ?? '').trim();
  const runs = Math.min(Math.max(Number(body.runs) || 0, -10000), 10000);
  if (body.action === 'create') {
    const res = createUser(username, body.password ?? '');
    if (!res.ok) {
      setResponseStatus(event, 400);
      return res;
    }
    if (runs > 0) adminCharge(username, runs);
    return { ok: true, message: runs > 0 ? `用户 ${username} 已创建，初始额度 ${runs} 次` : `用户 ${username} 已创建` };
  }
  if (!username || !runs) {
    setResponseStatus(event, 400);
    return { ok: false, message: '请填写用户名和非零次数' };
  }
  const res = adminCharge(username, runs);
  if (!res.ok) setResponseStatus(event, 404);
  return res;
});
