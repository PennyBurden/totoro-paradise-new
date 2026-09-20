<script setup lang="ts">
const mode = ref<'login' | 'register'>('login');
const username = ref('');
const password = ref('');
const message = ref('');
const loading = ref(false);
const showAuth = ref(false);
const loggedIn = ref(false);
const me = ref<{ username: string; remaining: number } | null>(null);

onMounted(async () => {
  try {
    const s = await $fetch<{ loggedIn: boolean; username: string; remaining: number }>('/api/auth/status');
    loggedIn.value = s.loggedIn;
    if (s.loggedIn) me.value = { username: s.username, remaining: s.remaining };
  } catch { loggedIn.value = false; }
});

const openAuth = () => { message.value = ''; showAuth.value = true; };
const closeAuth = () => { showAuth.value = false; };

const submit = async () => {
  if (!username.value.trim() || !password.value) { message.value = '请输入用户名和密码'; return; }
  loading.value = true;
  message.value = '';
  try {
    const api = mode.value === 'login' ? '/api/auth/login' : '/api/auth/register';
    const res = await $fetch<{ ok: boolean; message: string }>(api, { method: 'POST', body: { username: username.value.trim(), password: password.value } });
    if (!res.ok) { message.value = res.message; return; }
    const status = await $fetch<{ remaining: number }>('/api/auth/status');
    const raw = localStorage.getItem('totoroSession');
    let bound = false;
    try { bound = !!(raw && JSON.parse(raw).userInfo); } catch { /* 忽略旧缓存 */ }
    window.location.href = status.remaining <= 0 ? '/account' : bound ? '/scanned' : '/token';
  } catch (e: unknown) {
    message.value = (e as { data?: { message?: string } }).data?.message ?? '请求失败，请重试';
  } finally { loading.value = false; }
};

const logout = async () => {
  await $fetch('/api/auth/logout', { method: 'POST' });
  loggedIn.value = false;
  me.value = null;
  username.value = '';
  password.value = '';
};
</script>

<template>
  <div class="relative h-screen w-screen overflow-hidden">
    <img src="/images/purple-track-hero.png" alt="紫色塑胶跑道航拍" class="absolute inset-0 h-full w-full object-cover">
    <div class="absolute inset-0 from-black/60 via-black/40 to-purple-900/50 bg-gradient-to-br" />
    <nav class="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-8 py-5">
      <span class="text-lg text-white font-bold">龙猫跑轮</span>
      <NuxtLink to="/guide" class="nav-pill">使用说明</NuxtLink>
    </nav>
    <div class="relative z-10 h-full flex flex-col items-center justify-center px-6 text-center">
      <p class="hero-eyebrow"><span />简单 · 专注 · 即刻开始</p>
      <h1 class="whitespace-nowrap text-5xl text-white font-black leading-tight md:text-7xl">龙猫跑轮</h1>
      <p class="mt-5 max-w-2xl text-base text-white/75">把每一次校园跑变简单。</p>
      <a v-if="loggedIn && me" :href="me.remaining > 0 ? '/scanned' : '/account'" class="cta-btn mt-12">{{ me.remaining > 0 ? `进入系统 · 剩余 ${me.remaining} 次` : '兑换使用次数' }}</a>
      <button v-else class="cta-btn mt-12" @click="openAuth">登录 / 注册</button>
      <div v-if="loggedIn && me" class="mt-5 flex items-center gap-5 text-sm text-white/70">
        <a href="/account" class="glass-link">个人中心 / 兑换码</a>
        <a href="#" class="glass-link" @click.prevent="logout">退出登录</a>
      </div>
    </div>

    <Transition name="pop">
      <div v-if="showAuth" class="fixed inset-0 flex items-center justify-center bg-black/40 px-6 backdrop-blur-sm" style="z-index: 50" @click.self="closeAuth" @keyup.escape="closeAuth">
        <div class="glass relative max-w-sm w-full rounded-3xl p-8 text-white">
          <button class="close-btn" aria-label="关闭" @click="closeAuth">×</button>
          <h2 class="text-xl font-bold">{{ mode === 'login' ? '登录' : '注册账号' }}</h2>
          <p class="mb-6 mt-1 text-xs text-white/60">{{ mode === 'login' ? '使用你的账号登录后使用系统' : '注册后使用兑换码增加次数' }}</p>
          <form class="flex flex-col gap-3" @submit.prevent="submit">
            <input v-model="username" class="glass-input" type="text" placeholder="用户名" autocomplete="username" :disabled="loading">
            <input v-model="password" class="glass-input" type="password" placeholder="密码" :autocomplete="mode === 'login' ? 'current-password' : 'new-password'" :disabled="loading">
            <button class="glass-btn mt-2" type="submit" :disabled="loading">{{ loading ? '请稍候…' : mode === 'login' ? '登录' : '注册并登录' }}</button>
          </form>
          <p v-if="message" class="mt-3 text-xs text-red-200">{{ message }}</p>
          <div class="mt-5 text-xs text-white/70">
            <a href="#" class="glass-link" @click.prevent="mode = mode === 'login' ? 'register' : 'login'; message = ''">{{ mode === 'login' ? '没有账号？注册' : '已有账号？去登录' }}</a>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.hero-eyebrow { align-items: center; backdrop-filter: blur(14px); background: rgb(255 255 255 / 12%); border: 1px solid rgb(255 255 255 / 22%); border-radius: 999px; color: rgb(255 255 255 / 82%); display: inline-flex; font-size: 12px; font-weight: 600; gap: 9px; letter-spacing: .08em; margin: 0 0 18px; padding: 8px 14px; }.hero-eyebrow span { background: #7ee787; border-radius: 50%; box-shadow: 0 0 0 4px rgb(126 231 135 / 16%); height: 7px; width: 7px; }
.nav-pill { background: rgb(255 255 255 / 12%); border: 1px solid rgb(255 255 255 / 24%); border-radius: 9999px; color: #fff; font-size: 13px; font-weight: 600; padding: 8px 18px; text-decoration: none; transition: background 200ms ease, transform 200ms ease; }.nav-pill:hover { background: rgb(255 255 255 / 22%); transform: translateY(-1px); }
.cta-btn { background: #fff; border: 0; border-radius: 9999px; box-shadow: 0 16px 40px rgb(0 0 0 / 25%); color: #17111f; cursor: pointer; font-size: clamp(1rem, 2vw, 1.1rem); font-weight: 800; min-height: 3.4rem; padding: 0 2.6rem; text-decoration: none; transition: background 200ms ease, transform 200ms ease; }.cta-btn:hover { background: rgb(255 255 255 / 88%); transform: translateY(-2px); }
.glass { background: rgb(255 255 255 / 10%); border: 1px solid rgb(255 255 255 / 22%); border-radius: 28px; box-shadow: 0 24px 60px rgb(0 0 0 / 35%); backdrop-filter: blur(28px) saturate(160%); -webkit-backdrop-filter: blur(28px) saturate(160%); }.close-btn { background: rgb(255 255 255 / 12%); border: 1px solid rgb(255 255 255 / 22%); border-radius: 9999px; color: #fff; cursor: pointer; font-size: 18px; height: 32px; line-height: 1; position: absolute; right: 16px; top: 16px; width: 32px; }.close-btn:hover { background: rgb(255 255 255 / 22%); }
.glass-input { background: rgb(255 255 255 / 12%); border: 1px solid rgb(255 255 255 / 20%); border-radius: 14px; box-sizing: border-box; color: #fff; font-size: 15px; outline: none; padding: 13px 16px; transition: border-color 200ms ease, background 200ms ease; width: 100%; }.glass-input::placeholder { color: rgb(255 255 255 / 45%); }.glass-input:focus { background: rgb(255 255 255 / 18%); border-color: rgb(255 255 255 / 45%); }
.glass-btn { background: #fff; border: 0; border-radius: 14px; box-shadow: 0 10px 26px rgb(0 0 0 / 22%); color: #17111f; cursor: pointer; display: block; font-size: 15px; font-weight: 700; padding: 13px 16px; text-align: center; transition: background 200ms ease, transform 200ms ease; width: 100%; }.glass-btn:hover { background: rgb(255 255 255 / 88%); transform: translateY(-1px); }.glass-btn:disabled { cursor: wait; opacity: .7; }.glass-link { color: rgb(255 255 255 / 80%); text-decoration: none; }.glass-link:hover { color: #fff; text-decoration: underline; }
.pop-enter-active,.pop-leave-active { transition: opacity 260ms ease; }.pop-enter-active .glass,.pop-leave-active .glass { transition: transform 320ms cubic-bezier(.22,1,.36,1); }.pop-enter-from,.pop-leave-to { opacity: 0; }.pop-enter-from .glass { transform: scale(.92) translateY(12px); }
</style>
