/**
 * 服务端时间校准 —— 复刻小程序 syncServerTime 逻辑
 * （POST /wxxcx/platform/camera/currentTimeMillis，g = serverMs - Date.now()）。
 * 轨迹点 timestamp 用校正时间，防止客户端改表导致轨迹时间戳与服务端时钟不符。
 */

let offset = 0;
let synced = false;

export const setServerTime = (serverMillis: number) => {
  offset = serverMillis - Date.now();
  synced = true;
};

export const isServerTimeSynced = () => synced;

/** 复刻小程序 getRealTime() = Date.now() + g */
export const getRealTime = () => Date.now() + offset;

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

/** 复刻小程序 getCurrentTime()：'YYYY-MM-DD HH:MM:SS' 零填充（轨迹点 time 字段） */
export const formatTrackTime = (millis: number) => {
  const d = new Date(millis);
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
};

/** 复刻小程序计时器 formatTime()：'YYYY-MM-DDTHH:mm:ss'（create_time_data/end_time_data） */
export const formatIsoLocal = (millis: number) => {
  const d = new Date(millis);
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
};
