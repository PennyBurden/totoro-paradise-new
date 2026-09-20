/**
 * 小程序版轨迹点（sunRunExercisesDetail.pointList 元素）。
 * 与 APK 版 {longitude, latitude} 字符串不同：数值类型 + 两个时间字段；
 * timestamp 为服务端校正后的毫秒（getRealTime = Date.now() + g）。
 */
export default interface TrackPoint {
  latitude: number;
  longitude: number;
  /** 'YYYY-MM-DD HH:MM:SS'（getCurrentTime，零填充） */
  time: string;
  /** 服务端校正后的毫秒时间戳 */
  timestamp: number;
}
