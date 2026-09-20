<script setup lang="ts">
/**
 * 个人中心：账号信息、剩余次数、充值码兑换、退出登录。
 */
definePageMeta({ middleware: 'auth' });

// 登录功能停用期间本页无意义，重定向到龙猫ID绑定页
if (!useRuntimeConfig().public.authEnabled) {
  await navigateTo('/token', { replace: true });
}

const router = useRouter();
const status = ref<{ username: string; remaining: number; totalRuns: number; usedRuns: number } | null>(null);
const code = ref('');
const message = ref('');
const messageKind = ref<'ok' | 'err' | ''>('');
const loading = ref(false);

/* 头像字符：用户名首字符（无则 "U"） */
const avatarChar = computed(() => status.value?.username?.trim().charAt(0) || 'U');

onMounted(async () => {
  try {
    status.value = await $fetch('/api/auth/status');
  } catch {}
});

const recharge = async () => {
  if (!code.value.trim()) {
    message.value = '请输入充值码';
    messageKind.value = 'err';
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
    messageKind.value = res.ok ? 'ok' : 'err';
    if (res.ok) {
      code.value = '';
      status.value = await $fetch('/api/auth/status');
    }
  } catch (e: unknown) {
    const err = e as { data?: { message?: string } };
    message.value = err.data?.message ?? '充值失败';
    messageKind.value = 'err';
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
  <div class="tp-page">
    <header class="tp-nav">
      <div class="tp-nav-side">
        <NuxtLink to="/" class="tp-back">‹ 返回首页</NuxtLink>
      </div>
    </header>

    <main class="acct-main">
      <h1 class="tp-title acct-title tp-rise">个人中心</h1>

      <!-- 账号 -->
      <section class="tp-card tp-card--pad acct-card tp-rise" aria-label="账号信息">
        <div class="acct-avatar" aria-hidden="true">{{ avatarChar }}</div>
        <div class="acct-who">
          <p class="acct-name">{{ status?.username || '…' }}</p>
          <p class="acct-meta tp-num">累计 {{ status?.totalRuns ?? 0 }} 次 · 已用 {{ status?.usedRuns ?? 0 }} 次</p>
        </div>
        <button type="button" class="tp-quiet tp-quiet--danger acct-logout" @click="logout">退出登录</button>
      </section>

      <!-- 剩余次数 -->
      <section class="tp-card tp-card--pad acct-count tp-rise-2" aria-label="剩余次数">
        <p class="acct-count-num tp-num">{{ status?.remaining ?? 0 }}</p>
        <p class="acct-count-label">次剩余</p>
        <NuxtLink to="/scanned" class="tp-cta acct-cta">进入任务页</NuxtLink>
      </section>

      <!-- 充值码兑换 -->
      <section class="tp-card tp-card--pad acct-redeem-card tp-rise-3">
        <h2 class="tp-group-label acct-group">充值码兑换</h2>
        <p class="acct-hint">购买后获得的充值码（形如 TP-XXXXX-XXXXX）在此兑换，次数自动充入账户。</p>
        <div class="acct-redeem">
          <input
            v-model="code"
            type="text"
            class="tp-input acct-code"
            placeholder="充值码"
            aria-label="充值码"
            autocomplete="off"
            spellcheck="false"
            :disabled="loading"
            @keyup.enter="recharge"
          />
          <button type="button" class="tp-cta tp-cta--sm acct-redeem-btn" :disabled="loading" @click="recharge">
            {{ loading ? '···' : '兑换' }}
          </button>
        </div>
        <p v-if="message" class="tp-msg acct-msg" :class="messageKind === 'ok' ? 'tp-msg--ok' : 'tp-msg--err'" role="status">
          {{ message }}
        </p>
        <p class="acct-buy">没有充值码？<NuxtLink to="/purchase" class="tp-link">购买次数</NuxtLink></p>
      </section>
    </main>
  </div>
</template>

<style scoped>
.acct-main {
  padding-top: 30px;
}

.acct-title {
  margin: 0 0 22px;
}

/* ---------- 账号卡 ---------- */

.acct-card {
  align-items: center;
  display: flex;
  gap: 16px;
}

.acct-avatar {
  align-items: center;
  background: var(--tp-blue);
  border-radius: 50%;
  color: var(--tp-surface);
  display: flex;
  flex-shrink: 0;
  font-size: 22px;
  font-weight: 700;
  height: 52px;
  justify-content: center;
  width: 52px;
}

.acct-who {
  flex: 1;
  min-width: 0;
}

.acct-name {
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.01em;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.acct-meta {
  color: var(--tp-text-2);
  font-size: 13px;
  margin: 4px 0 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.acct-logout {
  flex-shrink: 0;
}

/* ---------- 次数卡 ---------- */

.acct-count {
  padding-bottom: 28px;
  padding-top: 28px;
  text-align: center;
}

.acct-count-num {
  font-size: 64px;
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1;
  margin: 0;
}

.acct-count-label {
  color: var(--tp-text-2);
  font-size: 15px;
  margin: 10px 0 0;
}

.acct-cta {
  margin-top: 24px;
  min-width: 220px;
}

/* ---------- 兑换卡 ---------- */

.acct-redeem-card .acct-group {
  padding-top: 0;
}

.acct-hint {
  color: var(--tp-text-2);
  font-size: 13px;
  line-height: 1.55;
  margin: 4px 0 15px;
}

.acct-redeem {
  align-items: stretch;
  display: flex;
  gap: 10px;
}

.acct-code {
  flex: 1;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  letter-spacing: 0.05em;
  min-width: 0;
  text-transform: uppercase;
}

.acct-code:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.acct-redeem-btn {
  flex-shrink: 0;
}

.acct-msg {
  margin: 12px 0 0;
}

.acct-buy {
  color: var(--tp-text-2);
  font-size: 14px;
  margin: 15px 0 0;
}

/* ---------- 移动端 ---------- */

@media (max-width: 560px) {
  .acct-main {
    padding-top: 22px;
  }

  .acct-title {
    margin-bottom: 16px;
  }

  .acct-card {
    gap: 13px;
  }

  .acct-count-num {
    font-size: 56px;
  }

  .acct-cta {
    min-width: 0;
    width: 100%;
  }

  .acct-redeem-btn {
    padding: 0 18px;
  }
}
</style>
