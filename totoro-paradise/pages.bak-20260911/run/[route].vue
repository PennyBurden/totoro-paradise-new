<script setup lang="ts">
import { useNow } from '@vueuse/core';
import { onMounted, onUnmounted } from 'vue';
import TotoroApiWrapper, { setTotoroContext } from '~/src/wrappers/TotoroApiWrapper';
import generateSunRunExercisesReq, {
  adjustMileage,
  sampleRunDuration,
} from '~~/src/controllers/generateSunRunExercisesReq';
import generateRoute from '~~/src/utils/generateRoute';
import calculateRouteSimilarity from '~~/src/utils/fitDegree';
import { getRealTime, setServerTime } from '~~/src/utils/serverTime';
import { pickDevice } from '~~/src/utils/device';
import useSunRunPaper from '~/composables/useSunRunPaper';

definePageMeta({ middleware: 'auth' });

/**
 * 小程序版跑步流程（复刻 pages/run/index.js 的线上协议，时序自洽版；无人脸核验模式）：
 *  1. currentTimeMillis 校准时间偏移 g（轨迹 timestamp 用）
 *  2. getRunBegin（faceBase64 传空串，跳过跑前人脸）→ scantronId；beginAt 即起跑时刻
 *  3. km = 要求里程 ×(1+1%~5%)；waitSecond 在任务用时区间内采样
 *  4. 等待期间每 15s 轮询 getRunPointList/getRunPointListAbnormal（复刻真机心跳）
 *  5. 结束：endAt = 当前时刻；生成轨迹（timestamp 严格覆盖 [beginAt, endAt]）
 *  6. 对轨迹诚实计算 fitDegree（复刻 stopRun 的 calculateRouteSimilarity）
 *  7. sunRunExercises（17 字段）→ status=='00'
 *  8. sunRunExercisesDetail（轨迹 + cheatCode，失败不阻断）
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
const runned = computed(() => !running.value && !!needTime.value);
const target = computed(() => sunRunPaper.value?.runPointList.find((r) => r.pointId === routeId)!);

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

const handleRun = async () => {
  if (!session.value.userInfo || !target.value || !sunRunPaper.value) return;
  // 防御:旧持久化会话可能缺 device,缺失时补一台并保持本会话一致
  if (!session.value.device) {
    session.value.device = pickDevice();
  }
  setTotoroContext({
    token: session.value.token,
    host: session.value.host,
    ua: session.value.device.ua,
  });
  running.value = true;
  statusText.value = '准备中…';

  try {
    // ① 服务端时间校准与起跑配置已在任务页完成（🔬 实抓时序 [591][592][612]）；
    //    直接进任务后从「再校验」开始：旧会话可能未经过任务页，此处兜底校时
    try {
      const timeRes = await TotoroApiWrapper.getServerTime(session.value.token);
      const serverMs = Number(timeRes.body);
      if (Number.isFinite(serverMs) && serverMs > 1e12) setServerTime(serverMs);
    } catch (e) {
      console.warn('[totoro] 时间校准失败，使用本地时间', e);
    }

    // ①'' 真机起跑链补水：选线后 getCameraConfig、开跑前 selectSunRunRandomConfiguration
    //     （🔬 实抓 [177]/[241]；即使人脸关闭 randomConfig 请求也照发，保持流水完整）
    try {
      await TotoroApiWrapper.getCameraConfig?.(target.value.pointId, session.value.token);
    } catch (e) {
      console.warn('[totoro] getCameraConfig 失败（未部署摄像头的路线常见）', e);
    }
    try {
      const randomCfg = (await TotoroApiWrapper.getRandomConfiguration?.(
        target.value.pointId,
        session.value.token,
      )) as { body?: { startDistance?: string; checkDistance?: string; offsetDistance?: string } };
      console.log('[totoro] 随机抽查距离配置:', randomCfg?.body);
    } catch (e) {
      console.warn('[totoro] selectSunRunRandomConfiguration 失败', e);
    }

    // ①'' 起跑前置校验（真机 _continueStartRun 第一步；status!='00' 中止，网络失败放行）
    // 🔬 实抓：成功响应 { status:'00', msg:'', code:'0' }；status!='00' 中止，网络失败放行
    let note: { status?: string; msg?: string; code?: string } | null = null;
    try {
      note = (await TotoroApiWrapper.getStartUpNote(session.value.token)) as {
        status?: string;
        msg?: string;
        code?: string;
      };
    } catch (e) {
      console.warn('[totoro] startUpNote 网络失败，放行（复刻真机 doFail 语义）', e);
    }
    if (note && note.status !== '00' && note.code !== '0') {
      throw new Error(note.msg || '暂无法开始跑步');
    }

    // ② 开始跑步：code==0（数字）→ scantronId；beginAt 即"起跑时刻"
    statusText.value = '开始跑步…';
    // 🔬 源码 startRequest/realStartRun：请求体 6 字段（runType/version/phoneInfo/
    // paperId/lineId/faceBase64），鉴权在 Bearer 头，体中无 token
    const beginRes = await TotoroApiWrapper.getRunBegin({
      runType: '0',
      version: session.value.device.version,
      phoneInfo: session.value.device.phoneInfo,
      paperId: target.value.taskId,
      lineId: target.value.pointId,
      faceBase64: '',
    });
    if (`${beginRes.code}` !== '0' || !beginRes.scantronId) {
      throw new Error(beginRes.msg || '开始失败，请稍后再试');
    }
    const beginAt = getRealTime();

    // ③ 里程调整 + 用时采样
    const km = adjustMileage(sunRunPaper.value.mileage);
    const waitSecond = sampleRunDuration(km, sunRunPaper.value.minTime, sunRunPaper.value.maxTime);
    startTime.value = now.value;
    needTime.value = waitSecond * 1000;
    statusText.value = '跑步中…';

    // ④ 轮询跑点进度：真机在起跑后立即调一次，随后 15s 周期。
    //    注意（capture.log 证实）：跑点到达由服务端依据【提交的轨迹】判定——跑步中
    //    服务端没有位置数据，allCount=0 是空模板响应（真机同样显示 0/0），
    //    有意义的数据在 sunRunExercises 提交后的结算页轮询中出现。
    const pollOnce = async () => {
      try {
        const [points, abnormal] = await Promise.all([
          TotoroApiWrapper.getRunPointList(beginRes.scantronId),
          TotoroApiWrapper.getRunPointListAbnormal(beginRes.scantronId),
        ]);
        const p = points as {
          allCount?: number;
          alreadyCount?: number;
          sunRunStatus?: number;
          sunRunMsg?: string;
        };
        const a = abnormal as { abnormalPointType?: number };
        if (!p.allCount) {
          // 空模板（服务端无该 scantronId 的跑点记录，跑中正常态）——不向用户展示
          pollInfo.value = '';
        } else {
          pollInfo.value =
            `跑点 ${p.alreadyCount ?? 0}/${p.allCount}${ 
            p.sunRunMsg ? `（${p.sunRunMsg}）` : '' 
            }${a.abnormalPointType ? ` [异常${a.abnormalPointType}]` : ''}`;
        }
        console.log('[totoro] poll:', JSON.stringify(points), JSON.stringify(abnormal));
      } catch (e) {
        console.warn('[totoro] 轮询失败', e);
      }
    };
    void pollOnce();
    const poll = setInterval(pollOnce, 15000);
    try {
      await new Promise<void>((resolve) => setTimeout(resolve, needTime.value));
    } finally {
      clearInterval(poll);
    }

    // ⑤ 生成轨迹：timestamp 严格覆盖 [beginAt, endAt]，与 usedTime/avgSpeed 同源
    statusText.value = '生成跑步数据…';
    const endAt = getRealTime();
    const track = generateRoute({
      distance: km,
      route: target.value,
      startAt: beginAt,
      endAt,
    });
    // km 与轨迹完全同源（真机 distance_data 即轨迹累积长度）：
    // 提交的 km 取生成轨迹的实际折线长，服务端复算轨迹长度与 km 字段一致
    const kmFinal = track.distance;

    // ⑥ 拟合度诚实计算（复刻 stopRun 的 calculateRouteSimilarity，5m 采样 / 25m 容差）
    const fit = calculateRouteSimilarity(
      track.mockRoute.map((p) => [p.latitude, p.longitude] as [number, number]),
      target.value.pointList.map((p) => [Number(p.latitude), Number(p.longitude)] as [number, number]),
    );
    const fitDegree = fit.toFixed(2);

    // ⑦ 生成并提交阶段一
    const req = generateSunRunExercisesReq({
      scantronId: beginRes.scantronId,
      km: kmFinal,
      startAt: beginAt,
      endAt,
      fitDegree,
      taskId: target.value.taskId,
      route: target.value,
      snCode: session.value.userInfo.snCode,
      schoolCode: session.value.userInfo.schoolCode,
      token: session.value.token,
      device: session.value.device,
    });
    statusText.value = '提交成绩…';
    const submitRes = await TotoroApiWrapper.sunRunExercises(req);
    if (`${submitRes.status}` !== '00') {
      throw new Error(submitRes.msg || submitRes.message || '成绩提交失败');
    }

    // ⑧ 阶段二轨迹（失败不阻断——复刻小程序 success/doFail 均 resolve）
    await TotoroApiWrapper.sunRunExercisesDetail({
      pointList: track.mockRoute,
      gyroscope: [],
      accelerometer: [],
      cheatCode: '正常跑步',
      scantronId: beginRes.scantronId,
      token: session.value.token,
    });

    statusText.value = '';
    running.value = false;
  } catch (e) {
    console.error(e);
    statusText.value = (e as Error).message;
    running.value = false;
  }
};

onMounted(() => {
  window.addEventListener('beforeunload', handleBeforeUnload);
});

onUnmounted(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload);
});

function handleBeforeUnload(e: BeforeUnloadEvent) {
  if (running.value && !runned.value) {
    e.preventDefault();
    e.returnValue = '跑步还未完成，确定要离开吗？';
  }
}
</script>

<template>
  <div class="apple-page">
    <!-- 导航 -->
    <div class="nav">
      <NuxtLink to="/scanned" class="back">
        ‹ 返回
      </NuxtLink>
      <span class="nav-title">{{ target?.pointName ?? '跑步' }}</span>
      <span class="nav-spacer" />
    </div>

    <!-- 确认开跑 -->
    <template v-if="!runned && !running">
      <h1 class="title">
        准备开跑
      </h1>
      <p class="subtitle">
        已选择路线，请再次确认
      </p>

      <section class="card">
        <div class="cell">
          <span class="cell-key">路线</span>
          <span class="cell-val">{{ target?.pointName }}</span>
        </div>
        <div class="cell">
          <span class="cell-key">里程</span>
          <span class="cell-val">{{ sunRunPaper?.mileage }} km</span>
        </div>
        <div class="cell">
          <span class="cell-key">用时</span>
          <span class="cell-val">{{ sunRunPaper?.minTime }} – {{ sunRunPaper?.maxTime }} 分钟</span>
        </div>
      </section>

      <section class="card notice">
        <p>开跑后<b>请勿关闭或离开本页面</b>，耐心等待自动完成即可。</p>
      </section>

      <button class="cta" @click="handleRun">
        确认开跑
      </button>
    </template>

    <!-- 跑步中 -->
    <template v-if="running">
      <section class="card run-card">
        <div class="run-percent">
          {{ progressPercent }}<span class="run-percent-unit">%</span>
        </div>
        <div class="run-bar">
          <div class="run-bar-fill" :style="{ width: `${progressPercent}%` }" />
        </div>
        <div class="run-times">
          <span>{{ fmt(timePassed) }}</span>
          <span class="muted">/ {{ fmt(needTime) }}</span>
        </div>
        <p class="run-status">
          {{ statusText }}
        </p>
        <p v-if="pollInfo" class="run-poll">
          {{ pollInfo }}
        </p>
      </section>
      <p class="tip">
        保持页面打开，完成后自动提交成绩
      </p>
    </template>

    <!-- 完成 / 失败 -->
    <template v-if="runned">
      <section class="card done-card">
        <div class="done-check">
          ✓
        </div>
        <h2 class="done-title">
          跑步完成
        </h2>
        <p class="done-sub">
          成绩已提交，去小程序里看记录吧
        </p>
        <NuxtLink to="/scanned" class="cta">
          返回任务页
        </NuxtLink>
      </section>
    </template>
    <section v-if="statusText && !running && !runned" class="card notice">
      <p class="err">
        {{ statusText }}
      </p>
    </section>
  </div>
</template>

<style scoped>
.apple-page {
  margin: 0 auto;
  max-width: 640px;
  min-height: 100vh;
  padding: 0 20px 60px;
  background: #f5f5f7;
}

.nav {
  align-items: center;
  display: flex;
  justify-content: space-between;
  padding: 18px 2px 0;
}
.back {
  color: #111;
  font-size: 15px;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
}
.nav-title {
  color: #111;
  font-size: 15px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.nav-spacer {
  display: inline-block;
  min-width: 56px;
}

.title {
  font-size: 34px;
  font-weight: 800;
  letter-spacing: -0.02em;
  margin: 18px 2px 4px;
}
.subtitle {
  color: #6e6e73;
  font-size: 15px;
  margin: 0 2px 22px;
}

.card {
  background: #fff;
  border-radius: 22px;
  box-shadow: 0 4px 24px rgb(17 17 17 / 5%);
  margin-bottom: 16px;
  padding: 6px 18px;
}

.cell {
  align-items: center;
  border-bottom: 1px solid #e5e5ea;
  display: flex;
  justify-content: space-between;
  min-height: 48px;
  padding: 8px 2px;
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

.notice {
  color: #6e6e73;
  font-size: 14px;
  line-height: 1.6;
  padding: 16px 18px;
}
.notice b {
  color: #111;
}
.err {
  color: #111;
  font-weight: 700;
  margin: 0;
}

.cta {
  background: #111;
  border: 0;
  border-radius: 999px;
  box-shadow: 0 10px 26px rgb(17 17 17 / 22%);
  color: #fff;
  display: block;
  font-size: 17px;
  font-weight: 700;
  margin-top: 10px;
  padding: 17px;
  text-align: center;
  text-decoration: none;
  transition:
    transform 180ms ease,
    opacity 180ms ease;
  width: 100%;
}
.cta:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

/* 跑步中 */
.run-card {
  margin-top: 14px;
  padding: 36px 22px 26px;
  text-align: center;
}
.run-percent {
  font-size: 72px;
  font-weight: 800;
  letter-spacing: -0.04em;
  line-height: 1;
}
.run-percent-unit {
  color: #6e6e73;
  font-size: 26px;
  font-weight: 700;
  margin-left: 2px;
}
.run-bar {
  background: #e5e5ea;
  border-radius: 999px;
  height: 8px;
  margin: 26px auto 14px;
  overflow: hidden;
}
.run-bar-fill {
  background: #111;
  border-radius: 999px;
  height: 100%;
  transition: width 1s linear;
}
.run-times {
  font-size: 17px;
  font-weight: 700;
}
.muted {
  color: #86868b;
  font-weight: 500;
}
.run-status {
  color: #6e6e73;
  font-size: 14px;
  margin: 14px 0 0;
}
.run-poll {
  color: #86868b;
  font-size: 12px;
  margin: 8px 0 0;
}
.tip {
  color: #86868b;
  font-size: 13px;
  text-align: center;
}

/* 完成 */
.done-card {
  margin-top: 14px;
  padding: 44px 22px 30px;
  text-align: center;
}
.done-check {
  align-items: center;
  background: #111;
  border-radius: 50%;
  color: #fff;
  display: flex;
  font-size: 34px;
  font-weight: 800;
  height: 72px;
  justify-content: center;
  margin: 0 auto 18px;
  width: 72px;
}
.done-title {
  font-size: 26px;
  font-weight: 800;
  letter-spacing: -0.02em;
  margin: 0 0 6px;
}
.done-sub {
  color: #6e6e73;
  font-size: 15px;
  margin: 0 0 26px;
}
</style>
