/**
 * 小程序版 userInfo —— 来源 GET /wxxcx/platform/serverlist/GetStudentInfoByToken
 * 🔬 capture.log [579] 实抓全量 30 字段（存 wx.storage 'userInfo'）。
 * 注意：**没有 name / phone 字段**（真机代码 `studentName || name`、`s.phone || ''` 是
 * 防御性写法）——姓名是 studentName，电话是 phoneNumber。
 */
export default interface UserInfo {
  /** 学生主键 smallStdent-… */
  studentId: string;
  /** 学生证号/学号 —— 身份主键 */
  snCode: string;
  studentName: string;
  /** 身份证号 🔬（敏感字段，实抓确认存在） */
  idNumber: string;
  schoolCode: string;
  schoolName: string;
  /** 校区代码 —— getSunrunPaper 的 campusId 来源（实抓可为中文 "默认校区"） */
  schoolCampusCode: string;
  schoolCampusName: string;
  /** 🔬 电话字段名是 phoneNumber（不存在 phone） */
  phoneNumber: string;
  className: string;
  headPortrait: string | null;
  qq: string | null;
  ifActive: number;
  /** 微信 unionId/openId（实抓两者同值） */
  unionId: string;
  openId: string;
  teachClassName: string | null;
  /** 性别：'男' / '女' */
  sex: string;
  teacherName: string | null;
  teacherId: string | null;
  /** ⚠ 实抓拼写错误（应为 teacherPhoneNumber） */
  teaherPhoneNumber: string | null;
  /** ⚠ 实抓拼写错误（应为 inSchoolYear） */
  inSchooleYear: string;
  /** 人脸底库照片 URL（checkFaceSave 上传后下发；未建档 null） */
  faceDataUrl: string | null;
  adminClassId: string;
  adminClassName: string;
  studentGrade: string;
  studentGradeName: string | null;
  /** 角色：0 = 学生 */
  teacherType: number;
  adminType: number;
  [key: string]: unknown;
}
