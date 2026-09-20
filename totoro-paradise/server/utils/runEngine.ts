/**
 * 服务端跑步引擎 —— pages/run/[route].vue 原客户端协议的完整服务端移植。
 *
 * 核心动机：轨迹生成(generateRoute)、成绩构造(generateSunRunExercisesReq)、
 * 拟合度计算(fitDegree)与提交时序不再进前端包，前端只拿作业进度。
 *
 * 协议时序与原客户端版逐行对齐（注释序号 ①-⑨ 同源）：
 *  ① currentTimeMillis 校准时间偏移 g（轨迹 timestamp 用）
 *  ①'' getCameraConfig + selectSunRunRandomConfiguration（补水请求，失败放行）
 *  ①''' startUpNote 前置校验（status!='00' 中止，网络失败放行）
 *  ② getRunBegin（faceBase64 空串）→ scantronId；beginAt 即起跑时刻
 *  ③ km = 要求里程 ×(1+1%~5%)；waitSecond 在任务用时区间内采样
 *  ④ 等待期间每 15s 轮询 getRunPointList/getRunPointListAbnormal
 *  ⑤ 结束：endAt = 当前时刻；生成轨迹（timestamp 严格覆盖 [beginAt, endAt]）
 *  ⑥ 对轨迹诚实计算 fitDegree
 *  ⑦ sunRunExercises（17 字段）→ status=='00'
 *  ⑧ sunRunExercisesDetail（失败不阻断）
 *
 * 作业模型：startRun() 立即返回 jobId，协议在后台执行；
 * 进程内 Map 存作业快照，前端轮询 /api/run/status 展示进度。
 */
import { randomUUID } from 'node:crypto';
import type RunPoint from '../../src/types/RunPoint';
import type { SunRunPaper } from '../../src/types/responseTypes/GetSunRunPaperResponse';
import type GetStudentInfoResponse from '../../src/types/responseTypes/GetStudentInfoResponse';
import type { Device } from '../../src/utils/device';
import generateSunRunExercisesReq, {
  adjustMileage,
  sampleRunDuration,
} from '../../src/controllers/generateSunRunExercisesReq';
import generateRoute from '../../src/utils/generateRoute';
import calculateRouteSimilarity from '../../src/utils/fitDegree';
import { getRealTime, setServerTime } from '../../src/utils/serverTime';
import { totoroGet, totoroPost, type TotoroContext } from './totoroClient';
import { recordRunSuccess } from './statsStore';

export interface RunJob {
  id: string;
  status: 'running' | 'done' | 'error';
  statusText: string;
  pollInfo: string;
  /** 作业创建时刻（客户端计时起点） */
  createdAt: number;
  /** getRunBegin 成功时刻（校准时钟）；null = 尚未起跑 */
  startedAt: number | null;
  /** 目标用时毫秒；null = 尚未采样 */
  needMs: number | null;
  error?: string;
  finishedAt?: number;
}

/** 进程内作业表（单实例 Nitro 足够；重启丢作业可接受） */
const jobs = new Map<string, RunJob>();

/** 完成态作业保留 2 小时，超时清理 */
const JOB_TTL_MS = 2 * 60 * 60 * 1000;

const purgeStaleJobs = () => {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (job.status !== 'running' && now - (job.finishedAt ?? job.createdAt) > JOB_TTL_MS) jobs.delete(id);
  }
};

export const getRunJob = (id: string): RunJob | null => {
  purgeStaleJobs();
  return jobs.get(id) ?? null;
};

export interface StartRunInput extends TotoroContext {
  paper: SunRunPaper;
  /** 选定路线；null = 无路线任务（校园取消路线选择后的自由跑模式） */
  target: RunPoint | null;
  snCode: string;
  schoolCode: string;
  /** 发起请求的客户端 IP（仅成功后记统计明细用，不参与跑步流程） */
  ip?: string;
  /** 成绩提交成功后的回调（登录启用时扣减额度） */
  onSuccess?: () => void;
}

/** 拉取并校验学生身份（A 型：code=='0' 时 obj 含 snCode/schoolCode/campus） */
export const fetchStudentInfo = async (ctx: TotoroContext): Promise<GetStudentInfoResponse['obj']> => {
  const info = await totoroGet<GetStudentInfoResponse>(ctx, 'platform/serverlist/GetStudentInfoByToken');
  if (`${info.code}` !== '0' || !info.obj?.snCode) throw new Error('龙猫ID无效或已过期');
  return info.obj;
};

/** 拉取今日任务（C 型双层结构：优先 getSunrunPaperResponseList[0]） */
export const fetchSunRunPaper = async (ctx: TotoroContext, snCode: string, campusId: string): Promise<SunRunPaper | null> => {
  const data = await totoroPost<GetSunRunPaperResponseLike>(ctx, 'sunrun/getSunrunPaper', {
    stuNumber: snCode,
    campusId,
    token: ctx.token,
  });
  return data.getSunrunPaperResponseList?.[0] ?? (data.runPointList?.length ? (data as unknown as SunRunPaper) : null);
};

interface GetSunRunPaperResponseLike {
  getSunrunPaperResponseList?: SunRunPaper[];
  runPointList?: RunPoint[];
}

/**
 * 自由跑兜底路线：将军路校区西操场 400m 跑道。
 * 校园在后台取消路线选择后任务 runPointList 为空，学生实际为操场自由跑。
 * 此处用西操场田径场跑道的实测椭圆（OpenStreetMap way/1053867283，19 点闭环，
 * 周长 398m ≈ 标准 400m 跑道第一分道内沿 2×84.39+2π×36.5；外围另有含看台的
 * 582m 整体轮廓 way/1053867282），轨迹沿真实跑道绕圈，任务里程 2.40km ≈ 整 6 圈。
 * 坐标为 WGS-84；小程序内置腾讯地图（GCJ-02），如后续需要对齐再整体偏移。
 */
const FREE_RUN_LOOP: Array<[string, string]> = [
  ['118.781721', '31.940508'],
  ['118.781803', '31.940436'],
  ['118.781994', '31.940361'],
  ['118.782145', '31.940365'],
  ['118.782278', '31.940412'],
  ['118.782421', '31.940536'],
  ['118.782449', '31.940630'],
  ['118.782457', '31.940714'],
  ['118.782242', '31.941500'],
  ['118.782158', '31.941630'],
  ['118.782027', '31.941711'],
  ['118.781887', '31.941739'],
  ['118.781746', '31.941732'],
  ['118.781631', '31.941676'],
  ['118.781542', '31.941598'],
  ['118.781466', '31.941479'],
  ['118.781456', '31.941358'],
  ['118.781661', '31.940611'],
  ['118.781721', '31.940508'],
];

/** 无路线任务合成自由跑路线：taskId 取任务主键，lineId 置空（与真机不选路线一致） */
export const buildFreeRunRoute = (paper: SunRunPaper): RunPoint => ({
  taskId: paper.paperId ?? paper.id ?? '',
  pointId: '',
  pointName: '西操场',
  longitude: FREE_RUN_LOOP[0]![0],
  latitude: FREE_RUN_LOOP[0]![1],
  pointList: FREE_RUN_LOOP.map(([longitude, latitude]) => ({ longitude, latitude, time: null })),
  signLongitude: null,
  signLatitude: null,
  signQrcode: '',
});

export const startRun = (input: StartRunInput): RunJob => {
  const job: RunJob = {
    id: randomUUID(),
    status: 'running',
    statusText: '准备中…',
    pollInfo: '',
    createdAt: Date.now(),
    startedAt: null,
    needMs: null,
  };
  jobs.set(job.id, job);
  // 后台执行，不阻塞 HTTP 响应
  void executeJob(job, input).catch((e) => {
    job.status = 'error';
    job.error = (e as Error).message || '服务器内部错误';
    job.statusText = '';
    job.finishedAt = Date.now();
  });
  return job;
};

async function executeJob(job: RunJob, input: StartRunInput): Promise<void> {
  const { paper } = input;
  /* 无路线任务（自由跑）：target 为空时用校园环线合成路线，后续流程完全一致 */
  const target = input.target ?? buildFreeRunRoute(paper);
  const ctx: TotoroContext = { token: input.token, host: input.host, device: input.device };

  // ① 服务端时间校准（旧会话兜底校时语义保留）
  try {
    const timeRes = await totoroPost<{ body?: number | string }>(ctx, 'platform/camera/currentTimeMillis', { token: ctx.token });
    const serverMs = Number(timeRes.body);
    if (Number.isFinite(serverMs) && serverMs > 1e12) setServerTime(serverMs);
  } catch (e) {
    console.warn('[run-engine] 时间校准失败，使用本地时间', e);
  }

  // ①'' 真机起跑链补水：getCameraConfig、selectSunRunRandomConfiguration（失败放行）
  try {
    await totoroPost(ctx, 'platform/camera/getCameraConfig', { lineId: target.pointId, token: ctx.token });
  } catch (e) {
    console.warn('[run-engine] getCameraConfig 失败（未部署摄像头的路线常见）', e);
  }
  try {
    await totoroPost(ctx, 'platform/sunrunFace/selectSunRunRandomConfiguration', { lineId: target.pointId, token: ctx.token });
  } catch (e) {
    console.warn('[run-engine] selectSunRunRandomConfiguration 失败', e);
  }

  // ①''' 起跑前置校验（status!='00' 中止，网络失败放行）
  let note: { status?: string; msg?: string; code?: string } | null = null;
  try {
    note = await totoroPost(ctx, 'platform/sunrunFace/startUpNote', { token: ctx.token });
  } catch (e) {
    console.warn('[run-engine] startUpNote 网络失败，放行', e);
  }
  if (note && note.status !== '00' && note.code !== '0') {
    throw new Error(note.msg || '暂无法开始跑步');
  }

  // ② 开始跑步：code==0（数字）→ scantronId
  job.statusText = '开始跑步…';
  const beginRes = await totoroPost<{ code?: number | string; scantronId?: string; msg?: string }>(ctx, 'sunrun/getRunBegin', {
    runType: '0',
    version: input.device.version,
    phoneInfo: input.device.phoneInfo,
    paperId: target.taskId,
    lineId: target.pointId,
    faceBase64: '',
  });
  if (`${beginRes.code}` !== '0' || !beginRes.scantronId) {
    throw new Error(beginRes.msg || '开始失败，请稍后再试');
  }
  const beginAt = getRealTime();
  job.startedAt = beginAt;

  // ③ 里程调整 + 用时采样（含任务速度区间 km/h，保证 avgSpeed 落在校验区间内）
  const km = adjustMileage(paper.mileage);
  const waitSecond = sampleRunDuration(km, paper.minTime, paper.maxTime, {
    minSpeed: paper.minSpeed,
    maxSpeed: paper.maxSpeed,
  });
  job.needMs = waitSecond * 1000;
  job.statusText = '跑步中…';

  // ④ 轮询跑点进度（15s 周期；空模板响应不展示）
  const pollOnce = async () => {
    try {
      const [points, abnormal] = await Promise.all([
        totoroPost<{ allCount?: number; alreadyCount?: number; sunRunMsg?: string }>(ctx, 'sunrun/getRunPointList', { scantronId: beginRes.scantronId }),
        totoroPost<{ abnormalPointType?: number }>(ctx, 'sunrun/getRunPointListAbnormal', { scantronId: beginRes.scantronId }),
      ]);
      if (!points.allCount) {
        job.pollInfo = '';
      } else {
        job.pollInfo =
          `跑点 ${points.alreadyCount ?? 0}/${points.allCount}` +
          `${points.sunRunMsg ? `（${points.sunRunMsg}）` : ''}` +
          `${abnormal.abnormalPointType ? ` [异常${abnormal.abnormalPointType}]` : ''}`;
      }
    } catch (e) {
      console.warn('[run-engine] 轮询失败', e);
    }
  };
  void pollOnce();
  const poll = setInterval(pollOnce, 15000);
  try {
    await new Promise<void>((resolve) => setTimeout(resolve, job.needMs!));
  } finally {
    clearInterval(poll);
  }

  // ⑤ 生成轨迹：timestamp 严格覆盖 [beginAt, endAt]，km 与轨迹同源
  job.statusText = '生成跑步数据…';
  const endAt = getRealTime();
  const track = generateRoute({ distance: km, route: target, startAt: beginAt, endAt });
  const kmFinal = track.distance;

  // ⑥ 拟合度诚实计算（5m 采样 / 25m 容差）
  const fit = calculateRouteSimilarity(
    track.mockRoute.map((p) => [p.latitude, p.longitude] as [number, number]),
    target.pointList.map((p) => [Number(p.latitude), Number(p.longitude)] as [number, number]),
  );
  const fitDegree = fit.toFixed(2);

  // ⑦ 生成并提交阶段一（17 字段）
  const req = generateSunRunExercisesReq({
    scantronId: beginRes.scantronId!,
    km: kmFinal,
    startAt: beginAt,
    endAt,
    fitDegree,
    taskId: target.taskId,
    route: target,
    snCode: input.snCode,
    schoolCode: input.schoolCode,
    token: ctx.token,
    device: input.device,
  });
  job.statusText = '提交成绩…';
  const submitRes = await totoroPost<{ status?: string; msg?: string; message?: string }>(ctx, 'sunrun/sunRunExercises', req as unknown as Record<string, unknown>);
  if (`${submitRes.status}` !== '00') {
    throw new Error(submitRes.msg || submitRes.message || '成绩提交失败');
  }

  // ⑧ 阶段二轨迹（失败不阻断）
  try {
    await totoroPost(ctx, 'platform/recrecord/sunRunExercisesDetail', {
      pointList: track.mockRoute,
      gyroscope: [],
      accelerometer: [],
      cheatCode: '正常跑步',
      scantronId: beginRes.scantronId,
      token: ctx.token,
    });
  } catch (e) {
    console.warn('[run-engine] 阶段二轨迹提交失败（不阻断）', e);
  }

  job.statusText = '';
  job.status = 'done';
  job.finishedAt = Date.now();
  recordRunSuccess(input.snCode, input.ip);
  input.onSuccess?.();
}
