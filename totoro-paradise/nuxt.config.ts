import vuetify from 'vite-plugin-vuetify';
import inject from '@rollup/plugin-inject';

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  pages: true,
  ssr: false,
  css: ['~/assets/css/kit.css'],
  runtimeConfig: {
    public: {
      /**
       * 网站账号登录功能总开关。
       * false = 登录/注册 UI 下线、路由守卫与 /api/totoro 门禁放行、
       *        /api/auth/* 返回停用（代码保留，改回 true 即恢复）。
       */
      authEnabled: false,
    },
  },
  app: {
    pageTransition: { name: 'tp', mode: 'out-in' },
  },
  vite: {
    build: { commonjsOptions: { transformMixedEsModules: true } },
    resolve: { alias: { buffer: 'buffer' } },
    plugins: [inject({ Buffer: ['buffer', 'Buffer'] })],
    ssr: { noExternal: ['vuetify'] },
    optimizeDeps: {
      include: ['@vueuse/core', 'date-fns', 'uuid', 'md5', '@amap/amap-jsapi-loader'],
    },
  },
  build: {
    transpile: ['vuetify'],
  },
  modules: [
    '@unocss/nuxt',
    async (options, nuxt) => {
      nuxt.hooks.hook('vite:extendConfig', (config) => {
        if (!config.plugins) config.plugins = [];
        config.plugins.push(vuetify({ autoImport: true }));
      });
    },
  ],
});
