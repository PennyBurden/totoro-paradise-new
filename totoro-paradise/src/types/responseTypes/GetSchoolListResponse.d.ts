/**
 * POST https://wxxcx.xtotoro.com/wxapi/platform/active/getSunRunSchoolList
 * 唯一不经封装层的请求：固定主站、无鉴权、无 body，响应为独立结构 { body: [...] }
 * 客户端把 domainUrl→baseUrl、schoolCode→code、schoolName→name 重命名后使用
 */
export interface SchoolItem {
  schoolCode: string;
  schoolName: string;
  /** 该校专属 API 服务器地址（登录后所有 /wxxcx 请求的 host） */
  domainUrl: string;
}

export default interface GetSchoolListResponse {
  body: SchoolItem[];
}
