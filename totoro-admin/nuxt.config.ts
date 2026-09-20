// 独立后台管理系统：通过代理调用主站 /api/admin/*（生产环境可用 NUXT_MAIN_URL 覆盖）
export default defineNuxtConfig({
  ssr: false,
  runtimeConfig: {
    mainUrl: process.env.MAIN_URL ?? 'http://127.0.0.1:3000',
  },
});
