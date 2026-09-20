/**
 * 小程序版响应基类 —— 三轨判定并存（见《龙猫校园小程序API接口文档.md》§0）：
 *  - A 型：code=='0' 成功，数据在 obj（serverlist/*、getRunBegin 等）
 *  - B 型：status=='00' 成功，数据在 body（sunrunFace/*、sunRunExercises 等）
 *  - C 型：平铺无判定（getSunrunArch/getTermList 等，直接取字段）
 * 错误描述混用 msg / message。
 */
export default interface BaseResponse {
  code?: string | number | null;
  status?: string | null;
  msg?: string | null;
  message?: string | null;
  obj?: unknown;
  body?: unknown;
  [key: string]: unknown;
}
