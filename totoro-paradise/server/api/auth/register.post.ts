/** 用户注册：{ username, password } → 注册并直接登录（登录功能停用期间返回 403） */
export default defineEventHandler(async (event) => {
  if (!useRuntimeConfig(event).public.authEnabled) {
    setResponseStatus(event, 403);
    return { ok: false, message: '登录功能已停用' };
  }
  const body = (await readBody<{ username?: string; password?: string }>(event)) ?? {};
  const res = createUser((body.username ?? '').trim(), body.password ?? '');
  if (!res.ok) {
    setResponseStatus(event, 400);
    return { ok: false, message: res.message };
  }
  issueSession(event, (body.username ?? '').trim());
  return { ok: true, message: '注册成功，已自动登录' };
});
