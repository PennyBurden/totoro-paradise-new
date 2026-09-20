import type RunPoint from '../RunPoint';
import type BaseResponse from './BaseResponse';

export interface RunTimeRule {
  startTime: string;
  endTime: string;
}

/** 路线折线定义点（🔬 实抓：time 恒 null，仅 7-13 个稀疏点，真实轨迹需插值） */
export interface RouteDefPoint {
  longitude: string;
  latitude: string;
  time: null;
}

/** getSunrunPaperResponseList[] 元素（🔬 实抓：任务对象字段全集） */
export interface SunRunPaper {
  paperName: string;
  /** 🔬 实抓：任务主键（顶层 id 与 paperId 同值）；无路线任务(自由跑)作为 getRunBegin 的 paperId */
  id?: string;
  paperId?: string;
  /** 要求里程（km，字符串） */
  mileage: string;
  /** 最短/最长完成用时（分钟），换算配速区间 */
  minTime: string;
  maxTime: string;
  startDate: string;
  endDate: string;
  /** 轨迹拟合度阈值（服务端下发，🔬 实抓 '0.60'） */
  fitDegree: string;
  /** 可跑时段规则 */
  runTimeRuleList: RunTimeRule[];
  /** 可选跑步路线（打卡点） */
  runPointList: RunPoint[];
  /** 🔬 实抓：'0' = 该任务无人脸要求 */
  faceFlag?: string;
  /** 🔬 实抓：'0' = 今日未跑 */
  ifHasRun?: string;
  /** 🔬 实抓：定位容差（米，'300'） */
  offsetRange?: string;
  /** 🔬 实抓：允许速度区间（km/h，'3'~'15'） */
  minSpeed?: string;
  maxSpeed?: string;
  startTime?: string;
  endTime?: string;
  minWalkTotal?: string;
  maxWalkTotal?: string;
}

/**
 * POST /wxxcx/sunrun/getSunrunPaper（C 型平铺；🔬 capture.log 实抓确认为双层结构）
 * 请求 { stuNumber, campusId, token }（campusId 可为中文字面量 "默认校区"）。
 * 响应：任务字段【顶层平铺一份 + getSunrunPaperResponseList[0] 完整副本一份】，
 * 两层内容完全一致；真机读嵌套层，复现读任一层均可。
 */
export default interface GetSunRunPaperResponse extends BaseResponse, SunRunPaper {
  getSunrunPaperResponseList: SunRunPaper[] | null;
}
