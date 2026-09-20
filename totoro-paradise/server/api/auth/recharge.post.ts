/** 充值码兑换：登录后 { code } → 次数充入账户（登录功能停用期间返回 403） */
export default defineEventHandler(async (event) => {
  if (!useRuntimeConfig(event).public.authEnabled) {
    setResponseStatus(event, 403);
    return { ok: false, message: '登录功能已停用' };
  }
  const user = sessionUser(event);
  if (!user) {
    setResponseStatus(event, 401);
    return { ok: false, message: '请先登录' };
  }
  const body = (await readBody<{ code?: string }>(event)) ?? {};
  const res = redeemCode(user, body.code ?? '');
  if (!res.ok) setResponseStatus(event, 400);
  return res;
});
