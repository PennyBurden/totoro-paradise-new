<script setup lang="ts">
const CONTACT = {
  wechat: '微信号见站长主页',
  qq: 'QQ 号见站长主页',
  note: '添加时备注「龙猫」',
};
const plans = [
  { name: '体验卡', runs: 1, price: '¥3', highlight: false },
  { name: '次卡 · 10 次', runs: 10, price: '¥25', highlight: true },
  { name: '次卡 · 30 次', runs: 30, price: '¥60', highlight: false },
  { name: '学期卡 · 60 次', runs: 60, price: '¥99', highlight: false },
];
</script>

<template>
  <div class="mx-auto flex min-h-screen max-w-4xl flex-col px-6 py-10">
    <NuxtLink to="/" class="text-lg font-bold no-underline">← 龙猫跑轮</NuxtLink>
    <h1 class="mt-10 text-3xl font-bold">购买授权 / 跑步次数</h1>
    <p class="mt-2 text-sm opacity-70">注册账号 → 购买次数 → 充值码兑换到账；每次成功提交成绩消耗 1 次。</p>
    <div class="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
      <VCard v-for="p in plans" :key="p.name" :class="p.highlight ? 'border-2 border-primary' : ''" elevation="2">
        <VCardItem><VCardTitle class="text-base">{{ p.name }}</VCardTitle></VCardItem>
        <VCardText><div class="text-3xl font-black">{{ p.price }}</div><div class="mt-1 text-sm opacity-70">{{ p.runs }} 次跑步额度</div><div v-if="p.highlight" class="mt-2 text-xs text-primary">最受欢迎</div></VCardText>
      </VCard>
    </div>
    <VCard class="mt-10" elevation="1">
      <VCardItem><VCardTitle>如何购买</VCardTitle></VCardItem>
      <VCardText class="flex flex-col gap-2">
        <p>1. 通过以下方式联系站长，说明想要的套餐：</p>
        <p class="pl-4">微信：<b>{{ CONTACT.wechat }}</b>（{{ CONTACT.note }}）<br>QQ：<b>{{ CONTACT.qq }}</b></p>
        <p>2. 完成支付后，站长会发给你一个充值码（形如 TP-XXXXX-XXXXX）</p>
        <p>3. 登录你的账号，在「个人中心」输入充值码，次数自动到账</p>
      </VCardText>
      <VCardActions><VBtn color="primary" to="/account" variant="tonal">我已有充值码，去兑换</VBtn></VCardActions>
    </VCard>
    <p class="mt-8 text-xs opacity-50">购买前请确认所在学校使用龙猫跑轮系统。充值码一经使用不支持退换（未使用可联系站长处理）。</p>
  </div>
</template>
