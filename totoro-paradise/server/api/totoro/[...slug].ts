/**
 * 小程序版通用代理：/api/totoro/<path> → {学校 domainUrl}/wxxcx/<path>
 *
 * 与 APK 版代理（app.xtotoro.com/app/* + RSA 密文体 + okhttp UA）的差异：
 *  - 目标 host 动态：来自请求头 x-totoro-host（前端登录选校后设置），默认主站
 *    https://wxxcx.xtotoro.com；
 *  - 鉴权：请求头 x-totoro-token → Authorization: Bearer {token}（小程序封装层行为）；
 *  - 请求体：明文 JSON 直传（content-type: application/json;charset=UTF-8）；
 *  - 请求头 🔬 对齐 capture.log 实抓：全小写 content-type + charset 头 +
 *    Referer（servicewechat.com/{appid}/{版本}/page-frame.html）+ 真机微信 UA；
 *  - method 透传（GetStudentInfoByToken 等是 GET）。
 *
 * Debug 日志（TOTORO_DEBUG=1 开启，默认开启于 dev）：
 *  - 每次请求/响应记录到控制台与 ./totoro-debug.log（追加）；
 *  - 记录内容：时间戳、方法路径、请求头（token 脱敏）、请求体、响应状态与体；
 *  - 响应体超过 2000 字符截断（轨迹类大响应只记头部）。
 */
import { appendFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { consumeRun } from '../../utils/authStore';

const DEBUG = process.env.TOTORO_DEBUG !== '0';
const DEBUG_FILE = resolve('./totoro-debug.log');
const TRUNCATE = 2000;

const writeDebug = (line: string) => {
  const stamped = `[${new Date().toISOString()}] ${line}\n`;
  if (DEBUG) {
    console.log(`[totoro-debug] ${line}`);
    try {
      appendFileSync(DEBUG_FILE, stamped);
    } catch {
      // 日志目录不存在等场景：尝试创建后重写一次，再失败则仅控制台
      try {
        mkdirSync(resolve('./'), { recursive: true });
        appendFileSync(DEBUG_FILE, stamped);
      } catch {
        /* 仅控制台 */
      }
    }
  }
};

const maskToken = (t: string) => (t ? `${t.slice(0, 12)}…${t.slice(-6)}` : '(none)');

export default defineEventHandler(async (event) => {
  const method = event.method;
  const token = getHeader(event, 'x-totoro-token') || '';
  const host = (getHeader(event, 'x-totoro-host') || 'https://wxxcx.xtotoro.com').replace(/\/$/, '');
  // 🔬 UA 与请求体 phoneInfo 必须同源（capture.log 审计）：由前端传入所选设备的 UA，
  // 未传时回退实抓样例（PLY110）——避免"UA=PLY110 而 phoneInfo=Xiaomi"的交叉矛盾
  const ua =
    getHeader(event, 'x-totoro-ua') ||
    'Mozilla/5.0 (Linux; Android 16; PLY110 Build/BP2A.250605.015; wv) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/150.0.7871.189 Mobile Safari/537.36 ' +
      'XWEB/1500117 MMWEBSDK/20260502 MMWEBID/1435 MicroMessenger/8.0.76.3141(0x28004C54) ' +
      'WeChat/arm64 Weixin NetType/WIFI Language/zh_CN ABI/arm64 MiniProgramEnv/android';

  const path = event.path.replace(/^\/api\/totoro\//, '/wxxcx/');

  let body: string | undefined;
  if (method !== 'GET' && method !== 'HEAD') {
    const json = await readBody<Record<string, unknown>>(event);
    body = json === undefined ? undefined : JSON.stringify(json);
  }

  // 🔬 实抓请求头（capture.log [128] 等）：全小写 content-type、charset、Referer、真机 UA
  const headers: Record<string, string> = {
    'content-type': 'application/json;charset=UTF-8',
    charset: 'utf-8',
    Authorization: `Bearer ${token}`,
    Referer: 'https://servicewechat.com/wx8e8598deed63f9b1/65/page-frame.html',
    'User-Agent': ua,
    'Accept-Encoding': 'gzip, deflate, br',
  };

  console.log(
    `[totoro-proxy] -> ${host}${path}`,
    body === undefined ? '(no body)' : `(${body.length} chars)`,
  );
  writeDebug(
    `REQ  ${method} ${host}${path} | Authorization=Bearer ${maskToken(token)} | ` +
      `body=${body === undefined ? '(none)' : body.length > TRUNCATE ? body.slice(0, TRUNCATE) + '…(truncated)' : body}`,
  );

  const started = Date.now();
  const res = await fetch(`${host}${path}`, { method, headers, body });

  // 记录响应（克隆读取，不影响返回流）
  let respText = '';
  try {
    const clone = res.clone();
    respText = await clone.text();
    writeDebug(
      `RESP ${res.status} ${host}${path} | ${Date.now() - started}ms | ` +
        `body=${respText.length > TRUNCATE ? respText.slice(0, TRUNCATE) + `…(truncated, ${respText.length} chars total)` : respText}`,
    );
  } catch (e) {
    writeDebug(`RESP ${res.status} ${host}${path} | (响应体读取失败: ${(e as Error).message})`);
  }

  // 授权额度：成绩提交成功（B 型 status=='00' 或 A 型 code=='0'）扣 1 次
  if (/\/sunrun\/sunRunExercises$/.test(event.path) && res.status === 200) {
    let success = false;
    try {
      const j = JSON.parse(respText);
      success = j.status === '00' || j.code === 0 || j.code === '0';
    } catch {
      /* 响应非 JSON：不扣 */
    }
    if (success) {
      consumeRun(event);
      console.log('[auth] 已扣减 1 次跑步额度');
    }
  }

  return res;
});
