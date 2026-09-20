<template>
  <div class="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-10">
    <NuxtLink to="/" class="text-lg font-bold no-underline">← 龙猫跑轮</NuxtLink>
    <h1 class="mt-10 text-3xl font-bold">使用说明</h1>
    <div class="mt-6 grid gap-4 md:grid-cols-3">
      <VCard v-for="(s, i) in [{ t: '登录账号', d: '登录已有账号，或注册一个新账号。' }, { t: '兑换次数', d: '在个人中心输入兑换码，次数会自动到账。' }, { t: '开始使用', d: '绑定账号后核对任务并选择路线。' }]" :key="s.t" elevation="2">
        <VCardItem><VCardTitle class="flex items-center gap-2 text-base"><span class="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-white">{{ i + 1 }}</span>{{ s.t }}</VCardTitle></VCardItem>
        <VCardText class="text-sm opacity-80">{{ s.d }}</VCardText>
      </VCard>
    </div>
  </div>
</template>
