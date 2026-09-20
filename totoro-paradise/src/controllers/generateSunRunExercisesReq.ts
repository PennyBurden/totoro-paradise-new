import type SunRunExercisesRequest from '../types/requestTypes/SunRunExercisesRequest';
import type RunPoint from '../types/RunPoint';
import type { Device } from '../utils/device';
import { formatIsoLocal } from '../utils/serverTime';
import normalRandom from '../utils/normalRandom';
import calSpeed from '../utils/pace';

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

/** Duration → 'HH:MM:SS'（小程序计时器 time_data 输出格式） */
const getHHmmss = (totalSeconds: number) => {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
};

/** 合理跑步速度区间（m/s）：配速约 5'33"~11'06" /km（下限含快走边缘，防用时区间过窄抛错） */
const SPEED_MAX_M_PER_S = 3.0;
const SPEED_MIN_M_PER_S = 1.5;

/**
 * 里程调整：真实用户通常超出任务要求里程 1%-5%（为保险多跑），
 * 避免每次 km 恒等于 mileage 的分布异常。
 */
export const adjustMileage = (mileage: string): string =>
  (Number(mileage) * (1 + 0.01 + Math.random() * 0.04)).toFixed(2);

/**
 * 用时采样：落在「任务用时区间 ∩ 任务速度区间耗时 ∩ 合理跑步速度耗时」内做正态采样。
 * 返回目标等待秒数；实际 duration 以 getRunBegin→提交的真实间隔为准。
 *
 * speedLimit 为任务下发的允许速度区间（km/h，如研途健行 2.4km 为 4~7，即约 8'30"
 * 以上配速）——只在区间内采样，保证 avgSpeed=km/usedTime 必然落在服务器校验区间。
 * 缺失时退回工具内置的合理跑步速度（配速约 5'33"~11'06" /km）。
 */
export const sampleRunDuration = (
  km: string,
  minTime: string,
  maxTime: string,
  speedLimit?: { minSpeed?: string; maxSpeed?: string },
): number => {
  const d = Number(km);
  /* kmFinal 由轨迹实际点距累计而来（toFixed(2) 可能比采样 km 高/低 0.01），
     速度边界按 ±0.01km 保守取值，保证 avgSpeed=kmFinal/usedTime 必在校验区间内 */
  const bounds = [Number(minTime) * 60, ((d + 0.01) * 1000) / SPEED_MAX_M_PER_S];
  const ceilings = [Number(maxTime) * 60, ((d - 0.01) * 1000) / SPEED_MIN_M_PER_S];
  const maxKmh = Number(speedLimit?.maxSpeed);
  const minKmh = Number(speedLimit?.minSpeed);
  if (Number.isFinite(maxKmh) && maxKmh > 0) bounds.push(((d + 0.01) * 3600) / maxKmh);
  if (Number.isFinite(minKmh) && minKmh > 0) ceilings.push(((d - 0.01) * 3600) / minKmh);
  const lower = Math.max(...bounds);
  const upper = Math.min(...ceilings);
  if (lower > upper) {
    throw new Error('任务参数矛盾：用时区间与合理跑步速度无交集，无法生成合法数据');
  }
  const avg = (lower + upper) / 2;
  for (let i = 0; i < 50; i += 1) {
    const second = Math.floor(normalRandom(avg, (upper - lower) / 6));
    if (second >= lower && second <= upper) return second;
  }
  return Math.floor((lower + upper) / 2);
};

/**
 * 小程序版成绩请求生成器（阶段一 sunRunExercises，17 字段）。
 *
 * 时间轴自洽（修复初版缺陷）：startAt/endAt 由调用方传入——startAt 为 getRunBegin
 * 成功时刻、endAt 为提交时刻（均经 currentTimeMillis 校准），与轨迹 pointList 的
 * timestamp 覆盖窗、usedTime、avgSpeed 全部同源，服务端交叉比对一致。
 *
 * fitDegree 由调用方对生成轨迹按 calculateRouteSimilarity（5m/25m）诚实计算后传入
 * （复刻小程序 stopRun 时对真实轨迹的同源计算）。
 */
const generateSunRunExercisesReq = ({
  scantronId,
  km,
  startAt,
  endAt,
  fitDegree,
  taskId,
  route,
  snCode,
  schoolCode,
  token,
  device,
}: {
  scantronId: string;
  km: string;
  startAt: number;
  endAt: number;
  fitDegree: string;
  taskId: string;
  route: RunPoint;
  snCode: string;
  schoolCode: string;
  token: string;
  device: Device;
}): SunRunExercisesRequest => {
  const durationSecond = Math.max(1, Math.round((endAt - startAt) / 1000));
  const createTimeData = formatIsoLocal(startAt); // 'YYYY-MM-DDTHH:mm:ss'
  const endTimeData = formatIsoLocal(endAt);

  return {
    scantronId,
    stuNumber: snCode,
    schoolCode,
    runType: '0',
    km,
    usedTime: getHHmmss(durationSecond),
    fitDegree,
    avgSpeed: calSpeed(Number(km), durationSecond),
    steps: '',
    evaluateDate: createTimeData.split('T')[0]!,
    startTime: createTimeData.split('T')[1]!,
    endTime: endTimeData.split('T')[1]!,
    taskId,
    sunrunPathPointList: route.pointList,
    flag: '1',
    version: device.version,
    phoneInfo: device.phoneInfo,
    token,
  };
};

export default generateSunRunExercisesReq;
