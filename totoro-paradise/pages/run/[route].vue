<script setup lang="ts">
import { useNow } from '@vueuse/core';
import { onUnmounted } from 'vue';
import useSunRunPaper from '~/composables/useSunRunPaper';
import { pickDevice } from '~~/src/utils/device';

definePageMeta({ middleware: 'auth' });

/**
 * 跑步页（纯进度展示版）。
 * 协议执行已整体移至服务端 /api/run 引擎（server/utils/runEngine.ts）：
 * 本页只提交 {token, host, pointId, device} 启动作业并轮询进度，
 * 轨迹生成/成绩构造/提交时序等核心逻辑不再进前端包。
 */
const now = useNow({ interval: 1000 });
const startTime = ref(new Date());
const timePassed = computed(() => Number(now.value) - Number(startTime.value));
const needTime = ref(0);
const running = ref(false);
const statusText = ref('');
const pollInfo = ref('');
const sunRunPaper = useSunRunPaper();
const { params } = useRoute();
const session = useSession();
const { route: routeId } = params as { route: string };
/** 显式失败态：防止"失败但有 needTime"被误判为完成(原版遗留缺陷) */
const failed = ref(false);
const runned = computed(() => !running.value && !failed.value && !!needTime.value);
const target = computed(() => sunRunPaper.value?.runPointList?.find((r) => r.pointId === routeId));
/** 自由跑：校园取消路线选择后任务无路线，无需路线信息即可开跑 */
const freeRun = computed(() => !!sunRunPaper.value && !sunRunPaper.value.runPointList?.length);

/* 纯展示：进度与计时格式化 */
const progressPercent = computed(() =>
  needTime.value ? Math.min(100, Math.floor((timePassed.value / needTime.value) * 100)) : 0,
);
const fmt = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
};

/* ---------- 服务端作业轮询 ---------- */

let pollTimer: ReturnType<typeof setInterval> | null = null;
const stopPolling = () => {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
};

interface RunStatus {
  status: 'running' | 'done' | 'error';
  statusText: string;
  pollInfo: string;
  createdAt: number;
  needMs: number | null;
  percent: number;
  error?: string;
}

const handleRun = async () => {
  if (!target.value && !freeRun.value) {
    statusText.value = '任务信息缺失，请返回任务页重新选择路线';
    return;
  }
  // 防御：旧持久化会话可能缺 device；本会话内补一台并保持一致（与服务器引擎 UA 同源）
  if (!session.value.device) {
    session.value.device = pickDevice();
  }
  failed.value = false;
  running.value = true;
  statusText.value = '准备中…';
  try {
    const res = await $fetch<{ jobId: string; createdAt: number }>('/api/run/start', {
      method: 'POST',
      body: {
        token: session.value.token,
        host: session.value.host,
        pointId: target.value?.pointId ?? routeId, /* 自由跑时为占位符，服务器按任务判定 */
        device: session.value.device,
      },
    });
    startTime.value = new Date(res.createdAt);
    statusText.value = '已提交服务器，等待起跑…';

    pollTimer = setInterval(async () => {
      try {
        const s = await $fetch<RunStatus>('/api/run/status', { query: { jobId: res.jobId } });
        if (s.needMs) needTime.value = s.needMs;
        pollInfo.value = s.pollInfo || '';
        if (s.status === 'done') {
          stopPolling();
          statusText.value = '';
          running.value = false;
        } else if (s.status === 'error') {
          stopPolling();
          failed.value = true;
          statusText.value = s.error || '跑步失败';
          running.value = false;
        } else {
          statusText.value = s.statusText || '跑步中…';
        }
      } catch {
        /* 单次轮询失败忽略，下个周期重试 */
      }
    }, 1000);
  } catch (e) {
    failed.value = true;
    statusText.value = (e as { data?: { error?: string } }).data?.error ?? (e as Error).message ?? '启动失败';
    running.value = false;
  }
};

onUnmounted(stopPolling);
</script>

<template>
  <div class="tp-page run-page">
    <!-- 导航 -->
    <nav class="tp-nav">
      <div class="tp-nav-side">
        <NuxtLink to="/scanned" class="tp-back">
          ‹ 返回
        </NuxtLink>
      </div>
      <div class="tp-nav-title">
        {{ target?.pointName ?? (freeRun ? '西操场自由跑' : '跑步') }}
      </div>
      <div class="tp-nav-side">
        <span class="nav-balancer" aria-hidden="true" />
      </div>
    </nav>

    <!-- 确认开跑 -->
    <template v-if="!runned && !running">
      <header class="run-head tp-rise">
        <h1 class="tp-title">
          准备开跑
        </h1>
        <p class="tp-subtitle">
          {{ freeRun ? '自由跑任务，默认沿西操场跑道完成' : '已选择路线，请再次确认' }}
        </p>
      </header>

      <!-- 直接访问/刷新导致任务缺失：引导回任务页 -->
      <div v-if="!target && !freeRun" class="tp-msg tp-msg--err run-error tp-rise" role="alert">
        <span>任务信息缺失，请返回任务页重新选择路线</span>
      </div>
      <NuxtLink v-if="!target && !freeRun" to="/scanned" class="tp-cta tp-cta--block run-cta tp-rise-3">
        返回任务页
      </NuxtLink>

      <section v-if="target || freeRun" class="tp-card tp-rise-2">
        <div class="tp-cell">
          <span class="tp-cell-key">路线</span>
          <span class="tp-cell-val">{{ freeRun ? '西操场（无需选择路线）' : target?.pointName }}</span>
        </div>
        <div class="tp-cell">
          <span class="tp-cell-key">里程</span>
          <span class="tp-cell-val">{{ sunRunPaper?.mileage }} km</span>
        </div>
        <div class="tp-cell">
          <span class="tp-cell-key">用时</span>
          <span class="tp-cell-val">{{ sunRunPaper?.minTime }} – {{ sunRunPaper?.maxTime }} 分钟</span>
        </div>
      </section>

      <div v-if="target || freeRun" class="run-hint tp-rise-3">
        <p>跑步由<b>服务器自动完成</b>，开始后可关闭本页，稍后回来查看结果。</p>
      </div>

      <button v-if="target || freeRun" class="tp-cta tp-cta--block run-cta tp-rise-3" @click="handleRun">
        确认开跑
      </button>
    </template>

    <!-- 跑步中：Apple Watch 活动圆环 -->
    <template v-if="running">
      <section class="tp-card run-card tp-rise">
        <div class="ring-wrap">
          <svg class="ring-svg" viewBox="0 0 200 200" role="img" aria-label="跑步进度">
            <circle class="ring-track" cx="100" cy="100" r="88" />
            <circle
              class="ring-progress"
              cx="100"
              cy="100"
              r="88"
              pathLength="100"
              stroke="var(--tp-blue)"
              stroke-dasharray="100"
              :stroke-dashoffset="100 - progressPercent"
              :opacity="progressPercent > 0 ? 1 : 0"
            />
          </svg>
          <div class="ring-center">
            <div class="ring-percent tp-num">
              {{ progressPercent }}<span class="ring-percent-unit">%</span>
            </div>
            <div class="ring-time tp-num">
              {{ fmt(timePassed) }}<span class="ring-time-total"> / {{ fmt(needTime) }}</span>
            </div>
          </div>
        </div>

        <p class="ring-status" aria-live="polite">
          {{ statusText }}
        </p>
        <p v-if="pollInfo" class="ring-poll tp-num">
          {{ pollInfo }}
        </p>
      </section>

      <p class="tp-note run-tip">
        跑步在服务器进行，页面仅展示进度
      </p>
    </template>

    <!-- 完成 -->
    <template v-if="runned">
      <section class="tp-card done-card tp-rise">
        <div class="done-check">
          <svg viewBox="0 0 64 64" width="34" height="34" aria-hidden="true">
            <path class="done-check-mark" d="M20 33.5 28.5 42 45 25" pathLength="1" />
          </svg>
        </div>
        <h2 class="done-title">
          跑步完成
        </h2>
        <p class="done-sub">
          成绩已提交，去小程序里看记录吧
        </p>
        <NuxtLink to="/scanned" class="tp-cta tp-cta--block">
          返回任务页
        </NuxtLink>
      </section>
    </template>

    <!-- 失败：v-if 分支与原版等价 -->
    <div v-if="statusText && !running && !runned" class="tp-msg tp-msg--err run-error tp-rise" role="alert">
      <svg class="run-error-icon" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <circle cx="8" cy="8" r="8" fill="currentColor" />
        <rect x="7.2" y="3.8" width="1.6" height="5.4" rx="0.8" fill="#fff" />
        <circle cx="8" cy="11.8" r="1" fill="#fff" />
      </svg>
      <span>{{ statusText }}</span>
    </div>
  </div>
</template>

<style scoped>
/* ---------- 页面骨架 ---------- */

.run-page {
  padding-bottom: 56px;
}

/* 与左侧「‹ 返回」等宽的隐形配重，让标题视觉居中 */
.nav-balancer {
  display: inline-block;
  min-width: 52px;
}

.run-head {
  padding: 28px 2px 20px;
}

/* ---------- 确认开跑 · 浅蓝提示条（规格对齐 kit .tp-msg） ---------- */

.run-hint {
  background: rgba(0, 113, 227, 0.06);
  border-radius: var(--tp-radius-control);
  color: var(--tp-text-2);
  font-size: 13px;
  line-height: 1.65;
  margin: 0 0 22px;
  padding: 12px 14px;
}
.run-hint p {
  margin: 0;
}
.run-hint b {
  color: var(--tp-text);
  font-weight: 600;
}

.run-cta {
  margin-top: 2px;
}

/* ---------- 跑步中：活动圆环 ---------- */

.run-card {
  align-items: center;
  display: flex;
  flex-direction: column;
  margin-top: 20px;
  padding: 46px 24px 32px;
  text-align: center;
}

.ring-wrap {
  height: 208px;
  position: relative;
  width: 208px;
}

.ring-svg {
  display: block;
  height: 100%;
  transform: rotate(-90deg);
  width: 100%;
}

/* 底环：简报指定的 iOS 灰 #e5e5ea */
.ring-track {
  fill: none;
  stroke: #e5e5ea;
  stroke-width: 10;
}

.ring-progress {
  fill: none;
  stroke-linecap: round;
  stroke-width: 10;
  transition: stroke-dashoffset 1s linear, opacity 400ms ease;
}

.ring-center {
  align-items: center;
  bottom: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  left: 0;
  position: absolute;
  right: 0;
  top: 0;
}

.ring-percent {
  color: var(--tp-text);
  font-size: 52px;
  font-weight: 700;
  letter-spacing: -0.04em;
  line-height: 1;
}

.ring-percent-unit {
  color: var(--tp-text-2);
  font-size: 24px;
  font-weight: 700;
  letter-spacing: 0;
  margin-left: 3px;
}

.ring-time {
  color: var(--tp-text);
  font-size: 17px;
  font-weight: 600;
  margin-top: 8px;
}

.ring-time-total {
  color: var(--tp-text-2);
  font-weight: 500;
}

.ring-status {
  color: var(--tp-text-2);
  font-size: 14px;
  margin: 24px 0 0;
}

.ring-poll {
  color: var(--tp-text-3);
  font-size: 12px;
  margin: 8px 0 0;
}

.run-tip {
  margin-top: 4px;
}

/* ---------- 完成 ---------- */

.done-card {
  margin-top: 20px;
  padding: 50px 24px 34px;
  text-align: center;
}

.done-check {
  align-items: center;
  animation: done-pop 560ms cubic-bezier(0.34, 1.36, 0.64, 1) both;
  background: var(--tp-green);
  border-radius: 50%;
  display: flex;
  height: 76px;
  justify-content: center;
  margin: 0 auto 20px;
  width: 76px;
}

.done-check-mark {
  animation: check-draw 360ms 200ms ease-out both;
  fill: none;
  stroke: #fff;
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 5;
}

.done-title {
  color: var(--tp-text);
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin: 0 0 6px;
}

.done-sub {
  color: var(--tp-text-2);
  font-size: 15px;
  margin: 0 0 28px;
}

@keyframes done-pop {
  0% {
    opacity: 0;
    transform: scale(0.5);
  }
  62% {
    opacity: 1;
    transform: scale(1.08);
  }
  82% {
    transform: scale(0.97);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes check-draw {
  to {
    stroke-dashoffset: 0;
  }
}

/* ---------- 失败 ---------- */

.run-error {
  font-weight: 600;
  margin-top: 20px;
}

.run-error-icon {
  flex: none;
  margin-top: 1px;
}

/* ---------- 移动端 ---------- */

@media (max-width: 560px) {
  .run-head {
    padding-top: 22px;
  }

  .run-card {
    padding: 38px 18px 28px;
  }

  .ring-wrap {
    height: 188px;
    width: 188px;
  }

  .ring-percent {
    font-size: 46px;
  }

  .ring-percent-unit {
    font-size: 21px;
  }

  .done-card {
    padding: 44px 20px 30px;
  }
}
</style>
