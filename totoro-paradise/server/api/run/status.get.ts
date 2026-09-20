/**
 * GET /api/run/status?jobId= —— 查询跑步作业进度。
 * 返回快照 + 服务端计算的百分比，前端据此驱动进度环。
 */
import { getRunJob } from '../../utils/runEngine';

export default defineEventHandler((event) => {
  const jobId = getQuery(event).jobId;
  if (!jobId || typeof jobId !== 'string') {
    setResponseStatus(event, 400);
    return { error: '缺少 jobId' };
  }
  const job = getRunJob(jobId);
  if (!job) {
    setResponseStatus(event, 404);
    return { error: '作业不存在或已过期' };
  }

  const elapsed = Date.now() - job.createdAt;
  const percent = job.needMs ? Math.min(100, Math.floor((elapsed / job.needMs) * 100)) : 0;

  return {
    jobId: job.id,
    status: job.status,
    statusText: job.statusText,
    pollInfo: job.pollInfo,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    needMs: job.needMs,
    percent,
    error: job.error,
  };
});
