/**
 * 学校列表 —— POST https://wxxcx.xtotoro.com/wxapi/platform/active/getSunRunSchoolList
 * 小程序登录页唯一不经封装层的请求：固定主站、无 Authorization、无 body，
 * 响应为独立结构 { body: [{ schoolCode, schoolName, domainUrl }] }（非 A/B/C 三型）。
 * 选校后 domainUrl 即成为后续所有 /wxxcx 请求的 host。
 * 供 schoolList.get.ts 与 run/start.post.ts 共用（避免服务端自请求相对路径）。
 */
import type { SchoolItem } from '../../src/types/responseTypes/GetSchoolListResponse';

export const fetchSchoolList = async (): Promise<SchoolItem[]> => {
  try {
    const res = await $fetch<{ body?: SchoolItem[] }>(
      'https://wxxcx.xtotoro.com/wxapi/platform/active/getSunRunSchoolList',
      {
        // 🔬 实抓 [570]：Content-Length: 0 的空 body POST（不带 {}）
        method: 'POST',
        headers: { 'content-type': 'application/json;charset=UTF-8' },
      },
    );
    return res.body ?? [];
  } catch (error) {
    console.error('[schoolList]', error);
    return [];
  }
};
