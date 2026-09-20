import type BaseResponse from './BaseResponse';

/**
 * POST /wxxcx/platform/recrecord/sunRunExercisesDetail
 * 无业务判定：success 与 doFail 均 resolve，失败不阻断主流程
 */
export default interface SunRunExercisesDetailResponse extends BaseResponse {}
