import type { Ref } from 'vue';
import type UserInfo from '~~/src/types/UserInfo';
import { pickDevice } from '~~/src/utils/device';

/**
 * 小程序版会话。
 * 与 APK 版差异：token 来自 wx.login code 换取（getLesseeServerByNewDecode）或用户从
 * 小程序抓包直接填入；身份对象是 userInfo（GetStudentInfoByToken 的 obj，含 snCode），
 * 无 schoolId/campusId 分离 —— 校区字段为 schoolCampusCode。
 * host 为所选学校 domainUrl，决定代理层请求目标。
 */
interface Session {
  token: string;
  /** 学校 API 服务器（domainUrl），默认主站 */
  host: string;
  schoolCode: string;
  schoolName: string;
  userInfo: UserInfo | null;
  /** 每会话随机固定一台（多用户场景避免全量同型号指纹） */
  device: ReturnType<typeof pickDevice>;
}

const STORAGE_KEY = 'totoroSession';

const useSession = () =>
  useState<Session>('totoroSession', () => {
    const fallback: Session = {
      token: '',
      host: 'https://wxxcx.xtotoro.com',
      schoolCode: '',
      schoolName: '',
      userInfo: null,
      device: pickDevice(),
    };
    // SPA 刷新后 useState 重建：从 localStorage 恢复登录态（真机行为等价物）
    if (import.meta.client) {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw) as Partial<Session>;
          return { ...fallback, ...saved };
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    return fallback;
  });

/** 登录成功/会话更新后持久化 */
export const persistSession = (session: Session) => {
  if (import.meta.client) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      /* 配额满等场景静默失败 */
    }
  }
};

/** 解绑：清掉持久化会话并重置传入的 session ref（重新绑定龙猫ID前调用，避免 token↔scanned 跳转死循环） */
export const resetSession = (session: Ref<Session>) => {
  if (import.meta.client) {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* 忽略 */
    }
  }
  session.value.token = '';
  session.value.host = 'https://wxxcx.xtotoro.com';
  session.value.schoolCode = '';
  session.value.schoolName = '';
  session.value.userInfo = null;
};

export default useSession;
