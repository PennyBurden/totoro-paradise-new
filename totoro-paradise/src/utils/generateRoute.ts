import type RunPoint from '../types/RunPoint';
import type TrackPoint from '../types/TrackPoint';
import { distanceBetweenPoints } from './distanceCalculator';
import { formatTrackTime } from './serverTime';
import normalRandom from './normalRandom';

type AMapPoint = [number, number]; // [lng, lat]（高德序，与 distanceBetweenPoints 一致）

/** 轨迹点距（米）：真机 onLocationChange 秒级回调、跑步速度下每点约 3-6m */
const SPACING_M = 4;
/**
 * GPS 噪声标准差（度）。操场/校园开阔地真机 GPS 精度通常 3-8m，
 * 取 σ≈0.8m（AR(1) 稳态约 2.3m 偏差）——跑步者沿跑道线跑，轨迹贴合路线、
 * 偶有小幅抖动，不会出现 20m+ 的系统性偏移（那是"假轨迹"的主要特征）。
 */
const DEG_STD = 0.8 / 111320;
/** 纬度方向每米度数 */
const DEG_PER_M = 1 / 111320;
/** 环形路线判定：路线首尾定义点距离（米）小于该值视为闭合环 */
const LOOP_CLOSE_M = 50;

/**
 * 小程序版轨迹生成（真实跑步形态版）。
 *
 * 形态原则（对应真实操场/校园跑步）：
 *  - **固定方向**：环形路线（操场）沿单向循环跑圈；开放路线也**单向推进**，
 *    到达终点定义点即回到起点继续（或到达即停，以先满足里程者为准），
 *    不做 ping-pong 往返折返；
 *  - **随机起点**：闭合环沿周长均匀随机进场，开放路线在能跑满里程的
 *    范围内随机（真机从任意入口开跑，不会每次都从同一个定义点出发），
 *    终点随"起点+里程"自然随机；
 *  - **跑满即停**：里程达标时停在**当前位置**，不直线返回起点——真机结束
 *    跑步是原地长按结束，轨迹终点即当时所在位置；
 *  - **贴线**：AR(1) 小幅噪声（σ≈0.8m），轨迹沿路线形状平滑贴合，
 *    fitDegree 自然落在 0.99+（真实操场跑步本就是高拟合度）；
 *  - 保留 GPS 停滞段与回调丢拍（真机行为）。
 *
 * 时间轴（承接上版）：严格覆盖 [startAt, endAt]，速度低频起伏+噪声后归一化，
 * 与 usedTime/avgSpeed/km 同源。
 */
const generateRoute = ({
  distance,
  route,
  startAt,
  endAt,
}: {
  distance: string;
  route: RunPoint;
  startAt: number;
  endAt: number;
}) => {
  const routePoints: AMapPoint[] = route.pointList.map((p) => [
    Number(p.longitude),
    Number(p.latitude),
  ]);
  if (routePoints.length < 2 || !routePoints[0] || Number.isNaN(routePoints[0][1])) {
    throw new Error('任务路线为空');
  }
  const n = routePoints.length;
  const closed =
    distanceBetweenPoints(routePoints[0]!, routePoints[n - 1]!) < LOOP_CLOSE_M;
  // 闭合环的真实定义点首尾几乎重合（实抓 1-9m），但尾点→首点这条几米长的
  // 小段方向随机，跑圈经过时会产生一次 ~180° 假折返；且首点与尾点相邻重复。
  // 处理：去掉与首点过近（<10m）的尾定义点，闭合环由首点直接衔接
  let loop: AMapPoint[] = routePoints;
  if (closed) {
    while (
      loop.length > 3 &&
      distanceBetweenPoints(loop[0]!, loop[loop.length - 1]!) < 10
    ) {
      loop = loop.slice(0, -1);
    }
  }
  const ln = loop.length;

  /**
   * 定义点游标：单向前进，永不折返。
   *  - 闭合环：idx 循环 (idx+1)%ln，跑圈；
   *  - 开放路线：推进到尾点即停（跑不满目标里程也在尾点停——
   *    不跳回起点制造 200m 直线"瞬移"，也不折返）。
   *    绝大多数校园任务为闭合环；开放路线跑不满属任务配置问题，
   *    km 会如实反映实际里程，服务端按 km 与轨迹一致性判定。
   */
  let idx = 0;
  const nextIndex = () => {
    if (!closed && idx === ln - 1) return -1; // 开放路线尾点：终止信号
    idx = (idx + 1) % ln;
    return idx;
  };

  // 随机起点：真机从跑道上任意入口/任意位置进场开跑，不固定在首个定义点
  //（实抓确认：任务无 signPointList 签到点约束，起点位置不受服务端限制）。
  //  - 闭合环：沿周长均匀取任意位置；
  //  - 开放路线：在 [0, 路线长-目标里程] 内随机——起点太靠后会导致到尾
  //    仍跑不满目标里程；跑不满的任务（路线长<里程）从路线起点出发。
  //  落点插值在定义点之间（不局限于定义点本身）；起点定在段 i 上，
  //  游标从 i 出发，第一段只走剩余部分。终点 = 起点 + 里程，自然随机。
  const distanceM = Number(distance) * 1000;
  const segCount = closed ? ln : ln - 1;
  const segLens: number[] = [];
  let peri = 0;
  for (let i = 0; i < segCount; i += 1) {
    const segLen = Math.max(0.1, distanceBetweenPoints(loop[i]!, loop[(i + 1) % ln]!));
    segLens.push(segLen);
    peri += segLen;
  }
  const maxStart = closed ? peri : Math.max(0, peri - distanceM);
  let d0 = Math.random() * maxStart;
  let startPt: AMapPoint = loop[0]!;
  for (let i = 0; i < segCount; i += 1) {
    if (d0 <= segLens[i]!) {
      const f = d0 / segLens[i]!;
      const a = loop[i]!;
      const b = loop[(i + 1) % ln]!;
      startPt = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
      idx = i;
      break;
    }
    d0 -= segLens[i]!;
  }

  // GPS 误差建模:AR(1) 时间相关噪声(ρ=0.95)——平滑漂移,非逐点独立抖动
  let errLat = 0;
  let errLng = 0;
  const rho = 0.95;
  const innov = Math.sqrt(1 - rho * rho) * DEG_STD;
  const addNoise = (p: AMapPoint): AMapPoint => {
    errLat = rho * errLat + normalRandom(0, innov);
    errLng = rho * errLng + normalRandom(0, innov);
    return [p[0] + errLng, p[1] + errLat];
  };

  // ① 沿定义点按 ~4m 间距插值，从随机起点开始**单向**累积到目标里程
  //    里程按【实际生成的相邻点距】累加（与 km 字段/服务端复算口径一致）；
  //    cur 追踪当前定义点位置——起点在段中间时第一段只走剩余部分
  const pts: AMapPoint[] = [addNoise(startPt)];
  let acc = 0;
  let guard = 0;
  let cur = startPt;
  while (acc < distanceM && guard < 1e6) {
    guard += 1;
    const nb = nextIndex();
    if (nb === -1) break; // 开放路线到达尾点：跑满即停（此处为"到尾即停"）
    const b = loop[nb]!;
    const segM = Math.max(0.1, distanceBetweenPoints(cur, b));
    const steps = Math.max(1, Math.round(segM / SPACING_M));
    for (let j = 1; j <= steps && acc < distanceM; j += 1) {
      const f = j / steps;
      const p = addNoise([cur[0] + (b[0] - cur[0]) * f, cur[1] + (b[1] - cur[1]) * f]);
      acc += distanceBetweenPoints(pts[pts.length - 1]!, p);
      pts.push(p);
    }
    cur = b;
  }
  // 跑满即停：末点即当前位置（不返回起点）；整圈数恰使末点落回起点附近时
  // 微移开，避免"整圈闭合后停在进场点"的规整感
  if (closed && pts.length > 3) {
    const tailGap = distanceBetweenPoints(pts[pts.length - 1]!, pts[0]!);
    const lastStep = distanceBetweenPoints(pts[pts.length - 2]!, pts[pts.length - 1]!);
    if (tailGap < SPACING_M && lastStep < SPACING_M * 1.5) {
      // 末点恰好回到起点附近：微移开，避免"整圈闭合后停在起点"的规整感
      pts[pts.length - 1] = [
        pts[pts.length - 1]![0] + normalRandom(0, 3e-6),
        pts[pts.length - 1]![1] + normalRandom(0, 3e-6),
      ];
    }
  }

  // ② GPS 停滞段:1-3 处 × 2-3 个连续点保持在前一位置 ±0.2m（真实零速段）。
  //     停滞恢复点处间隔为 (hlen+1)×点距（≈12-16m），与丢拍间隔同量级。
  //     停滞+恢复使该处时间戳大幅拉长（停滞点耗时、恢复点跳进），这是真机
  //     停滞（等红灯/系鞋带）在时间轴上的真实表现。
  const count = pts.length;
  const holdCount = 1 + Math.floor(Math.random() * 3);
  const holdEnds = new Set<number>(); // 各停滞段的恢复点索引（丢拍需避开）
  const held = new Set<number>(); // 已被停滞段占用的索引（防止两段相邻叠加）
  for (let h = 0; h < holdCount && count > 60; h += 1) {
    const hlen = 2 + Math.floor(Math.random() * 2);
    let hs = -1;
    // 新停滞段需与已有停滞段隔开 ≥3 个点——相邻停滞段会叠加出
    // 5-6 点连续停滞，恢复时间隔 20m+（真机零速段通常 ≤3s）
    for (let tries = 0; tries < 10 && hs === -1; tries += 1) {
      const cand = 10 + Math.floor(Math.random() * Math.max(1, count - hlen - 20));
      let ok = true;
      for (let k = cand - 3; k <= cand + hlen + 2; k += 1) {
        if (held.has(k)) ok = false;
      }
      if (ok) hs = cand;
    }
    if (hs === -1) continue;
    for (let j = 0; j < hlen; j += 1) {
      const base = pts[hs + j - 1]!;
      pts[hs + j] = [base[0] + normalRandom(0, 2e-6), base[1] + normalRandom(0, 2e-6)];
      held.add(hs + j);
    }
    holdEnds.add(hs + hlen);
  }

  // ②' 回调丢拍:随机删除 2-5 个内部点（真机偶发跳拍，间隔与段长同放）；
  //     避免删除相邻点、以及停滞段的恢复点——两者叠加会产生 20m+ 超长间隔，
  //     真机单次跳拍只丢 1 个回调（1-3s），间隔翻倍而非数倍
  const dropCount = 1 + Math.floor(Math.random() * 4);
  const dropSet = new Set<number>();
  for (let d2 = 0; d2 < dropCount && count > 40; d2 += 1) {
    const cand = 8 + Math.floor(Math.random() * (pts.length - 16));
    if (dropSet.has(cand - 1) || dropSet.has(cand + 1) || holdEnds.has(cand)) continue;
    dropSet.add(cand);
  }
  if (dropSet.size > 0) {
    const filtered = pts.filter((_, i) => !dropSet.has(i));
    pts.length = 0;
    pts.push(...filtered);
  }

  // ③ 时间戳：速度 = 基速 ×（低频起伏 + 噪声），归一化后严格覆盖 [startAt, endAt]
  const segM: number[] = [];
  let totalM = 0;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const m = distanceBetweenPoints(pts[i]!, pts[i + 1]!);
    segM.push(m);
    totalM += m;
  }
  const totalMs = Math.max(1, endAt - startAt);
  const baseSpeed = totalM / (totalMs / 1000); // m/s，与 avgSpeed/usedTime 同源
  const phase = Math.random() * Math.PI * 2;
  const omega = (Math.PI * 2) / (120 + Math.random() * 180); // 2-5 分钟一个起伏周期
  const rawDt: number[] = [];
  let sum = 0;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const speed = Math.max(
      baseSpeed * 0.4,
      baseSpeed * (1 + 0.12 * Math.sin(phase + omega * i) + normalRandom(0, 0.05)),
    );
    const dt = segM[i]! / speed;
    rawDt.push(dt);
    sum += dt;
  }
  const scale = totalMs / 1000 / sum;

  const mockRoute: TrackPoint[] = [];
  let t = startAt;
  for (let i = 0; i < pts.length; i += 1) {
    const timestamp = i === 0 ? startAt : i === pts.length - 1 ? endAt : Math.round(t);
    mockRoute.push({
      longitude: Number(pts[i]![0].toFixed(6)),
      latitude: Number(pts[i]![1].toFixed(6)),
      time: formatTrackTime(timestamp),
      timestamp,
    });
    if (i < pts.length - 1) t += rawDt[i]! * scale * 1000;
  }

  return {
    mockRoute,
    distance: (totalM / 1000).toFixed(2),
    /** 生成轨迹隐含的平均速度（m/s），用于自检 */
    baseSpeed,
  };
};

export default generateRoute;
