import type BaseResponse from './BaseResponse';

/**
 * POST /wxxcx/sunrun/getSchoolTerm（A 型）—— 请求 {}，返回当前学期
 */
export default interface GetSchoolTermResponse extends BaseResponse {
  obj: { id: string; name: string };
}
