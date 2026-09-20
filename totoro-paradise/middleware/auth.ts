/**
 * 客户端路由守卫：token/scanned/run/account 页面需已登录账号（服务端 /api/totoro、/api/run 也有硬门禁）。
 * 登录功能停用期间（authEnabled=false）直接放行。
 */
export default defineNuxtRouteMiddleware(async (to) => {
  if (!['token', 'scanned', 'run-route', 'account'].includes(String(to.name))) return;

  // 登录功能停用：无账号概念，放行
  if (!useRuntimeConfig().public.authEnabled) return;

  try {
    const s = await $fetch<{ loggedIn: boolean }>('/api/auth/status');
    if (s?.loggedIn) return;
  } catch {
    /* 状态接口异常按未登录处理 */
  }
  return navigateTo('/');
});
