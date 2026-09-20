/**
 * POST /api/run/start —— 启动服务端跑步作业。
 *
 * 前端只提交 { token, host?, pointId, device? }；学生身份校验、任务拉取、
 * 路线匹配全部在服务端完成（不信任客户端提交的任务/路线数据）。
 *
 * 门禁：登录启用时需会话且次数>0（对齐 /api/totoro guard 语义）；
 *      成功提交后由引擎 onSuccess 扣减额度。登录停用时开放使用。
 */
import { sessionUser, remainingRuns, consumeRun } from '../../utils/authStore';
import { fetchStudentInfo, fetchSunRunPaper, startRun } from '../../utils/runEngine';
import { getClientIp } from '../../utils/clientIp';
import { fetchSchoolList } from '../../utils/schools';
import { DEFAULT_TOTORO_HOST, type TotoroContext } from '../../utils/totoroClient';
import { pickDevice, type Device } from '../../../src/utils/device';
import type { SunRunPaper } from '../../../src/types/responseTypes/GetSunRunPaperResponse';

interface StartBody {
  token?: string;
  host?: string;
  pointId?: string;
  device?: Partial<Device>;
}

const sanitizeDevice = (d?: Partial<Device>): Device => {
  if (d && typeof d.phoneInfo === 'string' && typeof d.version === 'string' && typeof d.ua === 'string'
    && d.phoneInfo && d.version && d.ua) {
    return { phoneInfo: d.phoneInfo, version: d.version, ua: d.ua };
  }
  return pickDevice();
};

export default defineEventHandler(async (event) => {
  const authEnabled = useRuntimeConfig(event).public.authEnabled;

  // 登录门禁（停用时跳过；与 server/middleware/guard.ts 语义一致）
  if (authEnabled) {
    const user = sessionUser(event);
    if (!user) {
      setResponseStatus(event, 401);
      return { error: '请先登录', needLogin: true };
    }
    if (remainingRuns(user) <= 0) {
      setResponseStatus(event, 402);
      return { error: '跑步次数不足，请兑换新的兑换码', noRuns: true };
    }
  }

  const body = (await readBody<StartBody>(event)) ?? {};
  const token = (body.token ?? '').trim();
  const pointId = (body.pointId ?? '').trim();
  if (!token) {
    setResponseStatus(event, 400);
    return { error: '缺少龙猫ID' };
  }
  const device = sanitizeDevice(body.device);

  // 学生身份校验（同时验证 token 有效性）
  const initialCtx: TotoroContext = {
    token,
    host: (body.host ?? DEFAULT_TOTORO_HOST).replace(/\/$/, ''),
    device,
  };
  let info;
  try {
    info = await fetchStudentInfo(initialCtx);
  } catch (e) {
    setResponseStatus(event, 400);
    return { error: (e as Error).message };
  }

  // 按学校码解析正确 host（跨校 token 场景）；直接外呼学校列表，避免服务端自请求
  let host = initialCtx.host;
  try {
    const schools = await fetchSchoolList();
    const matched = schools.find((s) => s.schoolCode === info!.schoolCode)?.domainUrl;
    if (matched) host = matched.replace(/\/$/, '');
  } catch {
    /* 学校列表失败时沿用请求 host */
  }
  const ctx: TotoroContext = { ...initialCtx, host };

  // 拉取任务并匹配路线
  let paper: SunRunPaper | null;
  try {
    paper = await fetchSunRunPaper(ctx, info!.snCode, info!.schoolCampusCode ?? '');
  } catch (e) {
    console.error('[run-start] 任务拉取失败', e);
    setResponseStatus(event, 400);
    return { error: '龙猫服务器错误：任务拉取失败，请稍后再试' };
  }
  // 路线匹配：任务带路线时必须选中有效路线；无路线任务（校园取消路线选择）
  // 按自由跑处理，客户端 pointId 仅占位，引擎以校园环线合成轨迹
  const hasRoutes = !!paper?.runPointList?.length;
  const target = hasRoutes
    ? paper!.runPointList!.find((r) => r.pointId === pointId) ?? null
    : null;
  if (!paper || (hasRoutes && !target)) {
    setResponseStatus(event, 400);
    return { error: '未找到该路线（可能不在任务日期/时段内）' };
  }

  const job = startRun({
    ...ctx,
    paper,
    target,
    snCode: info!.snCode,
    schoolCode: info!.schoolCode,
    ip: getClientIp(event), // 仅供统计明细使用（成功后记 IP），不影响跑步流程
    onSuccess: authEnabled ? () => consumeRun(event) : undefined,
  });

  return { jobId: job.id, createdAt: job.createdAt };
});
