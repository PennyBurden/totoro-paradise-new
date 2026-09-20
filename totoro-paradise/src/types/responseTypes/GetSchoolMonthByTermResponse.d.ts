import type BaseResponse from './BaseResponse';

export interface MonthItem {
  monthId: string;
  monthName: string;
  /** '1' = 当前月，自动选中 */
  ifCurrent: string;
}

/**
 * POST /wxxcx/sunrun/getSchoolMonthByTerm（C 型平铺）—— 请求 {}（不传 termId）
 */
export default interface GetSchoolMonthByTermResponse extends BaseResponse {
  monthList: MonthItem[];
}
