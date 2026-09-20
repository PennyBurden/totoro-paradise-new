import type TrackPoint from '../TrackPoint';

/**
 * POST /wxxcx/platform/recrecord/sunRunExercisesDetail —— 轨迹提交阶段二（明文）
 * 与 APK 版差异：pointList 元素含 time/timestamp；新增 gyroscope/accelerometer
 * （线上版恒空数组，采集了未上传）与 cheatCode（motionAnalyzer verdict 文案）；
 * 无 faceData/stuNumber（人脸在跑前/跑中单独接口比对）。
 */
export default interface SunRunExercisesDetailRequest {
  /** 用户真实 GPS 轨迹 */
  pointList: TrackPoint[];
  /** 线上版恒 [] */
  gyroscope: unknown[];
  /** 线上版恒 [] */
  accelerometer: unknown[];
  /** motionAnalyzer 判定文案：正常跑步/疑似使用代步工具/长时间静止/运动轨迹异常/疑似全程走路 */
  cheatCode: string;
  scantronId: string;
  token: string;
}
