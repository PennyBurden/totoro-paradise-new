/**
 * 轨迹-路线拟合度 —— 复刻小程序模块 8D736DE5 的 calculateRouteSimilarity
 * （app-service.js:25465-25533，R=6371e3，5m 采样，25m 容差，点到线段投影在度空间）。
 *
 * 用途：对生成的轨迹**诚实计算** fitDegree（小程序在 stopRun 时对真实轨迹同源计算，
 * app-service.js:87690），使上报值与服务端用 pointList 复算的结果一致。
 * 轨迹中的 GPS 漂移窗口（见 generateRoute）会让该值自然落在 0.9x 而非恒 1.00。
 */

const R = 6371e3;

const hav = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

/** 点到线段距离（投影在经纬度度空间，与小程序实现一致的近似） */
const segDist = (
  pLat: number,
  pLng: number,
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
) => {
  const dx = lat2 - lat1;
  const dy = lng2 - lng1;
  const s2 = dx * dx + dy * dy;
  let u = 0;
  if (s2 !== 0) u = ((pLat - lat1) * dx + (pLng - lng1) * dy) / s2;
  const cx = u < 0 ? lat1 : u > 1 ? lat2 : lat1 + u * dx;
  const cy = u < 0 ? lng1 : u > 1 ? lng2 : lng1 + u * dy;
  return hav(pLat, pLng, cx, cy);
};

/**
 * @param track 用户轨迹 [[lat, lng], ...]
 * @param route 路线定义点 [[lat, lng], ...]
 * @param sampleInterval 检测点采样间隔（米），默认 5
 * @param tolerance 匹配容差（米），默认 25
 * @returns 匹配检测点 / 总检测点 ∈ [0, 1]
 */
export const calculateRouteSimilarity = (
  track: [number, number][],
  route: [number, number][],
  sampleInterval = 5,
  tolerance = 25,
): number => {
  if (!track || track.length < 2 || !route || route.length < 2) return 0;
  let matched = 0;
  let total = 0;
  for (let i = 0; i < track.length - 1; i += 1) {
    const [lat1, lng1] = track[i]!;
    const [lat2, lng2] = track[i + 1]!;
    const segLen = hav(lat1, lng1, lat2, lng2);
    const n = Math.max(1, Math.ceil(segLen / sampleInterval));
    for (let g = 0; g < n; g += 1) {
      const d = g / n;
      const pLat = lat1 + (lat2 - lat1) * d;
      const pLng = lng1 + (lng2 - lng1) * d;
      let minDist = Infinity;
      for (let j = 0; j < route.length - 1; j += 1) {
        const w = segDist(pLat, pLng, route[j]![0], route[j]![1], route[j + 1]![0], route[j + 1]![1]);
        if (w < minDist) minDist = w;
        if (minDist <= tolerance) break;
      }
      total += 1;
      if (minDist <= tolerance) matched += 1;
    }
  }
  return total === 0 ? 0 : matched / total;
};

export default calculateRouteSimilarity;
