import type BaseResponse from './BaseResponse';

export interface RunInfoVo {
  totalMileage: string;
  usedTime: string;
  avgPace: string;
  calorie: string;
}

/**
 * POST /wxxcx/platform/serverlist/getAppFrontPage（C 型平铺）
 * 请求 { snCode, token, stuNumber }（snCode≡stuNumber），响应整体即 frontPageData
 */
export default interface GetAppFrontPageResponse extends BaseResponse {
  todayTotalKm: string;
  todayCalorie: string;
  sunRunFreeType: number;
  sunRunInfoVo: RunInfoVo;
  freeRunInfoVo: { totalMileage: string };
}
