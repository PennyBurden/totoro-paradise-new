<script setup lang="ts">
const mode = ref<'login' | 'register'>('login');
const username = ref('');
const password = ref('');
const message = ref('');
const loading = ref(false);
const showAuth = ref(false);
const loggedIn = ref(false);
const me = ref<{ username: string; remaining: number } | null>(null);
// 账号登录功能开关：false 时登录 UI 全部下线，CTA 直达龙猫ID绑定页
const authEnabled = useRuntimeConfig().public.authEnabled;

onMounted(async () => {
  if (!authEnabled) return;
  try {
    const s = await $fetch<{ loggedIn: boolean; username: string; remaining: number }>('/api/auth/status');
    loggedIn.value = s.loggedIn;
    if (s.loggedIn) me.value = { username: s.username, remaining: s.remaining };
  } catch { loggedIn.value = false; }
});

const openAuth = () => { message.value = ''; showAuth.value = true; };
const closeAuth = () => { showAuth.value = false; };

// Esc 关闭弹窗（Vue 3.4 不支持 @keydown.escape.window 修饰符，改为手动监听）
const onMaskKeydown = (e: KeyboardEvent) => { if (e.key === 'Escape' && showAuth.value) closeAuth(); };
onMounted(() => window.addEventListener('keydown', onMaskKeydown));
onUnmounted(() => window.removeEventListener('keydown', onMaskKeydown));

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
  <div class="hero">
    <img src="/images/purple-track-hero.png" alt="紫色塑胶跑道航拍" class="hero-media">
    <div class="hero-shade" aria-hidden="true" />

    <header class="hero-nav">
      <span class="hero-brand">龙猫跑轮</span>
    </header>

    <main class="hero-body">
      <h1 class="hero-title hero-title--stroke">
        <StrokeText
          text="龙猫跑轮"
          stroke-color="#A78BFA"
          fill-color="#F8FAFC"
          :stroke-width="2"
          :draw-duration="1.8"
          :fill-delay="0.3"
          :stagger="0.08"
          :font-size="128"
          :font-weight="700"
          :letter-spacing="14"
          trigger="mount"
          fill-mode="wipe"
        />
      </h1>
      <p class="hero-sub hero-in hero-in--3">把每一次校园跑变简单。</p>

      <a v-if="!authEnabled" href="/token" class="tp-cta hero-cta hero-in hero-in--4">开始使用</a>
      <a v-else-if="loggedIn && me" :href="me.remaining > 0 ? '/scanned' : '/account'" class="tp-cta hero-cta hero-in hero-in--4">{{ me.remaining > 0 ? `进入系统 · 剩余 ${me.remaining} 次` : '兑换使用次数' }}</a>
      <button v-else class="tp-cta hero-cta hero-in hero-in--4" @click="openAuth">登录 / 注册</button>

      <!-- 常驻使用说明入口；登录功能开启且已登录时追加账号相关链接 -->
      <div class="hero-links hero-in hero-in--5">
        <a href="/guide" class="hero-link">不会使用？查看使用说明</a>
        <template v-if="authEnabled && loggedIn && me">
          <a href="/account" class="hero-link">个人中心 / 兑换码</a>
          <a href="#" class="hero-link" @click.prevent="logout">退出登录</a>
        </template>
      </div>

      <!-- 使用说明：三步开始（中心显著位置） -->
      <section class="hero-steps hero-in hero-in--6" aria-label="使用说明">
        <h2 class="hero-steps__title">使用说明 · 三步开始</h2>
        <ol class="hero-steps__list">
          <li class="hero-step">
            <span class="hero-step__no">1</span>
            <div class="hero-step__body">
              <h3 class="hero-step__name">注册小程序</h3>
              <p class="hero-step__desc">打开微信，搜索「龙猫体育锻炼」小程序；先在手机端完成注册并上传人脸信息。</p>
            </div>
          </li>
          <li class="hero-step">
            <span class="hero-step__no">2</span>
            <div class="hero-step__body">
              <h3 class="hero-step__name">获取龙猫ID</h3>
              <p class="hero-step__desc">在电脑上运行「获取龙猫ID」工具，获取成功后复制终端中显示的龙猫ID。</p>
            </div>
          </li>
          <li class="hero-step">
            <span class="hero-step__no">3</span>
            <div class="hero-step__body">
              <h3 class="hero-step__name">登录开跑</h3>
              <p class="hero-step__desc">回到本站{{ authEnabled ? '登录账号，' : '' }}粘贴龙猫ID完成绑定，开始你的校园跑。</p>
            </div>
          </li>
        </ol>
        <p class="hero-steps__note">本项目仅供学习交流，禁止用于任何其他用途</p>
      </section>
    </main>

    <p class="hero-foot">建议使用电脑浏览器访问</p>

    <Transition name="pop">
      <div v-if="showAuth" class="auth-mask" @click.self="closeAuth">
        <div class="auth-card" role="dialog" aria-modal="true" aria-labelledby="auth-dialog-title">
          <button class="auth-close" aria-label="关闭" @click="closeAuth">×</button>
          <h2 id="auth-dialog-title" class="auth-title">{{ mode === 'login' ? '登录' : '注册账号' }}</h2>
          <p class="auth-desc">{{ mode === 'login' ? '使用你的账号登录后使用系统' : '注册后使用兑换码增加次数' }}</p>
          <form class="auth-form" @submit.prevent="submit">
            <input v-model="username" class="auth-input" type="text" placeholder="用户名" aria-label="用户名" autocomplete="username" :disabled="loading">
            <input v-model="password" class="auth-input" type="password" placeholder="密码" aria-label="密码" :autocomplete="mode === 'login' ? 'current-password' : 'new-password'" :disabled="loading">
            <button class="tp-cta tp-cta--block auth-submit" type="submit" :disabled="loading">{{ loading ? '请稍候…' : mode === 'login' ? '登录' : '注册并登录' }}</button>
          </form>
          <p v-if="message" class="auth-error" role="alert">{{ message }}</p>
          <div class="auth-switch-row">
            <a href="#" class="auth-switch" @click.prevent="mode = mode === 'login' ? 'register' : 'login'; message = ''">{{ mode === 'login' ? '没有账号？注册' : '已有账号？去登录' }}</a>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* ---------- 全屏 hero 骨架（一屏，无滚动） ---------- */

.hero {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  min-height: 100dvh;
  position: relative;
  width: 100%;
}

.hero-media {
  height: 100%;
  inset: 0;
  object-fit: cover;
  position: absolute;
  user-select: none;
  width: 100%;
}

/* 电影感压暗：上 black/50 → 透明 → 下 black/60，中部轻铺一层保证主体可读 */
.hero-shade {
  background:
    linear-gradient(180deg, rgba(0, 0, 0, 0.5) 0%, rgba(0, 0, 0, 0) 30%, rgba(0, 0, 0, 0) 56%, rgba(0, 0, 0, 0.6) 100%),
    linear-gradient(180deg, rgba(0, 0, 0, 0.16), rgba(0, 0, 0, 0.16));
  inset: 0;
  position: absolute;
}

/* ---------- 顶部导航（不吸顶） ---------- */

.hero-nav {
  align-items: center;
  display: flex;
  justify-content: space-between;
  padding: 22px clamp(20px, 4vw, 44px);
  position: relative;
  z-index: 2;
}

.hero-brand {
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.01em;
}

/* ---------- 居中主体 ---------- */

.hero-body {
  align-items: center;
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: center;
  padding: 0 24px 3vh;
  position: relative;
  text-align: center;
  z-index: 2;
}

.hero-title {
  color: #fff;
  font-size: clamp(44px, 8vw, 76px);
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.04;
  margin: 0;
  text-shadow: 0 2px 28px rgba(0, 0, 0, 0.35);
}

/* 描边书写版标题:SVG 按宽度等比缩放,用 max-width 控制最终字号 */
.hero-title--stroke {
  margin: 0 auto;
  max-width: 470px;
  text-shadow: none;
  width: 100%;
}

.hero-sub {
  color: rgba(255, 255, 255, 0.75);
  font-size: clamp(17px, 2.6vw, 19px);
  font-weight: 500;
  letter-spacing: -0.01em;
  line-height: 1.5;
  margin: 20px 0 0;
  max-width: 560px;
  text-shadow: 0 1px 16px rgba(0, 0, 0, 0.32);
}

/* 主 CTA：kit 的 tp-cta 蓝色胶囊（apple.com 压图 hero 为纯平无投影） */
.hero-cta {
  margin-top: 46px;
  padding: 0 34px;
}

.hero-cta:active { transform: scale(0.985); }

.hero-links {
  align-items: center;
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-top: 22px;
}

.hero-link {
  -webkit-backdrop-filter: blur(14px) saturate(160%);
  backdrop-filter: blur(14px) saturate(160%);
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 999px;
  color: rgba(255, 255, 255, 0.85);
  font-size: 14px;
  font-weight: 500;
  padding: 11px 18px;
  text-decoration: none;
  transition: background var(--tp-dur) var(--tp-ease), border-color var(--tp-dur) var(--tp-ease), color var(--tp-dur) var(--tp-ease);
}

.hero-link:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.3);
  color: #fff;
}

/* ---------- 使用说明面板（hero 中央三步玻璃卡） ---------- */

.hero-steps {
  -webkit-backdrop-filter: blur(28px) saturate(160%);
  backdrop-filter: blur(28px) saturate(160%);
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: var(--tp-radius-card);
  box-shadow: var(--tp-shadow-float);
  margin-top: 44px;
  max-width: 880px;
  padding: 24px 28px 20px;
  text-align: left;
  width: 100%;
}

.hero-steps__title {
  color: rgba(255, 255, 255, 0.85);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.08em;
  margin: 0 0 16px;
  text-align: center;
}

.hero-steps__list {
  display: grid;
  gap: 18px;
  grid-template-columns: repeat(3, 1fr);
  list-style: none;
  margin: 0;
  padding: 0;
}

.hero-step {
  align-items: flex-start;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* 列间细分隔线（apple.com 网格卡惯用） */
.hero-step + .hero-step { border-left: 1px solid rgba(255, 255, 255, 0.14); padding-left: 18px; }

.hero-step__no {
  align-items: center;
  background: rgba(255, 255, 255, 0.16);
  border: 1px solid rgba(255, 255, 255, 0.28);
  border-radius: 999px;
  color: #fff;
  display: flex;
  flex: none;
  font-size: 14px;
  font-weight: 700;
  height: 32px;
  justify-content: center;
  width: 32px;
}

.hero-step__name {
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.01em;
  margin: 0;
}

.hero-step__desc {
  color: rgba(255, 255, 255, 0.78);
  font-size: 13px;
  line-height: 1.6;
  margin: 0;
  text-shadow: 0 1px 8px rgba(0, 0, 0, 0.25);
}

.hero-steps__note {
  border-top: 1px solid rgba(255, 255, 255, 0.14);
  color: rgba(255, 255, 255, 0.62);
  font-size: 12px;
  letter-spacing: 0.02em;
  margin: 18px 0 0;
  padding-top: 14px;
  text-align: center;
}

/* 底部极弱提示 */
.hero-foot {
  color: rgba(255, 255, 255, 0.66);
  text-shadow: 0 1px 8px rgba(0, 0, 0, 0.4);
  font-size: 12px;
  letter-spacing: 0.02em;
  margin: 0;
  padding: 0 24px 22px;
  position: relative;
  text-align: center;
  z-index: 2;
}

/* ---------- 登录 / 注册弹窗 ---------- */

.auth-mask {
  align-items: center;
  -webkit-backdrop-filter: blur(16px);
  backdrop-filter: blur(16px);
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  inset: 0;
  justify-content: center;
  overflow-y: auto;
  padding: 24px;
  position: fixed;
  z-index: 50;
}

.auth-card {
  -webkit-backdrop-filter: blur(28px) saturate(160%);
  backdrop-filter: blur(28px) saturate(160%);
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: var(--tp-radius-card);
  box-shadow: var(--tp-shadow-float);
  color: #fff;
  max-height: calc(100dvh - 36px);
  max-width: 384px;
  overflow-y: auto;
  padding: 28px;
  position: relative;
  width: 100%;
}

.auth-close {
  align-items: center;
  background: rgba(255, 255, 255, 0.12);
  border: 0;
  border-radius: 999px;
  color: #fff;
  cursor: pointer;
  display: flex;
  font-size: 20px;
  height: 44px;
  justify-content: center;
  line-height: 1;
  position: absolute;
  right: 14px;
  top: 14px;
  transition: background var(--tp-dur) var(--tp-ease);
  width: 44px;
}

.auth-close:hover { background: rgba(255, 255, 255, 0.24); }

.auth-title {
  font-size: 21px;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin: 0;
}

.auth-desc {
  color: rgba(255, 255, 255, 0.6);
  font-size: 13px;
  margin: 6px 0 22px;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.auth-input {
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: var(--tp-radius-control);
  caret-color: #fff;
  color: #fff;
  font-family: inherit;
  font-size: 15px;
  outline: none;
  padding: 13px 16px;
  transition: border-color 160ms ease, background 160ms ease, box-shadow 160ms ease;
  width: 100%;
}

.auth-input::placeholder { color: rgba(255, 255, 255, 0.45); }

.auth-input:focus {
  background: rgba(255, 255, 255, 0.17);
  border-color: rgba(255, 255, 255, 0.45);
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.12);
}

/* webkit 自动填充去黄底（深色玻璃上压黑罩） */
.auth-input:-webkit-autofill {
  -webkit-box-shadow: 0 0 0 60px rgba(0, 0, 0, 0.55) inset;
  -webkit-text-fill-color: #fff;
}

.auth-submit { margin-top: 6px; }

/* 深底可读的错误提示（简报指定色） */
.auth-error {
  color: #ff6b6b;
  font-size: 13px;
  line-height: 1.5;
  margin: 12px 0 0;
}

.auth-switch-row { margin-top: 20px; text-align: center; }

.auth-switch {
  color: rgba(255, 255, 255, 0.75);
  display: inline-block;
  font-size: 12px;
  padding: 10px 8px;
  text-decoration: none;
}

.auth-switch:hover { color: #fff; text-decoration: underline; }

/* ---------- pop 过渡（scale 0.94→1 + fade） ---------- */

.pop-enter-active,
.pop-leave-active { transition: opacity 300ms ease; }

.pop-enter-active .auth-card,
.pop-leave-active .auth-card {
  transition: transform 420ms var(--tp-ease), opacity 420ms var(--tp-ease);
}

.pop-enter-from,
.pop-leave-to { opacity: 0; }

.pop-enter-from .auth-card { transform: scale(0.94) translateY(12px); }
.pop-leave-to .auth-card { transform: scale(0.97); }

/* ---------- 焦点态（深色页面用白色环，宽度沿用 kit） ---------- */

.hero-link:focus-visible,
.auth-close:focus-visible,
.auth-switch:focus-visible,
.auth-input:focus-visible {
  outline: 3px solid rgba(255, 255, 255, 0.65);
  outline-offset: 2px;
}

.hero-cta:focus-visible,
.auth-submit:focus-visible { outline-color: rgba(255, 255, 255, 0.65); }

/* ---------- hero 入场（逐级上浮淡入，标题 200ms） ---------- */

@keyframes hero-in {
  from { opacity: 0; transform: translateY(24px); }
  to { opacity: 1; transform: none; }
}

.hero-in { animation: hero-in 720ms var(--tp-ease) both; }
.hero-in--2 { animation-delay: 200ms; }
.hero-in--3 { animation-delay: 300ms; }
.hero-in--4 { animation-delay: 380ms; }
.hero-in--5 { animation-delay: 460ms; }
.hero-in--6 { animation-delay: 540ms; }

@media (prefers-reduced-motion: reduce) {
  .hero-in { animation: none; }
}

/* ---------- 小屏 / 矮屏适配 ---------- */

@media (max-width: 560px) {
  .hero-nav { padding: 16px 20px; }
  .hero-body { padding: 0 20px 2vh; }
  .hero-links { flex-wrap: wrap; }
  .hero-foot { padding: 0 20px 18px; }
  .auth-mask { padding: 18px; }
  .auth-card { padding: 24px 20px; }
  /* iOS Safari 聚焦不自动放大页面 */
  .auth-input { font-size: 16px; }

  /* 说明面板：小屏纵向堆叠，分隔线改为横线；收紧间距让三步尽量进首屏 */
  .hero-title { font-size: clamp(34px, 9vw, 44px); }
  .hero-sub { display: none; }
  .hero-cta { margin-top: 20px; min-width: 200px; padding: 0 26px; }
  .hero-steps { margin-top: 24px; padding: 16px 16px 12px; }
  .hero-steps__title { margin-bottom: 10px; }
  .hero-steps__list { gap: 11px; grid-template-columns: 1fr; }
  .hero-step { align-items: center; flex-direction: row; gap: 13px; }
  .hero-step + .hero-step { border-left: 0; border-top: 1px solid rgba(255, 255, 255, 0.14); padding-left: 0; padding-top: 11px; }
  .hero-step__no { height: 28px; width: 28px; font-size: 13px; }
  .hero-step__name { font-size: 14.5px; margin-bottom: 2px; }
  .hero-step__desc { font-size: 12px; line-height: 1.5; }
  .hero-steps__note { margin-top: 11px; padding-top: 10px; font-size: 11.5px; }
}

/* 中屏：三列放不下时提前堆叠 */
@media (min-width: 561px) and (max-width: 760px) {
  .hero-steps { padding: 20px 22px 16px; }
  .hero-steps__list { gap: 14px; grid-template-columns: 1fr; }
  .hero-step { align-items: center; flex-direction: row; gap: 14px; }
  .hero-step + .hero-step { border-left: 0; border-top: 1px solid rgba(255, 255, 255, 0.14); padding-left: 0; padding-top: 14px; }
}

@media (max-height: 600px) {
  .hero-sub { margin-top: 12px; }
  .hero-cta { margin-top: 26px; }
  .hero-steps { margin-top: 26px; padding: 16px 20px 12px; }
  .hero-step__desc { display: none; }
  .hero-steps__note { margin-top: 12px; padding-top: 10px; }
  .hero-foot { padding-bottom: 14px; }
}
</style>
