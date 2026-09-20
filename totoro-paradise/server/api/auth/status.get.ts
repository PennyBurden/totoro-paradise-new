/** 当前会话状态：是否登录、剩余次数（登录功能停用期间恒为未登录） */
export default defineEventHandler((event) => {
  if (!useRuntimeConfig(event).public.authEnabled) return { loggedIn: false, username: '', remaining: 0 };
  const user = sessionUser(event);
  if (!user) return { loggedIn: false, username: '', remaining: 0 };
  return {
    loggedIn: true,
    username: user.username,
    totalRuns: user.totalRuns,
    usedRuns: user.usedRuns,
    remaining: remainingRuns(user),
  };
});
