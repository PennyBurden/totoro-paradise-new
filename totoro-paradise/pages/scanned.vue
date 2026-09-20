<script setup lang="ts">
import TotoroApiWrapper, { setTotoroContext } from '~/src/wrappers/TotoroApiWrapper';
import useSunRunPaper from '~/composables/useSunRunPaper';
import { resetSession } from '~/composables/useSession';
import { setServerTime } from '~~/src/utils/serverTime';

definePageMeta({ middleware: 'auth' });

const sunrunPaper = useSunRunPaper();
const session = useSession();
const selectValue = ref('');
const message = ref('');
const loading = ref(true);
const task = computed(() => sunrunPaper.value);
/** 自由跑：校园在后台取消路线选择后任务不带回路线，无需选择直接开跑 */
const freeRun = computed(() => !!task.value && !task.value.runPointList?.length);
const remaining = ref<number | null>(null);
// 账号登录功能开关(false 时隐藏剩余次数/个人中心等账号 UI)
const authEnabled = useRuntimeConfig().public.authEnabled;

onMounted(async () => {
  if (authEnabled) {
    $fetch<{ loggedIn: boolean; remaining: number }>('/api/auth/status')
      .then((s) => {
        if (s.loggedIn) remaining.value = s.remaining;
      })
      .catch(() => {});
  }
  try {
    if (!session.value.userInfo) { await navigateTo('/token'); return; }
    setTotoroContext({ token: session.value.token, host: session.value.host, ua: session.value.device?.ua });
    try {
      const timeRes = await TotoroApiWrapper.getServerTime(session.value.token);
      const serverMs = Number(timeRes.body);
      if (Number.isFinite(serverMs) && serverMs > 1e12) setServerTime(serverMs);
    } catch (e) { console.warn('[totoro] 时间校准失败，使用本地时间', e); }
    try {
      const cfg = (await TotoroApiWrapper.getStartConfiguration(session.value.userInfo.snCode, session.value.token)) as { body?: { sunrunStartFace?: string; sunrunPointRandom?: string } };
      const faceOn = cfg.body?.sunrunStartFace === '1';
      const randomOn = cfg.body?.sunrunPointRandom === '1';
      console.log(`[totoro] 学校配置: 跑前人脸=${  faceOn  } 中途随机抽查=${  randomOn  }（本工具不进行人脸核验）`);
    } catch (e) { console.warn('[totoro] 起跑配置读取失败', e); }
    const data = await TotoroApiWrapper.getSunRunPaper({ stuNumber: session.value.userInfo.snCode, campusId: session.value.userInfo.schoolCampusCode ?? '', token: session.value.token });
    const currentTask = data.getSunrunPaperResponseList?.[0] ?? (data.runPointList?.length ? data : null);
    sunrunPaper.value = currentTask ?? null;
    // 无任务才提示；无路线（自由跑）不算异常
    if (!sunrunPaper.value) message.value = '当前无可用任务（可能不在任务日期/时段内）';
    // 默认选中第一条路线
    if (sunrunPaper.value?.runPointList?.length) selectValue.value = sunrunPaper.value.runPointList[0]?.pointId ?? '';
  } catch (e) { console.error(e); message.value = '龙猫服务器错误'; }
  finally { loading.value = false; }
});
const handleUpdate = (target: string) => { selectValue.value = target; };
/* 重新绑定：先清空本地会话再回绑定页，否则 token 页会因已绑定弹回本页形成死循环 */
const rebind = () => {
  resetSession(session);
  void navigateTo('/token');
};
const pickRandom = () => {
  const list = task.value?.runPointList ?? [];
  if (list.length) selectValue.value = list[Math.floor(Math.random() * list.length)]?.pointId ?? '';
};
</script>

<template>
  <div class="tp-page">
    <!-- 导航 -->
    <nav class="tp-nav">
      <div class="tp-nav-side">
        <NuxtLink v-if="authEnabled" to="/account" class="tp-back">
          ‹ 个人中心
        </NuxtLink>
        <a v-else href="#" class="tp-back" @click.prevent="rebind">‹ 重新绑定</a>
      </div>
      <NuxtLink v-if="authEnabled" to="/account" class="tp-badge tp-num">剩余 {{ remaining ?? '—' }} 次</NuxtLink>
    </nav>

    <header class="head tp-rise">
      <h1 class="tp-title">
        任务
      </h1>
      <p class="tp-subtitle">
        {{ freeRun ? '核对信息后直接开跑' : '核对信息、选择路线后开跑' }}
      </p>
    </header>

    <!-- 龙猫吉祥物（完整展示）+ 个人信息 -->
    <div class="top-row tp-rise">
      <div class="hero-img">
        <img src="/images/run-hero.jpg" alt="龙猫跑轮">
      </div>
      <section class="tp-card info-card">
        <div class="tp-group-label">
          个人信息
        </div>
        <div class="tp-cell">
          <span class="tp-cell-key">学校</span>
          <span class="tp-cell-val">{{ session.userInfo?.schoolName || session.schoolName }}</span>
        </div>
        <div class="tp-cell">
          <span class="tp-cell-key">校区</span>
          <span class="tp-cell-val">{{ session.userInfo?.schoolCampusName || '-' }}</span>
        </div>
        <div class="tp-cell">
          <span class="tp-cell-key">学号</span>
          <span class="tp-cell-val mono tp-num">{{ session.userInfo?.snCode }}</span>
        </div>
        <div class="tp-cell">
          <span class="tp-cell-key">姓名</span>
          <span class="tp-cell-val">{{ session.userInfo?.studentName || session.userInfo?.name }}</span>
        </div>
      </section>
    </div>

    <!-- 加载 / 无任务 -->
    <section v-if="loading" class="tp-card state tp-rise-2">
      <div class="tp-spinner" />
      <p>任务加载中…</p>
    </section>
    <section v-else-if="message" class="tp-card state tp-rise-2">
      <p class="state-emphasis">
        {{ message }}
      </p>
    </section>

    <template v-else-if="task">
      <!-- 任务信息 -->
      <section class="tp-card task tp-rise-2">
        <div class="tp-group-label">
          今日任务 · {{ task.paperName }}
        </div>
        <div class="task-hero">
          <span class="task-km tp-num">{{ task.mileage }}</span>
          <span class="task-km-unit">km</span>
        </div>
        <div class="task-meta">
          <div class="meta-item">
            <span class="meta-key">用时</span>
            <b class="tp-num">{{ task.minTime }}–{{ task.maxTime }} 分钟</b>
          </div>
          <div class="meta-item">
            <span class="meta-key">时段</span>
            <b class="tp-num">{{ task.startTime }}–{{ task.endTime }}</b>
          </div>
          <div class="meta-item">
            <span class="meta-key">日期</span>
            <b class="tp-num">{{ task.startDate?.slice(0, 10) }}~{{ task.endDate?.slice(0, 10) }}</b>
          </div>
        </div>
      </section>

      <!-- 选择路线（自由跑任务不渲染） -->
      <section v-if="!freeRun" class="tp-card tp-rise-2">
        <div class="group-head">
          <div class="tp-group-label">
            选择路线
          </div>
          <button class="tp-quiet random-btn" @click="pickRandom">
            随机选择
          </button>
        </div>
        <div class="chips">
          <button
            v-for="r in task.runPointList"
            :key="r.pointId"
            class="tp-chip"
            :class="{ on: selectValue === r.pointId }"
            @click="selectValue = r.pointId"
          >
            {{ r.pointName }}
          </button>
        </div>
      </section>

      <!-- 自由跑说明（校园取消路线选择后的任务形态） -->
      <p v-else class="tp-note free-note tp-rise-2">
        本校园任务无需选择路线，默认沿西操场跑道完成
      </p>

      <!-- 开始 -->
      <div class="cta-wrap tp-rise-3">
        <NuxtLink v-if="freeRun || selectValue" :to="`/run/${encodeURIComponent(freeRun ? 'free' : selectValue)}`" class="tp-cta tp-cta--block">
          开始跑步
        </NuxtLink>
        <button v-else class="tp-cta tp-cta--block" disabled>
          开始跑步
        </button>
      </div>

      <!-- 地图预览（自由跑无路线可画） -->
      <template v-if="!freeRun">
        <p class="tp-note">
          地图路线仅为示意
        </p>
        <div class="tp-card map-card">
          <ClientOnly>
            <AMap :target="selectValue" @update:target="handleUpdate" />
          </ClientOnly>
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
.head {
  padding: 30px 2px 10px;
}

/* 吉祥物完整展示（不裁切），与个人信息同排 */
.top-row {
  align-items: center;
  display: flex;
  gap: 12px;
}
.hero-img {
  border-radius: var(--tp-radius-card);
  box-shadow: var(--tp-shadow-card);
  flex: 0 0 auto;
  overflow: hidden;
}
.hero-img img {
  display: block;
  height: 200px;
  width: auto;
}
.info-card {
  flex: 1;
  margin-bottom: 0;
  min-width: 0;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

/* 状态卡（加载 / 无任务） */
.state {
  align-items: center;
  color: var(--tp-text-2);
  display: flex;
  flex-direction: column;
  gap: 14px;
  justify-content: center;
  padding: 44px 18px;
  text-align: center;
}
.state p {
  font-size: 15px;
  margin: 0;
}
.state-emphasis {
  color: var(--tp-text);
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.01em;
  margin: 0;
}

/* 任务卡：里程大数字 */
.task {
  padding-bottom: 14px;
}
.task-hero {
  align-items: baseline;
  display: flex;
  gap: 10px;
  padding: 6px 2px 16px;
}
.task-km {
  font-size: 60px;
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1;
}
.task-km-unit {
  color: var(--tp-text-2);
  font-size: 18px;
  font-weight: 600;
}
.task-meta {
  border-top: 1px solid var(--tp-separator);
  column-gap: 16px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
}
.meta-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  padding: 12px 2px 2px;
}
.meta-key {
  color: var(--tp-text-2);
  font-size: 12px;
  font-weight: 600;
}
.meta-item b {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.01em;
  white-space: nowrap;
}

/* 选择路线 */
.group-head {
  align-items: center;
  display: flex;
  justify-content: space-between;
}
.random-btn {
  flex: 0 0 auto;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 4px 2px 16px;
}
.free-note {
  margin: 2px 2px 0;
}

/* 开始按钮 */
.cta-wrap {
  margin: 8px 0 4px;
}

/* 地图卡 */
.map-card {
  height: 210px;
  overflow: hidden;
  padding: 0;
}

/* 窄屏：图片与信息上下排，完整不裁切 */
@media (max-width: 560px) {
  .top-row {
    align-items: stretch;
    flex-direction: column;
    gap: 12px;
  }
  .hero-img {
    align-self: center;
  }
  .hero-img img {
    height: auto;
    max-height: 40vh;
    max-width: 100%;
    width: auto;
  }
  .task-meta {
    grid-template-columns: 1fr;
  }
  .meta-item + .meta-item {
    border-top: 1px solid var(--tp-separator);
    padding-top: 10px;
  }
}
</style>
