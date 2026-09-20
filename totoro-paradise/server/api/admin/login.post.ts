/** 管理员登录：默认用户名 admin，密码为原管理口令；可通过环境变量覆盖。 */
export default defineEventHandler(async (event) => {
  const body = (await readBody<{ username?: string; password?: string }>(event)) ?? {};
  const username = (body.username ?? '').trim();
  if (!verifyAdminCredentials(username, body.password ?? '')) {
    setResponseStatus(event, 401);
    return { ok: false, message: '用户名或密码错误' };
  }
  return { ok: true, message: '登录成功', username, adminKey: getAdminKey() };
});
