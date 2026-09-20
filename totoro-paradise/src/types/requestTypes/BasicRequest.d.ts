/**
 * 小程序版基础请求字段。
 * 与 APK 版不同：身份主键是 schoolCode + snCode（无 schoolId/campusId 分离），
 * campusId 在 getSunrunPaper 场景下取 userInfo.schoolCampusCode；
 * token 同时出现在 Authorization: Bearer 头与请求体（多数接口冗余携带）。
 */
export default interface BasicRequest {
  snCode: string;
  stuNumber: string;
  token: string;
  campusId?: string;
}
