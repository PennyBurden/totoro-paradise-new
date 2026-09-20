/** 退出登录（登录功能停用期间为空操作） */
export default defineEventHandler((event) => {
  if (!useRuntimeConfig(event).public.authEnabled) return { ok: true, message: '已退出' };
  clearSession(event);
  return { ok: true, message: '已退出' };
});
