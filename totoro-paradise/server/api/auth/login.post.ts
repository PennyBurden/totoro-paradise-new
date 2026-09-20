/** 用户登录：{ username, password } → 会话 Cookie（登录功能停用期间返回 403） */
export default defineEventHandler(async (event) => {
  if (!useRuntimeConfig(event).public.authEnabled) {
    setResponseStatus(event, 403);
    return { ok: false, message: '登录功能已停用' };
  }
  const body = (await readBody<{ username?: string; password?: string }>(event)) ?? {};
  const username = (body.username ?? '').trim();
  const user = verifyUser(username, body.password ?? '');
  if (!user) {
    setResponseStatus(event, 400);
    return { ok: false, message: '用户名或密码错误' };
  }
  issueSession(event, username);
  return { ok: true, message: '登录成功', username, remaining: remainingRuns(user) };
});
