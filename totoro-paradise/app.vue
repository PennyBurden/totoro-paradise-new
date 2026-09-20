<script setup lang="ts">
useHead({
  title: '龙猫跑轮',
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    { name: 'theme-color', content: '#fafafa' },
  ],
});

// 访问统计信标：每浏览器会话仅上报一次
onMounted(() => {
  try {
    if (sessionStorage.getItem('totoroVisitLogged')) return;
    sessionStorage.setItem('totoroVisitLogged', '1');
    $fetch('/api/stats/visit', { method: 'POST' }).catch(() => {});
  } catch {
    /* 隐私模式等场景静默跳过 */
  }
});
</script>
<script lang="ts">
window.global = window;
</script>
<template>
  <ClickSpark
    spark-color="#c979e9"
    :spark-size="36"
    :spark-radius="180"
    :spark-count="19"
    :duration="400"
  >
    <NuxtPage />
    <!-- 全局帮助：右下角悬浮钮 + 快速引导弹窗（全站常驻，不遮挡内容） -->
    <GlobalHelp />
    <!-- 全局邀请：悬浮钮 + 分享海报弹窗（纯前端分享号召，与帮助钮并排） -->
    <GlobalInvite />
  </ClickSpark>
</template>

<style>
html { scroll-behavior: smooth; }
html, body, #__nuxt { min-height: 100%; }
body {
  margin: 0;
  overflow-x: hidden;
  background: #f5f5f7;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  -webkit-tap-highlight-color: transparent;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
}
* { box-sizing: border-box; }
::selection { background: rgba(0, 113, 227, 0.18); }

/* 页面切换（apple.com 式轻微上移淡入） */
.tp-enter-active,
.tp-leave-active { transition: opacity 260ms var(--tp-ease, ease), transform 260ms var(--tp-ease, ease); }
.tp-enter-from { opacity: 0; transform: translateY(10px); }
.tp-leave-to { opacity: 0; transform: translateY(-6px); }
@media (prefers-reduced-motion: reduce) {
  .tp-enter-active,
  .tp-leave-active { transition: opacity 0.01ms; }
  .tp-enter-from,
  .tp-leave-to { transform: none; }
}
</style>
