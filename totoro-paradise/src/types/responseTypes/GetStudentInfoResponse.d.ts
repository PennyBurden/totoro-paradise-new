import type BaseResponse from './BaseResponse';
import type UserInfo from '../UserInfo';

/**
 * GET /wxxcx/platform/serverlist/GetStudentInfoByToken（A 型）
 * code=='0' 时 obj 即全局 userInfo（原样存 wx.storage 'userInfo'）
 */
export default interface GetStudentInfoResponse extends BaseResponse {
  obj: UserInfo;
}
