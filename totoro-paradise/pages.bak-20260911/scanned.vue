<script setup lang="ts">
import TotoroApiWrapper, { setTotoroContext } from '~/src/wrappers/TotoroApiWrapper';
import useSunRunPaper from '~/composables/useSunRunPaper';
import { setServerTime } from '~~/src/utils/serverTime';

definePageMeta({ middleware: 'auth' });

const sunrunPaper = useSunRunPaper();
const session = useSession();
const selectValue = ref('');
const message = ref('');
const loading = ref(true);
const task = computed(() => sunrunPaper.value);
const remaining = ref<number | null>(null);

onMounted(async () => {
  $fetch<{ loggedIn: boolean; remaining: number }>('/api/auth/status')
    .then((s) => {
      if (s.loggedIn) remaining.value = s.remaining;
    })
    .catch(() => {});
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
    if (!sunrunPaper.value?.runPointList?.length) message.value = '当前无可用任务（可能不在任务日期/时段内）';
    // 默认选中第一条路线
    if (sunrunPaper.value?.runPointList?.length) selectValue.value = sunrunPaper.value.runPointList[0]?.pointId ?? '';
  } catch (e) { console.error(e); message.value = '龙猫服务器错误'; }
  finally { loading.value = false; }
});
const handleUpdate = (target: string) => { selectValue.value = target; };
const pickRandom = () => {
  const list = task.value?.runPointList ?? [];
  if (list.length) selectValue.value = list[Math.floor(Math.random() * list.length)]?.pointId ?? '';
};
</script>

<template>
  <div class="apple-page">
    <!-- 导航 -->
    <div class="nav">
      <NuxtLink to="/account" class="back">
        ‹ 龙猫跑轮
      </NuxtLink>
      <span v-if="remaining !== null" class="credit">剩余 {{ remaining }} 次</span>
    </div>

    <div class="head">
      <h1 class="title">
        任务
      </h1>
      <p class="subtitle">
        核对信息、选择路线后开跑
      </p>
    </div>

    <!-- 龙猫吉祥物（完整展示）+ 个人信息 -->
    <div class="top-row">
      <div class="hero-img">
        <img src="/images/run-hero.jpg" alt="龙猫跑轮">
      </div>
      <section class="card group info-card">
        <div class="group-label">
          个人信息
        </div>
        <div class="cell">
          <span class="cell-key">学校</span>
          <span class="cell-val">{{ session.userInfo?.schoolName || session.schoolName }}</span>
        </div>
        <div class="cell">
          <span class="cell-key">校区</span>
          <span class="cell-val">{{ session.userInfo?.schoolCampusName || '-' }}</span>
        </div>
        <div class="cell">
          <span class="cell-key">学号</span>
          <span class="cell-val mono">{{ session.userInfo?.snCode }}</span>
        </div>
        <div class="cell">
          <span class="cell-key">姓名</span>
          <span class="cell-val">{{ session.userInfo?.studentName || session.userInfo?.name }}</span>
        </div>
      </section>
    </div>

    <!-- 加载 / 无任务 -->
    <section v-if="loading" class="card state">
      <div class="spinner" />
      <p>任务加载中…</p>
    </section>
    <section v-else-if="message" class="card state">
      <p class="state-emphasis">
        {{ message }}
      </p>
    </section>

    <template v-else-if="task">
      <!-- 任务信息 -->
      <section class="card task">
        <div class="group-label">
          今日任务 · {{ task.paperName }}
        </div>
        <div class="task-hero">
          <span class="task-km">{{ task.mileage }}</span>
          <span class="task-km-unit">km</span>
        </div>
        <div class="task-meta">
          <div class="meta-item">
            <span class="cell-key">用时</span>
            <b>{{ task.minTime }}–{{ task.maxTime }} 分钟</b>
          </div>
          <div class="meta-item">
            <span class="cell-key">时段</span>
            <b>{{ task.startTime }}–{{ task.endTime }}</b>
          </div>
          <div class="meta-item">
            <span class="cell-key">日期</span>
            <b>{{ task.startDate?.slice(0, 10) }}~{{ task.endDate?.slice(0, 10) }}</b>
          </div>
        </div>
      </section>

      <!-- 选择路线（iOS 选择列表） -->
      <section class="card group">
        <div class="group-head">
          <div class="group-label">
            选择路线
          </div>
          <button class="link-btn" @click="pickRandom">
            随机选择
          </button>
        </div>
        <div class="chips">
          <button
            v-for="r in task.runPointList"
            :key="r.pointId"
            class="chip"
            :class="{ on: selectValue === r.pointId }"
            @click="selectValue = r.pointId"
          >
            {{ r.pointName }}
          </button>
        </div>
      </section>

      <!-- 开始 -->
      <NuxtLink v-if="selectValue" :to="`/run/${encodeURIComponent(selectValue)}`" class="cta">
        开始跑步
      </NuxtLink>
      <button v-else class="cta" disabled>
        开始跑步
      </button>

      <!-- 地图预览 -->
      <p class="map-note">
        地图路线仅为示意
      </p>
      <div class="card map-card">
        <ClientOnly>
          <AMap :target="selectValue" @update:target="handleUpdate" />
        </ClientOnly>
      </div>
    </template>
  </div>
</template>

<style scoped>
.apple-page {
  margin: 0 auto;
  max-width: 640px;
  min-height: 100vh;
  padding: 0 20px 24px;
  background: #f5f5f7;
}

.nav {
  align-items: center;
  display: flex;
  justify-content: space-between;
  padding: 14px 2px 0;
}
.back {
  color: #111;
  font-size: 15px;
  font-weight: 600;
  text-decoration: none;
}
.credit {
  background: #fff;
  border-radius: 999px;
  color: #111;
  font-size: 13px;
  font-weight: 600;
  padding: 6px 14px;
}

.head {
  margin: 12px 2px 12px;
}
.title {
  font-size: 30px;
  font-weight: 800;
  letter-spacing: -0.02em;
  margin: 0 0 2px;
}
.subtitle {
  color: #6e6e73;
  font-size: 14px;
  margin: 0;
}

/* 吉祥物完整展示（不裁切），与个人信息同排 */
.top-row {
  align-items: center;
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}
.hero-img {
  border-radius: 18px;
  box-shadow: 0 4px 24px rgb(17 17 17 / 5%);
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
}

.card {
  background: #fff;
  border-radius: 22px;
  box-shadow: 0 4px 24px rgb(17 17 17 / 5%);
  margin-bottom: 12px;
  padding: 4px 18px 6px;
}

/* iOS 分组列表 */
.group-label {
  color: #6e6e73;
  font-size: 13px;
  font-weight: 600;
  padding: 12px 2px 4px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.group-head {
  align-items: center;
  display: flex;
  justify-content: space-between;
}
.cell {
  align-items: center;
  border-bottom: 1px solid #e5e5ea;
  display: flex;
  justify-content: space-between;
  min-height: 48px;
  padding: 8px 2px;
  width: 100%;
}
.cell:last-child {
  border-bottom: 0;
}
.cell-key {
  color: #6e6e73;
  font-size: 15px;
}
.cell-val {
  font-size: 15px;
  font-weight: 600;
  text-align: right;
}
/* 路线胶囊 */
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 2px 2px 14px;
}
.chip {
  background: #f2f2f7;
  border: 0;
  border-radius: 999px;
  color: #111;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  padding: 9px 16px;
  transition:
    background 150ms ease,
    color 150ms ease;
}
.chip:hover {
  background: #e8e8ed;
}
.chip.on {
  background: #111;
  color: #fff;
  font-weight: 700;
}
.mono {
  font-family: ui-monospace, Consolas, monospace;
}

/* 状态卡 */
.state {
  color: #6e6e73;
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: center;
  padding: 34px 18px;
  text-align: center;
}
.state-emphasis {
  color: #111;
  font-size: 16px;
  font-weight: 700;
  margin: 0;
}
.spinner {
  animation: spin 0.9s linear infinite;
  border: 3px solid #e5e5ea;
  border-radius: 50%;
  border-top-color: #111;
  height: 22px;
  width: 22px;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* 任务卡 */
.task {
  padding-bottom: 12px;
}
.task-hero {
  align-items: baseline;
  display: flex;
  gap: 8px;
  padding: 2px 2px 10px;
}
.task-km {
  font-size: 46px;
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1;
}
.task-km-unit {
  color: #6e6e73;
  font-size: 18px;
  font-weight: 600;
}
.task-meta {
  border-top: 1px solid #e5e5ea;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
}
.meta-item {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 10px 2px 2px;
}
.meta-item b {
  font-size: 13px;
  letter-spacing: -0.01em;
  white-space: nowrap;
}
.meta-item + .meta-item {
  border-left: 1px solid #e5e5ea;
  padding-left: 12px;
}

.link-btn {
  background: transparent;
  border: 0;
  color: #111;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  padding: 14px 2px 6px;
  text-decoration: underline;
}

/* 主按钮 */
.cta {
  background: #111;
  border: 0;
  border-radius: 999px;
  box-shadow: 0 10px 26px rgb(17 17 17 / 22%);
  color: #fff;
  display: block;
  font-size: 17px;
  font-weight: 700;
  margin-top: 8px;
  padding: 17px;
  text-align: center;
  text-decoration: none;
  transition:
    transform 180ms ease,
    opacity 180ms ease;
}
.cta:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}
.cta:disabled {
  background: #d6d6db;
  box-shadow: none;
  color: #fff;
  cursor: not-allowed;
}

.map-note {
  color: #86868b;
  font-size: 12px;
  margin: 14px 4px 8px;
  text-align: center;
}
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
    width: auto;
  }
  .task-meta {
    grid-template-columns: 1fr;
  }
  .meta-item + .meta-item {
    border-left: 0;
    border-top: 1px solid #e5e5ea;
    padding-left: 2px;
  }
}
</style>
