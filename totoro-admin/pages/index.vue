<script setup lang="ts">
/**
 * 后台管理系统（独立于主站）：左侧边栏导航（概览 / 充值码 / 用户管理），黑白极简风格。
 * 所有数据操作经本站 /api 代理转发到主站 /api/admin/*。
 */
interface CodeRow {
  code: string;
  runs: number;
  createdAt: string;
  usedAt: string | null;
  usedBy: string | null;
}
interface UserRow {
  username: string;
  createdAt: string;
  totalRuns: number;
  usedRuns: number;
  note: string;
}
interface DayStat {
  day: string;
  visits: number;
  runs: number;
  runUsers: number;
}
interface IpSummaryRow {
  ip: string;
  visits: number;
  lastT: string;
  ua: string;
}
interface VisitorLogRow {
  day: string;
  t: string;
  ip: string;
  ua: string;
}
interface RunLogRow {
  day: string;
  t: string;
  ip: string;
  user: string;
}
interface RunStats {
  today: DayStat;
  totals: { visits: number; runs: number; runUsers: number };
  recent: DayStat[];
  /* 老主站（未重启升级）返回时可能缺以下字段，展示层按空数组兜底 */
  ipSummary?: IpSummaryRow[];
  visitorLog?: VisitorLogRow[];
  runLog?: RunLogRow[];
}

useHead({ title: '龙猫跑轮 · 后台管理' });

const message = ref('');
const loading = ref(false);
const tab = ref<'overview' | 'stats' | 'codes' | 'users'>('overview');

const codes = ref<CodeRow[]>([]);
const users = ref<UserRow[]>([]);
const runStats = ref<RunStats | null>(null);

/* 充值码生成 */
const genCount = ref(1);
const genRuns = ref(10);
const generated = ref<string[]>([]);

/* 用户直充与搜索 */
const chargeUser = ref('');
const chargeRuns = ref(10);
const userSearch = ref('');

/* 充值码过滤 */
const codeFilter = ref<'all' | 'unused' | 'used'>('all');

/* ---------- 概览统计 ---------- */
const stats = computed(() => {
  const unusedCodes = codes.value.filter((c) => !c.usedAt);
  const soldRuns = codes.value.reduce((s, c) => s + c.runs, 0);
  const usedRuns = users.value.reduce((s, u) => s + u.usedRuns, 0);
  const remaining = users.value.reduce((s, u) => s + (u.totalRuns - u.usedRuns), 0);
  return {
    users: users.value.length,
    codes: codes.value.length,
    unusedCodes: unusedCodes.length,
    soldRuns,
    usedRuns,
    remaining,
  };
});

const recentCodes = computed(() => codes.value.slice(0, 6));
const recentUsers = computed(() => users.value.slice(0, 6));

const filteredUsers = computed(() => {
  const q = userSearch.value.trim().toLowerCase();
  const list = q ? users.value.filter((u) => u.username.toLowerCase().includes(q)) : users.value;
  // 剩余次数升序（快用完的排前面，便于跟进售卖）
  return [...list].sort((a, b) => a.totalRuns - a.usedRuns - (b.totalRuns - b.usedRuns));
});

const filteredCodes = computed(() => {
  if (codeFilter.value === 'unused') return codes.value.filter((c) => !c.usedAt);
  if (codeFilter.value === 'used') return codes.value.filter((c) => c.usedAt);
  return codes.value;
});

/* ---------- IP/UA 明细（老主站缺字段时兜底空数组） ---------- */
const ipSummary = computed(() => runStats.value?.ipSummary ?? []);
const visitorLog = computed(() => runStats.value?.visitorLog ?? []);
const runLog = computed(() => runStats.value?.runLog ?? []);

/* ---------- 展示辅助 ---------- */
/** ISO UTC → 本地时区 MM-DD HH:mm */
const fmtTime = (t: string): string => {
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return '-';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** UA 简析 → "浏览器 · 系统"；微信最先，Edge 含 Chrome 字样须先判，
 *  Chrome 含 Safari 字样须先判 Chrome；识别不出显示 UA 前 24 字符 */
const parseUa = (ua: string): string => {
  const s = ua || '';
  const browser = /MicroMessenger/i.test(s)
    ? '微信'
    : /Edg/i.test(s)
      ? 'Edge'
      : /Chrome/i.test(s)
        ? 'Chrome'
        : /Firefox/i.test(s)
          ? 'Firefox'
          : /Safari/i.test(s)
            ? 'Safari'
            : '';
  const os = /Windows/i.test(s)
    ? 'Windows'
    : /Android/i.test(s)
      ? 'Android'
      : /iPhone|iPad|iPod/i.test(s)
        ? 'iOS'
        : /Macintosh|Mac OS X/i.test(s)
          ? 'macOS'
          : '';
  if (browser && os) return `${browser} · ${os}`;
  return browser || os || (s ? s.slice(0, 24) : '-');
};

/* ---------- 数据操作（管理口令由服务端代理自动注入） ---------- */
const loadAll = async () => {
  loading.value = true;
  message.value = '';
  try {
    const [c, u, s] = await Promise.all([
      $fetch<{ ok: boolean; codes: CodeRow[] }>('/api/codes'),
      $fetch<{ ok: boolean; users: UserRow[] }>('/api/users'),
      $fetch<{ ok: boolean; stats: RunStats }>('/api/stats'),
    ]);
    codes.value = c.codes.slice().reverse();
    users.value = u.users.slice().reverse();
    runStats.value = s.stats;
  } catch {
    message.value = '数据加载失败：请确认主站服务已启动（localhost:3000）';
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  // 直链/书签支持：?tab=stats|codes|users|overview 初始化 tab（仅一次，非法值回退概览）
  const q = new URLSearchParams(window.location.search).get('tab');
  if (q === 'stats' || q === 'codes' || q === 'users' || q === 'overview') tab.value = q;
  loadAll();
});

const generate = async () => {
  loading.value = true;
  try {
    const res = await $fetch<{ ok: boolean; message: string; codes: CodeRow[] }>('/api/codes', {
      method: 'POST',
      body: { count: genCount.value, runs: genRuns.value },
    });
    generated.value = res.codes.map((c) => c.code);
    message.value = res.message;
    await loadAll();
  } catch {
    message.value = '生成失败';
  } finally {
    loading.value = false;
  }
};

const charge = async () => {
  loading.value = true;
  try {
    const res = await $fetch<{ ok: boolean; message: string }>('/api/users', {
      method: 'POST',
      body: { username: chargeUser.value.trim(), runs: chargeRuns.value },
    });
    message.value = res.message;
    if (res.ok) {
      chargeUser.value = '';
      await loadAll();
    }
  } catch (e: unknown) {
    const err = e as { data?: { message?: string } };
    message.value = err.data?.message ?? '充值失败';
  } finally {
    loading.value = false;
  }
};

const copyAll = async () => {
  try {
    await navigator.clipboard.writeText(generated.value.join('\n'));
    message.value = '已复制到剪贴板';
  } catch {
    message.value = '复制失败，请手动选择';
  }
};
</script>

<template>
  <!-- 左 sidebar + 右内容（免登录，管理口令由服务端代理注入） -->
  <div class="layout">
    <aside class="side">
      <div class="side-brand">
        龙猫跑轮
        <span>后台管理</span>
      </div>
      <nav class="side-nav">
        <button :class="{ on: tab === 'overview' }" @click="tab = 'overview'">概览</button>
        <button :class="{ on: tab === 'stats' }" @click="tab = 'stats'">使用统计</button>
        <button :class="{ on: tab === 'codes' }" @click="tab = 'codes'">充值码</button>
        <button :class="{ on: tab === 'users' }" @click="tab = 'users'">用户管理</button>
      </nav>
      <button class="side-refresh" :disabled="loading" @click="loadAll">↻ 刷新数据</button>
    </aside>

    <main class="main">
      <!-- ============ 概览 ============ -->
      <template v-if="tab === 'overview'">
        <div class="stat-grid">
          <div class="card stat">
            <span class="stat-num">{{ runStats?.today.visits ?? '—' }}</span>
            <span class="stat-label">今日访问</span>
          </div>
          <div class="card stat">
            <span class="stat-num">{{ runStats?.today.runUsers ?? '—' }}</span>
            <span class="stat-label">今日开跑人数</span>
          </div>
          <div class="card stat">
            <span class="stat-num">{{ runStats?.today.runs ?? '—' }}</span>
            <span class="stat-label">今日成功跑步次数</span>
          </div>
          <div class="card stat">
            <span class="stat-num">{{ runStats?.totals.visits ?? '—' }}</span>
            <span class="stat-label">累计访问</span>
          </div>
          <div class="card stat">
            <span class="stat-num">{{ runStats?.totals.runUsers ?? '—' }}</span>
            <span class="stat-label">累计开跑人数</span>
          </div>
          <div class="card stat">
            <span class="stat-num">{{ runStats?.totals.runs ?? '—' }}</span>
            <span class="stat-label">累计成功跑步次数</span>
          </div>
        </div>

        <div class="two-col">
          <section class="card">
            <h2>最近生成（{{ recentCodes.length }}）</h2>
            <table v-if="recentCodes.length">
              <thead>
                <tr><th>充值码</th><th>次数</th><th>状态</th></tr>
              </thead>
              <tbody>
                <tr v-for="c in recentCodes" :key="c.code">
                  <td class="mono">{{ c.code }}</td>
                  <td>{{ c.runs }}</td>
                  <td><b v-if="!c.usedAt">未使用</b><span v-else class="muted">已使用</span></td>
                </tr>
              </tbody>
            </table>
            <p v-else class="muted empty">还没有生成过充值码，去「充值码」页生成。</p>
          </section>

          <section class="card">
            <h2>最近注册（{{ recentUsers.length }}）</h2>
            <table v-if="recentUsers.length">
              <thead>
                <tr><th>用户名</th><th>剩余</th><th>注册</th></tr>
              </thead>
              <tbody>
                <tr v-for="u in recentUsers" :key="u.username">
                  <td>{{ u.username }}</td>
                  <td><b>{{ u.totalRuns - u.usedRuns }}</b></td>
                  <td class="muted">{{ u.createdAt.slice(0, 10) }}</td>
                </tr>
              </tbody>
            </table>
            <p v-else class="muted empty">还没有注册用户。</p>
          </section>
        </div>
      </template>

      <!-- ============ 使用统计 ============ -->
      <template v-if="tab === 'stats'">
        <section class="card">
          <h2>近 7 天统计</h2>
          <table v-if="runStats?.recent.length">
            <thead>
              <tr><th>日期</th><th>访问量</th><th>开跑人数</th><th>成功跑步次数</th></tr>
            </thead>
            <tbody>
              <tr v-for="d in runStats.recent" :key="d.day" :class="{ today: d.day === runStats.today.day }">
                <td>{{ d.day }}<span v-if="d.day === runStats.today.day" class="today-tag">今天</span></td>
                <td>{{ d.visits }}</td>
                <td><b>{{ d.runUsers }}</b></td>
                <td>{{ d.runs }}</td>
              </tr>
            </tbody>
          </table>
          <p v-else class="muted empty">暂无数据：有人访问网站并使用正式跑后，这里会出现记录。</p>
          <p class="muted note">口径说明：访问量按浏览器会话计；开跑人数按学号哈希去重；次数为服务端成绩提交成功的正式跑。</p>
        </section>

        <section class="card">
          <h2>访问 IP 汇总（近14天）</h2>
          <table v-if="ipSummary.length">
            <thead>
              <tr><th>IP</th><th>次数</th><th>最近访问</th><th>设备</th></tr>
            </thead>
            <tbody>
              <tr v-for="r in ipSummary" :key="r.ip">
                <td class="mono">{{ r.ip }}</td>
                <td><b>{{ r.visits }}</b></td>
                <td class="muted">{{ fmtTime(r.lastT) }}</td>
                <td>{{ parseUa(r.ua) }}</td>
              </tr>
            </tbody>
          </table>
          <p v-else class="muted empty">暂无访问 IP 记录（本次改造上线后的访问才会带上 IP）。</p>
        </section>

        <section class="card">
          <h2>访问明细（最近100）</h2>
          <table v-if="visitorLog.length">
            <thead>
              <tr><th>时间</th><th>IP</th><th>设备</th></tr>
            </thead>
            <tbody>
              <tr v-for="(r, i) in visitorLog" :key="`${r.t}-${i}`">
                <td class="muted">{{ fmtTime(r.t) }}</td>
                <td class="mono">{{ r.ip }}</td>
                <td>{{ parseUa(r.ua) }}</td>
              </tr>
            </tbody>
          </table>
          <p v-else class="muted empty">暂无访问明细。</p>
        </section>

        <section class="card">
          <h2>开跑记录（最近50）</h2>
          <table v-if="runLog.length">
            <thead>
              <tr><th>时间</th><th>IP</th><th>用户标识</th></tr>
            </thead>
            <tbody>
              <tr v-for="(r, i) in runLog" :key="`${r.t}-${i}`">
                <td class="muted">{{ fmtTime(r.t) }}</td>
                <td class="mono">{{ r.ip || '-' }}</td>
                <td class="mono" :title="r.user">{{ r.user.slice(0, 8) }}</td>
              </tr>
            </tbody>
          </table>
          <p v-else class="muted empty">暂无开跑记录。</p>
        </section>

        <p class="muted note">IP 来自访问信标与跑步提交；经代理/隧道访问时为出口 IP；明细保留 30 天；改造前的历史访问无 IP。</p>
      </template>

      <!-- ============ 充值码 ============ -->
      <template v-if="tab === 'codes'">
        <section class="card">
          <h2>生成充值码</h2>
          <div class="row">
            <label>数量 <input v-model.number="genCount" type="number" min="1" max="100" /></label>
            <label>每个次数 <input v-model.number="genRuns" type="number" min="1" /></label>
            <button class="btn primary" :disabled="loading" @click="generate">生成</button>
          </div>
          <div v-if="generated.length" class="generated">
            <div class="row">
              <b>新生成</b>
              <button class="btn small" @click="copyAll">复制全部</button>
            </div>
            <pre>{{ generated.join('\n') }}</pre>
          </div>
        </section>

        <section class="card">
          <div class="card-head">
            <h2>充值码（{{ filteredCodes.length }}）</h2>
            <div class="chips">
              <button :class="['chip', { on: codeFilter === 'all' }]" @click="codeFilter = 'all'">
                全部 {{ stats.codes }}
              </button>
              <button :class="['chip', { on: codeFilter === 'unused' }]" @click="codeFilter = 'unused'">
                未使用 {{ stats.unusedCodes }}
              </button>
              <button :class="['chip', { on: codeFilter === 'used' }]" @click="codeFilter = 'used'">
                已使用 {{ stats.codes - stats.unusedCodes }}
              </button>
            </div>
          </div>
          <table>
            <thead>
              <tr><th>充值码</th><th>次数</th><th>状态</th><th>使用者</th><th>生成</th></tr>
            </thead>
            <tbody>
              <tr v-for="c in filteredCodes" :key="c.code">
                <td class="mono">{{ c.code }}</td>
                <td>{{ c.runs }}</td>
                <td><b v-if="!c.usedAt">未使用</b><span v-else class="muted">已使用</span></td>
                <td>{{ c.usedBy || '-' }}</td>
                <td class="muted">{{ c.createdAt.slice(0, 10) }}</td>
              </tr>
            </tbody>
          </table>
          <p v-if="!filteredCodes.length" class="muted empty">暂无充值码。</p>
        </section>
      </template>

      <!-- ============ 用户管理 ============ -->
      <template v-if="tab === 'users'">
        <section class="card">
          <div class="card-head">
            <h2>用户（{{ filteredUsers.length }}）</h2>
            <input v-model="userSearch" class="search" placeholder="搜索用户名…" >
          </div>

          <div class="row charge-bar">
            <label>直充：用户名 <input v-model="chargeUser" placeholder="username" /></label>
            <label>次数（负数扣回） <input v-model.number="chargeRuns" type="number" /></label>
            <button
              class="btn primary"
              :disabled="loading || !chargeUser.trim()"
              @click="charge"
            >
              充值
            </button>
          </div>

          <table>
            <thead>
              <tr><th>用户名</th><th>剩余</th><th>累计 / 已用</th><th>注册</th><th>操作</th></tr>
            </thead>
            <tbody>
              <tr v-for="u in filteredUsers" :key="u.username">
                <td>{{ u.username }}</td>
                <td>
                  <b v-if="u.totalRuns - u.usedRuns > 0">{{ u.totalRuns - u.usedRuns }}</b>
                  <span v-else class="muted">0（已用完）</span>
                </td>
                <td>{{ u.totalRuns }} / {{ u.usedRuns }}</td>
                <td class="muted">{{ u.createdAt.slice(0, 10) }}</td>
                <td>
                  <button class="btn small" @click="chargeUser = u.username">选中直充</button>
                </td>
              </tr>
            </tbody>
          </table>
          <p v-if="!filteredUsers.length" class="muted empty">
            {{ userSearch ? '没有匹配的用户。' : '还没有注册用户。' }}
          </p>
        </section>
      </template>

      <p v-if="message" class="msg">{{ message }}</p>
    </main>
  </div>
</template>

<style>
body {
  margin: 0;
  background: #f5f5f7;
  font-family: -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  color: #111111;
}

/* ===== 布局：左 sidebar + 右内容 ===== */
.layout {
  display: flex;
  min-height: 100vh;
}
.side {
  background: #111111;
  color: #fff;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  min-height: 100vh;
  padding: 22px 14px;
  position: sticky;
  top: 0;
  width: 200px;
}
.side-brand {
  color: #fff;
  font-size: 17px;
  font-weight: 800;
  line-height: 1.3;
  padding: 4px 12px 18px;
}
.side-brand span {
  color: rgba(255, 255, 255, 0.45);
  display: block;
  font-size: 12px;
  font-weight: 500;
}
.side-nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.side-nav button {
  background: transparent;
  border: 0;
  border-radius: 10px;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  padding: 11px 14px;
  text-align: left;
  transition: background 160ms ease, color 160ms ease;
}
.side-nav button:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}
.side-nav button.on {
  background: #fff;
  color: #111111;
}
.side-refresh {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 10px;
  color: rgba(255, 255, 255, 0.65);
  cursor: pointer;
  font-size: 13px;
  margin-top: auto;
  padding: 10px 14px;
}
.side-refresh:hover {
  border-color: rgba(255, 255, 255, 0.4);
  color: #fff;
}
.main {
  box-sizing: border-box;
  flex: 1;
  max-width: 1080px;
  padding: 28px 32px 60px;
}

/* 窄屏：侧栏折叠为顶部横条 */
@media (max-width: 760px) {
  .layout {
    flex-direction: column;
  }
  .side {
    flex-direction: row;
    align-items: center;
    gap: 10px;
    min-height: 0;
    padding: 10px 14px;
    position: static;
    width: 100%;
  }
  .side-brand {
    padding: 0 4px 0 0;
  }
  .side-brand span {
    display: none;
  }
  .side-nav {
    flex-direction: row;
    overflow-x: auto;
  }
  .side-refresh {
    margin: 0 0 0 auto;
    white-space: nowrap;
  }
  .main {
    padding: 18px 16px 40px;
  }
}

/* ===== 口令门 ===== */
.gate-wrap {
  align-items: center;
  display: flex;
  justify-content: center;
  min-height: 100vh;
  padding: 20px;
}
.gate {
  width: 100%;
  max-width: 380px;
}
.gate h1 {
  font-size: 20px;
  margin: 0 0 6px;
}
.gate input {
  border: 1px solid #d9d9de;
  border-radius: 10px;
  box-sizing: border-box;
  display: block;
  font-size: 15px;
  margin-bottom: 12px;
  max-width: 340px;
  padding: 10px 12px;
  width: 100%;
}

/* ===== 统计表 ===== */
.today-tag {
  background: #111111;
  border-radius: 999px;
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  margin-left: 8px;
  padding: 2px 8px;
}
tr.today td {
  background: #fafafa;
}
.note {
  font-size: 12px;
  line-height: 1.6;
  margin: 10px 0 0;
}

/* ===== 卡片 ===== */
.card {
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 6px 24px rgb(17 17 17 / 6%);
  margin-bottom: 18px;
  padding: 20px;
}
.card h2 {
  font-size: 16px;
  margin: 0 0 12px;
}
.card-head {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: space-between;
  margin-bottom: 12px;
}
.card-head h2 {
  margin: 0;
}

/* ===== 概览统计 ===== */
.stat-grid {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  margin-bottom: 18px;
}
.stat {
  flex-direction: column;
  gap: 4px;
  margin-bottom: 0;
  padding: 18px 20px;
}
.stat-num {
  font-size: 30px;
  font-weight: 800;
  line-height: 1.1;
}
.stat-label {
  color: #757575;
  font-size: 12px;
}
.two-col {
  display: grid;
  gap: 18px;
  grid-template-columns: 1fr 1fr;
}
@media (max-width: 900px) {
  .two-col {
    grid-template-columns: 1fr;
  }
}

/* ===== 表单与控件 ===== */
.row {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-bottom: 8px;
}
.row label {
  align-items: center;
  display: inline-flex;
  font-size: 14px;
  gap: 6px;
}
.row input {
  border: 1px solid #d9d9de;
  border-radius: 8px;
  font-size: 14px;
  padding: 8px 10px;
  width: 110px;
}
.charge-bar {
  background: #f5f5f7;
  border-radius: 10px;
  margin-bottom: 14px;
  padding: 10px 14px;
}
.btn {
  background: #ececee;
  border: 0;
  border-radius: 999px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 700;
  padding: 10px 22px;
}
.btn.primary {
  background: #111111;
  color: #fff;
}
.btn.small {
  font-size: 12px;
  padding: 5px 14px;
}
.btn:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
.chips {
  display: flex;
  gap: 8px;
}
.chip {
  background: #fafafa;
  border: 1px solid #e2e2e6;
  border-radius: 999px;
  color: #6e6e6e;
  cursor: pointer;
  font-size: 13px;
  padding: 6px 14px;
}
.chip.on {
  background: #111111;
  border-color: #111111;
  color: #fff;
}
.search {
  border: 1px solid #d9d9de;
  border-radius: 999px;
  font-size: 14px;
  outline: none;
  padding: 8px 14px;
  width: 200px;
}
.search:focus {
  border-color: #111111;
}

/* ===== 表格 ===== */
table {
  border-collapse: collapse;
  font-size: 14px;
  width: 100%;
}
th,
td {
  border-bottom: 1px solid #ececef;
  padding: 8px 10px;
  text-align: left;
}
th {
  color: #757575;
  font-size: 12px;
}

/* ===== 杂项 ===== */
.mono {
  font-family: ui-monospace, Consolas, monospace;
}
.muted {
  color: #8c8c8c;
}
.msg {
  color: #111111;
  font-size: 14px;
}
.empty {
  font-size: 14px;
  padding: 18px 4px;
  text-align: center;
}
.generated pre {
  background: #f5f5f7;
  border-radius: 10px;
  font-size: 14px;
  overflow-x: auto;
  padding: 12px;
}
</style>
