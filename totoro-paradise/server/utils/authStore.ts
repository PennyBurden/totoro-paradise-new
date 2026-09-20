/**
 * 用户账号 + 次数余额（服务端）。
 *
 * 模式：用户注册/登录（账号密码，会话 Cookie）→ 购买次数到账（充值码自助兑换
 * 或管理端直充）→ 每次成功提交成绩扣 1 次。
 *
 * 数据落在 totoro-auth.json（AUTH_DATA_DIR 可改），首次运行自动生成 secret/adminKey。
 * 密码存储：scrypt 加盐哈希，不存明文。
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';
import type { H3Event } from 'h3';

export interface User {
  username: string;
  /** scrypt：salt:hash（hex） */
  password: string;
  createdAt: string;
  totalRuns: number;
  usedRuns: number;
  note: string;
}

export interface RechargeCode {
  code: string;
  normalized: string;
  runs: number;
  createdAt: string;
  usedAt: string | null;
  usedBy: string | null;
}

interface AuthData {
  secret: string;
  adminKey: string;
  users: User[];
  rechargeCodes: RechargeCode[];
}

const AUTH_FILE = path.resolve(process.env.AUTH_DATA_DIR ?? '.', 'totoro-auth.json');
export const SESSION_COOKIE = 'tp_user';

const DATA: AuthData = (() => {
  try {
    return JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8')) as AuthData;
  } catch {
    const fresh: AuthData = {
      secret: crypto.randomBytes(32).toString('hex'),
      adminKey: crypto.randomBytes(6).toString('hex'),
      users: [],
      rechargeCodes: [],
    };
    save(fresh);
    // eslint-disable-next-line no-console
    console.log(`[auth] 已初始化 totoro-auth.json，管理口令 adminKey = ${fresh.adminKey}`);
    return fresh;
  }
})();

function save(data: AuthData = DATA) {
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
  fs.writeFileSync(AUTH_FILE, JSON.stringify(data, null, 2));
}

/* ---------- 密码 ---------- */
const hashPassword = (password: string) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
};
const verifyPassword = (password: string, stored: string) => {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const calc = crypto.scryptSync(password, salt, 64).toString('hex');
  return calc.length === hash.length && crypto.timingSafeEqual(Buffer.from(calc), Buffer.from(hash));
};

/* ---------- 用户 ---------- */
export const USERNAME_RE = /^[A-Za-z0-9_-]{3,20}$/;

export function createUser(username: string, password: string): { ok: boolean; message: string } {
  if (!USERNAME_RE.test(username)) return { ok: false, message: '用户名需 3-20 位字母/数字/_/-' };
  if (password.length < 6) return { ok: false, message: '密码至少 6 位' };
  if (DATA.users.some((u) => u.username === username)) return { ok: false, message: '用户名已存在' };
  DATA.users.push({
    username,
    password: hashPassword(password),
    createdAt: new Date().toISOString(),
    totalRuns: 0,
    usedRuns: 0,
    note: '',
  });
  save();
  return { ok: true, message: '注册成功' };
}

export function verifyUser(username: string, password: string): User | null {
  const user = DATA.users.find((u) => u.username === username);
  return user && verifyPassword(password, user.password) ? user : null;
}

/* ---------- 会话 Cookie（HMAC 签名） ---------- */
const b64u = (s: string) => Buffer.from(s, 'utf8').toString('base64url');
const hmac = (s: string) => crypto.createHmac('sha256', DATA.secret).update(s).digest('base64url');

const signSession = (username: string) => {
  const payload = b64u(JSON.stringify({ u: username, t: Date.now() }));
  return `${payload}.${hmac(payload)}`;
};

const verifySessionValue = (value: string): string | null => {
  const [payload, sig] = value.split('.');
  if (!payload || !sig || hmac(payload) !== sig) return null;
  try {
    const { u } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof u === 'string' && DATA.users.some((x) => x.username === u) ? u : null;
  } catch {
    return null;
  }
};

export function sessionUser(event: H3Event): User | null {
  const raw = getCookie(event, SESSION_COOKIE);
  if (!raw) return null;
  const username = verifySessionValue(raw);
  return username ? (DATA.users.find((u) => u.username === username) ?? null) : null;
}

export function issueSession(event: H3Event, username: string) {
  setCookie(event, SESSION_COOKIE, signSession(username), {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 365 * 24 * 3600,
    path: '/',
  });
}

export function clearSession(event: H3Event) {
  deleteCookie(event, SESSION_COOKIE, { path: '/' });
}

/* ---------- 充值码与管理 ---------- */
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export const genCodeString = () => {
  const pick = (n: number) =>
    Array.from({ length: n }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join('');
  return `TP-${pick(5)}-${pick(5)}`;
};
export const normalizeCode = (input: string) => input.toUpperCase().replace(/[^A-Z0-9]/g, '');

export function createRechargeCodes(count: number, runs: number, note = ''): RechargeCode[] {
  const made: RechargeCode[] = [];
  for (let i = 0; i < count; i++) {
    const code = genCodeString();
    made.push({
      code,
      normalized: normalizeCode(code),
      runs,
      createdAt: new Date().toISOString(),
      usedAt: null,
      usedBy: null,
    });
  }
  DATA.rechargeCodes.push(...made);
  if (note) {
    // 备注仅记录在日志意义层面：充值码未用前不知道归属，兑换后 usedBy 即归属
  }
  save();
  return made;
}

/** 充值码兑换：次数充入当前登录用户 */
export function redeemCode(user: User, input: string): { ok: boolean; message: string; runs?: number } {
  const normalized = normalizeCode(input);
  if (!normalized) return { ok: false, message: '请输入充值码' };
  const code = DATA.rechargeCodes.find((c) => c.normalized === normalized);
  if (!code) return { ok: false, message: '充值码不存在，请核对或联系卖家' };
  if (code.usedAt) return { ok: false, message: '该充值码已被使用' };
  code.usedAt = new Date().toISOString();
  code.usedBy = user.username;
  user.totalRuns += code.runs;
  save();
  return { ok: true, message: `充值成功，+${code.runs} 次`, runs: code.runs };
}

/** 管理端直充 */
export function adminCharge(username: string, runs: number): { ok: boolean; message: string } {
  const user = DATA.users.find((u) => u.username === username);
  if (!user) return { ok: false, message: '用户不存在' };
  user.totalRuns += runs;
  save();
  return { ok: true, message: `已为 ${username} 充值 ${runs} 次` };
}

export const listUsers = () => DATA.users.map(({ password: _p, ...rest }) => rest);
export const listRechargeCodes = () => DATA.rechargeCodes.map((c) => ({ ...c }));
export const isAdmin = (key?: string | null) => !!key && key === DATA.adminKey;
export const verifyAdminCredentials = (username: string, password: string) => {
  const expectedUsername = process.env.ADMIN_USERNAME ?? 'admin';
  const expectedPassword = process.env.ADMIN_PASSWORD ?? DATA.adminKey;
  return username === expectedUsername && password === expectedPassword;
};
export const getAdminKey = () => DATA.adminKey;

/* ---------- 扣次 ---------- */
export function consumeRun(event: H3Event): boolean {
  const user = sessionUser(event);
  if (!user) return false;
  user.usedRuns += 1;
  save();
  return true;
}

export const remainingRuns = (user: User) => user.totalRuns - user.usedRuns;
