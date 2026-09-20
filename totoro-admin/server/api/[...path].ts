/**
 * 管理代理：/api/<path> → 主站 /api/admin/<path>
 * 管理口令由本层服务端自动注入（不再让使用者输入）：
 *  - 优先环境变量 ADMIN_KEY；
 *  - 否则读取同机主站数据文件 ../totoro-paradise/totoro-auth.json 的 adminKey。
 * 主站 /api/admin/* 对公网依旧要求口令，保护不因后台免登录而弱化。
 */
import fs from 'node:fs';
import path from 'node:path';

const resolveAdminKey = (): string => {
  if (process.env.ADMIN_KEY) return process.env.ADMIN_KEY;
  try {
    const data = JSON.parse(
      fs.readFileSync(path.resolve('..', 'totoro-paradise', 'totoro-auth.json'), 'utf8'),
    ) as { adminKey?: string };
    return data.adminKey ?? '';
  } catch {
    return '';
  }
};

export default defineEventHandler(async (event) => {
  const mainUrl = (useRuntimeConfig().mainUrl as string).replace(/\/$/, '');
  const target = new URL(`${mainUrl}/api/admin/`);
  // 拼接路径与查询：丢弃客户端带来的 adminKey，注入服务端口令
  target.pathname += event.path.replace(/^\/api\//, '').split('?')[0]!.replace(/^\/+/, '');
  for (const [key, value] of Object.entries(getQuery(event))) {
    if (key === 'adminKey') continue;
    if (Array.isArray(value)) value.forEach((v) => target.searchParams.append(key, String(v)));
    else if (value !== undefined) target.searchParams.set(key, String(value));
  }
  const adminKey = resolveAdminKey();
  if (adminKey) target.searchParams.set('adminKey', adminKey);

  const method = event.method;
  let body: string | undefined;
  if (method !== 'GET' && method !== 'HEAD') {
    body = JSON.stringify((await readBody(event)) ?? {});
  }
  return fetch(target, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body,
  });
});
