import type BaseResponse from './BaseResponse';

export interface ArchDetailPoint {
  longitude: string;
  latitude: string;
}

export interface ArchDetail {
  /** 0 不合格 / 1 合格 / 2 申诉合格 / 3 补录合格 */
  status: number;
  date: string;
  time: string;
  mileage: string;
  usedTime: string;
  avgSpeed: string;
  avgPace: string;
  /** 0 阳光跑 / 1 自由跑 */
  runType: number;
  calorie: string;
  flag: string;
  pointList: ArchDetailPoint[];
  warnType?: string;
  scorePassType?: string;
  scorePassRemark?: string;
}

/**
 * POST /wxxcx/sunrun/getSunrunArchDetail（B 型）—— 请求 { scoreId }，数据在 body
 */
export default interface GetSunRunArchDetailResponse extends BaseResponse {
  body: ArchDetail;
}
