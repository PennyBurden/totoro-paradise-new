/**
 * 配速工具 —— 复刻小程序 run 页 calSpeed（app-service.js:87208）
 * 输出 M'SS" 格式（avgSpeed 字段用；APK 版为速度数字，语义不同）。
 */

const calSpeed = (km: number, totalSeconds: number): string => {
  if (!totalSeconds || km <= 0) return `0'00"`;
  const pace = totalSeconds / 60 / km; // 分钟/公里
  const m = Math.floor(pace);
  const s = Math.floor(60 * (pace - m));
  return `${m}'${s < 10 ? '0' : ''}${s}"`;
};

export default calSpeed;
