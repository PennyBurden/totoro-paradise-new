import type BaseResponse from './BaseResponse';

/**
 * POST /wxxcx/sunrun/sunRunExercises（B 型）
 * status=='00' 成功；失败时成绩落本地 RunInfo-{id} 供补传
 */
export default interface SunRunExercisesResponse extends BaseResponse {
  status: string;
  msg: string;
  message: string;
}
