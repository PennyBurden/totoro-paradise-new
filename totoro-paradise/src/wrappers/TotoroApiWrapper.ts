import ky from 'ky';
import type GetAppFrontPageResponse from '../types/responseTypes/GetAppFrontPageResponse';
import type GetRunBeginResponse from '../types/responseTypes/GetRunBeginResponse';
import type GetSchoolMonthByTermResponse from '../types/responseTypes/GetSchoolMonthByTermResponse';
import type GetSchoolTermResponse from '../types/responseTypes/GetSchoolTermResponse';
import type GetStudentInfoResponse from '../types/responseTypes/GetStudentInfoResponse';
import type GetSunRunArchDetailResponse from '../types/responseTypes/GetSunRunArchDetailResponse';
import type GetSunRunPaperResponse from '../types/responseTypes/GetSunRunPaperResponse';
import type SunRunExercisesDetailResponse from '../types/responseTypes/SunRunExercisesDetailResponse';
import type SunRunExercisesResponse from '../types/responseTypes/SunRunExercisesResponse';
import type SunRunExercisesDetailRequest from '../types/requestTypes/SunRunExercisesDetailRequest';
import type SunRunExercisesRequest from '../types/requestTypes/SunRunExercisesRequest';

/**
 * 小程序版 API 封装。
 *
 * 与 APK 版（原 totoro-paradise）的差异：
 *  - 请求体全部为明文 JSON（小程序仅早操打卡 morningExercises 用 RSA，本工具不涉及）；
 *  - 鉴权走 Authorization: Bearer 头（由代理层从 x-totoro-token 头注入），
 *    多数接口请求体内冗余携带 token（与小程序页面行为一致）；
 *  - 端点前缀 /wxxcx/，host 为所选学校的 domainUrl（默认 https://wxxcx.xtotoro.com）；
 *  - 成功判定三轨：code=='0'（A 型）/ status=='00'（B 型）/ 平铺（C 型）。
 */

/** 模块级上下文：登录后由页面设置，beforeRequest 钩子注入代理头 */
const context = {
  token: '',
  host: 'https://wxxcx.xtotoro.com',
  /** 与 session.device 同源的 UA（代理层据此设置请求头，保证 UA×phoneInfo 一致） */
  ua: '',
};

export const setTotoroContext = ({ token, host, ua }: { token: string; host?: string; ua?: string }) => {
  context.token = token;
  if (host) context.host = host.replace(/\/$/, '');
  if (ua) context.ua = ua;
};

export const getTotoroContext = () => ({ ...context });

const TotoroApiWrapper = {
  client: ky.create({
    prefixUrl: '/api/totoro',
    hooks: {
      beforeRequest: [
        (request) => {
          const url = new URL(request.url);
          console.log('[totoro] -> ' + request.method + ' ' + url.pathname);
          request.headers.set('x-totoro-token', context.token);
          request.headers.set('x-totoro-host', context.host);
          if (context.ua) request.headers.set('x-totoro-ua', context.ua);
        },
      ],
      // 授权门禁的服务端响应处理：401 未激活 → 激活页；402 次数用尽 → 购买页
      afterResponse: [
        async (_request, _options, response) => {
          if (response.status === 401 && import.meta.client) {
            window.location.href = '/';
            throw new Error('请先登录');
          }
          if (response.status === 402 && import.meta.client) {
            // eslint-disable-next-line no-alert
            alert('跑步次数已用尽，请购买或充值');
            window.location.href = '/purchase';
            throw new Error('跑步次数已用尽');
          }
        },
      ],
    },
  }),

  /** A 型：GET，无 body，仅靠 Bearer 头鉴权；code=='0' 时 obj 即 userInfo */
  async getStudentInfoByToken(token: string): Promise<GetStudentInfoResponse> {
    setTotoroContext({ token });
    return this.client.get('platform/serverlist/GetStudentInfoByToken').json();
  },

  /** B 型：服务器毫秒时间戳在 body（真机可能下发字符串，消费方需 Number() 兼容） */
  async getServerTime(token: string): Promise<{ body: number | string } & Record<string, unknown>> {
    return this.client.post('platform/camera/currentTimeMillis', { json: { token } }).json();
  },

  /** B 型：起跑前置校验（真机 _continueStartRun 第一步；网络失败时真机也放行） */
  async getStartUpNote(token: string): Promise<Record<string, unknown>> {
    return this.client.post('platform/sunrunFace/startUpNote', { json: { token } }).json();
  },

  /** B 型：摄像头杆配置（🔬 实抓：未部署路线返回 data:[] + body.flag:false） */
  async getCameraConfig(lineId: string, token: string): Promise<Record<string, unknown>> {
    return this.client.post('platform/camera/getCameraConfig', { json: { lineId, token } }).json();
  },

  /** B 型：随机抽查距离配置（🔬 实抓 body 为字符串值 200/230/30；真机在人脸关闭时也请求） */
  async getRandomConfiguration(
    lineId: string,
    token: string,
  ): Promise<Record<string, unknown>> {
    return this.client
      .post('platform/sunrunFace/selectSunRunRandomConfiguration', { json: { lineId, token } })
      .json();
  },

  /** B 型：起跑配置（sunrunStartFace/sunrunPointRandom/sunrunPointShowOff） */
  async getStartConfiguration(snCode: string, token: string): Promise<Record<string, unknown>> {
    return this.client
      .post('platform/sunrunFace/selectSunRunStartConfiguration', { json: { snCode, token } })
      .json();
  },

  /** C 型：任务与路线；请求 { stuNumber, campusId, token }，campusId=userInfo.schoolCampusCode */
  async getSunRunPaper(req: {
    stuNumber: string;
    campusId: string;
    token: string;
  }): Promise<GetSunRunPaperResponse> {
    return this.client.post('sunrun/getSunrunPaper', { json: req }).json();
  },

  /** A 型（code 数字）：成功后取 scantronId，本次跑步唯一 ID。
   *  🔬 源码实为 6 字段（runType/version/phoneInfo/paperId/lineId/faceBase64），
   *  鉴权在 Bearer 头，体中无 token（与实抓 startUpNote 等"体含 token"的接口不同） */
  async getRunBegin(req: {
    runType: string;
    version: string;
    phoneInfo: string;
    paperId: string;
    lineId: string;
    faceBase64: string;
  }): Promise<GetRunBeginResponse> {
    return this.client.post('sunrun/getRunBegin', { json: req }).json();
  },

  /** B 型：阶段一成绩摘要（17 字段），status=='00' 成功 */
  async sunRunExercises(req: SunRunExercisesRequest): Promise<SunRunExercisesResponse> {
    console.log('[totoro] payload:', {
      ...req,
      sunrunPathPointList: `[${req.sunrunPathPointList.length} points]`,
    });
    return this.client.post('sunrun/sunRunExercises', { json: req }).json();
  },

  /** C 型：跑点进度（15s 轮询，跑点到达由服务端判定）；请求体仅 { scantronId }，无 token 字段 */
  async getRunPointList(scantronId: string): Promise<Record<string, unknown>> {
    return this.client.post('sunrun/getRunPointList', { json: { scantronId } }).json();
  },

  /** C 型：跑点异常状态（与 getRunPointList 并发轮询）；请求体仅 { scantronId } */
  async getRunPointListAbnormal(scantronId: string): Promise<Record<string, unknown>> {
    return this.client.post('sunrun/getRunPointListAbnormal', { json: { scantronId } }).json();
  },

  /** 阶段二轨迹：无业务判定，失败不阻断 */
  async sunRunExercisesDetail(
    req: SunRunExercisesDetailRequest,
  ): Promise<SunRunExercisesDetailResponse> {
    console.log('[totoro] payload (plaintext):', {
      ...req,
      pointList: `[${req.pointList.length} points]`,
    });
    return this.client.post('platform/recrecord/sunRunExercisesDetail', { json: req }).json();
  },

  /** A 型：当前学期 { obj: { id, name } } */
  async getSchoolTerm(): Promise<GetSchoolTermResponse> {
    return this.client.post('sunrun/getSchoolTerm', { json: {} }).json();
  },

  /** C 型：monthList 平铺；请求 {}（不传 termId，服务端按当前学期返回） */
  async getSchoolMonthByTerm(): Promise<GetSchoolMonthByTermResponse> {
    return this.client.post('sunrun/getSchoolMonthByTerm', { json: {} }).json();
  },

  /** C 型：成绩档案；请求字段与 APK 版完全不同（projectName/paperId/pageNumber 全量拉取） */
  async getSunRunArch(
    req: { monthId: string; termId: string; paperId: string } & { snCode: string; stuNumber: string; token: string },
  ): Promise<Record<string, unknown>> {
    return this.client
      .post('sunrun/getSunrunArch', {
        json: {
          projectName: '阳光跑',
          monthId: req.monthId,
          termId: req.termId,
          paperId: req.paperId,
          stuNumber: req.stuNumber,
          token: req.token,
          snCode: req.snCode,
          pageNumber: 1,
          rowNumber: 100000,
        },
      })
      .json();
  },

  /** B 型：单次成绩详情（含轨迹），数据在 body */
  async getSunRunArchDetail(scoreId: string): Promise<GetSunRunArchDetailResponse> {
    return this.client.post('sunrun/getSunrunArchDetail', { json: { scoreId } }).json();
  },

  /** C 型：首页汇总，请求 { snCode, token, stuNumber }（snCode≡stuNumber） */
  async getAppFrontPage(req: { snCode: string; token: string }): Promise<GetAppFrontPageResponse> {
    return this.client
      .post('platform/serverlist/getAppFrontPage', {
        json: { snCode: req.snCode, token: req.token, stuNumber: req.snCode },
      })
      .json();
  },

  /** B 型：早操签到任务页（🔬 实抓 [580]：登录后立即调用；无早操任务时返回空数据）。
   *  会话指纹补水——真机每次进入首页都会请求，工具对齐以保持会话画像一致 */
  async getMornSignPaper(req: { snCode: string; token: string }): Promise<Record<string, unknown>> {
    return this.client
      .post('platform/mornSign/getMornSignPaper', {
        json: { snCode: req.snCode, token: req.token, stuNumber: req.snCode },
      })
      .json();
  },

  /** B 型：阳光跑公告（🔬 实抓 [584]：getAppFrontPage 之后调用，请求体 {}）。
   *  会话指纹补水——同上，仅保持请求流水一致 */
  async selectSunRunNote(): Promise<Record<string, unknown>> {
    return this.client.post('platform/note/selectSunRunNote', { json: {} }).json();
  },
};

export default TotoroApiWrapper;
