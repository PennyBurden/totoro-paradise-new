import type BaseResponse from './BaseResponse';

/**
 * POST /wxxcx/sunrun/getRunBegin（A 型，code 为数字）
 * code==0 时 scantronId = 本次跑步唯一 ID（后续轮询/打卡/提交全部依赖它）
 */
export default interface GetRunBeginResponse extends BaseResponse {
  code: number;
  msg: string;
  scantronId: string;
}
