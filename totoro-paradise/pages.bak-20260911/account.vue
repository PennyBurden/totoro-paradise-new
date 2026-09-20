<script setup lang="ts">
/**
 * 个人中心：账号信息、剩余次数、充值码兑换、退出登录。
 */
definePageMeta({ middleware: 'auth' });

const router = useRouter();
const status = ref<{ username: string; remaining: number; totalRuns: number; usedRuns: number } | null>(null);
const code = ref('');
const message = ref('');
const loading = ref(false);

onMounted(async () => {
  try {
    status.value = await $fetch('/api/auth/status');
  } catch {}
});

const recharge = async () => {
  if (!code.value.trim()) {
    message.value = '请输入充值码';
    return;
  }
  loading.value = true;
  message.value = '';
  try {
    const res = await $fetch<{ ok: boolean; message: string }>('/api/auth/recharge', {
      method: 'POST',
      body: { code: code.value.trim() },
    });
    message.value = res.message;
    if (res.ok) {
      code.value = '';
      status.value = await $fetch('/api/auth/status');
    }
  } catch (e: unknown) {
    const err = e as { data?: { message?: string } };
    message.value = err.data?.message ?? '充值失败';
  } finally {
    loading.value = false;
  }
};

const logout = async () => {
  await $fetch('/api/auth/logout', { method: 'POST' });
  router.push('/');
};
</script>

<template>
  <div class="mx-auto flex min-h-screen max-w-xl flex-col px-6 py-10">
    <NuxtLink to="/" class="text-lg font-bold no-underline">← 龙猫跑轮</NuxtLink>
    <h1 class="mt-10 text-3xl font-bold">个人中心</h1>
    <VCard class="mt-6" elevation="2">
      <VCardItem>
        <VCardTitle>{{ status?.username || '…' }}</VCardTitle>
        <template #append><VBtn size="small" variant="text" color="error" @click="logout">退出登录</VBtn></template>
      </VCardItem>
      <VCardText>
        <div class="flex items-baseline gap-2"><span class="text-4xl font-black text-primary">{{ status?.remaining ?? 0 }}</span><span class="text-sm opacity-70">次剩余（累计 {{ status?.totalRuns ?? 0 }} 次 / 已用 {{ status?.usedRuns ?? 0 }} 次）</span></div>
        <div class="mt-4"><VBtn to="/scanned" color="primary" variant="tonal">进入任务页</VBtn></div>
      </VCardText>
    </VCard>
    <VCard class="mt-6" elevation="1">
      <VCardItem><VCardTitle>充值码兑换</VCardTitle></VCardItem>
      <VCardText class="flex flex-col gap-3">
        <p class="text-sm opacity-70">购买后获得的充值码（形如 TP-XXXXX-XXXXX）在此兑换，次数自动充入账户。</p>
        <div class="flex gap-3">
          <VTextField v-model="code" label="充值码" variant="outlined" density="compact" class="text-uppercase" :disabled="loading" @keyup.enter="recharge" />
          <VBtn color="primary" :loading="loading" @click="recharge">兑换</VBtn>
        </div>
        <VAlert v-if="message" type="info" variant="tonal" density="compact">{{ message }}</VAlert>
        <p class="text-sm">没有充值码？<NuxtLink to="/purchase" class="underline">购买次数</NuxtLink></p>
      </VCardText>
    </VCard>
  </div>
</template>
