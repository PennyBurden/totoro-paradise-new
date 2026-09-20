import type RunPoint from '../RunPoint';

/**
 * POST /wxxcx/sunrun/sunRunExercises —— 跑步成绩提交阶段一（17 字段，不含用户轨迹）
 * 与 APK 版差异：无 uuid/baseStation/mac/headImage/consume/warnFlag/warnType/ifLocalSubmit/
 * LocalSubmitReason/sensorString/submitDate/routeId/pointList/phoneNumber/schoolId；
 * 新增 scantronId（getRunBegin 下发）、sunrunPathPointList（预设路线定义点，非用户轨迹）；
 * steps 线上版恒空串（计步引擎未启用）；flag 恒 '1'；avgSpeed 为 M'SS" 配速格式。
 */
export default interface SunRunExercisesRequest {
  scantronId: string;
  stuNumber: string;
  schoolCode: string;
  /** 0 阳光跑 / 1 自由跑（本地 runType==2 映射为 1） */
  runType: string;
  /** GPS 累积里程，'x.xx' 字符串 */
  km: string;
  /** 'HH:MM:SS' 计时器输出 */
  usedTime: string;
  /** 轨迹相似度 0-1，客户端按 calculateRouteSimilarity(5m/25m) 对轨迹计算后上报（本工具诚实计算，漂移窗使其自然落 0.9x-1.00） */
  fitDegree: string;
  /** 配速 M'SS" */
  avgSpeed: string;
  /** 线上版恒 '' */
  steps: string;
  /** create_time_data.split('T')[0] */
  evaluateDate: string;
  /** split('T')[1] */
  startTime: string;
  /** split('T')[1] */
  endTime: string;
  taskId: string;
  /** 预设路线定义点（getSunrunPaper 的路线 pointList 原样回传） */
  sunrunPathPointList: RunPoint['pointList'];
  /** 恒 '1' */
  flag: string;
  version: string;
  /** brand & model & system */
  phoneInfo: string;
  token: string;
}
