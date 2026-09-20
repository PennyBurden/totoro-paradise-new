/**
 * 使用统计（服务端，文件落盘 totoro-stats.json）。
 *
 * 口径：
 *  - visits：访问量，前端每浏览器会话 POST /api/stats/visit 一次；
 *  - runs：正式跑成功次数（服务端引擎成绩提交成功 +1）；
 *  - runUsers：使用人数，按学号哈希去重（不落明文，单日粒度存储）；
 *  - visitors：访问信标明细（时刻/IP/UA），单日上限 500 条，超出丢最旧；
 *  - runLogs：正式跑成功明细（时刻/IP/学号哈希），单日上限 200 条，超出丢最旧。
 * IP/UA 明细仅运营者后台可见、仅保留 30 天（超过 30 天的旧日清空明细，
 * visits/runs/runUsers 聚合数永久保留）。
 * 仅供后台 /api/admin/stats 读取。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/** 访问信标明细条目（旧数据无此数组，按空数组处理） */
interface VisitorEntry {
  /** 事件时刻（ISO UTC） */
  t: string;
  ip: string;
  /** User-Agent（截断 200 字符） */
  ua: string;
}

/** 正式跑成功明细条目（旧数据无此数组，按空数组处理） */
interface RunLogEntry {
  t: string;
  ip: string;
  /** 学号哈希（16 hex） */
  user: string;
}

interface DayStat {
  day: string;
  visits: number;
  runs: number;
  /** 当日去重使用者的学号哈希（16 hex） */
  runUsers: string[];
  visitors?: VisitorEntry[];
  runLogs?: RunLogEntry[];
}

interface StatsData {
  days: DayStat[];
}

const FILE = path.resolve(process.env.STATS_DATA_DIR ?? '.', 'totoro-stats.json');
/** 最多保留 400 天明细，防止文件无限增长 */
const MAX_DAYS = 400;
/** IP/UA 明细只保留近 30 天（30 天外的旧日清空明细，聚合数不受影响） */
const DETAIL_DAYS = 30;
/** 单日明细条数上限（超出丢最旧） */
const MAX_VISITORS_PER_DAY = 500;
const MAX_RUN_LOGS_PER_DAY = 200;

const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

let DATA: StatsData = { days: [] };
try {
  DATA = JSON.parse(fs.readFileSync(FILE, 'utf8'));
} catch {
  DATA = { days: [] };
}

const save = () => {
  try {
    fs.writeFileSync(FILE, JSON.stringify(DATA));
  } catch (e) {
    console.error('[stats] 写入失败', e);
  }
};

/** 超过 30 天的旧日清空 visitors/runLogs 明细（聚合数永久保留，防文件膨胀） */
const purgeStaleDetails = () => {
  const cutoff = dayKey(new Date(Date.now() - (DETAIL_DAYS - 1) * 86400000));
  for (const d of DATA.days) {
    if (d.day < cutoff && ((d.visitors && d.visitors.length > 0) || (d.runLogs && d.runLogs.length > 0))) {
      d.visitors = [];
      d.runLogs = [];
    }
  }
};

const todayEntry = (): DayStat => {
  const key = dayKey();
  purgeStaleDetails();
  let d = DATA.days.find((x) => x.day === key);
  if (!d) {
    d = { day: key, visits: 0, runs: 0, runUsers: [] };
    DATA.days.push(d);
    DATA.days.sort((a, b) => (a.day < b.day ? -1 : 1));
    if (DATA.days.length > MAX_DAYS) DATA.days = DATA.days.slice(-MAX_DAYS);
  }
  return d;
};

/** 访问信标：访问量 +1，并记一条 IP/UA 明细 */
export const recordVisit = (ip: string, ua: string) => {
  const d = todayEntry();
  d.visits += 1;
  if (!d.visitors) d.visitors = [];
  d.visitors.push({ t: new Date().toISOString(), ip, ua: ua.slice(0, 200) });
  if (d.visitors.length > MAX_VISITORS_PER_DAY) d.visitors = d.visitors.slice(-MAX_VISITORS_PER_DAY);
  save();
};

export const hashSn = (snCode: string) =>
  crypto.createHash('sha256').update(`totoro-run:${snCode}`).digest('hex').slice(0, 16);

/** 正式跑成功：次数 +1，当日人数去重，并记一条 IP 明细 */
export const recordRunSuccess = (snCode: string, ip?: string) => {
  const d = todayEntry();
  d.runs += 1;
  const h = hashSn(snCode);
  if (!d.runUsers.includes(h)) d.runUsers.push(h);
  if (!d.runLogs) d.runLogs = [];
  d.runLogs.push({ t: new Date().toISOString(), ip: ip || '', user: h });
  if (d.runLogs.length > MAX_RUN_LOGS_PER_DAY) d.runLogs = d.runLogs.slice(-MAX_RUN_LOGS_PER_DAY);
  save();
};

/** 近 N 天（含今日）的日明细，按日期升序（明细只在近 30 天内存在） */
const recentDetailDays = (n: number): DayStat[] => {
  const cutoff = dayKey(new Date(Date.now() - (n - 1) * 86400000));
  return DATA.days.filter((d) => d.day >= cutoff).sort((a, b) => (a.day < b.day ? -1 : 1));
};

export const getStatsSummary = () => {
  const key = dayKey();
  const today = DATA.days.find((d) => d.day === key);
  const allUsers = new Set<string>();
  for (const d of DATA.days) for (const h of d.runUsers) allUsers.add(h);

  // ---- IP/UA 明细（近 14 天；改造前的旧数据无明细，按空数组处理） ----
  const days14 = recentDetailDays(14);

  // 访问信标按 IP 聚合：次数 + 最近一次的时刻与 UA（升序遍历，天然按时间推进）
  const byIp = new Map<string, { ip: string; visits: number; lastT: string; ua: string }>();
  for (const d of days14) {
    for (const v of d.visitors ?? []) {
      const cur = byIp.get(v.ip) ?? { ip: v.ip, visits: 0, lastT: v.t, ua: v.ua };
      cur.visits += 1;
      if (v.t >= cur.lastT) {
        cur.lastT = v.t;
        cur.ua = v.ua;
      }
      byIp.set(v.ip, cur);
    }
  }
  const ipSummary = [...byIp.values()].sort((a, b) => b.visits - a.visits).slice(0, 50);

  // 拍平倒序（新 → 旧；日按升序拍平后整体 reverse 即为时间倒序）
  const visitorLog = days14
    .flatMap((d) => (d.visitors ?? []).map((v) => ({ day: d.day, t: v.t, ip: v.ip, ua: v.ua })))
    .reverse()
    .slice(0, 100);
  const runLog = days14
    .flatMap((d) => (d.runLogs ?? []).map((r) => ({ day: d.day, t: r.t, ip: r.ip, user: r.user })))
    .reverse()
    .slice(0, 50);

  return {
    today: {
      day: key,
      visits: today?.visits ?? 0,
      runs: today?.runs ?? 0,
      runUsers: today?.runUsers.length ?? 0,
    },
    totals: {
      visits: DATA.days.reduce((s, d) => s + d.visits, 0),
      runs: DATA.days.reduce((s, d) => s + d.runs, 0),
      runUsers: allUsers.size,
    },
    recent: [...DATA.days]
      .sort((a, b) => (a.day < b.day ? 1 : -1))
      .slice(0, 7)
      .map((d) => ({ day: d.day, visits: d.visits, runs: d.runs, runUsers: d.runUsers.length })),
    ipSummary,
    visitorLog,
    runLog,
  };
};
