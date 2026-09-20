<script setup lang="ts">
// 登录功能停用期间无付费体系，重定向到首页
if (!useRuntimeConfig().public.authEnabled) {
  await navigateTo('/', { replace: true });
}

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
  <div class="tp-page purchase">
    <header class="tp-nav">
      <div class="tp-nav-side">
        <NuxtLink to="/" class="tp-back">‹ 返回首页</NuxtLink>
      </div>
    </header>

    <header class="head tp-rise">
      <h1 class="tp-title">购买授权 / 跑步次数</h1>
      <p class="tp-subtitle">注册账号 → 购买次数 → 充值码兑换到账；每次成功提交成绩消耗 1 次。</p>
    </header>

    <section class="plans tp-rise-2" aria-label="套餐选择">
      <article
        v-for="p in plans"
        :key="p.name"
        class="plan-card"
        :class="{ 'plan-card--hot': p.highlight }"
      >
        <span v-if="p.highlight" class="plan-flag">最受欢迎</span>
        <h2 class="plan-name">{{ p.name }}</h2>
        <p class="plan-price tp-num">
          <span class="plan-cny">{{ p.price.slice(0, 1) }}</span>{{ p.price.slice(1) }}
        </p>
        <p class="plan-runs">{{ p.runs }} 次跑步额度</p>
      </article>
    </section>

    <div class="howto tp-rise-3">
      <p class="tp-group-label">如何购买</p>
      <section class="tp-card tp-card--pad">
        <ol class="steps">
          <li class="step">
            <span class="step-dot" aria-hidden="true">1</span>
            <div class="step-body">
              <p>通过以下方式联系站长，说明想要的套餐：</p>
              <p class="step-contact">微信：<b>{{ CONTACT.wechat }}</b>（{{ CONTACT.note }}）<br>QQ：<b>{{ CONTACT.qq }}</b></p>
            </div>
          </li>
          <li class="step">
            <span class="step-dot" aria-hidden="true">2</span>
            <div class="step-body">
              <p>完成支付后，站长会发给你一个充值码（形如 TP-XXXXX-XXXXX）</p>
            </div>
          </li>
          <li class="step">
            <span class="step-dot" aria-hidden="true">3</span>
            <div class="step-body">
              <p>登录你的账号，在「个人中心」输入充值码，次数自动到账</p>
            </div>
          </li>
        </ol>
        <div class="actions">
          <NuxtLink to="/account" class="tp-cta tp-cta--block">我已有充值码，去兑换</NuxtLink>
        </div>
      </section>
    </div>

    <p class="tp-note purchase-note">购买前请确认所在学校使用龙猫跑轮系统。充值码一经使用不支持退换（未使用可联系站长处理）。</p>
  </div>
</template>

<style scoped>
/* 本页内容较多：页面级放宽骨架宽度 */
.tp-page { max-width: 760px; }

.head { padding: 34px 2px 0; }

/* ---------- 套餐 ---------- */
.plans {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(2, 1fr);
  margin-top: 24px;
}

.plan-card {
  background: var(--tp-surface);
  border-radius: var(--tp-radius-card);
  box-shadow: var(--tp-shadow-card);
  margin: 0;
  padding: 22px 16px 20px;
  position: relative;
  text-align: center;
}

/* 推荐态仅用胶囊标签表达（Apple 定价卡不加彩色外框、不做 hover 位移） */
.plan-card--hot { box-shadow: var(--tp-shadow-card-hover); }

.plan-flag {
  background: var(--tp-blue);
  border-radius: 999px;
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  left: 50%;
  line-height: 1;
  padding: 5px 10px;
  position: absolute;
  top: -11px;
  transform: translateX(-50%);
  white-space: nowrap;
}

.plan-name {
  color: var(--tp-text-2);
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
  margin: 0;
}

.plan-price {
  color: var(--tp-text);
  font-size: 32px;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin: 10px 0 0;
}

.plan-cny {
  font-size: 18px;
  font-weight: 700;
  margin-right: 1px;
  position: relative;
  top: -7px;
}

.plan-runs {
  color: var(--tp-text-3);
  font-size: 13px;
  margin: 6px 0 0;
}

/* ---------- 如何购买 ---------- */
.howto { margin-top: 10px; }

.steps {
  display: flex;
  flex-direction: column;
  gap: 18px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.step { display: flex; gap: 12px; }

.step-dot {
  align-items: center;
  background: var(--tp-blue);
  border-radius: 50%;
  color: #fff;
  display: flex;
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 700;
  height: 24px;
  justify-content: center;
  width: 24px;
}

.step-body { flex: 1; min-width: 0; }
.step-body p { font-size: 15px; line-height: 1.6; margin: 0; }
.step-body .step-contact { margin-top: 6px; }

.actions {
  border-top: 1px solid var(--tp-separator);
  margin-top: 20px;
  padding-top: 20px;
}

.purchase-note { margin-top: 18px; text-align: center; }

/* ---------- 响应式 ---------- */
@media (min-width: 768px) {
  .plans { grid-template-columns: repeat(4, 1fr); }
}

@media (max-width: 560px) {
  .head { padding-top: 26px; }
  .plans { grid-template-columns: 1fr; }
  .plan-card { padding: 22px 20px 20px; }
}
</style>
